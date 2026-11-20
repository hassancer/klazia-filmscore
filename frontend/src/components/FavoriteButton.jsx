/** Presenta el estado de guardado y delega la mutación a la API propia. */
/** Traduce el estado de guardado a una acción y mensaje accesibles en el detalle. */
export default function FavoriteButton({
  isAuthenticated,
  status,
  onAddFavorite,
}) {
  if (!isAuthenticated) {
    return (
      <a className="button button--primary" href="#/acceso">
        Inicia sesión para guardar
      </a>
    );
  }

  const saved =
    status === "saved" || status === "already-saved" || status === "in-list";
  const label =
    status === "saving"
      ? "Guardando…"
      : saved
        ? "En tus favoritos"
        : "Agregar a favoritos";

  return (
    <div className="favorite-action">
      <button
        className="button button--primary"
        disabled={status === "saving" || saved}
        onClick={onAddFavorite}
        type="button"
      >
        {label}
      </button>
      {status === "saved" ? (
        <p className="form-message form-message--success" role="status">
          Agregada a tus favoritos.
        </p>
      ) : null}
      {status === "already-saved" ? (
        <p className="form-message" role="status">
          Ya está guardada en tus favoritos.
        </p>
      ) : null}
      {status === "error" ? (
        <p className="form-message form-message--error" role="alert">
          No pudimos guardar la película. Inténtalo nuevamente.
        </p>
      ) : null}
    </div>
  );
}
