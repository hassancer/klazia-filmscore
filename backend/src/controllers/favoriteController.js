/** Adapta los contratos HTTP de Favoritos a los casos de uso del módulo. */
export function createFavoriteController(favoriteService) {
  return {
    /** Lee el identificador de sesión y devuelve solo los snapshots de esa cuenta. */
    list(request, response) {
      const favorites = favoriteService.list(request.session?.userId);
      response.json({ success: true, data: { favorites } });
    },

    /** Usa la sesión como propietario y responde con el snapshot autorizado, sin datos privados. */
    get(request, response) {
      const favorite = favoriteService.get(
        request.session?.userId,
        request.params.id,
      );
      response.json({ success: true, data: { favorite } });
    },

    /** Confirma el alta solo después de guardar y recuperar el snapshot persistido. */
    create(request, response) {
      const favorite = favoriteService.create(
        request.session?.userId,
        request.body,
      );
      response.status(201).json({ success: true, data: { favorite } });
    },

    /** Retira por ID externo TMDB, limitado al usuario autenticado. */
    remove(request, response) {
      favoriteService.remove(request.session?.userId, request.params.id);
      response.status(204).end();
    },
  };
}
