import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));

/** Resuelve DATABASE_PATH absoluto, relativo a la raíz del proyecto o predeterminado. */
export function resolveDatabasePath(env = process.env) {
  const databaseSetting = env.DATABASE_PATH ?? "backend/data/klazia.db";
  return path.isAbsolute(databaseSetting)
    ? databaseSetting
    : path.resolve(projectRoot, databaseSetting);
}

/** Convierte una variable a entero positivo o rechaza configuración inválida. */
function positiveInteger(value, fallback, variableName) {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid ${variableName} configuration.`);
  }
  return parsed;
}

function positiveIntegerOrDefault(value, defaultValue) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

/**
 * Lee y valida la configuración del proceso.
 * Exige un secreto de sesión de al menos 32 bytes y no devuelve secretos TMDB vacíos.
 */
export function loadEnvironment(env = process.env) {
  const sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret || Buffer.byteLength(sessionSecret, "utf8") < 32) {
    throw new Error("No se pudo iniciar el backend: falta SESSION_SECRET.");
  }

  return {
    databasePath: resolveDatabasePath(env),
    frontendOrigin: env.FRONTEND_ORIGIN ?? "http://localhost:5173",
    port: positiveInteger(env.PORT, 3000, "PORT"),
    sessionIdleTimeoutMs: positiveInteger(
      env.SESSION_IDLE_TIMEOUT_MS,
      1_800_000,
      "SESSION_IDLE_TIMEOUT_MS",
    ),
    sessionSecret,
    tmdbAccessToken: env.TMDB_ACCESS_TOKEN?.trim() || null,
    tmdbBaseUrl: env.TMDB_BASE_URL ?? "https://api.themoviedb.org/3",
    tmdbTimeoutMs: positiveIntegerOrDefault(env.TMDB_TIMEOUT_MS, 4_000),
  };
}
