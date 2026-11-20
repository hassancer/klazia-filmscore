CREATE TABLE favorites (
  user_id INTEGER NOT NULL,
  movie_source TEXT NOT NULL
    CHECK (length(trim(movie_source)) > 0),
  movie_source_id TEXT NOT NULL
    CHECK (length(trim(movie_source_id)) > 0),
  movie_title TEXT NOT NULL
    CHECK (length(trim(movie_title)) > 0),
  poster_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- La cuenta forma parte de la clave: se permite la misma película en listas distintas.
  PRIMARY KEY (user_id, movie_source, movie_source_id),
  FOREIGN KEY (user_id)
    REFERENCES users (user_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);
