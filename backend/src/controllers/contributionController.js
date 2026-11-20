/** Adapta los contratos HTTP de Aportes a sus casos de uso. */
export function createContributionController(contributionService) {
  return {
    /** Lee solo la colección pública de la película; no necesita sesión. */
    listPublic(request, response) {
      const contributions = contributionService.listPublic(
        request.params.tmdbId,
      );
      response.json({ success: true, data: { contributions } });
    },

    /** Devuelve los aportes privados y públicos del usuario de sesión. */
    listOwn(request, response) {
      const contributions = contributionService.listOwn(
        request.session?.userId,
      );
      response.json({ success: true, data: { contributions } });
    },

    /** Confirma la creación solo después de persistir el aporte completo. */
    create(request, response) {
      const contribution = contributionService.create(
        request.session?.userId,
        request.body,
      );
      response.status(201).json({ success: true, data: { contribution } });
    },

    /** Aplica el PATCH parcial con autoría tomada exclusivamente de la sesión. */
    update(request, response) {
      const contribution = contributionService.update(
        request.session?.userId,
        request.params.id,
        request.body,
      );
      response.json({ success: true, data: { contribution } });
    },

    /** Responde sin cuerpo después de borrar únicamente el aporte propio. */
    remove(request, response) {
      contributionService.remove(request.session?.userId, request.params.id);
      response.status(204).end();
    },
  };
}
