import FavoriteButton from "../components/FavoriteButton.jsx";
import ContributionForm from "../components/ContributionForm.jsx";
import { formatCreatedAt } from "../utils/format-created-at.js";

/** Omite campos opcionales sin valor para no mostrar etiquetas vacías. */
function DetailField({ label, value }) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return (
    <div className="detail-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Renderiza detalle, carga, error con reintento o indicación de selección. */
export default function MovieDetailPage({
  movie,
  status,
  errorMessage,
  onBack,
  onRetry,
  isAuthenticated,
  favoriteStatus,
  onAddFavorite,
  myContribution,
  myContributionsStatus,
  myContributionsError,
  onRetryMyContributions,
  contributions,
  contributionsStatus,
  contributionsError,
  onRetryContributions,
  onCreateContribution,
  onEditContribution,
  isSubmittingContribution,
  contributionActionError,
  contributionSuccessMessage,
}) {
  if (status === "loading" && !movie) {
    return (
      <p className="status-message" role="status">
        Cargando detalle…
      </p>
    );
  }

  if (status === "error" && !movie) {
    return (
      <section className="status-panel status-panel--error" role="alert">
        <p>{errorMessage}</p>
        <button
          className="button button--secondary"
          onClick={onRetry}
          type="button"
        >
          Reintentar
        </button>
        <button className="text-button" onClick={onBack} type="button">
          Volver a resultados
        </button>
      </section>
    );
  }

  if (!movie) {
    return (
      <section className="status-panel" role="status">
        <p>Selecciona una película desde los resultados de búsqueda.</p>
        <button
          className="button button--secondary"
          onClick={onBack}
          type="button"
        >
          Volver a resultados
        </button>
      </section>
    );
  }

  return (
    <article className="movie-detail">
      <button className="text-button" onClick={onBack} type="button">
        ← Volver a resultados
      </button>
      {status === "loading" ? (
        <p className="status-message" role="status">
          Cargando el detalle; se conserva la información disponible.
        </p>
      ) : null}
      {status === "error" ? (
        <div className="status-panel status-panel--error" role="alert">
          <p>{errorMessage} Mostramos la información disponible.</p>
          <button
            className="button button--secondary"
            onClick={onRetry}
            type="button"
          >
            Reintentar detalle
          </button>
        </div>
      ) : null}
      <div className="movie-detail__layout">
        {movie.poster_url ? (
          <img alt="" className="movie-detail__poster" src={movie.poster_url} />
        ) : null}
        <div>
          <h1 className="page-title">{movie.title}</h1>
          {movie.tagline ? (
            <p className="movie-detail__tagline">{movie.tagline}</p>
          ) : null}
          <dl className="detail-list">
            <DetailField label="Año" value={movie.release_year} />
            <DetailField
              label={`Calificación ${movie.rating_source} (escala ${movie.rating_scale})`}
              value={movie.vote_average}
            />
            <DetailField
              label="Géneros"
              value={movie.genres?.length ? movie.genres.join(", ") : null}
            />
            <DetailField
              label="Duración"
              value={movie.runtime ? `${movie.runtime} minutos` : null}
            />
          </dl>
          {movie.overview ? (
            <section aria-labelledby="overview-title">
              <h2 className="section-title" id="overview-title">
                Sinopsis
              </h2>
              <p className="movie-detail__overview">{movie.overview}</p>
            </section>
          ) : null}
        </div>
      </div>
      <div className="movie-detail__favorite">
        <FavoriteButton
          isAuthenticated={isAuthenticated}
          onAddFavorite={onAddFavorite}
          status={favoriteStatus}
        />
      </div>
      <section
        aria-labelledby="own-contribution-title"
        className="contribution-section"
      >
        <h2 className="section-title" id="own-contribution-title">
          Tu aporte
        </h2>
        {contributionSuccessMessage ? (
          <p className="form-message form-message--success" role="status">
            {contributionSuccessMessage}
          </p>
        ) : null}
        {contributionActionError ? (
          <p className="form-message form-message--error" role="alert">
            {contributionActionError}
          </p>
        ) : null}
        {!isAuthenticated ? (
          <div className="status-panel">
            <p>Inicia sesión para crear y administrar tus aportes.</p>
            <a className="button button--primary" href="#/acceso">
              Iniciar sesión
            </a>
          </div>
        ) : myContributionsStatus === "idle" ||
          myContributionsStatus === "loading" ? (
          <p className="status-message" role="status">
            Consultando si ya tienes un aporte…
          </p>
        ) : myContributionsStatus === "error" ? (
          <div className="status-panel status-panel--error" role="alert">
            <p>{myContributionsError}</p>
            <button
              className="button button--secondary"
              onClick={onRetryMyContributions}
              type="button"
            >
              Reintentar
            </button>
          </div>
        ) : myContribution ? (
          <article className="contribution-card contribution-card--own">
            <div className="contribution-card__content">
              <p className="secondary-data">
                Tu aporte es{" "}
                {myContribution.visibility === "public" ? "público" : "privado"}
                .
              </p>
              <p className="contribution-card__review">
                Calificación personal: {myContribution.rating}/5
              </p>
              <p className="contribution-card__review">
                {myContribution.review_text}
              </p>
              <p className="secondary-data">
                Creado el{" "}
                {formatCreatedAt(myContribution.created_at, {
                  includeTime: true,
                })}
              </p>
              <button
                className="button button--secondary"
                onClick={() => onEditContribution(myContribution)}
                type="button"
              >
                Editar mi aporte
              </button>
            </div>
          </article>
        ) : (
          <ContributionForm
            isSubmitting={isSubmittingContribution}
            onSubmit={onCreateContribution}
            successMessage={contributionSuccessMessage}
          />
        )}
      </section>
      <section
        aria-labelledby="public-contributions-title"
        className="contribution-section"
      >
        <h2 className="section-title" id="public-contributions-title">
          Aportes públicos
        </h2>
        {contributionsStatus === "idle" || contributionsStatus === "loading" ? (
          <p className="status-message" role="status">
            Cargando aportes públicos…
          </p>
        ) : contributionsStatus === "error" ? (
          <div className="status-panel status-panel--error" role="alert">
            <p>{contributionsError}</p>
            <button
              className="button button--secondary"
              onClick={onRetryContributions}
              type="button"
            >
              Reintentar
            </button>
          </div>
        ) : contributionsStatus === "empty" ? (
          <p className="status-message" role="status">
            Todavía no hay aportes públicos para esta película.
          </p>
        ) : (
          <div className="contribution-list">
            {contributions.map((contribution) => (
              <article
                className="contribution-card contribution-card--public"
                key={contribution.contribution_id}
              >
                <div className="contribution-card__content">
                  <h3 className="movie-card__title">
                    {contribution.author_display_name}
                  </h3>
                  <p className="contribution-card__review">
                    Calificación personal: {contribution.rating}/5
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
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
