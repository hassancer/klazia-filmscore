import { Router } from "express";
import { createContributionController } from "../controllers/contributionController.js";

/** Registra las lecturas aprobadas y las mutaciones privadas de Aportes. */
export function createContributionRoutes(contributionService) {
  const router = Router();
  const controller = createContributionController(contributionService);

  router.get("/peliculas/:tmdbId/aportes", controller.listPublic);
  router.get("/aportes/propios", controller.listOwn);
  router.post("/aportes", controller.create);
  router.patch("/aportes/:id", controller.update);
  router.delete("/aportes/:id", controller.remove);

  return router;
}
