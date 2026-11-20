const API_BASE_URL = "http://localhost:3000/api";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Error HTTP controlado: conserva mensaje, status y código funcional. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = "NETWORK_ERROR" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

let csrfToken;

/** Invalida el token guardado después de rotar o destruir una sesión. */
export function clearCsrfToken() {
  csrfToken = undefined;
}

/**
 * Envía JSON a la API propia e interpreta su contrato de respuesta.
 * Agrega cookie y CSRF en mutaciones; convierte red, respuestas inválidas y errores HTTP.
 */
async function request(path, { method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  // Toda mutación usa un token sincronizado con la cookie de sesión del backend.
  if (MUTATING_METHODS.has(method)) {
    if (!csrfToken) {
      await getCsrfToken();
    }
    headers["X-CSRF-Token"] = csrfToken;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: "include",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "No pudimos conectar con el servidor. Inténtalo nuevamente.",
    );
  }

  // DELETE de sesión no trae cuerpo; evita intentar analizar JSON vacío.
  if (response.status === 204) {
    return null;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("El servidor devolvió una respuesta no válida.", {
      status: response.status,
    });
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ??
        "No pudimos procesar la solicitud. Inténtalo nuevamente.",
      {
        status: response.status,
        code: payload?.error?.code ?? "REQUEST_FAILED",
      },
    );
  }

  return payload?.data ?? payload;
}

/** Obtiene y valida un token CSRF antes de la siguiente mutación. */
export async function getCsrfToken() {
  const result = await request("/csrf-token");
  if (typeof result.csrfToken !== "string" || result.csrfToken.length === 0) {
    throw new ApiError("No pudimos preparar la solicitud de forma segura.", {
      code: "CSRF_TOKEN_UNAVAILABLE",
    });
  }
  csrfToken = result.csrfToken;
  return csrfToken;
}

/** Crea una cuenta; el backend persiste el usuario, pero no inicia sesión. */
export async function createAccount(account) {
  return request("/cuentas", { method: "POST", body: account });
}

/**
 * Autentica y obtiene el token CSRF de la nueva sesión.
 * Si no puede renovarlo, devuelve una advertencia visible sin ocultar el login exitoso.
 */
export async function login(credentials) {
  const result = await request("/sesiones", {
    method: "POST",
    body: credentials,
  });
  clearCsrfToken();

  try {
    await getCsrfToken();
    return result;
  } catch {
    return {
      ...result,
      csrfWarning:
        "La sesión inició, pero no pudimos renovar la protección de la solicitud. Recarga la página antes de cerrar sesión.",
    };
  }
}

/** Destruye la sesión y renueva CSRF para futuras mutaciones anónimas. */
export async function logout() {
  await request("/sesiones", { method: "DELETE" });
  clearCsrfToken();

  try {
    await getCsrfToken();
    return { csrfWarning: null };
  } catch {
    return {
      csrfWarning:
        "La sesión se cerró, pero no pudimos renovar la protección de la solicitud.",
    };
  }
}

/** Busca películas por título en la API local y devuelve solo su lista de resultados. */
export function searchMovies(title) {
  const query = new URLSearchParams({ titulo: title });
  return request(`/peliculas?${query.toString()}`).then(
    (result) => result.results,
  );
}

/** Pide a la API local el detalle TMDB para el ID indicado. */
export function getMovie(tmdbId) {
  return request(`/peliculas/${encodeURIComponent(tmdbId)}`).then(
    (result) => result.movie,
  );
}

/** Consulta los snapshots propios; la respuesta vacía es distinta de un error HTTP. */
export function getFavorites() {
  return request("/favoritos").then((result) => result.favorites);
}

/** Persiste la referencia seleccionada sin volver a consultar el catálogo externo. */
export function addFavorite(movie) {
  return request("/favoritos", { method: "POST", body: movie }).then(
    (result) => result.favorite,
  );
}

/** Quita la relación propia mediante el ID externo TMDB aprobado por contrato. */
export function removeFavorite(tmdbId) {
  return request(`/favoritos/${encodeURIComponent(tmdbId)}`, {
    method: "DELETE",
  });
}

/** Consulta los aportes públicos del detalle sin requerir sesión. */
export function getPublicContributions(tmdbId) {
  return request(`/peliculas/${encodeURIComponent(tmdbId)}/aportes`).then(
    (result) => result.contributions,
  );
}

/** Consulta la lista propia; la identidad se resuelve en la sesión del backend. */
export function getOwnContributions() {
  return request("/aportes/propios").then((result) => result.contributions);
}

/** Crea un aporte con el snapshot disponible de la película seleccionada. */
export function createContribution(contribution) {
  return request("/aportes", {
    method: "POST",
    body: contribution,
  }).then((result) => result.contribution);
}

/** Envía solo los campos editables autorizados del aporte propio. */
export function updateContribution(contributionId, changes) {
  return request(`/aportes/${encodeURIComponent(contributionId)}`, {
    method: "PATCH",
    body: changes,
  }).then((result) => result.contribution);
}

/** Elimina el aporte propio después de que el backend confirme HTTP 204. */
export function removeContribution(contributionId) {
  return request(`/aportes/${encodeURIComponent(contributionId)}`, {
    method: "DELETE",
  });
}
