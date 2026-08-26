import { Resend } from "resend";

/**
 * Transactional email via Resend.
 *
 * The client is created on first send, not at import time. `new Resend()` throws
 * when RESEND_API_KEY is unset, so building it at module scope meant that merely
 * importing this file without the key crashed the production build the moment a
 * route handler referenced it.
 */

const FROM = process.env.EMAIL_FROM ?? "noreply@yourclinic.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

let client: Resend | null = null;

function getResend(): Resend | null {
  if (client) return client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  client = new Resend(apiKey);
  return client;
}

interface Email {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send one email.
 *
 * With no API key configured: outside production the message is logged instead,
 * so the register → verify → login flow can be exercised locally without a
 * Resend account (the verification link is in the console). In production a
 * missing key is a real misconfiguration and throws, because silently dropping a
 * password-reset email is worse than a failed request.
 */
async function send({ to, subject, html }: Email): Promise<void> {
  const resend = getResend();

  if (!resend) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not configured — cannot send email");
    }
    console.info(
      `\n[email:dev] RESEND_API_KEY unset, not sending.\n  to: ${to}\n  subject: ${subject}\n  ${html.replace(/\s+/g, " ").trim()}\n`,
    );
    return;
  }

  await resend.emails.send({ from: FROM, to, subject, html });
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${APP_URL}/api/auth/verify-email?token=${token}`;
  await send({
    to,
    subject: "Verify your email address",
    html: `<p>Click <a href="${url}">here</a> to verify your email. This link expires in 24 hours.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${APP_URL}/reset-password?token=${token}`;
  await send({
    to,
    subject: "Reset your password",
    html: `<p>Click <a href="${url}">here</a> to reset your password. This link expires in 30 minutes.</p>`,
  });
}

export async function sendBookingConfirmationEmail(
  to: string,
  details: {
    patientName: string;
    dentistName: string;
    service: string;
    date: string;
    time: string;
  },
) {
  await send({
    to,
    subject: "Appointment Confirmed",
    html: `
      <p>Hi ${details.patientName},</p>
      <p>Your appointment has been booked:</p>
      <ul>
        <li><strong>Service:</strong> ${details.service}</li>
        <li><strong>Dentist:</strong> ${details.dentistName}</li>
        <li><strong>Date:</strong> ${details.date}</li>
        <li><strong>Time:</strong> ${details.time}</li>
      </ul>
      <p>We look forward to seeing you!</p>
    `,
  });
}

export async function sendAppointmentReminderEmail(
  to: string,
  details: {
    patientName: string;
    dentistName: string;
    service: string;
    date: string;
    time: string;
  },
) {
  await send({
    to,
    subject: "Appointment Reminder — Tomorrow",
    html: `
      <p>Hi ${details.patientName},</p>
      <p>This is a reminder that you have an appointment tomorrow:</p>
      <ul>
        <li><strong>Service:</strong> ${details.service}</li>
        <li><strong>Dentist:</strong> ${details.dentistName}</li>
        <li><strong>Date:</strong> ${details.date}</li>
        <li><strong>Time:</strong> ${details.time}</li>
      </ul>
    `,
  });
}

export async function sendCancellationEmail(
  to: string,
  details: { patientName: string; date: string; time: string },
) {
  await send({
    to,
    subject: "Appointment Cancelled",
    html: `
      <p>Hi ${details.patientName},</p>
      <p>Your appointment on ${details.date} at ${details.time} has been cancelled.</p>
      <p>Please rebook at your convenience.</p>
    `,
  });
}

export async function sendStatusUpdateEmail(
  to: string,
  details: { patientName: string; date: string; time: string; status: string },
) {
  await send({
    to,
    subject: `Appointment ${details.status}`,
    html: `
      <p>Hi ${details.patientName},</p>
      <p>Your appointment on ${details.date} at ${details.time} has been ${details.status.toLowerCase()}.</p>
    `,
  });
}
