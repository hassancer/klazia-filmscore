import {
  AuthenticationPersistenceError,
  DuplicateAccountError,
  InvalidCredentialsError,
  RegistrationPersistenceError,
  ValidationError,
} from "../errors/application-errors.js";
import { hashPassword, verifyPassword } from "../security/password.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const letterPattern = /\p{L}/u;
const numberPattern = /\p{N}/u;

/** Normaliza el correo para que registro e inicio de sesión comparen igual. */
export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * Valida nombre, correo y contraseña según el contrato de registro.
 * Devuelve los valores limpios o lanza ValidationError; la clave no se transforma.
 */
export function validateRegistration({ displayName, email, password }) {
  const normalizedName =
    typeof displayName === "string" ? displayName.trim() : "";
  const normalizedEmail =
    typeof email === "string" ? normalizeEmail(email) : "";

  if (
    Array.from(normalizedName).length < 2 ||
    Array.from(normalizedName).length > 100 ||
    !emailPattern.test(normalizedEmail) ||
    typeof password !== "string" ||
    Array.from(password).length < 8 ||
    Array.from(password).length > 72 ||
    !letterPattern.test(password) ||
    !numberPattern.test(password)
  ) {
    throw new ValidationError(
      "Revisa que el nombre, el correo y la contraseña cumplan las condiciones indicadas.",
    );
  }

  return {
    displayName: normalizedName,
    email: normalizedEmail,
    password,
  };
}

/** Coordina validación, hash y operaciones del repositorio de cuentas. */
export function createAuthService(userRepository) {
  return {
    /**
     * Crea una cuenta con correo normalizado y hash de contraseña.
     * El repositorio persiste los datos; conflictos y fallos se traducen a errores funcionales.
     */
    async register(input) {
      const account = validateRegistration(input);
      const passwordHash = await hashPassword(account.password);

      try {
        userRepository.create({
          displayName: account.displayName,
          email: account.email,
          passwordHash,
        });
      } catch (error) {
        if (
          error?.code === "SQLITE_CONSTRAINT_UNIQUE" ||
          error?.code === "SQLITE_CONSTRAINT_PRIMARYKEY"
        ) {
          throw new DuplicateAccountError();
        }
        throw new RegistrationPersistenceError();
      }

      return { display_name: account.displayName };
    },

    /**
     * Busca la cuenta por correo y compara la contraseña con el hash guardado.
     * Devuelve solo la identidad necesaria para crear una sesión, nunca el hash.
     */
    async authenticate(email, password) {
      if (typeof email !== "string" || typeof password !== "string") {
        throw new ValidationError("Ingresa el correo y la contraseña.");
      }

      let account;
      try {
        account = userRepository.findByEmail(normalizeEmail(email));
      } catch {
        throw new AuthenticationPersistenceError();
      }

      if (
        !account ||
        !(await verifyPassword(password, account.password_hash))
      ) {
        throw new InvalidCredentialsError();
      }

      return {
        user_id: account.user_id,
        display_name: account.display_name,
      };
    },
  };
}
