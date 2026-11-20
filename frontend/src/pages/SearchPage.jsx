import MovieCard from "../components/MovieCard.jsx";
import SearchBar from "../components/SearchBar.jsx";

/** Muestra formulario y estados de búsqueda: carga, vacío, error o resultados. */
export default function SearchPage({
  query,
  onQueryChange,
  onSearch,
  onRetry,
  onSelectMovie,
  status,
  results,
  errorMessage,
}) {
  return (
    <section aria-labelledby="search-page-title" className="content-section">
      <div className="page-intro">
        <h1 className="page-title" id="search-page-title">
          Buscar películas
        </h1>
        <p className="section-description">
          Consulta el catálogo por título, sin filtros adicionales.
        </p>
      </div>
      <SearchBar
        isLoading={status === "loading"}
        onQueryChange={onQueryChange}
        onSearch={onSearch}
        query={query}
      />
      {status === "loading" ? (
        <p className="status-message" role="status">
          Buscando películas…
        </p>
      ) : null}
      {status === "empty" ? (
        <p className="status-message" role="status">
          No hay resultados para “{query}”.
        </p>
      ) : null}
      {status === "error" ? (
        <div className="status-panel status-panel--error" role="alert">
          <p>{errorMessage}</p>
          <button
            className="button button--secondary"
            onClick={onRetry}
            type="button"
          >
            Reintentar
          </button>
        </div>
      ) : null}
      {status === "results" ? (
        <div aria-label="Resultados de búsqueda" className="movie-grid">
          {results.map((movie) => (
            <MovieCard
              key={movie.tmdb_id}
              movie={movie}
              onSelect={onSelectMovie}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
