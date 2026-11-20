import { useEffect, useRef, useState } from "react";
import Navbar from "./components/Navbar.jsx";
import {
  addFavorite,
  createContribution,
  createAccount,
  getFavorites,
  getMovie,
  getOwnContributions,
  getPublicContributions,
  login,
  logout,
  removeContribution,
  removeFavorite,
  searchMovies,
  updateContribution,
} from "./services/api.js";
import FavoritesPage from "./pages/FavoritesPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import MovieDetailPage from "./pages/MovieDetailPage.jsx";
import MyContributionsPage from "./pages/MyContributionsPage.jsx";
import EditContributionPage from "./pages/EditContributionPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import SearchPage from "./pages/SearchPage.jsx";

/** Lee la pantalla e ID desde el hash, tolerando IDs con codificación inválida. */
function readRoute() {
  const [screen = "inicio", rawId = ""] = window.location.hash
    .replace(/^#\/?/, "")
    .split("/");

  let id;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    id = rawId;
  }

  return { screen: screen || "inicio", id };
}

/** Construye una ruta hash y codifica el ID para conservarlo como un solo segmento. */
function routeHash(screen, id = "") {
  return `#/${screen}${id ? `/${encodeURIComponent(id)}` : ""}`;
}

/**
 * Coordina navegación, búsqueda, detalle y cuenta entre páginas.
 * La API y las reglas de sesión viven en services/api.js; aquí se refleja su estado.
 */
