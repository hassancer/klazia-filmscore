import {
  AuthenticationRequiredForContributionError,
  ContributionAlreadyExistsError,
  ContributionForbiddenError,
  ContributionNotFoundError,
  ContributionPersistenceError,
  ContributionReadError,
  ValidationError,
} from "../errors/application-errors.js";
import { validateTmdbPosterUrl } from "./movie-reference.js";

const PRIVATE_CONTRIBUTION_MESSAGE =
  "No se puede guardar el aporte con esos datos.";
const PUBLIC_AUTHOR_FALLBACK = "Usuario de Klazia FilmScore";
const CREATE_FIELDS = new Set([
  "movie_source",
  "movie_source_id",
  "movie_title",
  "poster_url",
  "rating",
  "review_text",
  "visibility",
]);
const EDIT_FIELDS = new Set(["rating", "review_text", "visibility"]);

/** Rechaza identidades ausentes para que las operaciones no usen datos del cliente. */
function requireAuthorId(authorId) {
  if (!Number.isSafeInteger(authorId) || authorId < 1) {
    throw new AuthenticationRequiredForContributionError();
  }
}

/** Valida IDs TMDB como texto decimal positivo, sin confundirlos con IDs de usuario. */
function validateMovieSourceId(movieSourceId) {
  if (
    typeof movieSourceId !== "string" ||
    !/^[1-9]\d*$/.test(movieSourceId.trim())
  ) {
    throw new ValidationError("No se puede consultar esa película.");
  }

  return movieSourceId.trim();
}

/** Convierte la fila privada al DTO aprobado sin exponer author_id. */
function toPrivateDto(contribution) {
  return {
    contribution_id: contribution.contribution_id,
    movie: {
      source: contribution.movie_source,
      source_id: contribution.movie_source_id,
      title: contribution.movie_title,
      poster_url: contribution.poster_url,
    },
    rating: contribution.rating,
    review_text: contribution.review_text,
    visibility: contribution.visibility,
    created_at: contribution.created_at,
  };
}

/** Exige objetos JSON con campos permitidos, evitando asignación masiva. */
function validateObjectFields(input, allowedFields, message) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((field) => !allowedFields.has(field))
  ) {
    throw new ValidationError(message);
  }
}

/** Valida y normaliza los valores mutables del agregado completo. */
function validateContributionValues({ rating, reviewText, visibility }) {
  const normalizedReview =
    typeof reviewText === "string" ? reviewText.trim() : "";

  // Cuenta puntos de código Unicode para que un emoji cuente como un carácter.
  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    Array.from(normalizedReview).length < 10 ||
    Array.from(normalizedReview).length > 1000 ||
    !["private", "public"].includes(visibility)
  ) {
    throw new ValidationError(
      "Revisa la calificación, la reseña y la visibilidad del aporte.",
    );
  }

  return { rating, reviewText: normalizedReview, visibility };
}

