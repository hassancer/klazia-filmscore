/**
 * Prepara las consultas de Favoritos y mantiene el acceso a SQLite en esta capa.
 * La identidad del propietario siempre se recibe desde la sesión validada.
 */
export function createFavoriteRepository(database) {
  const listByUser = database.prepare(`
    SELECT movie_source, movie_source_id, movie_title, poster_url, created_at
    FROM favorites
    WHERE user_id = ?
    ORDER BY created_at DESC, movie_source_id ASC
  `);
  const findByUserAndId = database.prepare(`
    SELECT movie_source, movie_source_id, movie_title, poster_url, created_at
    FROM favorites
    WHERE user_id = @userId
      AND movie_source = 'tmdb'
      AND movie_source_id = @movieSourceId
  `);
  const insertFavorite = database.prepare(`
    INSERT INTO favorites
      (user_id, movie_source, movie_source_id, movie_title, poster_url)
    VALUES
      (@userId, @movieSource, @movieSourceId, @movieTitle, @posterUrl)
    RETURNING movie_source, movie_source_id, movie_title, poster_url, created_at
  `);
  const deleteFavorite = database.prepare(`
    DELETE FROM favorites
    WHERE user_id = @userId
      AND movie_source = 'tmdb'
      AND movie_source_id = @movieSourceId
  `);

  return {
    /** Devuelve solo snapshots del propietario, con lectura vacía diferenciada de errores. */
    listForUser(userId) {
      return listByUser.all(userId);
    },
    /** Busca un único snapshot con la cuenta y la fuente fijadas en el backend. */
    findForUser(userId, movieSourceId) {
      return findByUserAndId.get({ userId, movieSourceId });
    },
    /** Inserta una fila y deja que SQLite aplique unicidad y fecha de creación. */
    create(favorite) {
      return insertFavorite.get(favorite);
    },
    /** Retira la relación por usuario, fuente fija e ID externo TMDB. */
    removeForUser(userId, movieSourceId) {
      return deleteFavorite.run({ userId, movieSourceId }).changes;
    },
  };
}
