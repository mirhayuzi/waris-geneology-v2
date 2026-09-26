import { describe, it, expect } from "vitest";
import { formatDate, isYearOnly, parseDate } from "../dates";

describe("parseDate", () => {
  it("parses a full date", () => {
    expect(parseDate("1950-03-02")).toEqual({ year: 1950, month: 3, day: 2 });
  });

  it("parses a year-only date", () => {
    expect(parseDate("1920")).toEqual({ year: 1920 });
  });

  it("returns null for unknown formats", () => {
    expect(parseDate("02/03/1950")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("isYearOnly", () => {
  it("detects year-only values", () => {
    expect(isYearOnly("1920")).toBe(true);
    expect(isYearOnly("1920-01-01")).toBe(false);
  });
});

describe("formatDate", () => {
  it("formats a full date in English and Malay", () => {
    expect(formatDate("1950-03-02", "en")).toBe("2 March 1950");
    expect(formatDate("1950-03-02", "bm")).toBe("2 Mac 1950");
  });

  it("shows only the year for a year-only date", () => {
    expect(formatDate("1920", "en")).toBe("1920");
  });

  it("returns an empty string for missing values and passes unknown formats through", () => {
    expect(formatDate(undefined, "en")).toBe("");
    expect(formatDate("sometime in 1920", "en")).toBe("sometime in 1920");
  });
});
