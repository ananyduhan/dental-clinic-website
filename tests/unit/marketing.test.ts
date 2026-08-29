import { describe, it, expect } from "vitest";

import {
  dentistCardStyle,
  initialsOf,
  serviceMarketing,
} from "@/lib/marketing";

describe("serviceMarketing", () => {
  it.each([
    ["General Checkup", "🦷", false],
    ["Teeth Cleaning", "🪥", true],
    ["Teeth Whitening", "✨", true],
  ])("maps the seeded service %s", (name, icon, isPopular) => {
    expect(serviceMarketing(name)).toEqual({ icon, isPopular });
  });

  it("falls back to a presentable default for an unmapped service", () => {
    // The admin UI can create a service the map has never heard of. The card
    // still has to render, so the fallback must be a real icon, not "".
    const marketing = serviceMarketing("Wisdom Tooth Extraction");

    expect(marketing.icon).not.toBe("");
    expect(marketing.isPopular).toBe(false);
  });

  it("does not inherit properties from Object.prototype", () => {
    // The lookup is a plain object literal, so a service named "constructor"
    // must not resolve to a function.
    expect(serviceMarketing("constructor").isPopular).toBe(false);
    expect(typeof serviceMarketing("toString").icon).toBe("string");
  });
});

describe("dentistCardStyle", () => {
  it("gives the first four cards four different styles", () => {
    // The whole reason the style is taken from the list position rather than a
    // hash of the id: with three dentists over four buckets, a hash collides
    // more often than not, and two identical cards read as a bug.
    const headers = [0, 1, 2, 3].map((i) => dentistCardStyle(i).header);

    expect(new Set(headers).size).toBe(4);
  });

  it("wraps around rather than running off the end", () => {
    expect(dentistCardStyle(4)).toEqual(dentistCardStyle(0));
    expect(dentistCardStyle(9)).toEqual(dentistCardStyle(1));
  });

  it("is stable for the same position", () => {
    expect(dentistCardStyle(2)).toBe(dentistCardStyle(2));
  });

  it("always yields a usable style, including for a nonsense index", () => {
    for (const index of [0, 3, 1000, -1, 1.5, Number.NaN]) {
      const style = dentistCardStyle(index);

      expect(style.header).toMatch(/^bg-/);
      expect(style.medallion).toBeTruthy();
      expect(style.initials).toMatch(/^text-/);
    }
  });
});

describe("initialsOf", () => {
  it.each([
    ["Priya", "Patel", "PP"],
    ["sarah", "chen", "SC"],
  ])("builds initials from %s %s", (first, last, expected) => {
    expect(initialsOf(first, last)).toBe(expected);
  });

  it("degrades rather than throwing on a missing name part", () => {
    expect(initialsOf("Cher", "")).toBe("C");
    expect(initialsOf("", "")).toBe("");
  });
});
