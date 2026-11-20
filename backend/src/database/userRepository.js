/**
 * Prepara las consultas SQLite del repositorio de usuarios una sola vez.
 * La cuenta se inserta en una transacción; las contraseñas recibidas ya son hashes.
 */
export function createUserRepository(database) {
  // Consulta parametrizada: el correo no se concatena al SQL.
  const findByEmail = database.prepare(`
    SELECT user_id, display_name, email, password_hash
    FROM users
    WHERE email = ?
  `);
  const insertUser = database.prepare(`
    INSERT INTO users (display_name, email, password_hash)
    VALUES (@displayName, @email, @passwordHash)
  `);
  const insertTransaction = database.transaction((account) =>
    insertUser.run(account),
  );

  return {
    /** Busca una cuenta y devuelve sus campos persistidos o undefined. */
    findByEmail(email) {
      return findByEmail.get(email);
    },
    /** Inserta la cuenta completa de forma atómica; propaga errores SQLite al servicio. */
    create(account) {
      return insertTransaction(account);
    },
  };
}
