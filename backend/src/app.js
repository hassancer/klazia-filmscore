import cors from "cors";
import express from "express";
import session from "express-session";
import { createAuthService } from "./services/authService.js";
import { createAuthRoutes } from "./routes/authRoutes.js";
import { createTmdbService } from "./services/tmdbService.js";
import { createMovieRoutes } from "./routes/movieRoutes.js";
import { createUserRepository } from "./database/userRepository.js";
import { createErrorHandler } from "./middlewares/error-handler.js";
import { createRequestProtection } from "./middlewares/request-protection.js";
import {
  requireAuth,
  requireContributionAuth,
} from "./middlewares/require-auth.js";
import { createFavoriteRepository } from "./database/favoriteRepository.js";
import { createFavoriteService } from "./services/favoriteService.js";
import { createFavoriteRoutes } from "./routes/favoriteRoutes.js";
import { createContributionRepository } from "./database/contributionRepository.js";
import { createContributionService } from "./services/contributionService.js";
import { createContributionRoutes } from "./routes/contributionRoutes.js";

/**
 * Ensambla la API, sus servicios y middleware de seguridad.
 * Recibe configuración y SQLite; permite inyectar servicios y logger en pruebas.
 */
export function createApp({
  config,
  database,
  tmdbService,
  authService,
  logger = console,
}) {
  const app = express();
  const sessionSecret = config.sessionSecret;
  const frontendOrigin = config.frontendOrigin;
  const { csrfSynchronisedProtection, validateMutationOrigin } =
    createRequestProtection(frontendOrigin);

  // Se rechaza una clave ausente o menor de 32 bytes; no hay secreto predeterminado.
  if (!sessionSecret || Buffer.byteLength(sessionSecret, "utf8") < 32) {
    throw new Error("No se pudo iniciar el backend: falta SESSION_SECRET.");
  }

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: frontendOrigin,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  // MemoryStore es local y no persistente; la cookie HttpOnly/Lax renueva el timeout por actividad.
  app.use(
    session({
      name: "klazia.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: config.sessionIdleTimeoutMs,
      },
    }),
  );
  app.use(validateMutationOrigin);
  // La autenticación precede a CSRF en las rutas privadas para responder 401 sin sesión.
  app.use("/api/favoritos", requireAuth);
  app.use("/api/aportes", requireContributionAuth);
  // La protección CSRF se aplica a mutaciones; las lecturas GET no cambian estado.
  app.use(csrfSynchronisedProtection);

  // La inyección mantiene las mismas rutas probables sin requerir TMDB en pruebas.
  const resolvedAuthService =
    authService ?? createAuthService(createUserRepository(database));
  const resolvedTmdbService =
    tmdbService ??
    createTmdbService({
      accessToken: config.tmdbAccessToken,
      baseUrl: config.tmdbBaseUrl,
      timeoutMs: config.tmdbTimeoutMs,
    });
  const favoriteService = createFavoriteService(
    createFavoriteRepository(database),
  );
  const contributionService = createContributionService(
    createContributionRepository(database),
    logger,
  );

  // Estado operativo público para comprobar que la API está disponible.
  app.get("/api/status", (_request, response) => {
    response.json({ success: true, data: { status: "ok" } });
  });
  app.use("/api", createAuthRoutes(resolvedAuthService));
  app.use("/api", createMovieRoutes(resolvedTmdbService));
  app.use("/api", createFavoriteRoutes(favoriteService));
  app.use("/api", createContributionRoutes(contributionService));
  app.use((_request, response) => {
    response.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "No encontramos esa ruta." },
    });
  });
  app.use(createErrorHandler(logger));

  return app;
}
