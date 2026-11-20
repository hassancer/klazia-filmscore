import { formatCreatedAt } from "../utils/format-created-at.js";

/** Presenta solo los aportes de la sesión y sus acciones autorizadas. */
export default function MyContributionsPage({
  isAuthenticated,
  status,
  contributions,
  errorMessage,
  actionError,
  successMessage,
  busyId,
  onRetry,
  onEdit,
  onChangeVisibility,
  onDelete,
}) {
  if (!isAuthenticated) {
    return (
      <section
        aria-labelledby="my-contributions-title"
        className="content-section"
      >
        <div className="page-intro">
          <h1 className="page-title" id="my-contributions-title">
            Mis aportes
          </h1>
          <p className="section-description">
            Inicia sesión para consultar y administrar tus aportes.
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
        Cargando tus aportes…
      </p>
    );
  }

  if (status === "error") {
    return (
      <section
        aria-labelledby="my-contributions-title"
        className="content-section"
      >
        <div className="page-intro">
          <h1 className="page-title" id="my-contributions-title">
            Mis aportes
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

  return (
    <section
      aria-labelledby="my-contributions-title"
      className="content-section"
    >
      <div className="page-intro">
        <h1 className="page-title" id="my-contributions-title">
          Mis aportes
        </h1>
        <p className="section-description">
          Administra tus calificaciones y reseñas. Solo tú puedes ver los
          aportes privados.
        </p>
      </div>
      {actionError ? (
        <p className="form-message form-message--error" role="alert">
          {actionError}
        </p>
      ) : null}
      {successMessage ? (
        <p className="form-message form-message--success" role="status">
          {successMessage}
        </p>
      ) : null}
      {status === "empty" ? (
        <div className="status-panel" role="status">
          <p>Todavía no tienes aportes.</p>
          <a className="button button--primary" href="#/buscar">
            Buscar películas
          </a>
        </div>
      ) : (
        <div className="contribution-list">
          {contributions.map((contribution) => (
            <article
              className="contribution-card contribution-card--with-poster"
              key={contribution.contribution_id}
            >
              {contribution.movie.poster_url ? (
                <img
                  alt=""
                  className="contribution-card__poster"
                  loading="lazy"
                  src={contribution.movie.poster_url}
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="contribution-card__poster contribution-card__poster--empty"
                >
                  Póster no disponible
                </div>
              )}
              <div className="contribution-card__content">
                <h2 className="movie-card__title">
                  {contribution.movie.title}
                </h2>
                <p className="secondary-data">
                  Calificación personal: {contribution.rating}/5 ·{" "}
                  {contribution.visibility === "public" ? "Público" : "Privado"}
                </p>
                <p className="contribution-card__review">
                  {contribution.review_text}
                </p>
                <p className="secondary-data">
                  Creado el{" "}
                  {formatCreatedAt(contribution.created_at, {
                    includeTime: true,
                  })}
                </p>
                <div className="contribution-card__actions">
                  <button
                    className="button button--secondary"
                    disabled={busyId === contribution.contribution_id}
                    onClick={() => onEdit(contribution)}
                    type="button"
                  >
                    Editar
                  </button>
                  <button
                    className="button button--secondary"
                    disabled={busyId === contribution.contribution_id}
                    onClick={() => onChangeVisibility(contribution)}
                    type="button"
                  >
                    {busyId === contribution.contribution_id
                      ? "Actualizando…"
                      : contribution.visibility === "public"
                        ? "Volver privado"
                        : "Hacer público"}
                  </button>
                  <button
                    className="button button--secondary"
                    disabled={busyId === contribution.contribution_id}
                    onClick={() => onDelete(contribution)}
                    type="button"
                  >
                    {busyId === contribution.contribution_id
                      ? "Eliminando…"
                      : "Eliminar aporte"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