export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [query, setQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState("idle");
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [movie, setMovie] = useState(null);
  const [movieStatus, setMovieStatus] = useState("idle");
  const [movieError, setMovieError] = useState("");
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [favoritesStatus, setFavoritesStatus] = useState("idle");
  const [favoritesError, setFavoritesError] = useState("");
  const [favoriteActionError, setFavoriteActionError] = useState("");
  const [favoriteBusyId, setFavoriteBusyId] = useState(null);
  const [favoriteButtonStatus, setFavoriteButtonStatus] = useState("idle");
  const [myContributions, setMyContributions] = useState([]);
  const [myContributionsStatus, setMyContributionsStatus] = useState("idle");
  const [myContributionsError, setMyContributionsError] = useState("");
  const [publicContributions, setPublicContributions] = useState([]);
  const [publicContributionsStatus, setPublicContributionsStatus] =
    useState("idle");
  const [publicContributionsError, setPublicContributionsError] = useState("");
  const [contributionActionError, setContributionActionError] = useState("");
  const [contributionActionSuccess, setContributionActionSuccess] =
    useState("");
  const [contributionBusyId, setContributionBusyId] = useState(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const searchInFlight = useRef(false);
  const detailRequestId = useRef(null);
  const publicContributionRequestId = useRef(0);

  // Mantiene la pantalla sincronizada con los botones atrás/adelante del navegador.
  useEffect(() => {
    const updateRoute = () => setRoute(readRoute());
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  useEffect(() => {
    if (
      route.screen === "pelicula" &&
      route.id &&
      movie?.tmdb_id !== route.id &&
      detailRequestId.current !== route.id
    ) {
      loadMovie(route.id);
    }
  }, [route.screen, route.id, movie?.tmdb_id]);

  useEffect(() => {
    if (route.screen === "pelicula" && route.id) {
      loadPublicContributions(route.id);
    }
  }, [route.screen, route.id]);

  useEffect(() => {
    if (!user) {
      setMyContributions([]);
      setMyContributionsStatus("idle");
      return;
    }

    if (
      ["pelicula", "mis-aportes", "editar"].includes(route.screen) &&
      myContributionsStatus === "idle"
    ) {
      loadMyContributions();
    }
  }, [route.screen, route.id, user, myContributionsStatus]);

  useEffect(() => {
    if (route.screen !== "favoritos") {
      return;
    }
    if (!user) {
      setFavoritesStatus("idle");
      return;
    }
    loadFavorites();
  }, [route.screen, user]);

  /** Cambia el hash sin recargar la aplicación y sincroniza la ruta actual. */
  function navigate(screen, id = "") {
    const nextHash = routeHash(screen, id);
    if (window.location.hash === nextHash) {
      setRoute(readRoute());
      return;
    }
    window.location.hash = nextHash;
  }

  /**
   * Ejecuta una búsqueda, evita solicitudes duplicadas y conserva estados de resultado.
   * Recibe el título del formulario; guarda resultados o un mensaje de error para la vista.
   */
  async function runSearch(title) {
    const normalizedTitle = title.trim();
    if (!normalizedTitle || searchInFlight.current) {
      return;
    }

    searchInFlight.current = true;
    setQuery(normalizedTitle);
    setSearchStatus("loading");
    setSearchError("");
    setNotice("");
    navigate("buscar");

    try {
      const results = await searchMovies(normalizedTitle);
      setSearchResults(results);
      setSearchStatus(results.length ? "results" : "empty");
    } catch (error) {
      setSearchStatus("error");
      setSearchError(error.message);
    } finally {
      searchInFlight.current = false;
    }
  }

  /** Carga detalles para un ID y evita pedir dos veces el mismo detalle simultáneamente. */
  async function loadMovie(tmdbId) {
    if (detailRequestId.current === tmdbId) {
      return;
    }

    detailRequestId.current = tmdbId;
    setMovieStatus("loading");
    setMovieError("");

    try {
      const details = await getMovie(tmdbId);
      setMovie(details);
      setMovieStatus("loaded");
    } catch (error) {
      setMovieStatus("error");
      setMovieError(error.message);
    } finally {
      detailRequestId.current = null;
    }
  }

  /** Abre el detalle y muestra primero los datos ya disponibles del resultado. */
  function openMovie(selectedMovie) {
    setMovie(selectedMovie);
    setMovieStatus("loading");
    setFavoriteButtonStatus("idle");
    navigate("pelicula", selectedMovie.tmdb_id);
    loadMovie(selectedMovie.tmdb_id);
  }

  /** Carga exclusivamente los snapshots propios desde la API local. */
  async function loadFavorites() {
    setFavoritesStatus("loading");
    setFavoritesError("");
    setFavoriteActionError("");

    try {
      const savedFavorites = await getFavorites();
      setFavorites(savedFavorites);
      setFavoritesStatus(savedFavorites.length ? "ready" : "empty");
    } catch (error) {
      if (error.status === 401) {
        // Una sesión vencida invalida también el estado de autenticación local.
        setUser(null);
      }
      setFavoritesStatus("error");
      setFavoritesError(error.message);
    }
  }

  /** Carga la vista privada sin convertir un error de lectura en una lista vacía. */
  async function loadMyContributions() {
    setMyContributionsStatus("loading");
    setMyContributionsError("");

    try {
      const savedContributions = await getOwnContributions();
      setMyContributions(savedContributions);
      setMyContributionsStatus(savedContributions.length ? "ready" : "empty");
    } catch (error) {
      if (error.status === 401) {
        setUser(null);
      }
      setMyContributionsStatus("error");
      setMyContributionsError(error.message);
    }
  }

  /** Carga aportes públicos e ignora respuestas tardías de películas anteriores. */
  async function loadPublicContributions(tmdbId) {
    const requestId = publicContributionRequestId.current + 1;
    publicContributionRequestId.current = requestId;
    setPublicContributionsStatus("loading");
    setPublicContributionsError("");

    try {
      const savedContributions = await getPublicContributions(tmdbId);
      if (publicContributionRequestId.current !== requestId) {
        return;
      }
      setPublicContributions(savedContributions);
      setPublicContributionsStatus(
        savedContributions.length ? "ready" : "empty",
      );
    } catch (error) {
      if (publicContributionRequestId.current !== requestId) {
        return;
      }
      setPublicContributionsStatus("error");
      setPublicContributionsError(error.message);
    }
  }

  /** Abre el detalle con el snapshot disponible antes de intentar actualizarlo. */
  function openFavorite(favorite) {
    const snapshot = {
      tmdb_id: favorite.movie_source_id,
      title: favorite.movie_title,
      poster_url: favorite.poster_url,
      release_year: null,
      overview: null,
      tagline: null,
      genres: [],
      runtime: null,
      vote_average: null,
      rating_source: "TMDB",
      rating_scale: "0–10",
    };
    setMovie(snapshot);
    setMovieStatus("loading");
    setFavoriteButtonStatus("in-list");
    navigate("pelicula", favorite.movie_source_id);
    loadMovie(favorite.movie_source_id);
  }

  /** Guarda la referencia que ya entregó MOD-002, sin repetir la llamada a TMDB. */
  async function handleAddFavorite() {
    if (!movie || !user) {
      return;
    }

    setFavoriteButtonStatus("saving");
    setFavoriteActionError("");
    try {
      const favorite = await addFavorite({
        movie_source: "tmdb",
        movie_source_id: movie.tmdb_id,
        movie_title: movie.title,
        poster_url: movie.poster_url ?? null,
      });
      setFavoriteButtonStatus("saved");
      setFavorites((current) => [
        favorite,
        ...current.filter(
          (item) => item.movie_source_id !== favorite.movie_source_id,
        ),
      ]);
    } catch (error) {
      if (error.code === "FAVORITE_ALREADY_EXISTS") {
        // El duplicado es una respuesta de negocio; no equivale a un fallo técnico.
        setFavoriteButtonStatus("already-saved");
        return;
      }
      if (error.status === 401) {
        setUser(null);
      }
      setFavoriteButtonStatus("error");
    }
  }

  /** Actualiza la lista solo tras el HTTP 204 confirmado por persistencia. */
  async function handleRemoveFavorite(tmdbId) {
    setFavoriteBusyId(tmdbId);
    setFavoriteActionError("");
    try {
      await removeFavorite(tmdbId);
      const remainingFavorites = favorites.filter(
        (favorite) => favorite.movie_source_id !== tmdbId,
      );
      setFavorites(remainingFavorites);
      setFavoritesStatus(remainingFavorites.length ? "ready" : "empty");
      if (movie?.tmdb_id === tmdbId) {
        setFavoriteButtonStatus("idle");
      }
    } catch (error) {
      if (error.status === 401) {
        setUser(null);
      }
      setFavoriteActionError(error.message);
    } finally {
      setFavoriteBusyId(null);
    }
  }

  /** Crea el snapshot de la película abierta; la API asigna autor y visibilidad inicial. */
  async function handleCreateContribution(values) {
    if (!movie || !user) {
      return;
    }

    setContributionBusyId("new");
    setContributionActionError("");
    setContributionActionSuccess("");
    setNotice("");
    try {
      const contribution = await createContribution({
        movie_source: "tmdb",
        movie_source_id: movie.tmdb_id,
        movie_title: movie.title,
        poster_url: movie.poster_url ?? null,
        ...values,
      });
      setMyContributions((current) => [contribution, ...current]);
      setMyContributionsStatus("ready");
      setContributionActionSuccess("Tu aporte se guardó como privado.");
    } catch (error) {
      if (error.status === 401) {
        setUser(null);
      }
      setContributionActionError(error.message);
      if (error.code === "CONTRIBUTION_ALREADY_EXISTS") {
        loadMyContributions();
      }
    } finally {
      setContributionBusyId(null);
    }
  }

  /** Actualiza la lista propia solo después de confirmar el PATCH en el backend. */
  async function handleUpdateContribution(contributionId, changes) {
    setContributionBusyId(contributionId);
    setContributionActionError("");
    setContributionActionSuccess("");
    setNotice("");
    try {
      const updated = await updateContribution(contributionId, changes);
      setMyContributions((current) =>
        current.map((item) =>
          item.contribution_id === contributionId ? updated : item,
        ),
      );
      setMyContributionsStatus("ready");
      setContributionActionSuccess("Los cambios de tu aporte se guardaron.");
      if (route.screen === "pelicula" && updated.movie.source_id === route.id) {
        loadPublicContributions(route.id);
      }
      return updated;
    } catch (error) {
      if (error.status === 401) {
        setUser(null);
      }
      setContributionActionError(error.message);
      return null;
    } finally {
      setContributionBusyId(null);
    }
  }

  /** Elimina el aporte tras el 204; no modifica la colección de Favoritos. */
  async function handleDeleteContribution(contribution) {
    const contributionId = contribution.contribution_id;
    setContributionBusyId(contributionId);
    setContributionActionError("");
    setContributionActionSuccess("");
    setNotice("");
    try {
      await removeContribution(contributionId);
      const remaining = myContributions.filter(
        (item) => item.contribution_id !== contributionId,
      );
      setMyContributions(remaining);
      setMyContributionsStatus(remaining.length ? "ready" : "empty");
      setContributionActionSuccess("El aporte se eliminó.");
      if (
        route.screen === "pelicula" &&
        contribution.movie.source_id === route.id
      ) {
        loadPublicContributions(route.id);
      }
      if (route.screen === "editar") {
        navigate("mis-aportes");
      }
    } catch (error) {
      if (error.status === 401) {
        setUser(null);
      }
      setContributionActionError(error.message);
    } finally {
      setContributionBusyId(null);
    }
  }

  /** Cambia visibilidad mediante el mismo PATCH parcial usado para editar. */
  function handleChangeContributionVisibility(contribution) {
    return handleUpdateContribution(contribution.contribution_id, {
      visibility: contribution.visibility === "public" ? "private" : "public",
    });
  }

  /** Abre la edición privada con el ID físico del aporte propio seleccionado. */
  function handleEditContribution(contribution) {
    navigate("editar", contribution.contribution_id);
  }

  /** Reintenta la carga del detalle actual después de un error. */
  function retryMovie() {
    if (route.id) {
      detailRequestId.current = null;
      loadMovie(route.id);
    }
  }

  /** Regresa a resultados conservando consulta y lista en el estado de la aplicación. */
  function returnToResults() {
    detailRequestId.current = null;
    navigate("buscar");
  }

  /** Envía el formulario de registro y controla el indicador de envío. */
  async function handleRegister(account) {
    setAccountBusy(true);
    try {
      await createAccount(account);
    } finally {
      setAccountBusy(false);
    }
  }

  /** Inicia sesión; el servicio HTTP renueva CSRF y la UI solo conserva el nombre visible. */
  async function handleLogin(credentials) {
    setAccountBusy(true);
    try {
      const result = await login(credentials);
      setUser(result);
      setNotice(result.csrfWarning ?? "");
      navigate("inicio");
      return result;
    } finally {
      setAccountBusy(false);
    }
  }

  /** Cierra la sesión en el backend y actualiza la navegación aunque haya un error. */
  async function handleLogout() {
    setAccountBusy(true);
    try {
      const result = await logout();
      setUser(null);
      setFavorites([]);
      setFavoritesStatus("idle");
      setMyContributions([]);
      setMyContributionsStatus("idle");
      setNotice(result.csrfWarning ?? "");
      navigate("inicio");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setAccountBusy(false);
    }
  }

  // Selecciona la página según el hash; cada página recibe datos y acciones por props.
  let page;
  switch (route.screen) {
    case "buscar":
      page = (
        <SearchPage
          errorMessage={searchError}
          onQueryChange={setQuery}
          onRetry={() => runSearch(query)}
          onSearch={runSearch}
          onSelectMovie={openMovie}
          query={query}
          results={searchResults}
          status={searchStatus}
        />
      );
      break;
    case "pelicula":
      page = (
        <MovieDetailPage
          errorMessage={movieError}
          favoriteStatus={favoriteButtonStatus}
          isAuthenticated={Boolean(user)}
          movie={movie?.tmdb_id === route.id ? movie : null}
          onAddFavorite={handleAddFavorite}
          onBack={returnToResults}
          onRetry={retryMovie}
          contributions={publicContributions}
          contributionsError={publicContributionsError}
          contributionsStatus={publicContributionsStatus}
          isSubmittingContribution={contributionBusyId === "new"}
          myContribution={
            myContributions.find((item) => item.movie.source_id === route.id) ??
            null
          }
          myContributionsError={myContributionsError}
          myContributionsStatus={myContributionsStatus}
          onCreateContribution={handleCreateContribution}
          onEditContribution={(contribution) =>
            navigate("editar", contribution.contribution_id)
          }
          onRetryContributions={() => loadPublicContributions(route.id)}
          onRetryMyContributions={loadMyContributions}
          contributionActionError={contributionActionError}
          contributionSuccessMessage={contributionActionSuccess}
          status={movieStatus}
        />
      );
      break;
    case "favoritos":
      page = (
        <FavoritesPage
          actionError={favoriteActionError}
          busyId={favoriteBusyId}
          errorMessage={favoritesError}
          favorites={favorites}
          isAuthenticated={Boolean(user)}
          onRemove={handleRemoveFavorite}
          onRetry={loadFavorites}
          onSelect={openFavorite}
          status={favoritesStatus}
        />
      );
      break;
    case "mis-aportes":
      page = (
        <MyContributionsPage
          actionError={contributionActionError}
          busyId={contributionBusyId}
          contributions={myContributions}
          errorMessage={myContributionsError}
          isAuthenticated={Boolean(user)}
          onChangeVisibility={handleChangeContributionVisibility}
          onDelete={handleDeleteContribution}
          onEdit={handleEditContribution}
          onRetry={loadMyContributions}
          successMessage={contributionActionSuccess}
          status={myContributionsStatus}
        />
      );
      break;
    case "editar": {
      const contribution = myContributions.find(
        (item) => String(item.contribution_id) === route.id,
      );
      page = (
        <EditContributionPage
          actionError={contributionActionError}
          contribution={contribution}
          errorMessage={myContributionsError}
          isAuthenticated={Boolean(user)}
          isSubmitting={contributionBusyId === Number(route.id)}
          onCancel={() => navigate("mis-aportes")}
          onRetry={loadMyContributions}
          onSubmit={async (changes) => {
            const updated = await handleUpdateContribution(
              Number(route.id),
              changes,
            );
            if (updated) {
              navigate("mis-aportes");
            }
          }}
          status={myContributionsStatus}
          successMessage={contributionActionSuccess}
        />
      );
      break;
    }
    case "registro":
      page = (
        <RegisterPage isSubmitting={accountBusy} onRegister={handleRegister} />
      );
      break;
    case "acceso":
      page = <LoginPage isSubmitting={accountBusy} onLogin={handleLogin} />;
      break;
    case "inicio":
    default:
      page = (
        <HomePage
          isLoading={searchStatus === "loading"}
          onQueryChange={setQuery}
          onSearch={runSearch}
          query={query}
        />
      );
      break;
  }

  return (
    <div className="app-shell">
      <div className="app-shell__inner">
        <Navbar onLogout={handleLogout} screen={route.screen} user={user} />
        {notice ? (
          <p className="global-notice" role="status">
            {notice}
          </p>
        ) : null}
        <main className="main-content" id="main-content">
          {page}
        </main>
        <footer className="site-footer">
          <p>Klazia FilmScore</p>
        </footer>
      </div>
    </div>
  );
}