/** Convierte solo la restricción única de Aporte en el conflicto aprobado. */
function isUniqueConstraint(error) {
  return (
    error?.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
    error?.code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}

/**
 * Implementa reglas de Aportes sobre el repositorio.
 * Conserva propiedad, snapshot y fecha; traduce errores de SQLite sin filtrarlos.
 */
export function createContributionService(
  contributionRepository,
  logger = console,
) {
  return {
    /** Crea un aporte único; autor y fecha vienen del backend y SQLite. */
    create(authorId, input) {
      requireAuthorId(authorId);
      validateObjectFields(input, CREATE_FIELDS, PRIVATE_CONTRIBUTION_MESSAGE);

      if (
        input.movie_source !== "tmdb" ||
        typeof input.movie_source_id !== "string" ||
        !/^[1-9]\d*$/.test(input.movie_source_id.trim()) ||
        typeof input.movie_title !== "string" ||
        input.movie_title.trim().length === 0
      ) {
        throw new ValidationError(PRIVATE_CONTRIBUTION_MESSAGE);
      }

      const values = validateContributionValues({
        rating: input.rating,
        reviewText: input.review_text,
        visibility:
          input.visibility === undefined ? "private" : input.visibility,
      });
      const contribution = {
        authorId,
        movieSource: "tmdb",
        movieSourceId: input.movie_source_id.trim(),
        movieTitle: input.movie_title.trim(),
        posterUrl: validateTmdbPosterUrl(input.poster_url),
        ...values,
      };

      try {
        return toPrivateDto(contributionRepository.create(contribution));
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new ContributionAlreadyExistsError();
        }
        throw new ContributionPersistenceError();
      }
    },

    /** Devuelve los aportes propios, incluidos los privados, sin identidad interna. */
    listOwn(authorId) {
      requireAuthorId(authorId);
      try {
        return contributionRepository.listForAuthor(authorId).map(toPrivateDto);
      } catch {
        throw new ContributionReadError();
      }
    },

    /** Devuelve únicamente aportes públicos de la película consultada. */
    listPublic(movieSourceId) {
      const normalizedId = validateMovieSourceId(movieSourceId);
      let contributions;
      try {
        contributions = contributionRepository.listPublicForMovie(normalizedId);
      } catch {
        throw new ContributionReadError();
      }

      return contributions.map((contribution) => {
        const displayName =
          typeof contribution.author_display_name === "string"
            ? contribution.author_display_name.trim()
            : "";
        if (!displayName) {
          logger.warn?.(
            JSON.stringify({ event: "contribution_author_name_unavailable" }),
          );
        }

        return {
          contribution_id: contribution.contribution_id,
          author_display_name: displayName || PUBLIC_AUTHOR_FALLBACK,
          rating: contribution.rating,
          review_text: contribution.review_text,
          created_at: contribution.created_at,
        };
      });
    },

    /** Busca primero el aporte, luego verifica autoría y valida el agregado final. */
    update(authorId, rawId, input) {
      requireAuthorId(authorId);
      const contributionId = validateContributionId(rawId);
      let current;
      try {
        current = contributionRepository.findById(contributionId);
      } catch {
        throw new ContributionReadError();
      }

      if (!current) {
        throw new ContributionNotFoundError();
      }
      if (current.author_id !== authorId) {
        throw new ContributionForbiddenError();
      }

      validateObjectFields(
        input,
        EDIT_FIELDS,
        "Incluye al menos un campo editable del aporte.",
      );
      if (Object.keys(input).length === 0) {
        throw new ValidationError(
          "Incluye al menos un campo editable del aporte.",
        );
      }

      const values = validateContributionValues({
        rating: Object.hasOwn(input, "rating") ? input.rating : current.rating,
        reviewText: Object.hasOwn(input, "review_text")
          ? input.review_text
          : current.review_text,
        visibility: Object.hasOwn(input, "visibility")
          ? input.visibility
          : current.visibility,
      });

      let updated;
      try {
        updated = contributionRepository.update({
          contributionId,
          authorId,
          ...values,
        });
      } catch {
        throw new ContributionPersistenceError();
      }
      if (!updated) {
        throw new ContributionNotFoundError();
      }

      return toPrivateDto(updated);
    },

    /** Elimina solo el aporte propio; Favoritos se mantienen en tabla independiente. */
    remove(authorId, rawId) {
      requireAuthorId(authorId);
      const contributionId = validateContributionId(rawId);
      let current;
      try {
        current = contributionRepository.findById(contributionId);
      } catch {
        throw new ContributionReadError();
      }

      if (!current) {
        throw new ContributionNotFoundError();
      }
      if (current.author_id !== authorId) {
        throw new ContributionForbiddenError();
      }

      let removedCount;
      try {
        removedCount = contributionRepository.remove(contributionId, authorId);
      } catch {
        throw new ContributionPersistenceError();
      }
      if (removedCount === 0) {
        throw new ContributionNotFoundError();
      }
    },
  };
}

/** Valida el ID físico positivo usado solo por PATCH y DELETE. */
function validateContributionId(rawId) {
  if (
    typeof rawId !== "string" ||
    !/^[1-9]\d*$/.test(rawId) ||
    !Number.isSafeInteger(Number(rawId))
  ) {
    throw new ValidationError("No se encontró el aporte solicitado.");
  }

  return Number(rawId);
}
