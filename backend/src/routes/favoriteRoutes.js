import { Router } from "express";
import { createFavoriteController } from "../controllers/favoriteController.js";

/** Registra únicamente las operaciones autorizadas del módulo de Favoritos. */
export function createFavoriteRoutes(favoriteService) {
  const router = Router();
  const controller = createFavoriteController(favoriteService);

  router.get("/favoritos", controller.list);
  router.get("/favoritos/:id", controller.get);
  router.post("/favoritos", controller.create);
  router.delete("/favoritos/:id", controller.remove);

  return router;
}
