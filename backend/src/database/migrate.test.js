import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDatabase } from "./connection.js";
import { runMigrations } from "./migrate.js";

describe("database migrations", () => {
  let database;
  let migrationDirectory;

  afterEach(() => {
    database?.close();
    database = undefined;

    if (migrationDirectory) {
      rmSync(migrationDirectory, { recursive: true, force: true });
      migrationDirectory = undefined;
    }
  });

  it("applies the approved migrations once and preserves their constraints", () => {
    database = createDatabase(":memory:");

    expect(runMigrations(database)).toEqual([
      "001_create_users.sql",
      "002_create_favorites.sql",
      "003_create_contributions.sql",
    ]);
    expect(runMigrations(database)).toEqual([]);
    expect(
      database.prepare("SELECT migration_name FROM schema_migrations").all(),
    ).toEqual([
      { migration_name: "001_create_users.sql" },
      { migration_name: "002_create_favorites.sql" },
      { migration_name: "003_create_contributions.sql" },
    ]);

    const userA = database
      .prepare(
        "INSERT INTO users (display_name, email, password_hash) VALUES (?, ?, ?)",
      )
      .run("Cinefila A", "a@example.invalid", "hash");
    const favorite = {
      userId: userA.lastInsertRowid,
      source: "tmdb",
      sourceId: "123",
      title: "Película ficticia",
    };

    database
      .prepare(
        `
        INSERT INTO favorites
          (user_id, movie_source, movie_source_id, movie_title)
        VALUES (@userId, @source, @sourceId, @title)
      `,
      )
      .run(favorite);
    expect(
      database.prepare("SELECT created_at, poster_url FROM favorites").get(),
    ).toMatchObject({
      created_at: expect.any(String),
      poster_url: null,
    });

    const contribution = {
      authorId: userA.lastInsertRowid,
      sourceId: "123",
      title: "Película ficticia",
      rating: 5,
      reviewText: "Una reseña ficticia.",
    };
    database
      .prepare(
        `INSERT INTO contributions
          (author_id, movie_source_id, movie_title, rating, review_text)
         VALUES
          (@authorId, @sourceId, @title, @rating, @reviewText)`,
      )
      .run(contribution);

    const savedContribution = database
      .prepare("SELECT * FROM contributions")
      .get();
    expect(savedContribution).toMatchObject({
      author_id: userA.lastInsertRowid,
      movie_source: "tmdb",
      movie_source_id: "123",
      visibility: "private",
      poster_url: null,
      rating: 5,
      review_text: "Una reseña ficticia.",
      created_at: expect.any(String),
    });

    expect(
      database
        .prepare("PRAGMA index_list('contributions')")
        .all()
        .map((index) => index.name),
    ).toContain("contributions_by_movie_visibility");
    expect(
      database
        .prepare("PRAGMA foreign_key_list('contributions')")
        .all()
        .map((foreignKey) => foreignKey.table),
    ).toEqual(["users"]);

    expect(() =>
      database
        .prepare(
          `INSERT INTO contributions
            (author_id, movie_source_id, movie_title, rating, review_text)
           VALUES
            (@authorId, @sourceId, @title, @rating, @reviewText)`,
        )
        .run(contribution),
    ).toThrow(/UNIQUE/i);

    expect(() =>
      database
        .prepare(
          `INSERT INTO contributions
            (author_id, movie_source_id, movie_title, rating, review_text)
           VALUES
            (999, '456', 'Otra película', 4, 'Otra reseña válida.')`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY/i);

    expect(() =>
      database
        .prepare(
          `INSERT INTO favorites
            (user_id, movie_source, movie_source_id, movie_title)
           VALUES (@userId, @source, @sourceId, @title)`,
        )
        .run(favorite),
    ).toThrow(/UNIQUE/i);
    expect(() =>
      database
        .prepare(
          `
          INSERT INTO favorites
            (user_id, movie_source, movie_source_id, movie_title)
          VALUES (999, 'tmdb', '456', 'Otra película')
        `,
        )
        .run(),
    ).toThrow(/FOREIGN KEY/i);
  });

  it("enforces contribution field constraints and allows another author", () => {
    database = createDatabase(":memory:");
    runMigrations(database);

    const authorA = database
      .prepare(
        "INSERT INTO users (display_name, email, password_hash) VALUES (?, ?, ?)",
      )
      .run("Cinefila A", "a@example.invalid", "hash");
    const authorB = database
      .prepare(
        "INSERT INTO users (display_name, email, password_hash) VALUES (?, ?, ?)",
      )
      .run("Cinefila B", "b@example.invalid", "hash");

    const insertContribution = database.prepare(
      `INSERT INTO contributions
        (author_id, movie_source_id, movie_title, rating, review_text, visibility)
       VALUES
        (@authorId, @sourceId, @title, @rating, @reviewText, @visibility)`,
    );
    const validContribution = {
      authorId: authorA.lastInsertRowid,
      sourceId: "157336",
      title: "Película ficticia",
      rating: 4,
      reviewText: "Una reseña ficticia.",
      visibility: "public",
    };

    for (const invalidRating of [0, 6, 2.5]) {
      expect(() =>
        insertContribution.run({
          ...validContribution,
          sourceId: `rating-${invalidRating}`,
          rating: invalidRating,
        }),
      ).toThrow(/CHECK/i);
    }

    for (const invalidReview of ["corta", "x".repeat(1001)]) {
      expect(() =>
        insertContribution.run({
          ...validContribution,
          sourceId: `review-${invalidReview.length}`,
          reviewText: invalidReview,
        }),
      ).toThrow(/CHECK/i);
    }

    expect(() =>
      insertContribution.run({
        ...validContribution,
        sourceId: "invalid-visibility",
        visibility: "friends",
      }),
    ).toThrow(/CHECK/i);

    insertContribution.run(validContribution);
    expect(() =>
      insertContribution.run({
        ...validContribution,
        authorId: authorB.lastInsertRowid,
      }),
    ).not.toThrow();
    expect(
      database
        .prepare(
          "SELECT author_id FROM contributions WHERE movie_source_id = ? ORDER BY author_id",
        )
        .all("157336"),
    ).toEqual([
      { author_id: authorA.lastInsertRowid },
      { author_id: authorB.lastInsertRowid },
    ]);
  });

  it("rolls back a migration file and its registration when SQL fails", () => {
    database = createDatabase(":memory:");
    migrationDirectory = mkdtempSync(
      path.join(os.tmpdir(), "filmscore-migrations-"),
    );
    writeFileSync(
      path.join(migrationDirectory, "003_failing_migration.sql"),
      "CREATE TABLE rollback_probe (id INTEGER PRIMARY KEY); INSERT INTO missing_table (id) VALUES (1);",
    );

    expect(() => runMigrations(database, migrationDirectory)).toThrow();
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rollback_probe'",
        )
        .get(),
    ).toBeUndefined();
    expect(
      database.prepare("SELECT migration_name FROM schema_migrations").all(),
    ).toEqual([]);
  });
});
