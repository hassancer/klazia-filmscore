import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogUnavailableError } from "../errors/application-errors.js";
import { createTmdbService } from "./tmdbService.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("TMDB catalog adapter", () => {
  it("returns a controlled unavailable error without a token", async () => {
    const fetchImpl = vi.fn();
    const service = createTmdbService({ accessToken: null, fetchImpl });

    await expect(service.searchMovies("Spirited Away")).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps only fields supplied by TMDB and preserves the rating source", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 11,
        title: "Película ficticia",
        poster_path: null,
        release_date: "",
        overview: "",
        vote_average: 8.4,
        vote_count: 21,
        genres: [{ name: "Drama" }],
      }),
    });
    const service = createTmdbService({
      accessToken: "test-token",
      fetchImpl,
    });

    await expect(service.getMovie("11")).resolves.toMatchObject({
      tmdb_id: "11",
      title: "Película ficticia",
      poster_url: null,
      release_year: null,
      overview: "",
      genres: ["Drama"],
      vote_average: 8.4,
      rating_source: "TMDB",
      rating_scale: "0–10",
    });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer test-token",
    );
  });

  it("aborts a provider request after the configured timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
    );
    const service = createTmdbService({
      accessToken: "test-token",
      fetchImpl,
      timeoutMs: 4_000,
    });
    const search = service.searchMovies("Película ficticia");
    const rejection = expect(search).rejects.toMatchObject({
      name: CatalogUnavailableError.name,
      statusCode: 504,
    });

    await vi.advanceTimersByTimeAsync(4_000);
    await rejection;
  });
});
