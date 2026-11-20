import { useState } from "react";

/** Captura datos de registro, muestra feedback y borra la contraseña al responder. */
export default function RegisterPage({ onRegister, isSubmitting }) {
  const [form, setForm] = useState({
    display_name: "",
    email: "",
    password: "",
  });
  const [message, setMessage] = useState(null);

  /** Actualiza el campo editado y limpia el error anterior del formulario. */
  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setMessage(null);
  }

  /** Envía nombre, correo y contraseña; conserva los datos no secretos si falla. */
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);

    try {
      await onRegister(form);
      setForm((current) => ({ ...current, password: "" }));
      setMessage({
        type: "success",
        text: "La cuenta se creó. Ahora puedes iniciar sesión.",
      });
    } catch (error) {
      setForm((current) => ({ ...current, password: "" }));
      setMessage({
        type: "error",
        text: error.message,
      });
    }
  }

  return (
    <section aria-labelledby="register-title" className="form-page">
      <div className="page-intro">
        <h1 className="page-title" id="register-title">
          Crear cuenta
        </h1>
        <p className="section-description">
          Registra un nombre visible, correo y contraseña.
        </p>
      </div>
      <form className="account-form" onSubmit={handleSubmit}>
        <label className="form-field" htmlFor="register-name">
          <span>Nombre visible</span>
          <input
            autoComplete="name"
            className="form-control"
            id="register-name"
            maxLength={100}
            minLength={2}
            name="display_name"
            onChange={updateField}
            required
            value={form.display_name}
          />
        </label>
        <label className="form-field" htmlFor="register-email">
          <span>Correo electrónico</span>
          <input
            autoComplete="email"
            className="form-control"
            id="register-email"
            name="email"
            onChange={updateField}
            required
            type="email"
            value={form.email}
          />
        </label>
        <div className="form-field">
          <label htmlFor="register-password">Contraseña</label>
          <input
            autoComplete="new-password"
            aria-describedby="register-password-hint"
            className="form-control"
            id="register-password"
            maxLength={72}
            minLength={8}
            name="password"
            onChange={updateField}
            pattern="(?=.*\p{L})(?=.*\p{N}).{8,72}"
            required
            title="Usa de 8 a 72 caracteres, con al menos una letra y un número."
            type="password"
            value={form.password}
          />
          <span className="field-hint" id="register-password-hint">
            De 8 a 72 caracteres, con al menos una letra y un número.
          </span>
        </div>
        {message ? (
          <p
            className={`form-message form-message--${message.type}`}
            role={message.type === "error" ? "alert" : "status"}
          >
            {message.text}
          </p>
        ) : null}
        <button
          className="button button--primary"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
    </section>
  );
}
