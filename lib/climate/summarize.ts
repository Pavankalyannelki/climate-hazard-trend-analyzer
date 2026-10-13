
export type Observation = {
  date: string;
  value: number;
};

export const percentile = (
  values: number[],
  p: number,
): number => {
  const sorted = [...values].sort((a, b) => a - b);

  return (
    sorted[
      Math.min(
        sorted.length - 1,
        Math.floor((sorted.length - 1) * p),
      )
    ] ?? 0
  );
};

export function summarize(
  inputRows: Observation[],
  startYear: number,
  endYear: number,
) {
  const rows = [...inputRows].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  if (rows.length === 0) {
    throw new Error("No valid observations available for analysis");
  }

  const threshold = percentile(
    rows.map((row) => row.value),
    0.95,
  );

  type YearSummary = {
    values: number[];
    events: number;
    days: number;
  };

  const byYear = new Map<number, YearSummary>();

  for (let year = startYear; year <= endYear; year++) {
    byYear.set(year, {
      values: [],
      events: 0,
      days: 0,
    });
  }

  for (const row of rows) {
    const year = Number(row.date.slice(0, 4));
    const summary = byYear.get(year);

    if (summary) {
      summary.values.push(row.value);
    }
  }

  let run: Observation[] = [];
  let previousDate: string | null = null;

  const finishRun = () => {
    if (run.length >= 3) {
      const eventYear = Number(run[0].date.slice(0, 4));
      const eventYearSummary = byYear.get(eventYear);

      if (eventYearSummary) {
        eventYearSummary.events += 1;
      }

      for (const day of run) {
        const dayYear = Number(day.date.slice(0, 4));
        const daySummary = byYear.get(dayYear);

        if (daySummary) {
          daySummary.days += 1;
        }
      }
    }

    run = [];
  };

  for (const row of rows) {
    const currentTimestamp = Date.parse(`${row.date}T00:00:00Z`);

    const previousTimestamp = previousDate
      ? Date.parse(`${previousDate}T00:00:00Z`)
      : null;

    const isConsecutive =
      previousTimestamp !== null &&
      currentTimestamp - previousTimestamp === 86_400_000;

    if (run.length > 0 && !isConsecutive) {
      finishRun();
    }

    if (row.value > threshold) {
      run.push(row);
    } else {
      finishRun();
    }

    previousDate = row.date;
  }

  finishRun();

  const annual = Array.from(
    { length: endYear - startYear + 1 },
    (_, index) => {
      const year = startYear + index;
      const item = byYear.get(year)!;

      return {
        year,
        events: item.events,
        days: item.days,
        mean:
          item.values.length > 0
            ? Number(
                (
                  item.values.reduce((sum, value) => sum + value, 0) /
                  item.values.length
                ).toFixed(1),
              )
            : null,
      };
    },
  );

  const n = annual.length;

  const meanYear =
    annual.reduce((sum, item) => sum + item.year, 0) / n;

  const meanEvents =
    annual.reduce((sum, item) => sum + item.events, 0) / n;

  const numerator = annual.reduce(
    (sum, item) =>
      sum + (item.year - meanYear) * (item.events - meanEvents),
    0,
  );

  const denominator = annual.reduce(
    (sum, item) => sum + (item.year - meanYear) ** 2,
    0,
  );

  const eventTrendPerYear =
    denominator === 0 ? 0 : numerator / denominator;

  return {
    annual,
    threshold: Number(threshold.toFixed(1)),
    trend: {
      metric: "annual_heatwave_events",
      slopePerYear: Number(eventTrendPerYear.toFixed(4)),
      direction:
        eventTrendPerYear > 0
          ? ("increasing" as const)
          : eventTrendPerYear < 0
            ? ("decreasing" as const)
            : ("stable" as const),
    },
  };
}
