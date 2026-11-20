import { ValidationError } from "../errors/application-errors.js";

const TMDB_IMAGE_HOST = "image.tmdb.org";
const INVALID_POSTER_MESSAGE =
  "No se puede guardar esa referencia de película.";

/** Valida el snapshot opcional de póster compartido por Favoritos y Aportes. */
export function validateTmdbPosterUrl(posterUrl) {
  if (posterUrl === undefined || posterUrl === null) {
    return null;
  }

  if (typeof posterUrl !== "string") {
    throw new ValidationError(INVALID_POSTER_MESSAGE);
  }

  try {
    const url = new URL(posterUrl);
    if (
      url.protocol !== "https:" ||
      url.hostname !== TMDB_IMAGE_HOST ||
      url.username ||
      url.password ||
      !url.pathname.startsWith("/t/p/w500/") ||
      url.search ||
      url.hash
    ) {
      throw new Error("Invalid TMDB image URL.");
    }
  } catch {
    throw new ValidationError(INVALID_POSTER_MESSAGE);
  }

  return posterUrl;
}
