import SearchBar from "../components/SearchBar.jsx";

/** Portada pública con una búsqueda rápida que reutiliza el estado de App. */
export default function HomePage({
  query,
  onQueryChange,
  onSearch,
  isLoading,
}) {
  return (
    <>
      <section aria-labelledby="home-title" className="hero">
        <p className="eyebrow">Una mirada propia al cine</p>
        <h1 className="page-title" id="home-title">
          Klazia <span>FilmScore</span>
        </h1>
        <p className="hero__description">
          Busca una película, explora sus detalles y encuentra tu próxima
          historia favorita.
        </p>
        <section aria-labelledby="search-title" className="search-panel">
          <h2 className="section-title" id="search-title">
            ¿Qué película quieres descubrir?
          </h2>
          <p className="section-description">
            La búsqueda está disponible sin crear una cuenta.
          </p>
          <SearchBar
            compact
            isLoading={isLoading}
            onQueryChange={onQueryChange}
            onSearch={onSearch}
            query={query}
          />
        </section>
      </section>
      <p className="data-notice" role="note">
        Las películas y calificaciones se consultan en TMDB.
      </p>
    </>
  );
}
