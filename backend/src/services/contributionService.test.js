import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ContributionAlreadyExistsError,
  ContributionForbiddenError,
  ContributionNotFoundError,
  ContributionPersistenceError,
  ContributionReadError,
  ValidationError,
} from "../errors/application-errors.js";
import { createDatabase } from "../database/connection.js";
import { runMigrations } from "../database/migrate.js";
import { createContributionRepository } from "../database/contributionRepository.js";
import { createContributionService } from "./contributionService.js";

describe("contribution service", () => {
  let database;
  let service;
  let authorA;
  let authorB;

  beforeEach(() => {
    database = createDatabase(":memory:");
    runMigrations(database);
    authorA = database
      .prepare(
        "INSERT INTO users (display_name, email, password_hash) VALUES (?, ?, ?)",
      )
      .run("Persona A", "a@example.invalid", "hash").lastInsertRowid;
    authorB = database
      .prepare(
        "INSERT INTO users (display_name, email, password_hash) VALUES (?, ?, ?)",
      )
      .run("Persona B", "b@example.invalid", "hash").lastInsertRowid;
    service = createContributionService(createContributionRepository(database));
  });

  afterEach(() => {
    database?.close();
  });

  function contributionPayload(overrides = {}) {
    return {
      movie_source: "tmdb",
      movie_source_id: "157336",
      movie_title: "Interstellar",
      poster_url: null,
      rating: 5,
      review_text: "Una reseña ficticia.",
      ...overrides,
    };
  }

  it("creates a private snapshot with database identity and date", () => {
    const created = service.create(authorA, contributionPayload());

    expect(created).toMatchObject({
      contribution_id: expect.any(Number),
      movie: {
        source: "tmdb",
        source_id: "157336",
        title: "Interstellar",
        poster_url: null,
      },
      rating: 5,
      review_text: "Una reseña ficticia.",
      visibility: "private",
      created_at: expect.any(String),
    });
    expect(created).not.toHaveProperty("author_id");
    expect(created).not.toHaveProperty("user_id");
    expect(service.listOwn(authorB)).toEqual([]);
    expect(service.listPublic("157336")).toEqual([]);
  });

  it("returns only public contributions with an allowlisted author projection", () => {
    service.create(authorA, contributionPayload({ visibility: "public" }));
    service.create(
      authorB,
      contributionPayload({
        movie_source_id: "157336",
        review_text: "Un aporte que debe seguir privado.",
      }),
    );

    const publicContributions = service.listPublic("157336");

    expect(publicContributions).toHaveLength(1);
    expect(publicContributions[0]).toMatchObject({
      author_display_name: "Persona A",
      rating: 5,
      review_text: "Una reseña ficticia.",
      created_at: expect.any(String),
    });
    expect(Object.keys(publicContributions[0]).sort()).toEqual(
      [
        "contribution_id",
        "author_display_name",
        "rating",
        "review_text",
        "created_at",
      ].sort(),
    );
    expect(JSON.stringify(publicContributions)).not.toMatch(
      /author_id|user_id|email|Interstellar|privado/i,
    );
  });

  it("rejects duplicate and reserved client fields without changing the saved contribution", () => {
    const created = service.create(authorA, contributionPayload());

    expect(() =>
      service.create(authorA, contributionPayload({ rating: 1 })),
    ).toThrow(ContributionAlreadyExistsError);
    expect(() =>
      service.create(authorA, contributionPayload({ author_id: authorB })),
    ).toThrow(ValidationError);
    expect(service.listOwn(authorA)).toEqual([created]);
  });

  it("validates the final aggregate on partial updates and preserves created_at and snapshot", () => {
    const created = service.create(authorA, contributionPayload());
    const originalDate = "2001-02-03 04:05:06";
    database
      .prepare(
        "UPDATE contributions SET created_at = ? WHERE contribution_id = ?",
      )
      .run(originalDate, created.contribution_id);

    expect(() =>
      service.update(authorA, String(created.contribution_id), {
        review_text: "corta",
      }),
    ).toThrow(ValidationError);

    const updated = service.update(authorA, String(created.contribution_id), {
      rating: 4,
    });
    expect(updated).toMatchObject({
      contribution_id: created.contribution_id,
      movie: created.movie,
      rating: 4,
      review_text: created.review_text,
      visibility: "private",
      created_at: originalDate,
    });
  });

  it("rejects foreign mutations and keeps an independent favorite", () => {
    const created = service.create(authorA, contributionPayload());
    database
      .prepare(
        `INSERT INTO favorites
          (user_id, movie_source, movie_source_id, movie_title)
         VALUES (?, 'tmdb', '157336', 'Interstellar')`,
      )
      .run(authorA);

    expect(() =>
      service.update(authorB, String(created.contribution_id), { rating: 1 }),
    ).toThrow(ContributionForbiddenError);
    expect(() =>
      service.remove(authorB, String(created.contribution_id)),
    ).toThrow(ContributionForbiddenError);
    expect(
      database
        .prepare("SELECT rating, review_text, visibility FROM contributions")
        .get(),
    ).toEqual({
      rating: 5,
      review_text: "Una reseña ficticia.",
      visibility: "private",
    });

    service.remove(authorA, String(created.contribution_id));
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM favorites").get().count,
    ).toBe(1);
    expect(service.listOwn(authorA)).toEqual([]);
  });

  it("distinguishes missing records from failed reads and writes", () => {
    expect(() => service.update(authorA, "42", { rating: 3 })).toThrow(
      ContributionNotFoundError,
    );

    database.exec(`
      CREATE TRIGGER reject_contribution
      BEFORE INSERT ON contributions
      BEGIN
        SELECT RAISE(ABORT, 'private database diagnostic');
      END;
    `);
    expect(() =>
      service.create(authorA, contributionPayload({ movie_source_id: "9" })),
    ).toThrow(ContributionPersistenceError);
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM contributions").get()
        .count,
    ).toBe(0);

    database.exec(
      "DROP TRIGGER reject_contribution; DROP TABLE contributions;",
    );
    expect(() => service.listOwn(authorA)).toThrow(ContributionReadError);
  });

  it("restores contribution snapshots after reopening persistent SQLite", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "filmscore-data-"));
    const databasePath = path.join(directory, "restore.sqlite");
    let persistentDatabase;

    try {
      persistentDatabase = createDatabase(databasePath);
      runMigrations(persistentDatabase);
      const authorId = persistentDatabase
        .prepare(
          "INSERT INTO users (display_name, email, password_hash) VALUES (?, ?, ?)",
        )
        .run(
          "Persona persistida",
          "persistida@example.invalid",
          "hash",
        ).lastInsertRowid;
      const persistentService = createContributionService(
        createContributionRepository(persistentDatabase),
      );
      const created = persistentService.create(
        authorId,
        contributionPayload({ visibility: "public" }),
      );

      persistentDatabase.close();
      persistentDatabase = createDatabase(databasePath);
      expect(runMigrations(persistentDatabase)).toEqual([]);

      const restoredService = createContributionService(
        createContributionRepository(persistentDatabase),
      );
      expect(restoredService.listOwn(authorId)).toEqual([created]);
      expect(restoredService.listPublic("157336")).toEqual([
        expect.objectContaining({
          author_display_name: "Persona persistida",
          rating: 5,
          review_text: "Una reseña ficticia.",
          created_at: created.created_at,
        }),
      ]);
      expect(persistentDatabase.pragma("foreign_key_check")).toEqual([]);
    } finally {
      persistentDatabase?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses a safe display-name fallback for public results", () => {
    const logger = { warn: vi.fn() };
    const publicService = createContributionService(
      {
        listPublicForMovie: () => [
          {
            contribution_id: 7,
            author_display_name: null,
            rating: 3,
            review_text: "Una opinión pública.",
            created_at: "2026-11-19 14:30:00",
          },
        ],
      },
      logger,
    );

    expect(publicService.listPublic("157336")).toEqual([
      {
        contribution_id: 7,
        author_display_name: "Usuario de Klazia FilmScore",
        rating: 3,
        review_text: "Una opinión pública.",
        created_at: "2026-11-19 14:30:00",
      },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      JSON.stringify({ event: "contribution_author_name_unavailable" }),
    );
  });
});
