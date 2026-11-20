/**
 * Prepara las consultas de Aportes y conserva el acceso a SQLite en esta capa.
 * Las mutaciones se acotan al autor para mantener la propiedad también en SQL.
 */
export function createContributionRepository(database) {
  const insertContribution = database.prepare(`
    INSERT INTO contributions
      (author_id, movie_source, movie_source_id, movie_title, poster_url,
       rating, review_text, visibility)
    VALUES
      (@authorId, @movieSource, @movieSourceId, @movieTitle, @posterUrl,
       @rating, @reviewText, @visibility)
    RETURNING contribution_id, movie_source, movie_source_id, movie_title,
      poster_url, rating, review_text, visibility, created_at
  `);
  const listByAuthor = database.prepare(`
    SELECT contribution_id, movie_source, movie_source_id, movie_title,
      poster_url, rating, review_text, visibility, created_at
    FROM contributions
    WHERE author_id = ?
    ORDER BY created_at DESC, contribution_id DESC
  `);
  const listPublicByMovie = database.prepare(`
    SELECT c.contribution_id, u.display_name AS author_display_name,
      c.rating, c.review_text, c.created_at
    FROM contributions AS c
    LEFT JOIN users AS u ON u.user_id = c.author_id
    WHERE c.movie_source = 'tmdb'
      AND c.movie_source_id = ?
      AND c.visibility = 'public'
    ORDER BY c.created_at DESC, c.contribution_id DESC
  `);
  const findById = database.prepare(`
    SELECT contribution_id, author_id, movie_source, movie_source_id,
      movie_title, poster_url, rating, review_text, visibility, created_at
    FROM contributions
    WHERE contribution_id = ?
  `);
  const updateOwned = database.prepare(`
    UPDATE contributions
    SET rating = @rating,
      review_text = @reviewText,
      visibility = @visibility
    WHERE contribution_id = @contributionId
      AND author_id = @authorId
    RETURNING contribution_id, movie_source, movie_source_id, movie_title,
      poster_url, rating, review_text, visibility, created_at
  `);
  const deleteOwned = database.prepare(`
    DELETE FROM contributions
    WHERE contribution_id = @contributionId
      AND author_id = @authorId
  `);

  return {
    /** Inserta la unidad completa y deja que SQLite asigne identidad y fecha. */
    create(contribution) {
      return insertContribution.get(contribution);
    },
    /** Devuelve solo los aportes del autor autenticado. */
    listForAuthor(authorId) {
      return listByAuthor.all(authorId);
    },
    /** Proyecta solo campos públicos; el snapshot privado no sale de la consulta. */
    listPublicForMovie(movieSourceId) {
      return listPublicByMovie.all(movieSourceId);
    },
    /** Busca por ID para que el servicio distinga ausencia y propiedad. */
    findById(contributionId) {
      return findById.get(contributionId);
    },
    /** Actualiza únicamente campos mutables y conserva la fecha original. */
    update(contribution) {
      return updateOwned.get(contribution);
    },
    /** Borra solo si el autor coincide, sin acoplar la tabla de Favoritos. */
    remove(contributionId, authorId) {
      return deleteOwned.run({ contributionId, authorId }).changes;
    },
  };
}
