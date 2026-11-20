import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Abre SQLite en la ruta recibida y activa sus claves foráneas.
 * Crea el directorio si hace falta y devuelve la conexión para servicios y migraciones.
 */
export function createDatabase(databasePath) {
  if (databasePath !== ":memory:") {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  return database;
}
