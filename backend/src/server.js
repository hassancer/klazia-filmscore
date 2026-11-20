import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { loadEnvironment } from "./config/environment.js";
import { createDatabase } from "./database/connection.js";

const backendRoot = fileURLToPath(new URL("../", import.meta.url));
dotenv.config({ path: path.join(backendRoot, ".env") });

// Carga configuración privada, SQLite y arranca la API solo en loopback.
function startServer() {
  let config;
  try {
    config = loadEnvironment();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  let database;
  try {
    database = createDatabase(config.databasePath);
  } catch {
    console.error(
      "No se pudo iniciar el backend por un error de persistencia local.",
    );
    process.exitCode = 1;
    return;
  }

  const app = createApp({ config, database });
  const server = app.listen(config.port, "127.0.0.1", () => {
    console.info(`Backend disponible en http://localhost:${config.port}.`);
  });

  const shutdown = () => {
    // Cierra primero el servidor para no interrumpir solicitudes en curso.
    server.close(() => {
      database.close();
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startServer();
