const publicLinks = [
  { href: "#/inicio", label: "Inicio", screen: "inicio" },
  { href: "#/buscar", label: "Buscar películas", screen: "buscar" },
];

/** Muestra navegación pública y controles de sesión según la identidad recibida. */
export default function Navbar({ screen, user, onLogout }) {
  // Las opciones de cuenta desaparecen al iniciar sesión; la acción de salida queda visible.
  const links = user
    ? [
        ...publicLinks,
        { href: "#/favoritos", label: "Mis Favoritos", screen: "favoritos" },
        { href: "#/mis-aportes", label: "Mis aportes", screen: "mis-aportes" },
      ]
    : [
        ...publicLinks,
        { href: "#/registro", label: "Crear cuenta", screen: "registro" },
        { href: "#/acceso", label: "Iniciar sesión", screen: "acceso" },
      ];

  return (
    <header className="site-header">
      <a
        className="wordmark"
        href="#/inicio"
        aria-label="Klazia FilmScore, inicio"
      >
        <span className="wordmark__name">Klazia</span>
        <span className="wordmark__descriptor">FilmScore</span>
      </a>
      <nav className="primary-navigation" aria-label="Navegación principal">
        {links.map((item) => (
          <a
            aria-current={screen === item.screen ? "page" : undefined}
            className="primary-navigation__link"
            href={item.href}
            key={item.screen}
          >
            {item.label}
          </a>
        ))}
        {user ? (
          <div className="session-controls">
            <span className="session-controls__name">{user.display_name}</span>
            <button
              className="button button--secondary"
              onClick={onLogout}
              type="button"
            >
              Cerrar sesión
            </button>
          </div>
        ) : null}
      </nav>
    </header>
  );
}
