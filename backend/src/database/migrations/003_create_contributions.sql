CREATE TABLE contributions (
  contribution_id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL,
  movie_source TEXT NOT NULL DEFAULT 'tmdb'
    CHECK (length(trim(movie_source)) > 0),
  movie_source_id TEXT NOT NULL
    CHECK (length(trim(movie_source_id)) > 0),
  movie_title TEXT NOT NULL
    CHECK (length(trim(movie_title)) > 0),
  poster_url TEXT,
  rating INTEGER NOT NULL
    CHECK (
      typeof(rating) = 'integer'
      AND rating BETWEEN 1 AND 5
    ),
  review_text TEXT NOT NULL
    CHECK (length(trim(review_text)) BETWEEN 10 AND 1000),
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'public')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (author_id, movie_source, movie_source_id),
  FOREIGN KEY (author_id)
    REFERENCES users (user_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

-- Aporte y Favorito tienen ciclos independientes; no se agrega una FK entre ellos.
CREATE INDEX contributions_by_movie_visibility
  ON contributions (movie_source, movie_source_id, visibility);
