// Errores de aplicación con status/código estables para que la API los traduzca sin filtrar detalles internos.
/** Error 400 para validaciones funcionales de entrada. */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
    this.code = "VALIDATION_ERROR";
  }
}

/** Conflicto 409: el correo ya pertenece a una cuenta. */
export class DuplicateAccountError extends Error {
  constructor() {
    super("An account already uses this email.");
    this.name = "DuplicateAccountError";
    this.statusCode = 409;
    this.code = "ACCOUNT_ALREADY_EXISTS";
  }
}

/** Error 500 saneado cuando SQLite no pudo guardar una cuenta. */
export class RegistrationPersistenceError extends Error {
  constructor() {
    super("Account persistence failed.");
    this.name = "RegistrationPersistenceError";
    this.statusCode = 500;
    this.code = "REGISTRATION_PERSISTENCE_ERROR";
  }
}

/** Error 500 saneado cuando SQLite no pudo consultar credenciales. */
export class AuthenticationPersistenceError extends Error {
  constructor() {
    super("Authentication persistence failed.");
    this.name = "AuthenticationPersistenceError";
    this.statusCode = 500;
    this.code = "AUTH_PERSISTENCE_ERROR";
  }
}

/** Error 401 genérico para no revelar si el correo existe. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid credentials.");
    this.name = "InvalidCredentialsError";
    this.statusCode = 401;
    this.code = "INVALID_CREDENTIALS";
  }
}

/** Error 503/504 del catálogo; distingue indisponibilidad de timeout. */
export class CatalogUnavailableError extends Error {
  constructor(statusCode = 503) {
    super("The catalog provider is unavailable.");
    this.name = "CatalogUnavailableError";
    this.statusCode = statusCode;
    this.code = statusCode === 504 ? "TMDB_TIMEOUT" : "TMDB_UNAVAILABLE";
  }
}

/** Error 404 cuando el ID solicitado no corresponde a una película. */
export class MovieNotFoundError extends Error {
  constructor() {
    super("The requested movie was not found.");
    this.name = "MovieNotFoundError";
    this.statusCode = 404;
    this.code = "MOVIE_NOT_FOUND";
  }
}

/** Error 401 para operaciones privadas sin una identidad de sesión válida. */
export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
    this.statusCode = 401;
    this.code = "AUTHENTICATION_REQUIRED";
  }
}

/** Conflicto 409 cuando la cuenta ya guardó la misma referencia TMDB. */
export class FavoriteAlreadyExistsError extends Error {
  constructor() {
    super("The favorite already exists.");
    this.name = "FavoriteAlreadyExistsError";
    this.statusCode = 409;
    this.code = "FAVORITE_ALREADY_EXISTS";
  }
}

/** Error 404 que no revela si el Favorito existe para otra cuenta. */
export class FavoriteNotFoundError extends Error {
  constructor() {
    super("The favorite was not found for this account.");
    this.name = "FavoriteNotFoundError";
    this.statusCode = 404;
    this.code = "FAVORITE_NOT_FOUND";
  }
}

/** Error 500 saneado para fallos de lectura o escritura de Favoritos. */
export class FavoritePersistenceError extends Error {
  constructor() {
    super("Favorite persistence failed.");
    this.name = "FavoritePersistenceError";
    this.statusCode = 500;
    this.code = "FAVORITE_PERSISTENCE_ERROR";
  }
}

/** Error 500 saneado para fallos al leer uno o varios Favoritos. */
export class FavoriteReadError extends Error {
  constructor() {
    super("Favorite list read failed.");
    this.name = "FavoriteReadError";
    this.statusCode = 500;
    this.code = "FAVORITE_READ_ERROR";
  }
}

/** Error 401 para las operaciones privadas de Aportes. */
export class AuthenticationRequiredForContributionError extends Error {
  constructor() {
    super("Contribution authentication is required.");
    this.name = "AuthenticationRequiredForContributionError";
    this.statusCode = 401;
    this.code = "AUTHENTICATION_REQUIRED";
  }
}

/** Conflicto 409 cuando el autor ya aportó a esa película. */
export class ContributionAlreadyExistsError extends Error {
  constructor() {
    super("The contribution already exists.");
    this.name = "ContributionAlreadyExistsError";
    this.statusCode = 409;
    this.code = "CONTRIBUTION_ALREADY_EXISTS";
  }
}

/** Error 403 para impedir mutaciones de aportes ajenos. */
export class ContributionForbiddenError extends Error {
  constructor() {
    super("The contribution belongs to another author.");
    this.name = "ContributionForbiddenError";
    this.statusCode = 403;
    this.code = "CONTRIBUTION_FORBIDDEN";
  }
}

/** Error 404 para aportes ausentes sin incluir datos privados. */
export class ContributionNotFoundError extends Error {
  constructor() {
    super("The contribution was not found.");
    this.name = "ContributionNotFoundError";
    this.statusCode = 404;
    this.code = "CONTRIBUTION_NOT_FOUND";
  }
}

/** Error 500 saneado ante fallos al escribir Aportes. */
export class ContributionPersistenceError extends Error {
  constructor() {
    super("Contribution persistence failed.");
    this.name = "ContributionPersistenceError";
    this.statusCode = 500;
    this.code = "CONTRIBUTION_PERSISTENCE_ERROR";
  }
}

/** Error 500 saneado ante fallos de lectura de Aportes. */
export class ContributionReadError extends Error {
  constructor() {
    super("Contribution read failed.");
    this.name = "ContributionReadError";
    this.statusCode = 500;
    this.code = "CONTRIBUTION_READ_ERROR";
  }
}
