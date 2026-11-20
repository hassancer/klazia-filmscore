import {
  CatalogUnavailableError,
  MovieNotFoundError,
} from "../errors/application-errors.js";

const imageBaseUrl = "https://image.tmdb.org/t/p/w500";

/**
 * Convierte una película de TMDB al formato reducido que consume el frontend.
 * Devuelve null si la respuesta no incluye un ID entero y un título válido.
 */
function mapMovie(movie) {
  if (
    !movie ||
    !Number.isInteger(movie.id) ||
    typeof movie.title !== "string"
  ) {
    return null;
  }

  return {
    tmdb_id: String(movie.id),
    title: movie.title,
    // TMDB entrega una ruta relativa; el frontend recibe una URL utilizable o null.
    poster_url:
      typeof movie.poster_path === "string"
        ? `${imageBaseUrl}${movie.poster_path}`
        : null,
    release_year:
      typeof movie.release_date === "string" && movie.release_date.length >= 4
        ? movie.release_date.slice(0, 4)
        : null,
    overview: typeof movie.overview === "string" ? movie.overview : null,
  };
}

/**
 * Añade al formato común los campos disponibles en el detalle de TMDB.
 * Si la respuesta base es inválida, informa que el catálogo no está disponible.
 */
function mapDetails(movie) {
  const mapped = mapMovie(movie);
  if (!mapped) {
    throw new CatalogUnavailableError();
  }

  return {
    ...mapped,
    original_title:
      typeof movie.original_title === "string" ? movie.original_title : null,
    release_date:
      typeof movie.release_date === "string" && movie.release_date
        ? movie.release_date
        : null,
    genres: Array.isArray(movie.genres)
      ? movie.genres
          .filter((genre) => typeof genre?.name === "string")
          .map((genre) => genre.name)
      : [],
    runtime: Number.isInteger(movie.runtime) ? movie.runtime : null,
    tagline: typeof movie.tagline === "string" ? movie.tagline : null,
    vote_average:
      typeof movie.vote_average === "number" ? movie.vote_average : null,
    vote_count: Number.isInteger(movie.vote_count) ? movie.vote_count : null,
    // Evita confundir la calificación externa con una calificación de la aplicación.
    rating_source: "TMDB",
    rating_scale: "0–10",
  };
}

/**
 * Crea el adaptador del catálogo externo.
 * Recibe token, URL, tiempo límite y un fetch opcional; expone búsqueda y detalle.
 */
export function createTmdbService({
  accessToken,
  baseUrl = "https://api.themoviedb.org/3",
  timeoutMs = 4_000,
  fetchImpl = globalThis.fetch,
}) {
  /**
   * Solicita un recurso de TMDB y devuelve su JSON.
   * El token solo se envía al proveedor desde el backend; errores de red se
   * convierten en errores funcionales y el timeout se distingue con HTTP 504.
   */
  async function request(resource, params = {}) {
    // Sin credencial no se intenta una llamada externa ni se revela configuración.
    if (!accessToken) {
      throw new CatalogUnavailableError();
    }

    // Se quitan barras finales para evitar rutas duplicadas y se codifican los parámetros.
    const url = new URL(`${baseUrl.replace(/\/+$/, "")}/${resource}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    // El timeout aborta fetch; abajo se traduce a un error funcional 504.
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      });

      if (response.status === 404 && resource.startsWith("movie/")) {
        throw new MovieNotFoundError();
      }
      if (!response.ok) {
        throw new CatalogUnavailableError();
      }
      return await response.json();
    } catch (error) {
      if (
        error instanceof MovieNotFoundError ||
        error instanceof CatalogUnavailableError
      ) {
        throw error;
      }
      // Solo un timeout es 504; los demás errores externos se exponen como 503.
      if (controller.signal.aborted || error?.name === "AbortError") {
        throw new CatalogUnavailableError(504);
      }
      throw new CatalogUnavailableError();
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    /**
     * Busca por título en español de Colombia y normaliza los resultados válidos.
     * Devuelve una lista del contrato local; una respuesta sin lista de resultados
     * se trata como indisponibilidad del catálogo.
     */
    async searchMovies(title) {
      const payload = await request("search/movie", {
        query: title,
        language: "es-CO",
      });
      if (!Array.isArray(payload?.results)) {
        throw new CatalogUnavailableError();
      }
      return payload.results.map(mapMovie).filter(Boolean);
    },

    /**
     * Consulta el detalle de una película por ID numérico de TMDB.
     * Un ID inválido o inexistente produce MovieNotFoundError; los detalles
     * válidos incluyen la fuente y escala de la calificación externa.
     */
    async getMovie(tmdbId) {
      if (!/^\d+$/.test(tmdbId)) {
        throw new MovieNotFoundError();
      }
      const payload = await request(`movie/${encodeURIComponent(tmdbId)}`, {
        language: "es-CO",
      });
      return mapDetails(payload);
    },
  };
}
