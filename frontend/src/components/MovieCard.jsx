/** Presenta los datos resumidos de una película y notifica cuando se abre su detalle. */
export default function MovieCard({ movie, onSelect }) {
  return (
    <article className="movie-card">
      {movie.poster_url ? (
        <img
          alt=""
          className="movie-card__poster"
          loading="lazy"
          src={movie.poster_url}
        />
      ) : (
        <div
          aria-hidden="true"
          className="movie-card__poster movie-card__poster--empty"
        >
          Póster no disponible
        </div>
      )}
      <div className="movie-card__content">
        <h2 className="movie-card__title">{movie.title}</h2>
        {movie.release_year ? (
          <p className="secondary-data">{movie.release_year}</p>
        ) : null}
        {movie.overview ? (
          <p className="movie-card__overview">{movie.overview}</p>
        ) : null}
        <button
          className="button button--secondary"
          onClick={() => onSelect(movie)}
          type="button"
        >
          Ver detalle
        </button>
      </div>
    </article>
  );
}
