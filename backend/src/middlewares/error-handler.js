import {
  AuthenticationPersistenceError,
  AuthenticationRequiredError,
  CatalogUnavailableError,
  ContributionAlreadyExistsError,
  ContributionForbiddenError,
  ContributionNotFoundError,
  ContributionPersistenceError,
  ContributionReadError,
  AuthenticationRequiredForContributionError,
  DuplicateAccountError,
  FavoriteAlreadyExistsError,
  FavoriteNotFoundError,
  FavoritePersistenceError,
  FavoriteReadError,
  InvalidCredentialsError,
  MovieNotFoundError,
  RegistrationPersistenceError,
  ValidationError,
} from "../errors/application-errors.js";

const publicErrors = new Map([
  [ValidationError, (error) => [error.statusCode, error.code, error.message]],
  [
    DuplicateAccountError,
    (error) => [
      error.statusCode,
      error.code,
      "No se pudo crear la cuenta con ese correo.",
    ],
  ],
  [
    RegistrationPersistenceError,
    (error) => [
      error.statusCode,
      error.code,
      "No pudimos crear la cuenta en este momento. Inténtalo nuevamente.",
    ],
  ],
  [
    AuthenticationPersistenceError,
    () => [
      500,
      "AUTH_PERSISTENCE_ERROR",
      "No pudimos procesar el inicio de sesión. Inténtalo nuevamente.",
    ],
  ],
  [
    InvalidCredentialsError,
    (error) => [
      error.statusCode,
      error.code,
      "No pudimos iniciar sesión con esos datos.",
    ],
  ],
  [
    AuthenticationRequiredError,
    (error) => [
      error.statusCode,
      error.code,
      "Inicia sesión para administrar tus favoritos.",
    ],
  ],
  [
    AuthenticationRequiredForContributionError,
    (error) => [
      error.statusCode,
      error.code,
      "Inicia sesión para administrar tus aportes.",
    ],
  ],
  [
    ContributionAlreadyExistsError,
    (error) => [
      error.statusCode,
      error.code,
      "Ya tienes un aporte para esta película.",
    ],
  ],
  [
    ContributionForbiddenError,
    (error) => [
      error.statusCode,
      error.code,
      "No tienes permiso para modificar este aporte.",
    ],
  ],
  [
    ContributionNotFoundError,
    (error) => [
      error.statusCode,
      error.code,
      "No se encontró el aporte solicitado.",
    ],
  ],
  [
    ContributionPersistenceError,
    (error) => [
      error.statusCode,
      error.code,
      "No pudimos guardar el aporte. Inténtalo nuevamente.",
    ],
  ],
  [
    ContributionReadError,
    (error) => [
      error.statusCode,
      error.code,
      "No pudimos consultar los aportes. Inténtalo nuevamente.",
    ],
  ],
  [
    FavoriteAlreadyExistsError,
    (error) => [
      error.statusCode,
      error.code,
      "Ya está guardada en tus favoritos.",
    ],
  ],
  [
    FavoriteNotFoundError,
    (error) => [
      error.statusCode,
      error.code,
      "No encontramos ese favorito en tu lista.",
    ],
  ],
  [
    FavoritePersistenceError,
    (error) => [
      error.statusCode,
      error.code,
      "No pudimos guardar la información. Inténtalo nuevamente.",
    ],
  ],
  [
    FavoriteReadError,
    (error) => [
      error.statusCode,
      error.code,
      "No pudimos consultar tus favoritos. Inténtalo nuevamente.",
    ],
  ],
  [
    CatalogUnavailableError,
    (error) => [
      error.statusCode,
      error.code,
      error.statusCode === 504
        ? "La consulta tardó demasiado. Inténtalo nuevamente."
        : "El catálogo no está disponible en este momento. Inténtalo nuevamente.",
    ],
  ],
  [
    MovieNotFoundError,
    (error) => [error.statusCode, error.code, "No encontramos esa película."],
  ],
]);

/** Convierte excepciones internas conocidas en status, código y mensaje público. */
function getPublicError(error) {
  for (const [ErrorType, toResponse] of publicErrors) {
    if (error instanceof ErrorType) {
      return toResponse(error);
    }
  }

  if (error?.status === 403 || error?.code === "EBADCSRFTOKEN") {
    return [
      403,
      "CSRF_TOKEN_INVALID",
      "No se pudo validar la solicitud. Actualiza la página e inténtalo nuevamente.",
    ];
  }

  if (error?.status === 400 || error?.type === "entity.parse.failed") {
    return [400, "INVALID_REQUEST", "La solicitud no tiene un formato válido."];
  }

  return [
    500,
    "INTERNAL_ERROR",
    "No pudimos procesar la solicitud. Inténtalo nuevamente.",
  ];
}

/**
 * Crea el middleware que responde errores sin exponer detalles internos.
 * Los fallos 5xx se registran con un código saneado, no con credenciales o SQL.
 */
export function createErrorHandler(logger = console) {
  return function errorHandler(error, request, response, next) {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (
      error instanceof AuthenticationPersistenceError ||
      error instanceof RegistrationPersistenceError
    ) {
      // Evita renovar la cookie anónima si falló la persistencia de la cuenta.
      request.sessionID = undefined;
    }

    const [statusCode, code, message] = getPublicError(error);
    if (statusCode >= 500) {
      logger.error(
        JSON.stringify({
          event: "request_failed",
          code,
        }),
      );
    }

    response.status(statusCode).json({
      success: false,
      error: { code, message },
    });
  };
}
