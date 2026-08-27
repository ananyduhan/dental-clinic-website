import { expect, test } from "@playwright/test";

import {
  ADMIN,
  E2E_MARKER,
  PATIENT,
  cleanupE2EData,
  prisma,
  seedAppointment,
  signIn,
  signOut,
} from "./fixtures";

/**
 * The three scenarios docs/booking-flow.md names.
 *
 * They drive the real UI against the seeded database. Everything created is
 * tagged with `E2E_MARKER` and removed afterwards, so a run leaves the seed
 * state untouched.
 */

test.afterEach(async () => {
  await cleanupE2EData();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("a patient books an appointment and sees it on the dashboard", async ({
  page,
}) => {
  await signIn(page, PATIENT);

  await page.goto("/book");

  // Step 1 — service.
  await expect(
    page.getByRole("heading", { name: "Choose a service" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /General Checkup/ }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 2 — dentist. "No preference" exercises the load-balancing path.
  await expect(
    page.getByRole("heading", { name: "Choose your dentist" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /No preference/ }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 3 — pick the first day the calendar will accept, then the first slot.
  await expect(
    page.getByRole("heading", { name: "Pick a date & time" }),
  ).toBeVisible();
  const slot = await pickFirstAvailableDay(page);
  expect(slot).not.toBeNull();
  await page.getByRole("button", { name: "Review Booking" }).click();

  // Step 4 — confirm, tagging the row so teardown can find it.
  await expect(
    page.getByRole("heading", { name: "Confirm your booking" }),
  ).toBeVisible();
  await page.fill("#notes", E2E_MARKER);
  await page.getByRole("button", { name: "Confirm Booking" }).click();

  // Step 5 — success.
  await expect(
    page.getByRole("heading", { name: /You.re all booked/ }),
  ).toBeVisible({
    timeout: 30_000,
  });

  // And it is really in the database, PENDING.
  const stored = await prisma.appointment.findFirstOrThrow({
    where: { notes: { contains: E2E_MARKER } },
  });
  expect(stored.status).toBe("PENDING");

  // The patient's own pages show it.
  await page.goto("/appointments");
  await expect(page.getByText(E2E_MARKER)).toBeVisible();
  await expect(page.getByText("Pending").first()).toBeVisible();
});

test("a patient cannot cancel an appointment less than 24 hours away", async ({
  page,
}) => {
  // The slot generator would never offer this, so it is inserted directly.
  await seedAppointment({ hoursFromNow: 12 });

  await signIn(page, PATIENT);
  await page.goto("/appointments");

  // The cancel button is withheld and the reason is stated in its place.
  await expect(
    page.getByText(/Within 24 hours of your appointment/).first(),
  ).toBeVisible();

  // Confirm the server refuses it too, not just the UI.
  const appointment = await prisma.appointment.findFirstOrThrow({
    where: { adminNotes: E2E_MARKER },
  });
  const response = await page.request.patch(
    `/api/appointments/${appointment.id}`,
    {
      data: { status: "CANCELLED" },
    },
  );
  expect(response.status()).toBe(422);
  expect(await response.json()).toMatchObject({
    error: { message: expect.stringContaining("24 hours") },
  });

  const stored = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointment.id },
  });
  expect(stored.status).toBe("CONFIRMED");
});

test("an admin confirms a booking and the patient sees the new status", async ({
  page,
}) => {
  const appointment = await seedAppointment({
    hoursFromNow: 72,
    status: "PENDING",
  });

  // The patient sees it as pending.
  await signIn(page, PATIENT);
  await page.goto("/appointments");
  await expect(page.getByText("Pending").first()).toBeVisible();

  // The admin confirms it.
  await signOut(page);
  await signIn(page, ADMIN);
  await page.goto("/admin/appointments");

  const response = await page.request.patch(
    `/api/admin/appointments/${appointment.id}`,
    {
      data: { status: "CONFIRMED" },
    },
  );
  expect(response.ok()).toBe(true);

  await expect(async () => {
    const stored = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(stored.status).toBe("CONFIRMED");
  }).toPass();

  // Back as the patient — the status has moved.
  await signOut(page);
  await signIn(page, PATIENT);
  await page.goto("/appointments");
  await expect(page.getByText("Confirmed").first()).toBeVisible();
});

/**
 * Click forward through the calendar until a day offers at least one slot.
 *
 * Which days have availability depends on the seeded roster, so the test asks
 * the UI rather than assuming. Returns the slot label it selected.
 */
async function pickFirstAvailableDay(page: import("@playwright/test").Page) {
  const dayButtons = page.locator("button.rdp-day_button:not([disabled])");
  const count = await dayButtons.count();

  for (let i = 0; i < Math.min(count, 14); i++) {
    await dayButtons.nth(i).click();

    // Wait for the slot request to settle, then look for a time button.
    const slots = page.locator("button[aria-pressed]", {
      hasText: /^\d{2}:\d{2}$/,
    });
    try {
      await expect(slots.first()).toBeVisible({ timeout: 8_000 });
    } catch {
      continue;
    }

    const label = await slots.first().textContent();
    await slots.first().click();
    return label;
  }

  return null;
}
