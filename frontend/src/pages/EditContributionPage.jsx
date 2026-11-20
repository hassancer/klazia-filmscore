import ContributionForm from "../components/ContributionForm.jsx";

/** Edita un aporte propio ya cargado; el backend vuelve a validar su autoría. */
export default function EditContributionPage({
  isAuthenticated,
  status,
  contribution,
  errorMessage,
  actionError,
  successMessage,
  isSubmitting,
  onRetry,
  onSubmit,
  onCancel,
}) {
  if (!isAuthenticated) {
    return (
      <section className="status-panel" role="alert">
        <p>Inicia sesión para editar tus aportes.</p>
        <a className="button button--primary" href="#/acceso">
          Iniciar sesión
        </a>
      </section>
    );
  }

  if (status === "idle" || status === "loading") {
    return (
      <p className="status-message" role="status">
        Cargando tu aporte…
      </p>
    );
  }

  if (status === "error") {
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
      </section>
    );
  }

  if (!contribution) {
    return (
      <section className="status-panel" role="status">
        <p>No se encontró el aporte solicitado.</p>
        <button
          className="button button--secondary"
          onClick={onCancel}
          type="button"
        >
          Volver a Mis aportes
        </button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="edit-contribution-title"
      className="content-section"
    >
      <div className="page-intro">
        <h1 className="page-title" id="edit-contribution-title">
          Editar aporte de {contribution.movie.title}
        </h1>
      </div>
      <ContributionForm
        errorMessage={actionError}
        initialValues={contribution}
        isSubmitting={isSubmitting}
        mode="edit"
        onCancel={onCancel}
        onSubmit={onSubmit}
        successMessage={successMessage}
      />
    </section>
  );
}
