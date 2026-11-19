import { describe, expect, it } from "vitest";
import { loadEnvironment } from "./environment.js";

describe("backend environment", () => {
  it("requires a SESSION_SECRET with at least 32 bytes", () => {
    expect(() => loadEnvironment({ SESSION_SECRET: "" })).toThrow(
      "No se pudo iniciar el backend: falta SESSION_SECRET.",
    );
    expect(() => loadEnvironment({ SESSION_SECRET: "short" })).toThrow(
      "No se pudo iniciar el backend: falta SESSION_SECRET.",
    );
  });

  it("uses default timeouts and database path when environment values are absent", () => {
    const config = loadEnvironment({ SESSION_SECRET: "s".repeat(32) });

    expect(config.sessionIdleTimeoutMs).toBe(1_800_000);
    expect(config.tmdbTimeoutMs).toBe(4_000);
    expect(config.frontendOrigin).toBe("http://localhost:5173");
    expect(config.databasePath).toMatch(
      /FilmScore\\backend\\data\\klazia\.db$/,
    );
  });

  it("reads a valid positive integer TMDB timeout from the environment", () => {
    const config = loadEnvironment({
      SESSION_SECRET: "s".repeat(32),
      TMDB_TIMEOUT_MS: "2500",
    });

    expect(config.tmdbTimeoutMs).toBe(2_500);
  });

  it("uses the default TMDB timeout for invalid text", () => {
    const config = loadEnvironment({
      SESSION_SECRET: "s".repeat(32),
      TMDB_TIMEOUT_MS: "not-a-number",
    });

    expect(config.tmdbTimeoutMs).toBe(4_000);
  });

  it.each(["0", "-1"])(
    "uses the default TMDB timeout for non-positive value %s",
    (value) => {
      const config = loadEnvironment({
        SESSION_SECRET: "s".repeat(32),
        TMDB_TIMEOUT_MS: value,
      });

      expect(config.tmdbTimeoutMs).toBe(4_000);
    },
  );

  it("uses the default TMDB timeout for a non-integer value", () => {
    const config = loadEnvironment({
      SESSION_SECRET: "s".repeat(32),
      TMDB_TIMEOUT_MS: "2500.5",
    });

    expect(config.tmdbTimeoutMs).toBe(4_000);
  });
});
