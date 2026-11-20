import { describe, expect, it } from "vitest";
import { createAuthService, normalizeEmail } from "./authService.js";
import { hashPassword, verifyPassword } from "../security/password.js";
import { ValidationError } from "../errors/application-errors.js";

describe("account validation and password protection", () => {
  it("normalizes email consistently", () => {
    expect(normalizeEmail("  Cinefila@Example.Invalid  ")).toBe(
      "cinefila@example.invalid",
    );
  });

  it("accepts the approved password bounds and rejects invalid compositions", async () => {
    const repository = {
      create: () => undefined,
      findByEmail: () => undefined,
    };
    const service = createAuthService(repository);

    await expect(
      service.register({
        displayName: "Ana",
        email: "ana@example.invalid",
        password: "Abcdefg1",
      }),
    ).resolves.toEqual({ display_name: "Ana" });
    await expect(
      service.register({
        displayName: "A",
        email: "ana@example.invalid",
        password: "Abcdefg1",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.register({
        displayName: "Ana",
        email: "ana@example.invalid",
        password: "abcdefgh",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("stores a bcrypt hash at cost 10 without truncating long UTF-8 input", async () => {
    const password = "á".repeat(36);
    const passwordHash = await hashPassword(password);

    expect(passwordHash).toMatch(/^\$2[aby]\$10\$/);
    expect(passwordHash).not.toContain(password);
    await expect(verifyPassword(password, passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("otra contraseña", passwordHash)).resolves.toBe(
      false,
    );
  });
});
