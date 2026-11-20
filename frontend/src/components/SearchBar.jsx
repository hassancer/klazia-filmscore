/** Formulario reutilizable para buscar desde inicio o desde la página de resultados. */
export default function SearchBar({
  query,
  onQueryChange,
  onSearch,
  isLoading,
  compact = false,
}) {
  /** Evita recargas y no envía búsquedas vacías ni duplicadas mientras carga. */
  function handleSubmit(event) {
    event.preventDefault();
    if (!query.trim() || isLoading) {
      return;
    }
    onSearch(query.trim());
  }

  return (
    <form
      className={`search-form${compact ? " search-form--compact" : ""}`}
      onSubmit={handleSubmit}
      role="search"
    >
      <label
        className="search-form__label"
        htmlFor={compact ? "search-home" : "search-results"}
      >
        Título de película
      </label>
      <div className="search-form__controls">
        <input
          autoComplete="off"
          className="form-control search-form__input"
          id={compact ? "search-home" : "search-results"}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Ej. El viaje de Chihiro"
          required
          type="search"
          value={query}
        />
        <button
          className="button button--primary"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? "Buscando…" : "Buscar"}
        </button>
      </div>
    </form>
  );
}
