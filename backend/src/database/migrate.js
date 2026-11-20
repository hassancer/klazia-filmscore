import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createDatabase } from "./connection.js";
import { resolveDatabasePath } from "../config/environment.js";

const migrationsDirectory = fileURLToPath(
  new URL("./migrations/", import.meta.url),
);
const backendRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Aplica en orden las migraciones SQL aún no registradas.
 * Cada archivo y su registro se confirman juntos para no dejar el esquema a medias.
 */
export function runMigrations(database, directory = migrationsDirectory) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const applied = database
    .prepare("SELECT migration_name FROM schema_migrations")
    .all()
    .map((row) => row.migration_name);
  const appliedNames = new Set(applied);
  const migrationFiles = readdirSync(directory)
    // Solo se ejecutan archivos con el formato y nombre aprobados para migraciones.
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/i.test(name))
    .sort();

  for (const migrationName of migrationFiles) {
    if (appliedNames.has(migrationName)) {
      continue;
    }

    const sql = readFileSync(path.join(directory, migrationName), "utf8");
    // Una transacción hace que el cambio de esquema y su marca sean atómicos.
    const applyMigration = database.transaction(() => {
      database.exec(sql);
      database
        .prepare("INSERT INTO schema_migrations (migration_name) VALUES (?)")
        .run(migrationName);
    });

    applyMigration();
  }

  return migrationFiles.filter(
    (migrationName) => !appliedNames.has(migrationName),
  );
}

/** Punto de entrada CLI; carga .env, ejecuta migraciones y siempre cierra SQLite. */
function main() {
  dotenv.config({ path: path.join(backendRoot, ".env") });
  const database = createDatabase(resolveDatabasePath());

  try {
    const applied = runMigrations(database);
    console.info(
      applied.length
        ? `Migraciones aplicadas: ${applied.length}.`
        : "La base de datos ya está actualizada.",
    );
  } finally {
    database.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
