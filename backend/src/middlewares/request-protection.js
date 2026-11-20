import { csrfSync } from "csrf-sync";

/**
 * Crea defensas para solicitudes que modifican estado.
 * Exige el origen exacto del frontend y valida tokens CSRF en el middleware asociado.
 */
export function createRequestProtection(frontendOrigin) {
  const { csrfSynchronisedProtection } = csrfSync();

  // El origen se compara antes de procesar mutaciones, además del token CSRF.
  function validateMutationOrigin(request, response, next) {
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
      request.get("origin") !== frontendOrigin
    ) {
      response.status(403).json({
        success: false,
        error: {
          code: "ORIGIN_NOT_ALLOWED",
          message: "No se pudo procesar la solicitud.",
        },
      });
      return;
    }

    next();
  }

  return {
    csrfSynchronisedProtection,
    validateMutationOrigin,
  };
}
