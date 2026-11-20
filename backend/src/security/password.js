import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 10;

/**
 * Prepara contraseñas largas para evitar el límite de bytes de bcrypt.
 * El hash SHA-256 intermedio no se persiste; bcrypt sigue siendo el hash almacenado.
 */
function preparePassword(password) {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

/** Devuelve un hash bcrypt con costo 10 para guardar en users.password_hash. */
export function hashPassword(password) {
  return bcrypt.hash(preparePassword(password), BCRYPT_COST);
}

/** Compara una contraseña ingresada con el hash bcrypt persistido. */
export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(preparePassword(password), passwordHash);
}
