import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashToken } from "@/lib/tokens";

/**
 * Unit tests for lib/accounts.ts with Prisma and the mail provider mocked.
 *
 * The behaviours worth pinning down here are the security ones — enumeration
 * resistance, single-use tokens, expiry — all of which are pure control flow and
 * do not need a real database to verify. Integration coverage against Postgres
 * comes with the Phase 4 test database.
 */

// Declared via vi.hoisted so they exist before the hoisted vi.mock factories run.
const { db, mail } = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    verificationToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mail: {
    sendVerificationEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: mail.sendVerificationEmail,
  sendPasswordResetEmail: mail.sendPasswordResetEmail,
}));

// Safe as a static import: vitest hoists the vi.mock calls above it.
import { registerPatient, verifyEmail, requestPasswordReset, resetPassword } from "@/lib/accounts";

const VALID_REGISTRATION = {
  firstName: "Jane",
  lastName: "Smith",
  email: "Jane@Example.com ",
  phone: "+61412345678",
  password: "Sup3rSecret!",
  confirmPassword: "Sup3rSecret!",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops) : Promise.resolve(),
  );
  db.user.create.mockResolvedValue({ id: "user-1" });
  db.verificationToken.create.mockResolvedValue({});
  db.verificationToken.deleteMany.mockResolvedValue({});
  db.passwordResetToken.create.mockResolvedValue({});
  db.passwordResetToken.deleteMany.mockResolvedValue({});
});

