import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "noreply@yourclinic.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${APP_URL}/api/auth/verify-email?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your email address",
    html: `<p>Click <a href="${url}">here</a> to verify your email. This link expires in 24 hours.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${APP_URL}/reset-password?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your password",
    html: `<p>Click <a href="${url}">here</a> to reset your password. This link expires in 1 hour.</p>`,
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
  await resend.emails.send({
    from: FROM,
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
  await resend.emails.send({
    from: FROM,
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
  await resend.emails.send({
    from: FROM,
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
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Appointment ${details.status}`,
    html: `
      <p>Hi ${details.patientName},</p>
      <p>Your appointment on ${details.date} at ${details.time} has been ${details.status.toLowerCase()}.</p>
    `,
  });
}
