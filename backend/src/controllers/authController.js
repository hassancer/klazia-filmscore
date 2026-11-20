import { csrfSync } from "csrf-sync";

const { generateToken } = csrfSync();

/** Regenera el identificador de sesión para no reutilizarlo al autenticar. */
function regenerateSession(request) {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

/** Adapta las solicitudes HTTP de cuenta al servicio y define sus respuestas. */
export function createAuthController(authService) {
  return {
    /** Registra los campos recibidos y responde 201 sin iniciar sesión. */
    async register(request, response) {
      const body = request.body ?? {};
      const account = await authService.register({
        displayName: body.display_name,
        email: body.email,
        password: body.password,
      });
      response.status(201).json({ success: true, data: account });
    },

    /**
     * Valida credenciales, rota la sesión y genera un token CSRF nuevo.
     * Solo después de autenticar se guardan la identidad y la cookie de sesión.
     */
    async login(request, response) {
      const identity = await authService.authenticate(
        request.body?.email,
        request.body?.password,
      );

      await regenerateSession(request);
      request.session.userId = identity.user_id;
      request.session.displayName = identity.display_name;
      generateToken(request, true);

      response.status(200).json({
        success: true,
        data: { display_name: identity.display_name },
      });
    },

    /** Destruye la sesión autenticada y elimina su cookie del navegador. */
    logout(request, response, next) {
      if (!request.session) {
        response.status(204).end();
        return;
      }

      request.session.destroy((error) => {
        if (error) {
          next(error);
          return;
        }

        response.clearCookie("klazia.sid", {
          httpOnly: true,
          sameSite: "lax",
          secure: false,
        });
        response.status(204).end();
      });
    },
  };
}
