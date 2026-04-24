import { describe, it, expect } from "vitest";
import { generateSlots, filterBookedSlots, filterPastSlots, timesOverlap } from "@/lib/slots";

describe("generateSlots", () => {
  it("generates the correct number of 30-minute slots", () => {
    const date = new Date("2025-06-01");
    const slots = generateSlots("09:00", "11:00", 30, date);
    expect(slots).toHaveLength(4);
    expect(slots[0].startTime).toBe("09:00");
    expect(slots[0].endTime).toBe("09:30");
    expect(slots[3].startTime).toBe("10:30");
  });

  it("generates correct 60-minute slots", () => {
    const date = new Date("2025-06-01");
    const slots = generateSlots("09:00", "12:00", 60, date);
    expect(slots).toHaveLength(3);
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it("generates no slots when window is smaller than duration", () => {
    const date = new Date("2025-06-01");
    const slots = generateSlots("09:00", "09:20", 30, date);
    expect(slots).toHaveLength(0);
  });
});

describe("filterBookedSlots", () => {
  it("marks overlapping slots as unavailable", () => {
    const date = new Date("2025-06-01");
    const slots = generateSlots("09:00", "12:00", 30, date);
    const booked = [{ startTime: "10:00", endTime: "10:30" }];
    const result = filterBookedSlots(slots, booked);
    const unavailable = result.filter((s) => !s.available);
    expect(unavailable).toHaveLength(1);
    expect(unavailable[0].startTime).toBe("10:00");
  });

  it("does not mark non-overlapping slots as unavailable", () => {
    const date = new Date("2025-06-01");
    const slots = generateSlots("09:00", "12:00", 30, date);
    const booked = [{ startTime: "13:00", endTime: "13:30" }];
    const result = filterBookedSlots(slots, booked);
    expect(result.every((s) => s.available)).toBe(true);
  });
});

describe("filterPastSlots", () => {
  it("marks past slots as unavailable when referenceDate is today", () => {
    const today = new Date("2025-06-01T10:00:00.000Z");
    const slots = generateSlots("08:00", "12:00", 60, today);
    const result = filterPastSlots(slots, today, today);
    const past = result.filter((s) => !s.available);
    expect(past.length).toBeGreaterThan(0);
  });

  it("does not filter slots for a future date", () => {
    const today = new Date("2025-06-01");
    const future = new Date("2025-06-03");
    const slots = generateSlots("09:00", "12:00", 30, future);
    const result = filterPastSlots(slots, future, today);
    expect(result.every((s) => s.available)).toBe(true);
  });
});

describe("timesOverlap", () => {
  it("returns true for overlapping ranges", () => {
    expect(timesOverlap("09:00", "10:00", "09:30", "10:30")).toBe(true);
    expect(timesOverlap("09:00", "10:00", "08:30", "09:30")).toBe(true);
  });

  it("returns false for non-overlapping ranges", () => {
    expect(timesOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
    expect(timesOverlap("10:00", "11:00", "09:00", "10:00")).toBe(false);
  });
});
