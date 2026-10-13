
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  summarize,
  type Observation,
} from "@/lib/climate/summarize";

type GeocodingResult = {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

type OpenMeteoArchive = {
  daily?: {
    time?: string[];
    temperature_2m_max?: Array<number | null>;
  };
  timezone?: string;
};



type DataQuality = {
  requestedDays: number;
  observedDays: number;
  missingDays: number;
  completeness: number;
  source: string;
};



async function fetchJson<T>(
  url: string,
  revalidate: number,
): Promise<T> {
  const response = await fetch(url, {
    next: { revalidate },
  });

  if (!response.ok) {
    const details = await response.text();

    console.error("External weather API error:", {
      status: response.status,
      details,
    });

    throw new Error(
      `External weather API request failed (${response.status}).`,
    );
  }

  return response.json() as Promise<T>;
}



async function resolveLocation(
  location: string,
): Promise<GeocodingResult> {
  const query = encodeURIComponent(location);

  // First, try Open-Meteo geocoding.
  const geo = await fetchJson<{ results?: GeocodingResult[] }>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=10&language=en&format=json`,
    86_400,
  );

  const results = geo.results ?? [];

  // Prefer a result with valid coordinates.
  const place = results.find(
    (result) =>
      Number.isFinite(result.latitude) &&
      Number.isFinite(result.longitude),
  );

  if (place) {
    return place;
  }

  // Fallback for state or region names such as Karnataka.
  const fallbackUrl = new URL(
    "https://nominatim.openstreetmap.org/search",
  );

  fallbackUrl.searchParams.set("q", `${location}, India`);
  fallbackUrl.searchParams.set("format", "jsonv2");
  fallbackUrl.searchParams.set("limit", "1");

  const response = await fetch(fallbackUrl.toString(), {
    headers: {
      "User-Agent": "ClimateHazardTrendAnalyzer/1.0",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (response.ok) {
    const fallbackResults = (await response.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    const fallbackPlace = fallbackResults[0];
    const latitude = Number(fallbackPlace?.lat);
    const longitude = Number(fallbackPlace?.lon);

    if (
      fallbackPlace &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      return {
        name: fallbackPlace.display_name,
        latitude,
        longitude,
      } as GeocodingResult;
    }
  }

  throw new Error(
    `Location not found: ${location}. Try a city name such as Bengaluru.`,
  );
}



async function getObservations(
  place: GeocodingResult,
  startYear: number,
  endYear: number,
) {
  const coverageStart = `${startYear}-01-01`;
  const requestedEnd = `${endYear}-12-31`;

  // Use a conservative five-day buffer for recent archive data.
  const latestAvailableDate = new Date();
  latestAvailableDate.setUTCDate(
    latestAvailableDate.getUTCDate() - 5,
  );

  const latestAvailable = latestAvailableDate
    .toISOString()
    .slice(0, 10);

  // Never request future dates.
  const coverageEnd =
    requestedEnd > latestAvailable
      ? latestAvailable
      : requestedEnd;

  if (coverageEnd < coverageStart) {
    throw new Error(
      "The selected date range has no available historical dates.",
    );
  }

  // Count calendar days in the actual date range, including both endpoints.
  const requestedDays =
    Math.floor(
      (
        new Date(`${coverageEnd}T00:00:00Z`).getTime() -
        new Date(`${coverageStart}T00:00:00Z`).getTime()
      ) /
        86_400_000,
    ) + 1;

  // Reuse cached data only when it covers the actual requested dates.
  const cached = await prisma.weatherDataSource.findFirst({
    where: {
      provider: "Open-Meteo",
      dataset: "ERA5 reanalysis",
      latitude: place.latitude,
      longitude: place.longitude,
      coverageStart: { lte: coverageStart },
      coverageEnd: { gte: coverageEnd },
    },
    include: { observations: true },
  });

  if (cached) {
    const rows: Observation[] = cached.observations
      .filter(
        (row) =>
          row.observationDate >= coverageStart &&
          row.observationDate <= coverageEnd &&
          row.temperatureMax !== null &&
          Number.isFinite(row.temperatureMax),
      )
      .map((row) => ({
        date: row.observationDate,
        value: row.temperatureMax as number,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const quality: DataQuality = {
      requestedDays,
      observedDays: rows.length,
      missingDays: Math.max(0, requestedDays - rows.length),
      completeness: Number(
        (rows.length / requestedDays).toFixed(4),
      ),
      source:
        "Open-Meteo Historical Weather API · ERA5 reanalysis",
    };

    return { rows, quality };
  }

  // Fetch historical daily maximum temperatures.
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${place.latitude}` +
    `&longitude=${place.longitude}` +
    `&start_date=${coverageStart}` +
    `&end_date=${coverageEnd}` +
    `&daily=temperature_2m_max&timezone=auto`;

  const archive = await fetchJson<OpenMeteoArchive>(url, 3_600);

  const dates = archive.daily?.time ?? [];
  const values = archive.daily?.temperature_2m_max ?? [];

  if (dates.length !== values.length || dates.length === 0) {
    throw new Error(
      "Open-Meteo returned no aligned daily observations.",
    );
  }

  const rows: Observation[] = [];

  dates.forEach((date, index) => {
    const value = values[index];

    if (
      date >= coverageStart &&
      date <= coverageEnd &&
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      rows.push({ date, value });
    }
  });

  if (rows.length === 0) {
    throw new Error(
      "Open-Meteo returned no valid temperatures for the selected period.",
    );
  }

  const quality: DataQuality = {
    requestedDays,
    observedDays: rows.length,
    missingDays: Math.max(0, requestedDays - rows.length),
    completeness: Number(
      (rows.length / requestedDays).toFixed(4),
    ),
    source:
      "Open-Meteo Historical Weather API · ERA5 reanalysis",
  };

  // Store the actual fetched coverage, not the original future end date.
  const source = await prisma.weatherDataSource.create({
    data: {
      provider: "Open-Meteo",
      dataset: "ERA5 reanalysis",
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: archive.timezone ?? "auto",
      coverageStart,
      coverageEnd,
      quality: JSON.parse(JSON.stringify(quality)),
      observations: {
        create: rows.map((row) => ({
          observationDate: row.date,
          temperatureMax: row.value,
          rawPayload: {
            date: row.date,
            temperature_2m_max: row.value,
          },
        })),
      },
    },
    include: { observations: true },
  });

  return {
    rows: source.observations.flatMap((row) =>
      row.temperatureMax === null
        ? []
        : [
            {
              date: row.observationDate,
              value: row.temperatureMax,
            },
          ],
    ),
    quality,
  };
}



export async function GET() {
  try {
    const analyses = await prisma.climateAnalysis.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(analyses);
  } catch {
    return NextResponse.json(
      { error: "Unable to retrieve analyses." },
      { status: 500 },
    );
  }
}


export async function POST(request: Request) {
  try {
    
let body: {
  location?: unknown;
  city?: unknown;
  name?: unknown;
  startYear?: unknown;
  endYear?: unknown;
};

const rawBody = await request.text();

console.log("POST raw body:", JSON.stringify(rawBody));

try {
  body = JSON.parse(rawBody);
} catch {
  return NextResponse.json(
    { error: "Invalid JSON request body." },
    { status: 400 },
  );
}


    const location = String(body.location ?? body.city ?? "").trim();
    const name = String(
      body.name ?? `${location || "Climate"} heatwave analysis`,
    ).trim();

    const startYear = Number(body.startYear);
    const endYear = Number(body.endYear);
    const currentYear = new Date().getFullYear();

    // Validate the input before calling external APIs.
    if (
      !location ||
      location.length > 150 ||
      !Number.isInteger(startYear) ||
      !Number.isInteger(endYear) ||
      startYear < 1940 ||
      endYear > currentYear ||
      startYear >= endYear ||
      endYear - startYear > 100 ||
      !name ||
      name.length > 200
    ) {
      return NextResponse.json(
        {
          error:
            "Provide a location (maximum 150 characters), a name (maximum 200 characters), and a valid historical year range.",
        },
        { status: 400 },
      );
    }

    const place = await resolveLocation(location);

    const { rows, quality } = await getObservations(
      place,
      startYear,
      endYear,
    );

    if (rows.length === 0) {
      throw new Error("No valid temperature observations were returned");
    }

    const climate = {
      ...summarize(rows, startYear, endYear),
      quality,
      location: {
        city: place.name,
        state: place.admin1 ?? "",
        country: place.country ?? "",
        latitude: place.latitude,
        longitude: place.longitude,
      },
      source: quality.source,
    };

    const analysis = await prisma.climateAnalysis.create({
      data: {
        name,
        location: [place.name, place.admin1, place.country]
          .filter(Boolean)
          .join(", "),
        startYear,
        endYear,
        hazard: "Heatwave",
        status: "completed",
        payload: JSON.parse(
          JSON.stringify({
            ...climate,
            parameters: { location, startYear, endYear },
          }),
        ),
      },
    });

    return NextResponse.json(
      { ...analysis, climate },
      { status: 201 },
    );
  
  } catch (error) {
    console.error("Climate analysis failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to complete climate analysis.";

    const isLocationError = message.startsWith("Location not found:");

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: isLocationError ? 400 : 500,
      },
    );
  }
}


export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: unknown };
    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "A valid analysis id is required." },
        { status: 400 },
      );
    }

    const source = await prisma.climateAnalysis.findUnique({
      where: { id },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Analysis not found." },
        { status: 404 },
      );
    }

    const duplicate = await prisma.climateAnalysis.create({
      data: {
        name: `${source.name} (Copy)`,
        location: source.location,
        startYear: source.startYear,
        endYear: source.endYear,
        hazard: source.hazard,
        status: "completed",
        payload: source.payload === null
          ? undefined
          : JSON.parse(JSON.stringify(source.payload)),
      },
    });

    return NextResponse.json(duplicate, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Unable to duplicate analysis." },
      { status: 500 },
    );
  }
}
