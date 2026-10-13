
import { describe, expect, it } from "vitest";
import {
  summarize,
  type Observation,
} from "../lib/climate/summarize";

function makeRows(
  start: string,
  end: string,
  hotDates: string[] = [],
  missingDates: string[] = [],
): Observation[] {
  const hot = new Set(hotDates);
  const missing = new Set(missingDates);
  const rows: Observation[] = [];

  const date = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (date <= last) {
    const day = date.toISOString().slice(0, 10);

    if (!missing.has(day)) {
      rows.push({
        date: day,
        value: hot.has(day) ? 40 : 20,
      });
    }

    date.setUTCDate(date.getUTCDate() + 1);
  }

  return rows;
}

describe("summarize", () => {
  it("rejects empty observations", () => {
    expect(() => summarize([], 2000, 2000)).toThrow(
      "No valid observations available for analysis",
    );
  });

  it("detects three consecutive qualifying days", () => {
    const rows = makeRows(
      "2000-01-01",
      "2000-04-30",
      ["2000-01-10", "2000-01-11", "2000-01-12"],
    );

    const result = summarize(rows, 2000, 2000);

    expect(result.annual[0].events).toBe(1);
    expect(result.annual[0].days).toBe(3);
  });

  it("does not count a two-day run as a heatwave", () => {
    const rows = makeRows(
      "2000-01-01",
      "2000-04-30",
      ["2000-01-10", "2000-01-11"],
    );

    const result = summarize(rows, 2000, 2000);

    expect(result.annual[0].events).toBe(0);
    expect(result.annual[0].days).toBe(0);
  });

  it("breaks a run when a calendar date is missing", () => {
    const rows = makeRows(
      "2000-01-01",
      "2000-04-30",
      ["2000-01-10", "2000-01-11", "2000-01-13"],
      ["2000-01-12"],
    );

    const result = summarize(rows, 2000, 2000);

    expect(result.annual[0].events).toBe(0);
    expect(result.annual[0].days).toBe(0);
  });

  it("attributes a cross-year event to its start year", () => {
    const rows = makeRows(
      "2020-01-01",
      "2021-12-31",
      ["2020-12-30", "2020-12-31", "2021-01-01"],
    );

    const result = summarize(rows, 2020, 2021);

    expect(result.annual[0]).toMatchObject({
      year: 2020,
      events: 1,
      days: 2,
    });

    expect(result.annual[1]).toMatchObject({
      year: 2021,
      events: 0,
      days: 1,
    });
  });

  it("calculates an increasing annual event trend", () => {
    const rows = makeRows(
      "2018-01-01",
      "2020-12-31",
      [
        "2019-01-10", "2019-01-11", "2019-01-12",
        "2020-01-10", "2020-01-11", "2020-01-12",
        "2020-02-10", "2020-02-11", "2020-02-12",
      ],
    );

    const result = summarize(rows, 2018, 2020);

    expect(result.annual.map((item) => item.events)).toEqual([0, 1, 2]);
    expect(result.trend.direction).toBe("increasing");
    expect(result.trend.slopePerYear).toBeGreaterThan(0);
  });
});
