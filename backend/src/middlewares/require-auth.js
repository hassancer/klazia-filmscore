/** Crea una puerta de sesión con un mensaje general para cada módulo privado. */
function createRequireAuth(message) {
  return function requireAuth(request, response, next) {
    const userId = request.session?.userId;
    if (!Number.isSafeInteger(userId) || userId < 1) {
      response.status(401).json({
        success: false,
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message,
        },
      });
      return;
    }

    next();
  };
}

export const requireAuth = createRequireAuth(
  "Inicia sesión para administrar tus favoritos.",
);

export const requireContributionAuth = createRequireAuth(
  "Inicia sesión para administrar tus aportes.",
);
