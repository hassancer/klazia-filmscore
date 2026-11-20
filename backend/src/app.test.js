import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { createDatabase } from "./database/connection.js";
import { runMigrations } from "./database/migrate.js";

const frontendOrigin = "http://localhost:5173";
const sessionSecret = "a".repeat(64);

describe("account API", () => {
  let database;
  let app;
  let logger;
  let agent;

  beforeEach(() => {
    database = createDatabase(":memory:");
    runMigrations(database);
    logger = { error: vi.fn() };
    app = createApp({
      config: {
        frontendOrigin,
        sessionIdleTimeoutMs: 1_800_000,
        sessionSecret,
        tmdbAccessToken: null,
        tmdbBaseUrl: "https://api.themoviedb.org/3",
        tmdbTimeoutMs: 4_000,
      },
      database,
      logger,
    });
    agent = request.agent(app);
  });

  afterEach(() => {
    database?.close();
  });

  async function getCsrfToken(targetAgent = agent) {
    const response = await targetAgent
      .get("/api/csrf-token")
      .set("Origin", frontendOrigin);
    expect(response.status).toBe(200);
    return response.body.csrfToken;
  }

  async function registerAccount(targetAgent = agent, account = {}) {
    const csrfToken = await getCsrfToken(targetAgent);
    return targetAgent
      .post("/api/cuentas")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send({
        display_name: account.display_name ?? "Cinefila de prueba",
        email: account.email ?? "cinefila@example.invalid",
        password: account.password ?? "CinePrueba123",
      });
  }

  async function createAuthenticatedAgent(
    email = "cinefila@example.invalid",
    displayName = "Cinefila de prueba",
  ) {
    const authenticatedAgent = request.agent(app);
    const registration = await registerAccount(authenticatedAgent, {
      display_name: displayName,
      email,
    });
    expect(registration.status).toBe(201);

    const csrfToken = await getCsrfToken(authenticatedAgent);
    const login = await authenticatedAgent
      .post("/api/sesiones")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send({ email, password: "CinePrueba123" });
    expect(login.status).toBe(200);

    return {
      agent: authenticatedAgent,
      csrfToken: await getCsrfToken(authenticatedAgent),
    };
  }

  function favoritePayload(movieSourceId = "123") {
    return {
      movie_source: "tmdb",
      movie_source_id: movieSourceId,
      movie_title: "Película ficticia",
      poster_url: "https://image.tmdb.org/t/p/w500/poster.jpg",
    };
  }

  async function addFavorite(authenticated, payload = favoritePayload()) {
    return authenticated.agent
      .post("/api/favoritos")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", authenticated.csrfToken)
      .send(payload);
  }

  function contributionPayload(movieSourceId = "157336", overrides = {}) {
    return {
      movie_source: "tmdb",
      movie_source_id: movieSourceId,
      movie_title: "Película ficticia",
      poster_url: null,
      rating: 5,
      review_text: "Una reseña ficticia.",
      ...overrides,
    };
  }

  async function addContribution(
    authenticated,
    payload = contributionPayload(),
  ) {
    return authenticated.agent
      .post("/api/aportes")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", authenticated.csrfToken)
      .send(payload);
  }

  it("creates a normalized account without exposing credentials or starting a session", async () => {
    const response = await registerAccount();

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({ display_name: "Cinefila de prueba" });
    expect(JSON.stringify(response.body)).not.toMatch(
      /cinefila@example\.invalid|CinePrueba123|password_hash/i,
    );
    expect(
      database.prepare("SELECT email, password_hash FROM users").get(),
    ).toMatchObject({
      email: "cinefila@example.invalid",
      password_hash: expect.stringMatching(/^\$2[aby]\$10\$/),
    });
  });

  it("rejects duplicate normalized email and mutations without valid CSRF", async () => {
    await registerAccount();
    const csrfToken = await getCsrfToken();
    const duplicate = await agent
      .post("/api/cuentas")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send({
        display_name: "Otra cuenta",
        email: " CINEFILA@EXAMPLE.INVALID ",
        password: "CinePrueba123",
      });
    const forbidden = await agent
      .post("/api/cuentas")
      .set("Origin", frontendOrigin)
      .send({
        display_name: "Otra cuenta",
        email: "otra@example.invalid",
        password: "CinePrueba123",
      });

    expect(duplicate.status).toBe(409);
    expect(forbidden.status).toBe(403);
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM users").get().count,
    ).toBe(1);
  });

  it("authenticates, rotates the session, and closes it with CSRF protection", async () => {
    await registerAccount();
    const tokenBeforeLogin = await getCsrfToken();
    const loginResponse = await agent
      .post("/api/sesiones")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", tokenBeforeLogin)
      .send({
        email: " CINEFILA@EXAMPLE.INVALID ",
        password: "CinePrueba123",
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data).toEqual({
      display_name: "Cinefila de prueba",
    });

    const tokenAfterLogin = await getCsrfToken();
    expect(tokenAfterLogin).not.toBe(tokenBeforeLogin);
    const logoutResponse = await agent
      .delete("/api/sesiones")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", tokenAfterLogin);

    expect(logoutResponse.status).toBe(204);
  });

  it("returns a sanitized persistence error when SQLite cannot authenticate", async () => {
    const csrfToken = await getCsrfToken();
    database.close();
    database = undefined;

    const response = await agent
      .post("/api/sesiones")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send({
        email: "private@example.invalid",
        password: "SecretValue123",
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "AUTH_PERSISTENCE_ERROR",
        message:
          "No pudimos procesar el inicio de sesión. Inténtalo nuevamente.",
      },
    });
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(
      /private@example\.invalid|SecretValue123|sqlite|select|stack/i,
    );
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error.mock.calls[0][0]).not.toMatch(
      /private@example\.invalid|SecretValue123/i,
    );
  });

  it("does not partially create an account when SQLite rejects the write", async () => {
    database.exec(`
      CREATE TRIGGER reject_account
      BEFORE INSERT ON users
      BEGIN
        SELECT RAISE(ABORT, 'private database diagnostic');
      END;
    `);
    const csrfToken = await getCsrfToken();
    const response = await agent
      .post("/api/cuentas")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send({
        display_name: "Cuenta de prueba",
        email: "private@example.invalid",
        password: "SecretValue123",
      });

    expect(response.status).toBe(500);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.body.error.message).toBe(
      "No pudimos crear la cuenta en este momento. Inténtalo nuevamente.",
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /private@example\.invalid|SecretValue123|private database diagnostic/i,
    );
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM users").get().count,
    ).toBe(0);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it("keeps status public and reports missing TMDB configuration as unavailable", async () => {
    const status = await request(app).get("/api/status");
    const catalog = await request(app).get("/api/peliculas").query({
      titulo: "Película ficticia",
    });

    expect(status.status).toBe(200);
    expect(status.body).toEqual({ success: true, data: { status: "ok" } });
    expect(catalog.status).toBe(503);
    expect(catalog.body.error.code).toBe("TMDB_UNAVAILABLE");
    expect(JSON.stringify(catalog.body)).not.toMatch(
      /token|sql|stack|database/i,
    );
  });

  it("rejects mutating requests from an unapproved origin", async () => {
    const response = await agent
      .post("/api/cuentas")
      .set("Origin", "http://example.invalid")
      .send({
        display_name: "Cinefila",
        email: "cinefila@example.invalid",
        password: "CinePrueba123",
      });

    expect(response.status).toBe(403);
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM users").get().count,
    ).toBe(0);
  });

  it("creates snapshots and returns a conflict without changing duplicate data", async () => {
    const authenticated = await createAuthenticatedAgent();
    const created = await addFavorite(authenticated);
    const duplicate = await addFavorite(authenticated);

    expect(created.status).toBe(201);
    expect(created.body.data.favorite).toMatchObject({
      movie_source: "tmdb",
      movie_source_id: "123",
      movie_title: "Película ficticia",
      poster_url: "https://image.tmdb.org/t/p/w500/poster.jpg",
    });
    expect(created.body.data.favorite.created_at).toEqual(expect.any(String));
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toMatchObject({
      code: "FAVORITE_ALREADY_EXISTS",
      message: "Ya está guardada en tus favoritos.",
    });

    const list = await authenticated.agent.get("/api/favoritos");
    expect(list.status).toBe(200);
    expect(list.body.data.favorites).toEqual([created.body.data.favorite]);
  });

  it("returns only the authenticated account's snapshot and preserves created_at", async () => {
    const authenticated = await createAuthenticatedAgent();
    const created = await addFavorite(authenticated);

    const response = await authenticated.agent.get("/api/favoritos/123");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { favorite: created.body.data.favorite },
    });
    expect(response.body.data.favorite.created_at).toBe(
      created.body.data.favorite.created_at,
    );
    expect(Object.keys(response.body.data.favorite).sort()).toEqual(
      [
        "created_at",
        "movie_source",
        "movie_source_id",
        "movie_title",
        "poster_url",
      ].sort(),
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /user_id|cinefila@example\.invalid|password/i,
    );
  });

  it("returns the same 404 for another account's favorite and a nonexistent ID", async () => {
    const accountA = await createAuthenticatedAgent(
      "persona-a@example.invalid",
      "Persona A",
    );
    const accountB = await createAuthenticatedAgent(
      "persona-b@example.invalid",
      "Persona B",
    );
    const createdA = await addFavorite(accountA, {
      ...favoritePayload(),
      movie_title: "Snapshot privado de A",
    });

    const missingFromB = await accountB.agent.get("/api/favoritos/123");
    const nonexistentForB = await accountB.agent.get("/api/favoritos/999");

    expect(createdA.status).toBe(201);
    expect(missingFromB.status).toBe(404);
    expect(nonexistentForB.status).toBe(404);
    expect(missingFromB.body).toEqual(nonexistentForB.body);
    expect(JSON.stringify(missingFromB.body)).not.toMatch(
      /Snapshot privado de A|persona-a@example\.invalid|user_id/i,
    );

    const createdB = await addFavorite(accountB, {
      ...favoritePayload(),
      movie_title: "Snapshot privado de B",
    });
    const responseB = await accountB.agent.get("/api/favoritos/123");

    expect(createdB.status).toBe(201);
    expect(responseB.status).toBe(200);
    expect(responseB.body.data.favorite.movie_title).toBe(
      "Snapshot privado de B",
    );
  });

  it("requires a session and rejects invalid favorite IDs without CSRF", async () => {
    const unauthenticated = await agent.get("/api/favoritos/123");
    const authenticated = await createAuthenticatedAgent();
    const invalid = await authenticated.agent.get("/api/favoritos/0");

    expect(unauthenticated.status).toBe(401);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("isolates lists and removes only the authenticated user's favorite", async () => {
    const accountA = await createAuthenticatedAgent(
      "persona-a@example.invalid",
      "Persona A",
    );
    const accountB = await createAuthenticatedAgent(
      "persona-b@example.invalid",
      "Persona B",
    );
    expect((await addFavorite(accountA)).status).toBe(201);
    expect((await addFavorite(accountB)).status).toBe(201);

    const listA = await accountA.agent.get("/api/favoritos");
    const listB = await accountB.agent.get("/api/favoritos");
    expect(listA.body.data.favorites).toHaveLength(1);
    expect(listB.body.data.favorites).toHaveLength(1);
    expect(listA.body.data.favorites[0]).not.toHaveProperty("user_id");

    const removed = await accountA.agent
      .delete("/api/favoritos/123")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", accountA.csrfToken);
    const repeatedRemoval = await accountA.agent
      .delete("/api/favoritos/123")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", accountA.csrfToken);

    expect(removed.status).toBe(204);
    expect(removed.text || "").toBe("");
    expect(repeatedRemoval.status).toBe(404);
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM favorites").get().count,
    ).toBe(1);
    expect(
      (await accountA.agent.get("/api/favoritos")).body.data.favorites,
    ).toEqual([]);
    expect(
      (await accountB.agent.get("/api/favoritos")).body.data.favorites,
    ).toHaveLength(1);
  });

  it("returns 401 without a session and 403 for a missing CSRF token", async () => {
    const anonymousRead = await agent
      .get("/api/favoritos")
      .set("Origin", frontendOrigin);
    const anonymousWrite = await agent
      .post("/api/favoritos")
      .set("Origin", frontendOrigin)
      .send(favoritePayload());

    expect(anonymousRead.status).toBe(401);
    expect(anonymousWrite.status).toBe(401);

    const authenticated = await createAuthenticatedAgent();
    const missingToken = await authenticated.agent
      .post("/api/favoritos")
      .set("Origin", frontendOrigin)
      .send(favoritePayload());
    const invalidToken = await authenticated.agent
      .post("/api/favoritos")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", "invalid-csrf-token")
      .send(favoritePayload());
    expect(missingToken.status).toBe(403);
    expect(invalidToken.status).toBe(403);
  });

  it("reports persistence failures without false success or losing existing data", async () => {
    const authenticated = await createAuthenticatedAgent();
    expect((await addFavorite(authenticated)).status).toBe(201);
    database.exec(`
      CREATE TRIGGER reject_favorite_insert
      BEFORE INSERT ON favorites
      BEGIN
        SELECT RAISE(ABORT, 'private database diagnostic');
      END;
    `);

    const failedInsert = await addFavorite(
      authenticated,
      favoritePayload("456"),
    );
    expect(failedInsert.status).toBe(500);
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM favorites").get().count,
    ).toBe(1);
    expect(JSON.stringify(failedInsert.body)).not.toMatch(
      /private database diagnostic|sqlite|insert/i,
    );

    database.exec("DROP TRIGGER reject_favorite_insert;");
    database.exec(`
      CREATE TRIGGER reject_favorite_delete
      BEFORE DELETE ON favorites
      BEGIN
        SELECT RAISE(ABORT, 'private database diagnostic');
      END;
    `);

    const failedDelete = await authenticated.agent
      .delete("/api/favoritos/123")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", authenticated.csrfToken);

    expect(failedDelete.status).toBe(500);
    expect(failedDelete.body.error.message).toBe(
      "No pudimos guardar la información. Inténtalo nuevamente.",
    );
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM favorites").get().count,
    ).toBe(1);
    expect(JSON.stringify(failedDelete.body)).not.toMatch(
      /private database diagnostic|sqlite|delete/i,
    );
    expect(logger.error).toHaveBeenCalledTimes(2);

    database.exec("DROP TRIGGER reject_favorite_delete; DROP TABLE favorites;");
    const failedRead = await authenticated.agent.get("/api/favoritos");
    expect(failedRead.status).toBe(500);
    expect(failedRead.body).toEqual({
      success: false,
      error: {
        code: "FAVORITE_READ_ERROR",
        message: "No pudimos consultar tus favoritos. Inténtalo nuevamente.",
      },
    });
    expect(failedRead.body.data).toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(3);

    const failedLookup = await authenticated.agent.get("/api/favoritos/123");
    expect(failedLookup.status).toBe(500);
    expect(failedLookup.body).toEqual(failedRead.body);
    expect(JSON.stringify(failedLookup.body)).not.toMatch(/sqlite|favorites/i);
    expect(logger.error).toHaveBeenCalledTimes(4);
  });

  it("creates private contributions and rejects duplicates without changing the saved row", async () => {
    const accountA = await createAuthenticatedAgent(
      "persona-a@example.invalid",
      "Persona A",
    );
    const accountB = await createAuthenticatedAgent(
      "persona-b@example.invalid",
      "Persona B",
    );
    const created = await addContribution(accountA);
    const duplicate = await addContribution(
      accountA,
      contributionPayload("157336", {
        rating: 1,
        review_text: "Otra reseña diferente.",
      }),
    );

    expect(created.status).toBe(201);
    expect(created.body.data.contribution).toMatchObject({
      contribution_id: expect.any(Number),
      movie: {
        source: "tmdb",
        source_id: "157336",
        title: "Película ficticia",
        poster_url: null,
      },
      rating: 5,
      review_text: "Una reseña ficticia.",
      visibility: "private",
      created_at: expect.any(String),
    });
    expect(created.body.data.contribution).not.toHaveProperty("author_id");
    expect(created.body.data.contribution).not.toHaveProperty("user_id");
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({
      success: false,
      error: {
        code: "CONTRIBUTION_ALREADY_EXISTS",
        message: "Ya tienes un aporte para esta película.",
      },
    });

    const ownA = await accountA.agent.get("/api/aportes/propios");
    const ownB = await accountB.agent.get("/api/aportes/propios");
    expect(ownA.status).toBe(200);
    expect(ownA.body.data.contributions).toEqual([
      created.body.data.contribution,
    ]);
    expect(ownB.body.data.contributions).toEqual([]);
    expect(database.prepare("SELECT rating FROM contributions").get()).toEqual({
      rating: 5,
    });
  });

  it("serves only public contributions with an allowlisted projection and no session", async () => {
    const accountA = await createAuthenticatedAgent(
      "persona-a@example.invalid",
      "Persona A",
    );
    const accountB = await createAuthenticatedAgent(
      "persona-b@example.invalid",
      "Persona B",
    );
    await addContribution(accountA);
    const publicB = await addContribution(
      accountB,
      contributionPayload("157336", {
        visibility: "public",
        review_text: "Reseña pública ficticia.",
      }),
    );

    const response = await agent.get("/api/peliculas/157336/aportes");

    expect(publicB.status).toBe(201);
    expect(response.status).toBe(200);
    expect(response.body.data.contributions).toEqual([
      {
        contribution_id: publicB.body.data.contribution.contribution_id,
        author_display_name: "Persona B",
        rating: 5,
        review_text: "Reseña pública ficticia.",
        created_at: publicB.body.data.contribution.created_at,
      },
    ]);
    expect(Object.keys(response.body.data.contributions[0]).sort()).toEqual(
      [
        "contribution_id",
        "author_display_name",
        "rating",
        "review_text",
        "created_at",
      ].sort(),
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /persona-b@example\.invalid|author_id|user_id|private|poster_url/i,
    );
  });

  it("applies partial edits only to the author and preserves the original date", async () => {
    const accountA = await createAuthenticatedAgent(
      "persona-a@example.invalid",
      "Persona A",
    );
    const accountB = await createAuthenticatedAgent(
      "persona-b@example.invalid",
      "Persona B",
    );
    const created = await addContribution(accountA);
    const contributionId = created.body.data.contribution.contribution_id;
    const originalDate = "2001-02-03 04:05:06";
    database
      .prepare(
        "UPDATE contributions SET created_at = ? WHERE contribution_id = ?",
      )
      .run(originalDate, contributionId);

    const updated = await accountA.agent
      .patch(`/api/aportes/${contributionId}`)
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", accountA.csrfToken)
      .send({ rating: 4 });
    const foreign = await accountB.agent
      .patch(`/api/aportes/${contributionId}`)
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", accountB.csrfToken)
      .send({ rating: 1 });
    const missing = await accountA.agent
      .patch("/api/aportes/99999")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", accountA.csrfToken)
      .send({ rating: 3 });
    const invalid = await accountA.agent
      .patch("/api/aportes/no-es-id")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", accountA.csrfToken)
      .send({ rating: 3 });

    expect(updated.status).toBe(200);
    expect(updated.body.data.contribution).toMatchObject({
      rating: 4,
      review_text: "Una reseña ficticia.",
      visibility: "private",
      created_at: originalDate,
      movie: created.body.data.contribution.movie,
    });
    expect(foreign.status).toBe(403);
    expect(foreign.body.error).toMatchObject({
      code: "CONTRIBUTION_FORBIDDEN",
      message: "No tienes permiso para modificar este aporte.",
    });
    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(400);
    expect(
      database
        .prepare(
          "SELECT rating, review_text, visibility, created_at FROM contributions",
        )
        .get(),
    ).toEqual({
      rating: 4,
      review_text: "Una reseña ficticia.",
      visibility: "private",
      created_at: originalDate,
    });
  });

  it("deletes with 204 and leaves the author's favorite untouched", async () => {
    const accountA = await createAuthenticatedAgent(
      "persona-a@example.invalid",
      "Persona A",
    );
    const accountB = await createAuthenticatedAgent(
      "persona-b@example.invalid",
      "Persona B",
    );
    expect((await addFavorite(accountA)).status).toBe(201);
    const created = await addContribution(accountA);
    const contributionId = created.body.data.contribution.contribution_id;

    const foreign = await accountB.agent
      .delete(`/api/aportes/${contributionId}`)
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", accountB.csrfToken);
    const removed = await accountA.agent
      .delete(`/api/aportes/${contributionId}`)
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", accountA.csrfToken);
    const repeated = await accountA.agent
      .delete(`/api/aportes/${contributionId}`)
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", accountA.csrfToken);

    expect(foreign.status).toBe(403);
    expect(removed.status).toBe(204);
    expect(removed.text || "").toBe("");
    expect(repeated.status).toBe(404);
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM contributions").get()
        .count,
    ).toBe(0);
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM favorites").get().count,
    ).toBe(1);
  });

  it("requires authentication and CSRF only for private reads and mutations", async () => {
    const anonymousOwn = await agent.get("/api/aportes/propios");
    const anonymousCreate = await agent
      .post("/api/aportes")
      .set("Origin", frontendOrigin)
      .send(contributionPayload());
    const publicRead = await agent.get("/api/peliculas/157336/aportes");
    const accountA = await createAuthenticatedAgent();
    const missingToken = await accountA.agent
      .post("/api/aportes")
      .set("Origin", frontendOrigin)
      .send(contributionPayload());
    const created = await addContribution(accountA);
    const invalidPatchToken = await accountA.agent
      .patch(`/api/aportes/${created.body.data.contribution.contribution_id}`)
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", "invalid-csrf-token")
      .send({ rating: 3 });

    expect(anonymousOwn.status).toBe(401);
    expect(anonymousCreate.status).toBe(401);
    expect(publicRead.status).toBe(200);
    expect(missingToken.status).toBe(403);
    expect(invalidPatchToken.status).toBe(403);
    expect(database.prepare("SELECT rating FROM contributions").get()).toEqual({
      rating: 5,
    });
  });

  it("sanitizes contribution persistence and read failures", async () => {
    const accountA = await createAuthenticatedAgent();
    database.exec(`
      CREATE TRIGGER reject_contribution_insert
      BEFORE INSERT ON contributions
      BEGIN
        SELECT RAISE(ABORT, 'private contribution diagnostic');
      END;
    `);

    const failedCreate = await addContribution(
      accountA,
      contributionPayload("987654"),
    );
    expect(failedCreate.status).toBe(500);
    expect(failedCreate.body.error.message).toBe(
      "No pudimos guardar el aporte. Inténtalo nuevamente.",
    );
    expect(JSON.stringify(failedCreate.body)).not.toMatch(
      /private contribution diagnostic|sqlite|insert/i,
    );
    expect(logger.error).toHaveBeenCalledOnce();

    database.exec("DROP TRIGGER reject_contribution_insert;");
    database.exec("DROP TABLE contributions;");
    const failedRead = await accountA.agent.get("/api/aportes/propios");
    expect(failedRead.status).toBe(500);
    expect(failedRead.body.error.code).toBe("CONTRIBUTION_READ_ERROR");
    expect(JSON.stringify(failedRead.body)).not.toMatch(
      /sqlite|contributions|select/i,
    );
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
