import twilio from "twilio";
import type { Twilio } from "twilio";

/**
 * WhatsApp reminders via Twilio.
 *
 * Client built on first send, for the same reason as lib/email.ts: `twilio()`
 * throws on missing credentials, and constructing it at module scope would break
 * the build for anyone importing this file without Twilio configured.
 */

const FROM = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";

let client: Twilio | null = null;

function getTwilio(): Twilio | null {
  if (client) return client;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;

  client = twilio(sid, token);
  return client;
}

export async function sendWhatsAppReminder(
  toPhone: string,
  details: {
    patientName: string;
    dentistName: string;
    service: string;
    date: string;
    time: string;
  },
) {
  const normalised = toPhone.startsWith("whatsapp:") ? toPhone : `whatsapp:${toPhone}`;
  const body = [
    `Hi ${details.patientName}! 👋`,
    `This is a reminder of your appointment tomorrow:`,
    `📋 Service: ${details.service}`,
    `👨‍⚕️ Dentist: ${details.dentistName}`,
    `📅 Date: ${details.date}`,
    `🕐 Time: ${details.time}`,
    `See you then!`,
  ].join("\n");

  const twilioClient = getTwilio();

  if (!twilioClient) {
    // The reminder cron treats a WhatsApp failure as non-fatal and still sends
    // the email (docs/booking-flow.md), so an unconfigured Twilio must surface
    // as a thrown error the caller can catch — not a silent success.
    throw new Error("Twilio is not configured — cannot send WhatsApp reminder");
  }

  await twilioClient.messages.create({
    from: FROM,
    to: normalised,
    body,
  });
}
