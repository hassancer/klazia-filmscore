import { formatCreatedAt } from "../utils/format-created-at.js";

/** Renderiza estados separados de lista, error, sesión y operaciones de Favoritos. */
export default function FavoritesPage({
  isAuthenticated,
  status,
  favorites,
  errorMessage,
  actionError,
  busyId,
  onRetry,
  onRemove,
  onSelect,
}) {
  if (!isAuthenticated) {
    return (
      <section aria-labelledby="favorites-title" className="content-section">
        <div className="page-intro">
          <h1 className="page-title" id="favorites-title">
            Mis Favoritos
          </h1>
          <p className="section-description">
            Inicia sesión para consultar y administrar tu lista privada.
          </p>
          <a className="button button--primary" href="#/acceso">
            Iniciar sesión
          </a>
        </div>
      </section>
    );
  }

  if (status === "idle" || status === "loading") {
    return (
      <p className="status-message" role="status">
        Cargando tus favoritos…
      </p>
    );
  }

  if (status === "error") {
    return (
      <section aria-labelledby="favorites-title" className="content-section">
        <div className="page-intro">
          <h1 className="page-title" id="favorites-title">
            Mis Favoritos
          </h1>
        </div>
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
      </section>
    );
  }

  if (status === "empty") {
    return (
      <section aria-labelledby="favorites-title" className="content-section">
        <div className="page-intro">
          <h1 className="page-title" id="favorites-title">
            Mis Favoritos
          </h1>
          <p className="section-description">
            Todavía no tienes películas en tu lista.
          </p>
          <a className="button button--primary" href="#/buscar">
            Buscar películas
          </a>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="favorites-title" className="content-section">
      <div className="page-intro">
        <h1 className="page-title" id="favorites-title">
          Mis Favoritos
        </h1>
        <p className="section-description">
          Tu lista privada de películas guardadas.
        </p>
      </div>
      {actionError ? (
        <p className="form-message form-message--error" role="alert">
          {actionError}
        </p>
      ) : null}
      <div className="favorite-list">
        {favorites.map((favorite) => (
          <article
            className="favorite-card"
            key={`${favorite.movie_source}:${favorite.movie_source_id}`}
          >
            {favorite.poster_url ? (
              <img
                alt=""
                className="favorite-card__poster"
                loading="lazy"
                src={favorite.poster_url}
              />
            ) : (
              <div
                aria-hidden="true"
                className="favorite-card__poster favorite-card__poster--empty"
              >
                Póster no disponible
              </div>
            )}
            <div className="favorite-card__content">
              <h2 className="movie-card__title">{favorite.movie_title}</h2>
              <p className="secondary-data">
                Guardada el {formatCreatedAt(favorite.created_at)}
              </p>
              <div className="favorite-card__actions">
                <button
                  className="button button--secondary"
                  onClick={() => onSelect(favorite)}
                  type="button"
                >
                  Ver detalle
                </button>
                <button
                  className="button button--secondary"
                  disabled={busyId !== null}
                  onClick={() => onRemove(favorite.movie_source_id)}
                  type="button"
                >
                  {busyId === favorite.movie_source_id
                    ? "Quitando…"
                    : "Quitar de favoritos"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
