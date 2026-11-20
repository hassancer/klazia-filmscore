import { useState } from "react";

/** Recoge y valida calificación, reseña y, al editar, visibilidad del aporte. */
export default function ContributionForm({
  mode = "create",
  initialValues,
  isSubmitting,
  errorMessage,
  successMessage,
  onSubmit,
  onCancel,
}) {
  const [rating, setRating] = useState(String(initialValues?.rating ?? 5));
  const [reviewText, setReviewText] = useState(
    initialValues?.review_text ?? "",
  );
  const [visibility, setVisibility] = useState(
    initialValues?.visibility ?? "private",
  );
  const [validationError, setValidationError] = useState("");
  const isEditing = mode === "edit";
  const message = validationError || errorMessage;

  function handleSubmit(event) {
    event.preventDefault();
    const normalizedReview = reviewText.trim();
    const numericRating = Number(rating);

    // El servidor vuelve a validar; esta comprobación ayuda a corregir el formulario antes del envío.
    // Array.from mantiene el mismo conteo Unicode que valida el backend.
    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5 ||
      Array.from(normalizedReview).length < 10 ||
      Array.from(normalizedReview).length > 1000
    ) {
      setValidationError(
        "La calificación debe ser de 1 a 5 y la reseña de 10 a 1.000 caracteres.",
      );
      return;
    }

    setValidationError("");
    onSubmit({
      rating: numericRating,
      review_text: normalizedReview,
      ...(isEditing ? { visibility } : {}),
    });
  }

  return (
    <form
      aria-labelledby="contribution-form-title"
      className="account-form contribution-form"
      onSubmit={handleSubmit}
    >
      <h3 className="section-title" id="contribution-form-title">
        {isEditing ? "Editar mi aporte" : "Crear mi aporte"}
      </h3>
      <label className="form-field" htmlFor="contribution-rating">
        <span>Calificación personal (1 a 5)</span>
        <select
          className="form-control"
          id="contribution-rating"
          onChange={(event) => {
            setRating(event.target.value);
            setValidationError("");
          }}
          required
          value={rating}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <div className="form-field">
        <label htmlFor="contribution-review">
          Reseña (10 a 1.000 caracteres)
        </label>
        <textarea
          aria-describedby="contribution-review-hint"
          aria-invalid={Boolean(message)}
          className="form-control contribution-form__review"
          id="contribution-review"
          minLength={10}
          onChange={(event) => {
            setReviewText(event.target.value);
            setValidationError("");
          }}
          required
          value={reviewText}
        />
        <span className="field-hint" id="contribution-review-hint">
          Se guardará como texto. {Array.from(reviewText).length}/1.000
          caracteres.
        </span>
      </div>
      {isEditing ? (
        <label className="form-field" htmlFor="contribution-visibility">
          <span>Visibilidad</span>
          <select
            className="form-control"
            id="contribution-visibility"
            onChange={(event) => setVisibility(event.target.value)}
            value={visibility}
          >
            <option value="private">Privado</option>
            <option value="public">Público</option>
          </select>
        </label>
      ) : (
        <p className="field-hint">
          Tu aporte será privado al crearlo. Podrás cambiar la visibilidad
          después.
        </p>
      )}
      {message ? (
        <p className="form-message form-message--error" role="alert">
          {message}
        </p>
      ) : null}
      {successMessage ? (
        <p className="form-message form-message--success" role="status">
          {successMessage}
        </p>
      ) : null}
      <div className="contribution-form__actions">
        <button
          className="button button--primary"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? "Guardando…"
            : isEditing
              ? "Guardar cambios"
              : "Guardar aporte"}
        </button>
        {onCancel ? (
          <button
            className="button button--secondary"
            disabled={isSubmitting}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