describe("registerPatient", () => {
  it("creates the user and sends a verification email", async () => {
    db.user.findUnique.mockResolvedValue(null);

    await registerPatient(VALID_REGISTRATION);

    expect(db.user.create).toHaveBeenCalledOnce();
    expect(mail.sendVerificationEmail).toHaveBeenCalledOnce();
  });

  it("normalises the email to lowercase and trims it", async () => {
    db.user.findUnique.mockResolvedValue(null);

    await registerPatient(VALID_REGISTRATION);

    expect(db.user.create.mock.calls[0][0].data.email).toBe("jane@example.com");
  });

  it("stores a bcrypt hash, never the password", async () => {
    db.user.findUnique.mockResolvedValue(null);

    await registerPatient(VALID_REGISTRATION);

    const { passwordHash } = db.user.create.mock.calls[0][0].data;
    expect(passwordHash).not.toBe(VALID_REGISTRATION.password);
    // $2a$/$2b$ prefix, cost 12 — docs/security.md allows no other cost.
    expect(passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it("defaults the account to PATIENT and unverified", async () => {
    db.user.findUnique.mockResolvedValue(null);

    await registerPatient(VALID_REGISTRATION);

    const { role, emailVerified } = db.user.create.mock.calls[0][0].data;
    expect(role).toBe("PATIENT");
    expect(emailVerified).toBe(false);
  });

  it("emails the raw token but stores only its hash", async () => {
    db.user.findUnique.mockResolvedValue(null);

    await registerPatient(VALID_REGISTRATION);

    const emailed = mail.sendVerificationEmail.mock.calls[0][1] as string;
    const stored = db.verificationToken.create.mock.calls[0][0].data.token as string;

    expect(stored).not.toBe(emailed);
    expect(stored).toBe(hashToken(emailed));
  });

  // ─── Enumeration resistance ──────────────────────────────────────────────

  it("does not throw or create when the address is already verified", async () => {
    db.user.findUnique.mockResolvedValue({ id: "existing", emailVerified: true });

    await expect(registerPatient(VALID_REGISTRATION)).resolves.toBeUndefined();

    expect(db.user.create).not.toHaveBeenCalled();
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("re-sends verification for an existing unverified address", async () => {
    db.user.findUnique.mockResolvedValue({ id: "existing", emailVerified: false });

    await registerPatient(VALID_REGISTRATION);

    expect(db.user.create).not.toHaveBeenCalled();
    expect(mail.sendVerificationEmail).toHaveBeenCalledOnce();
  });

  it("supersedes any earlier verification token", async () => {
    db.user.findUnique.mockResolvedValue(null);

    await registerPatient(VALID_REGISTRATION);

    expect(db.verificationToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});

describe("verifyEmail", () => {
  it("verifies and consumes a valid token", async () => {
    db.verificationToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      user: { emailVerified: false },
    });

    await expect(verifyEmail("raw")).resolves.toBe("verified");
    expect(db.$transaction).toHaveBeenCalledOnce();
  });

  it("looks the token up by hash, not by raw value", async () => {
    db.verificationToken.findUnique.mockResolvedValue(null);

    await verifyEmail("raw-token");

    expect(db.verificationToken.findUnique.mock.calls[0][0].where.token).toBe(
      hashToken("raw-token"),
    );
  });

  it("rejects an unknown token", async () => {
    db.verificationToken.findUnique.mockResolvedValue(null);
    await expect(verifyEmail("nope")).resolves.toBe("invalid");
  });

  it("rejects an expired token and deletes it", async () => {
    db.verificationToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "user-1",
      expiresAt: new Date(Date.now() - 1),
      user: { emailVerified: false },
    });
    db.verificationToken.delete.mockResolvedValue({});

    await expect(verifyEmail("stale")).resolves.toBe("invalid");
    expect(db.verificationToken.delete).toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("reports an already-verified account without re-verifying", async () => {
    db.verificationToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      user: { emailVerified: true },
    });
    db.verificationToken.delete.mockResolvedValue({});

    await expect(verifyEmail("again")).resolves.toBe("already-verified");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("requestPasswordReset", () => {
  it("sends a reset email for a known address", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user-1", passwordHash: "$2a$12$abc" });

    await requestPasswordReset("jane@example.com");

    expect(mail.sendPasswordResetEmail).toHaveBeenCalledOnce();
  });

  it("resolves silently for an unknown address", async () => {
    db.user.findUnique.mockResolvedValue(null);

    await expect(requestPasswordReset("nobody@example.com")).resolves.toBeUndefined();
    expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("resolves silently for an account with no password set", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user-1", passwordHash: null });

    await expect(requestPasswordReset("magic@example.com")).resolves.toBeUndefined();
    expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("stores only the hash of the reset token", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user-1", passwordHash: "$2a$12$abc" });

    await requestPasswordReset("jane@example.com");

    const emailed = mail.sendPasswordResetEmail.mock.calls[0][1] as string;
    expect(db.passwordResetToken.create.mock.calls[0][0].data.token).toBe(hashToken(emailed));
  });
});

describe("resetPassword", () => {
  it("rejects an unknown token", async () => {
    db.passwordResetToken.findUnique.mockResolvedValue(null);
    await expect(resetPassword("nope", "Sup3rSecret!")).rejects.toThrow(/invalid or has already/i);
  });

  it("rejects an expired token", async () => {
    db.passwordResetToken.findUnique.mockResolvedValue({
      id: "r1",
      userId: "user-1",
      expiresAt: new Date(Date.now() - 1),
    });
    db.passwordResetToken.delete.mockResolvedValue({});

    await expect(resetPassword("stale", "Sup3rSecret!")).rejects.toThrow(/expired/i);
  });

  it("writes a bcrypt hash at cost 12", async () => {
    db.passwordResetToken.findUnique.mockResolvedValue({
      id: "r1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await resetPassword("good", "Sup3rSecret!");

    const update = db.user.update.mock.calls[0][0];
    expect(update.data.passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it("marks the email verified — completing a reset proves mailbox control", async () => {
    db.passwordResetToken.findUnique.mockResolvedValue({
      id: "r1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await resetPassword("good", "Sup3rSecret!");

    // Without this, an unverified user could reset successfully and still be
    // locked out, because lib/auth.ts refuses unverified logins.
    expect(db.user.update.mock.calls[0][0].data.emailVerified).toBe(true);
  });

  it("consumes the token so it cannot be replayed", async () => {
    db.passwordResetToken.findUnique.mockResolvedValue({
      id: "r1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await resetPassword("good", "Sup3rSecret!");

    expect(db.passwordResetToken.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
  });
});
