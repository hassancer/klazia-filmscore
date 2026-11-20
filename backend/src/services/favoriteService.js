import {
  AuthenticationRequiredError,
  FavoriteAlreadyExistsError,
  FavoriteNotFoundError,
  FavoritePersistenceError,
  FavoriteReadError,
  ValidationError,
} from "../errors/application-errors.js";
import { validateTmdbPosterUrl } from "./movie-reference.js";

/** Impide que una operación privada llegue a persistencia sin identidad de sesión. */
function requireUserId(userId) {
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new AuthenticationRequiredError();
  }
}

/** Fija la fuente en TMDB y normaliza el snapshot antes de persistirlo. */
function validateFavorite(input) {
  if (
    !input ||
    input.movie_source !== "tmdb" ||
    typeof input.movie_source_id !== "string" ||
    !/^[1-9]\d*$/.test(input.movie_source_id.trim()) ||
    typeof input.movie_title !== "string" ||
    input.movie_title.trim().length === 0
  ) {
    throw new ValidationError(
      "No se puede guardar esa referencia de película.",
    );
  }

  return {
    movieSource: "tmdb",
    movieSourceId: input.movie_source_id.trim(),
    movieTitle: input.movie_title.trim(),
    posterUrl: validateTmdbPosterUrl(input.poster_url),
  };
}

/** Acepta únicamente IDs externos positivos; nunca interpreta el parámetro como user_id. */
function validateMovieSourceId(movieSourceId, message) {
  if (
    typeof movieSourceId !== "string" ||
    !/^[1-9]\d*$/.test(movieSourceId.trim())
  ) {
    throw new ValidationError(message);
  }

  return movieSourceId.trim();
}

/** Distingue la restricción de unicidad para traducirla al conflicto 409 del contrato. */
function isUniqueConstraint(error) {
  return (
    error?.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
    error?.code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}

/**
 * Implementa los casos de uso privados de Favoritos.
 * Valida snapshots, delega integridad a SQLite y normaliza fallos sin exponer SQL.
 */
export function createFavoriteService(favoriteRepository) {
  return {
    /** Consulta los snapshots propios; un error de SQLite nunca se transforma en lista vacía. */
    list(userId) {
      requireUserId(userId);
      try {
        return favoriteRepository.listForUser(userId);
      } catch {
        throw new FavoriteReadError();
      }
    },

    /** Devuelve el snapshot propio; ajeno e inexistente comparten 404 y no consulta TMDB. */
    get(userId, movieSourceId) {
      requireUserId(userId);
      const normalizedId = validateMovieSourceId(
        movieSourceId,
        "No se puede consultar ese favorito.",
      );

      let favorite;
      try {
        favorite = favoriteRepository.findForUser(userId, normalizedId);
      } catch {
        throw new FavoriteReadError();
      }

      if (!favorite) {
        throw new FavoriteNotFoundError();
      }

      return favorite;
    },

    /** Guarda el snapshot aprobado y distingue duplicado de otros fallos de persistencia. */
    create(userId, input) {
      requireUserId(userId);
      const favorite = validateFavorite(input);

      try {
        return favoriteRepository.create({
          userId,
          ...favorite,
        });
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new FavoriteAlreadyExistsError();
        }
        throw new FavoritePersistenceError();
      }
    },

    /** Retira únicamente la relación del usuario y no revela registros de otras cuentas. */
    remove(userId, movieSourceId) {
      requireUserId(userId);
      const normalizedId = validateMovieSourceId(
        movieSourceId,
        "No se puede quitar ese favorito.",
      );

      let removedCount;
      try {
        removedCount = favoriteRepository.removeForUser(userId, normalizedId);
      } catch {
        throw new FavoritePersistenceError();
      }

      if (removedCount === 0) {
        throw new FavoriteNotFoundError();
      }
    },
  };
}
