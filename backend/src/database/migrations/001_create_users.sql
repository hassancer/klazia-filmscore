CREATE TABLE users (
  user_id INTEGER PRIMARY KEY,
  -- La restricción coincide con los límites de longitud validados por el servicio.
  display_name TEXT NOT NULL
    CHECK (length(trim(display_name)) BETWEEN 2 AND 100),
  -- NOCASE y UNIQUE evitan duplicados sin distinguir mayúsculas/minúsculas.
  email TEXT NOT NULL COLLATE NOCASE UNIQUE
    CHECK (length(trim(email)) > 0),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
