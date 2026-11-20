import { Router } from "express";
import { csrfSync } from "csrf-sync";
import { createAuthController } from "../controllers/authController.js";

const { generateToken } = csrfSync();

/** Registra las rutas de CSRF, registro, inicio y cierre de sesión. */
export function createAuthRoutes(authService) {
  const router = Router();
  const controller = createAuthController(authService);

  // El navegador obtiene este token antes de enviar operaciones que cambian estado.
  router.get("/csrf-token", (request, response) => {
    response.json({ csrfToken: generateToken(request) });
  });
  router.post("/cuentas", controller.register);
  router.post("/sesiones", controller.login);
  router.delete("/sesiones", controller.logout);

  return router;
}
