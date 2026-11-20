import { ValidationError } from "../errors/application-errors.js";

/** Convierte parámetros de rutas de películas en llamadas al adaptador TMDB. */
export function createMovieController(tmdbService) {
  return {
    /** Valida el título recibido por query y devuelve resultados normalizados. */
    async search(request, response) {
      const title = request.query.titulo;
      if (typeof title !== "string" || title.trim().length === 0) {
        throw new ValidationError("Ingresa el título de una película.");
      }

      const results = await tmdbService.searchMovies(title.trim());
      response.json({ success: true, data: { results } });
    },

    /** Consulta y devuelve el detalle usando el ID TMDB de la ruta. */
    async getDetails(request, response) {
      const movie = await tmdbService.getMovie(request.params.tmdbId);
      response.json({ success: true, data: { movie } });
    },
  };
}
