import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { clearCsrfToken } from "./services/api.js";

// Evita que el DOM, los espías o la navegación de un caso afecten a otro.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.location.hash = "";
  vi.unstubAllGlobals();
});

// Cada escenario comienza sin un token CSRF residual.
beforeEach(() => {
  clearCsrfToken();
});

// Construye una respuesta con la forma mínima que consume el servicio HTTP del frontend.
function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

// Simula el intercambio de tokens CSRF y la respuesta correcta de inicio de sesión.
function mockLoginResponses(fetchMock) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(200, { csrfToken: "csrf-before" }))
    .mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: { display_name: "Persona de prueba" },
      }),
    )
    .mockResolvedValueOnce(jsonResponse(200, { csrfToken: "csrf-after" }));
}

// Completa el inicio de sesión y espera a que la navegación privada esté disponible.
async function submitLogin() {
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "persona@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "ClavePrueba123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  await screen.findByRole("link", { name: "Mis Favoritos" });
}

describe("public application shell", () => {
  // Confirma que la portada expone la identidad de la aplicación y sus rutas públicas.
  it("identifies Klazia FilmScore and links to the included public functions", () => {
    render(<App />);

    expect(
      screen.getByRole("link", { name: "Klazia FilmScore, inicio" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Klazia FilmScore/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Busca una película, explora sus detalles/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Buscar películas" }),
    ).toHaveAttribute("href", "#/buscar");
    expect(screen.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute(
      "href",
      "#/registro",
    );
    expect(
      screen.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "#/acceso");
  });

  // Comprueba que el enlace de búsqueda actualiza tanto la vista como la ruta del navegador.
  it("navigates to the base route for public search", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("link", { name: "Buscar películas" }));

    expect(
      await screen.findByRole("heading", { name: "Buscar películas" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/buscar");
  });

  // Distingue una búsqueda válida sin coincidencias y conserva el texto introducido.
  it("searches once, distinguishes empty results, and preserves the title", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: { results: [] } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Título de película"), {
      target: { value: "Película sin coincidencias" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /No hay resultados/,
    );
    expect(screen.getByLabelText("Título de película")).toHaveValue(
      "Película sin coincidencias",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain(
      "titulo=Pel%C3%ADcula+sin+coincidencias",
    );
  });

  // Un error del proveedor no equivale a una lista vacía; el reintento requiere una acción explícita.
  it("keeps provider failure separate and retries only after a manual action", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(503, {
          success: false,
          error: {
            code: "TMDB_UNAVAILABLE",
            message: "El catálogo no está disponible en este momento.",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            results: [
              {
                tmdb_id: "11",
                title: "Película ficticia",
                poster_url: null,
                release_year: "2020",
                overview: null,
              },
            ],
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Título de película"), {
      target: { value: "Película ficticia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El catálogo no está disponible",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(
      await screen.findByRole("heading", { name: "Película ficticia" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // Las reseñas son contenido no confiable: deben conservarse como texto y no convertirse en HTML.
  it("renders public review text literally and labels the external rating separately", async () => {
    // Esta cadena comprueba a la vez el tratamiento literal de etiquetas y de una URL.
    const reviewText =
      '<script>alert("prueba")</script> Visita https://ejemplo.invalid';
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            results: [
              {
                tmdb_id: "11",
                title: "Película ficticia",
                poster_url: null,
                release_year: "2020",
                overview: null,
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            movie: {
              tmdb_id: "11",
              title: "Película ficticia",
              poster_url: null,
              release_year: "2020",
              overview: "Una sinopsis ficticia.",
              genres: ["Drama"],
              runtime: 100,
              vote_average: 8.1,
              rating_source: "TMDB",
              rating_scale: "0–10",
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            contributions: [
              {
                contribution_id: 7,
                author_display_name: "Persona autora",
                rating: 4,
                review_text: reviewText,
                created_at: "2026-11-19 14:30:00",
              },
            ],
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Título de película"), {
      target: { value: "Película ficticia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle" }));

    expect(
      await screen.findByText("Calificación TMDB (escala 0–10)"),
    ).toBeInTheDocument();
    expect(screen.getByText("8.1")).toBeInTheDocument();
    expect(screen.getByText("Una sinopsis ficticia.")).toBeInTheDocument();
    expect(screen.getByText("Persona autora")).toBeInTheDocument();
    const renderedReview = screen.getByText(reviewText);
    expect(renderedReview).toBeInTheDocument();
    expect(renderedReview.tagName).toBe("P");
    expect(renderedReview.textContent).toBe(reviewText);
    // Sin hijos HTML, la etiqueta y la URL permanecen en el mismo nodo de texto.
    expect(renderedReview.childElementCount).toBe(0);
    expect(
      renderedReview.querySelector("script, a, iframe, object, embed"),
    ).toBeNull();
    // Detecta si el contenido hubiera ejecutado el alert incluido en la reseña.
    expect(alertSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  // Si el servidor rechaza el acceso, se conserva el correo, se borra la contraseña y se informa el error.
  it("preserves login email and clears the password after a persistence error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { csrfToken: "fake-csrf-token" }),
      )
      .mockResolvedValueOnce(
        jsonResponse(500, {
          success: false,
          error: {
            code: "AUTH_PERSISTENCE_ERROR",
            message:
              "No pudimos procesar el inicio de sesión. Inténtalo nuevamente.",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    window.location.hash = "#/acceso";
    render(<App />);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "persona@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "ClavePrueba123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos procesar el inicio de sesión",
    );
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue(
      "persona@example.invalid",
    );
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  // Un fallo al crear la cuenta conserva nombre/correo y limpia la contraseña.
  it("preserves registration fields and clears the password after a database error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { csrfToken: "fake-csrf-token" }),
      )
      .mockResolvedValueOnce(
        jsonResponse(500, {
          success: false,
          error: {
            code: "REGISTRATION_PERSISTENCE_ERROR",
            message:
              "No pudimos crear la cuenta en este momento. Inténtalo nuevamente.",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    window.location.hash = "#/registro";
    render(<App />);

    fireEvent.change(screen.getByLabelText("Nombre visible"), {
      target: { value: "Persona de prueba" },
    });
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "persona@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "ClavePrueba123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos crear la cuenta",
    );
    expect(screen.getByLabelText("Nombre visible")).toHaveValue(
      "Persona de prueba",
    );
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue(
      "persona@example.invalid",
    );
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  // La lista refleja el snapshot privado y solo retira el favorito tras la confirmación del servidor.
  it("loads private snapshots and removes a favorite only after the API confirms", async () => {
    const savedFavorite = {
      movie_source: "tmdb",
      movie_source_id: "123",
      movie_title: "Película guardada",
      poster_url: null,
      created_at: "2026-11-18 10:00:00",
    };
    const fetchMock = vi.fn();
    mockLoginResponses(fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { favorites: [savedFavorite] },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(204, null));
    vi.stubGlobal("fetch", fetchMock);
    window.location.hash = "#/acceso";
    render(<App />);

    await submitLogin();
    fireEvent.click(screen.getByRole("link", { name: "Mis Favoritos" }));

    expect(
      await screen.findByRole("heading", { name: "Mis Favoritos" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Película guardada")).toBeInTheDocument();
    expect(screen.getByText(/Guardada el/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Quitar de favoritos" }),
    );

    expect(
      await screen.findByText("Todavía no tienes películas en tu lista."),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe(
      "http://localhost:3000/api/favoritos",
    );
    expect(fetchMock.mock.calls[4][0]).toBe(
      "http://localhost:3000/api/favoritos/123",
    );
    expect(fetchMock.mock.calls[4][1]).toMatchObject({
      method: "DELETE",
      credentials: "include",
      headers: { "X-CSRF-Token": "csrf-after" },
    });
  });

  // Un fallo de TMDB no debe perder los datos ya seleccionados para crear el favorito local.
  it("preserves the selected snapshot when TMDB detail is unavailable and adds it locally", async () => {
    const fetchMock = vi.fn();
    mockLoginResponses(fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            results: [
              {
                tmdb_id: "123",
                title: "Película guardada",
                poster_url: "https://image.tmdb.org/t/p/w500/poster.jpg",
                release_year: "2020",
                overview: "Resumen disponible desde la búsqueda.",
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(503, {
          success: false,
          error: {
            code: "TMDB_UNAVAILABLE",
            message: "El catálogo no está disponible en este momento.",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: { contributions: [] } }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: { contributions: [] } }),
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          success: true,
          data: {
            favorite: {
              movie_source: "tmdb",
              movie_source_id: "123",
              movie_title: "Película guardada",
              poster_url: "https://image.tmdb.org/t/p/w500/poster.jpg",
              created_at: "2026-11-18 10:00:00",
            },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    window.location.hash = "#/acceso";
    render(<App />);

    await submitLogin();
    fireEvent.click(screen.getByRole("link", { name: "Buscar películas" }));
    fireEvent.change(screen.getByLabelText("Título de película"), {
      target: { value: "Película guardada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle" }));

    expect(
      await screen.findByText(/Mostramos la información disponible/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Película guardada" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar a favoritos" }),
    );

    expect(
      await screen.findByText("Agregada a tus favoritos."),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[7][0]).toBe(
      "http://localhost:3000/api/favoritos",
    );
    expect(JSON.parse(fetchMock.mock.calls[7][1].body)).toEqual({
      movie_source: "tmdb",
      movie_source_id: "123",
      movie_title: "Película guardada",
      poster_url: "https://image.tmdb.org/t/p/w500/poster.jpg",
    });
  });

  // La creación envía el snapshot seleccionado y confirma que el aporte nace privado.
  it("creates a private contribution from the selected movie snapshot", async () => {
    const savedContribution = {
      contribution_id: 42,
      movie: {
        source: "tmdb",
        source_id: "123",
        title: "Película guardada",
        poster_url: null,
      },
      rating: 4,
      review_text: "Una reseña propia suficientemente larga.",
      visibility: "private",
      created_at: "2026-11-19 14:30:00",
    };
    const fetchMock = vi.fn();
    mockLoginResponses(fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            results: [
              {
                tmdb_id: "123",
                title: "Película guardada",
                poster_url: null,
                release_year: "2020",
                overview: null,
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            movie: {
              tmdb_id: "123",
              title: "Película guardada",
              poster_url: null,
              release_year: "2020",
              overview: null,
              genres: [],
              runtime: null,
              vote_average: 8,
              rating_source: "TMDB",
              rating_scale: "0–10",
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: { contributions: [] } }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: { contributions: [] } }),
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          success: true,
          data: { contribution: savedContribution },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    window.location.hash = "#/acceso";
    render(<App />);

    await submitLogin();
    fireEvent.click(screen.getByRole("link", { name: "Buscar películas" }));
    fireEvent.change(screen.getByLabelText("Título de película"), {
      target: { value: "Película guardada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle" }));

    fireEvent.change(
      await screen.findByLabelText("Calificación personal (1 a 5)"),
      { target: { value: "4" } },
    );
    fireEvent.change(screen.getByLabelText("Reseña (10 a 1.000 caracteres)"), {
      target: { value: "Una reseña propia suficientemente larga." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar aporte" }));

    expect(
      await screen.findByText("Tu aporte se guardó como privado."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Una reseña propia suficientemente larga."),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[7][0]).toBe(
      "http://localhost:3000/api/aportes",
    );
    expect(JSON.parse(fetchMock.mock.calls[7][1].body)).toEqual({
      movie_source: "tmdb",
      movie_source_id: "123",
      movie_title: "Película guardada",
      poster_url: null,
      rating: 4,
      review_text: "Una reseña propia suficientemente larga.",
    });
    expect(fetchMock.mock.calls[7][1].headers["X-CSRF-Token"]).toBe(
      "csrf-after",
    );
  });

  // La edición parcial cambia solo los campos editables y usa PATCH con protección CSRF.
  it("edits a contribution through a partial PATCH and returns to the private list", async () => {
    const savedContribution = {
      contribution_id: 42,
      movie: {
        source: "tmdb",
        source_id: "123",
        title: "Película guardada",
        poster_url: null,
      },
      rating: 5,
      review_text: "Una reseña propia suficientemente larga.",
      visibility: "private",
      created_at: "2026-11-19 14:30:00",
    };
    const updatedContribution = {
      ...savedContribution,
      rating: 4,
    };
    const fetchMock = vi.fn();
    mockLoginResponses(fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { contributions: [savedContribution] },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { contribution: updatedContribution },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    window.location.hash = "#/acceso";
    render(<App />);

    await submitLogin();
    fireEvent.click(screen.getByRole("link", { name: "Mis aportes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.change(
      await screen.findByLabelText("Calificación personal (1 a 5)"),
      { target: { value: "4" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText(/Calificación personal: 4\/5/),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[4][0]).toBe(
      "http://localhost:3000/api/aportes/42",
    );
    expect(fetchMock.mock.calls[4][1]).toMatchObject({
      method: "PATCH",
      credentials: "include",
      headers: { "X-CSRF-Token": "csrf-after" },
    });
    expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toEqual({
      rating: 4,
      review_text: "Una reseña propia suficientemente larga.",
      visibility: "private",
    });
  });

  // La visibilidad y el borrado usan solo rutas de aportes, sin mutar Favoritos.
  it("changes visibility and deletes only through confirmed API responses", async () => {
    const savedContribution = {
      contribution_id: 42,
      movie: {
        source: "tmdb",
        source_id: "123",
        title: "Película guardada",
        poster_url: null,
      },
      rating: 5,
      review_text: "Una reseña propia suficientemente larga.",
      visibility: "private",
      created_at: "2026-11-19 14:30:00",
    };
    const publicContribution = {
      ...savedContribution,
      visibility: "public",
    };
    const fetchMock = vi.fn();
    mockLoginResponses(fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { contributions: [savedContribution] },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { contribution: publicContribution },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(204, null));
    vi.stubGlobal("fetch", fetchMock);
    window.location.hash = "#/acceso";
    render(<App />);

    await submitLogin();
    fireEvent.click(screen.getByRole("link", { name: "Mis aportes" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Hacer público" }),
    );

    expect(await screen.findByText(/Público/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar aporte" }));
    expect(
      await screen.findByText("Todavía no tienes aportes."),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[4][0]).toBe(
      "http://localhost:3000/api/aportes/42",
    );
    expect(fetchMock.mock.calls[4][1].method).toBe("PATCH");
    expect(fetchMock.mock.calls[5][0]).toBe(
      "http://localhost:3000/api/aportes/42",
    );
    expect(fetchMock.mock.calls[5][1].method).toBe("DELETE");
    expect(
      fetchMock.mock.calls.some(([url]) => url.includes("/favoritos")),
    ).toBe(false);
  });

  // En la vista pública, un error recuperable no debe presentarse como una lista vacía.
  it("keeps public contribution read errors separate from an empty list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            results: [
              {
                tmdb_id: "123",
                title: "Película de prueba",
                poster_url: null,
                release_year: "2020",
                overview: null,
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            movie: {
              tmdb_id: "123",
              title: "Película de prueba",
              poster_url: null,
              release_year: "2020",
              overview: null,
              genres: [],
              runtime: null,
              vote_average: 8,
              rating_source: "TMDB",
              rating_scale: "0–10",
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(500, {
          success: false,
          error: {
            code: "CONTRIBUTION_READ_ERROR",
            message: "No pudimos consultar los aportes públicos.",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { contributions: [] },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Título de película"), {
      target: { value: "Película de prueba" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle" }));

    expect(
      await screen.findByText("No pudimos consultar los aportes públicos."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Todavía no hay aportes públicos para esta película."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(
      await screen.findByText(
        "Todavía no hay aportes públicos para esta película.",
      ),
    ).toBeInTheDocument();
  });

  // Aplica la misma distinción entre error y vacío a la lista privada de aportes.
  it("keeps private contribution read errors separate from an empty list", async () => {
    const fetchMock = vi.fn();
    mockLoginResponses(fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(500, {
          success: false,
          error: {
            code: "CONTRIBUTION_READ_ERROR",
            message: "No pudimos consultar tus aportes.",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { contributions: [] },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    window.location.hash = "#/acceso";
    render(<App />);

    await submitLogin();
    fireEvent.click(screen.getByRole("link", { name: "Mis aportes" }));

    expect(
      await screen.findByText("No pudimos consultar tus aportes."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Todavía no tienes aportes."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(
      await screen.findByText("Todavía no tienes aportes."),
    ).toBeInTheDocument();
  });

  // Comprueba que un fallo al leer favoritos se muestre y que el reintento pueda devolver una lista vacía.
  it("keeps a favorite read error separate from a successful empty list", async () => {
    const fetchMock = vi.fn();
    mockLoginResponses(fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(500, {
          success: false,
          error: {
            code: "FAVORITE_PERSISTENCE_ERROR",
            message:
              "No pudimos consultar tus favoritos. Inténtalo nuevamente.",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: { favorites: [] } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    window.location.hash = "#/acceso";
    render(<App />);

    await submitLogin();
    fireEvent.click(screen.getByRole("link", { name: "Mis Favoritos" }));
    expect(
      await screen.findByText(
        "No pudimos consultar tus favoritos. Inténtalo nuevamente.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Todavía no tienes películas en tu lista."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByText("Todavía no tienes películas en tu lista."),
    ).toBeInTheDocument();
  });
});
