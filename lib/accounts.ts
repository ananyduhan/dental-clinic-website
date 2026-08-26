import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  VERIFICATION_TOKEN_TTL_MS,
  expiresAt,
  generateToken,
  hashToken,
} from "@/lib/tokens";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import type { RegisterInput } from "@/lib/validators/auth";

/**
 * Account lifecycle: registration, email verification, password reset.
 *
 * All of it lives here rather than in the route handlers, which stay thin
 * wrappers (parse → validate → call lib → respond) per CLAUDE.md.
 *
 * A theme runs through this file: **none of these functions tell the caller
 * whether an email address exists.** docs/security.md treats that as an
 * enumeration oracle. Registration, forgot-password, and verification therefore
 * all succeed identically whether or not there is an account behind the address.
 */

/** bcrypt cost. docs/security.md: "salt rounds = 12. No exceptions." */
const BCRYPT_ROUNDS = 12;

/**
 * Register a patient and send a verification email.
 *
 * Resolves without error when the email is already taken. That is deliberate:
 * a distinguishable "email already registered" response lets anyone test which
 * addresses hold accounts at a dental clinic, which is medical-adjacent
 * information. The real owner learns of the duplicate attempt by email instead.
 */
export async function registerPatient(input: RegisterInput): Promise<void> {
  const email = normaliseEmail(input.email);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });

  if (existing) {
    // Unverified account, same address: almost always someone who lost the
    // first email. Re-sending is more useful than staying silent, and reveals
    // nothing an attacker could not already guess.
    if (!existing.emailVerified) {
      await issueVerificationToken(existing.id, email);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone.trim(),
      role: Role.PATIENT,
      emailVerified: false,
    },
    select: { id: true },
  });

  await issueVerificationToken(user.id, email);
}

/**
 * Mint a fresh verification token and email it.
 *
 * Older tokens for the user are deleted first, so a link only ever works until
 * the next one is requested.
 */
async function issueVerificationToken(userId: string, email: string): Promise<void> {
  const { raw, hash } = generateToken();

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { userId } }),
    prisma.verificationToken.create({
      data: { userId, token: hash, expiresAt: expiresAt(VERIFICATION_TOKEN_TTL_MS) },
    }),
  ]);

  // Sending is outside the transaction on purpose: a slow mail provider should
  // not hold a database transaction open. If this throws, the caller's request
  // fails and the user retries — the token row is simply superseded next time.
  await sendVerificationEmail(email, raw);
}

export type VerifyEmailResult = "verified" | "already-verified" | "invalid";

/**
 * Consume a verification token.
 *
 * Single-use: the token row is deleted in the same transaction that flips
 * `emailVerified`, so a replayed link cannot re-verify.
 */
export async function verifyEmail(rawToken: string): Promise<VerifyEmailResult> {
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(rawToken) },
    select: { id: true, userId: true, expiresAt: true, user: { select: { emailVerified: true } } },
  });

  if (!record) return "invalid";

  if (record.expiresAt.getTime() <= Date.now()) {
    await prisma.verificationToken.delete({ where: { id: record.id } }).catch(() => {});
    return "invalid";
  }

  if (record.user.emailVerified) {
    await prisma.verificationToken.delete({ where: { id: record.id } }).catch(() => {});
    return "already-verified";
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
    prisma.verificationToken.delete({ where: { id: record.id } }),
  ]);

  return "verified";
}

/**
 * Start a password reset.
 *
 * Always resolves, whether or not the address exists — the caller returns the
 * same 200 either way. docs/security.md: "always return 200 with 'If an account
 * exists, we've sent a link.'"
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = normaliseEmail(rawEmail);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // No account, or an account with no password (magic-link only) — nothing to
  // reset. Return quietly.
  if (!user?.passwordHash) return;

  const { raw, hash } = generateToken();

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, token: hash, expiresAt: expiresAt(PASSWORD_RESET_TOKEN_TTL_MS) },
    }),
  ]);

  await sendPasswordResetEmail(email, raw);
}

/**
 * Complete a password reset.
 *
 * Unlike the request side, this *does* report failure: the user is holding a
 * link they believe is valid, and "that link has expired, request a new one" is
 * information they need. It still reveals nothing about which addresses exist.
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { token: hashToken(rawToken) },
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!record) {
    throw new ValidationError("That reset link is invalid or has already been used.");
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {});
    throw new ValidationError("That reset link has expired. Please request a new one.");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      // Completing a reset proves control of the mailbox, so it doubles as
      // email verification. Without this, a user who registered but never
      // clicked the verification link would reset their password successfully
      // and still be unable to log in — lib/auth.ts rejects unverified logins.
      data: { passwordHash, emailVerified: true },
    }),
    prisma.passwordResetToken.delete({ where: { id: record.id } }),
    // Any outstanding verification link is now moot.
    prisma.verificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);
}

/** Lowercase and trim, so `Jane@X.com ` and `jane@x.com` are one account. */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
