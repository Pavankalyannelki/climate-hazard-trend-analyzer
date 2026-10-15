import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { climateAnalyses, climateDataSources, climateObservations } from '@/lib/db/schema'

type OpenMeteoGeocodingResult = {
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
}

type OpenMeteoArchive = {
  daily?: {
    time?: string[]
    temperature_2m_max?: Array<number | null>
  }
  timezone?: string
}

type Observation = { date: string; value: number }

type DataQuality = {
  requestedDays: number
  observedDays: number
  missingDays: number
  completeness: number
  source: string
}

const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0
}

const daysBetween = (startYear: number, endYear: number): number => {
  const start = Date.UTC(startYear, 0, 1)
  const end = Date.UTC(endYear + 1, 0, 1)
  return Math.round((end - start) / 86_400_000)
}

async function fetchJson<T>(url: string, revalidate: number): Promise<T> {
  const response = await fetch(url, { next: { revalidate } })
  if (!response.ok) throw new Error(`Open-Meteo request failed with status ${response.status}`)
  return response.json() as Promise<T>
}

async function resolveLocation(location: string): Promise<OpenMeteoGeocodingResult> {
  const query = encodeURIComponent(location)
  const geo = await fetchJson<{ results?: OpenMeteoGeocodingResult[] }>(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=en&format=json`, 86_400)
  const place = geo.results?.[0]
  if (!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) throw new Error('Location not found')
  return place
}

async function getObservations(place: OpenMeteoGeocodingResult, startYear: number, endYear: number) {
  const coverageStart = `${startYear}-01-01`
  const coverageEnd = `${endYear}-12-31`
  const sourceWhere = and(
    eq(climateDataSources.provider, 'Open-Meteo'),
    eq(climateDataSources.dataset, 'ERA5 reanalysis'),
    eq(climateDataSources.latitude, place.latitude),
    eq(climateDataSources.longitude, place.longitude),
    eq(climateDataSources.coverageStart, coverageStart),
    eq(climateDataSources.coverageEnd, coverageEnd),
  )
  const cached = await db.select().from(climateDataSources).where(sourceWhere).limit(1)
  if (cached[0]) {
    const rows = await db.select().from(climateObservations).where(eq(climateObservations.sourceId, cached[0].id))
    return { rows: rows.flatMap((row) => row.temperatureMax === null ? [] : [{ date: row.observationDate, value: row.temperatureMax }]), quality: cached[0].quality as DataQuality }
  }

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${place.latitude}&longitude=${place.longitude}&start_date=${coverageStart}&end_date=${coverageEnd}&daily=temperature_2m_max&timezone=auto`
  const archive = await fetchJson<OpenMeteoArchive>(url, 3_600)
  const dates = archive.daily?.time ?? []
  const values = archive.daily?.temperature_2m_max ?? []
  if (dates.length !== values.length || dates.length === 0) throw new Error('Open-Meteo returned no aligned daily observations')

  const rows: Observation[] = []
  dates.forEach((date, index) => {
    const value = values[index]
    if (typeof value === 'number' && Number.isFinite(value)) rows.push({ date, value })
  })
  const quality: DataQuality = {
    requestedDays: daysBetween(startYear, endYear),
    observedDays: rows.length,
    missingDays: Math.max(0, daysBetween(startYear, endYear) - rows.length),
    completeness: Number((rows.length / daysBetween(startYear, endYear)).toFixed(4)),
    source: 'Open-Meteo Historical Weather API · ERA5 reanalysis',
  }
  const [source] = await db.insert(climateDataSources).values({ provider: 'Open-Meteo', dataset: 'ERA5 reanalysis', latitude: place.latitude, longitude: place.longitude, timezone: archive.timezone ?? 'auto', coverageStart, coverageEnd, quality }).onConflictDoNothing().returning()
  const persistedSource = source ?? (await db.select().from(climateDataSources).where(sourceWhere).limit(1))[0]
  if (!persistedSource) throw new Error('Unable to persist source metadata')
  await db.insert(climateObservations).values(rows.map((row) => ({ sourceId: persistedSource.id, observationDate: row.date, temperatureMax: row.value, rawPayload: { date: row.date, temperature_2m_max: row.value } }))).onConflictDoNothing()
  return { rows, quality }
}

function summarize(rows: Observation[], startYear: number, endYear: number) {
  const threshold = percentile(rows.map((row) => row.value), 0.95)
  const byYear = new Map<number, { values: number[]; events: number; days: number }>()
  const events: Array<{ start: string; end: string; duration: number; peak: string; severity: string }> = []
  let run: Observation[] = []
  const finishRun = () => {
    if (run.length >= 3) {
      const peak = Math.max(...run.map((item) => item.value))
      events.push({ start: run[0].date, end: run[run.length - 1].date, duration: run.length, peak: `${peak.toFixed(1)}°C`, severity: peak >= threshold + 5 ? 'Severe' : peak >= threshold + 2 ? 'High' : 'Moderate' })
      const year = Number(run[0].date.slice(0, 4))
      const item = byYear.get(year)
      if (item) item.events += 1
    }
    run = []
  }
  rows.forEach((row) => {
    const year = Number(row.date.slice(0, 4))
    const item = byYear.get(year) ?? { values: [], events: 0, days: 0 }
    item.values.push(row.value)
    if (row.value >= threshold) { item.days += 1; run.push(row) } else finishRun()
    byYear.set(year, item)
  })
  finishRun()
  const annual = Array.from({ length: endYear - startYear + 1 }, (_, index) => {
    const year = startYear + index
    const item = byYear.get(year) ?? { values: [], events: 0, days: 0 }
    return { year, events: item.events, days: item.days, mean: item.values.length ? Number((item.values.reduce((sum, value) => sum + value, 0) / item.values.length).toFixed(1)) : null }
  })
  return { annual, events, threshold: Number(threshold.toFixed(1)) }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const query = url.searchParams.get('q')?.trim()
  if (query) {
    if (query.length < 2) return NextResponse.json([])
    const geo = await fetchJson<{ results?: OpenMeteoGeocodingResult[] }>(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`, 86_400)
    return NextResponse.json((geo.results ?? []).map((place) => ({ name: place.name, state: place.admin1 ?? '', country: place.country ?? '', latitude: place.latitude, longitude: place.longitude })))
  }
  const analyses = await db.select().from(climateAnalyses).orderBy(desc(climateAnalyses.updatedAt))
  return NextResponse.json(analyses)
}

export async function POST(request: Request) {
  const body = await request.json() as { location?: unknown; city?: unknown; name?: unknown; startYear?: unknown; endYear?: unknown }
  const location = String(body.location ?? body.city ?? '').trim()
  const name = String(body.name ?? `${location || 'Climate'} heatwave analysis`).trim()
  const startYear = Number(body.startYear)
  const endYear = Number(body.endYear)
  if (!location || !Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear >= endYear || startYear < 1940 || endYear > new Date().getFullYear()) return NextResponse.json({ error: 'Provide a location and a valid historical year range.' }, { status: 400 })
  try {
    const place = await resolveLocation(location)
    const { rows, quality } = await getObservations(place, startYear, endYear)
    if (rows.length === 0) throw new Error('No valid temperature observations were returned')
    const climate = { ...summarize(rows, startYear, endYear), quality, location: { city: place.name, state: place.admin1 ?? '', country: place.country ?? '', latitude: place.latitude, longitude: place.longitude }, source: quality.source }
    const [analysis] = await db.insert(climateAnalyses).values({ name, location: [place.name, place.admin1, place.country].filter(Boolean).join(', '), startYear, endYear, hazard: 'Heatwave', status: 'completed', payload: { ...climate, parameters: { location, startYear, endYear } } }).returning()
    return NextResponse.json({ ...analysis, climate }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load weather data.' }, { status: 502 })
  }
}

export async function DELETE(request: Request) {
  const body = await request.json() as { id?: unknown }
  const id = Number(body.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'A valid analysis id is required.' }, { status: 400 })
  const [deleted] = await db.delete(climateAnalyses).where(eq(climateAnalyses.id, id)).returning({ id: climateAnalyses.id })
  if (!deleted) return NextResponse.json({ error: 'Analysis not found.' }, { status: 404 })
  return NextResponse.json({ deleted: true, id: deleted.id })
}

export async function PATCH(request: Request) {
  const body = await request.json() as { id?: unknown }
  const id = Number(body.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'A valid analysis id is required.' }, { status: 400 })
  const [source] = await db.select().from(climateAnalyses).where(eq(climateAnalyses.id, id)).limit(1)
  if (!source) return NextResponse.json({ error: 'Analysis not found.' }, { status: 404 })
  const [duplicate] = await db.insert(climateAnalyses).values({ name: `${source.name} (Copy)`, location: source.location, startYear: source.startYear, endYear: source.endYear, hazard: source.hazard, status: 'completed', payload: source.payload }).returning()
  return NextResponse.json(duplicate, { status: 201 })
}
