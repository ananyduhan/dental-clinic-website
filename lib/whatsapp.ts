import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);
const FROM = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";

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

  await client.messages.create({
    from: FROM,
    to: normalised,
    body,
  });
}
