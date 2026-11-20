import { Router } from "express";
import { createMovieController } from "../controllers/movieController.js";

/** Enlaza las rutas públicas del catálogo con sus acciones del controlador. */
export function createMovieRoutes(tmdbService) {
  const router = Router();
  const controller = createMovieController(tmdbService);

  router.get("/peliculas", controller.search);
  router.get("/peliculas/:tmdbId", controller.getDetails);

  return router;
}
