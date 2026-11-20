import { useState } from "react";

/** Formulario de acceso; conserva el correo y limpia la clave tras un error. */
export default function LoginPage({ onLogin, isSubmitting }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState(null);

  /** Actualiza el dato escrito y quita el mensaje previo al reintentar. */
  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setMessage(null);
  }

  /** Envía credenciales y presenta errores saneados devueltos por la API. */
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);

    try {
      const result = await onLogin(form);
      if (result.csrfWarning) {
        setMessage({ type: "warning", text: result.csrfWarning });
      }
    } catch (error) {
      setForm((current) => ({ ...current, password: "" }));
      setMessage({ type: "error", text: error.message });
    }
  }

  return (
    <section aria-labelledby="login-title" className="form-page">
      <div className="page-intro">
        <h1 className="page-title" id="login-title">
          Iniciar sesión
        </h1>
        <p className="section-description">
          Accede con el correo y la contraseña de tu cuenta.
        </p>
      </div>
      <form className="account-form" onSubmit={handleSubmit}>
        <label className="form-field" htmlFor="login-email">
          <span>Correo electrónico</span>
          <input
            autoComplete="email"
            className="form-control"
            id="login-email"
            name="email"
            onChange={updateField}
            required
            type="email"
            value={form.email}
          />
        </label>
        <label className="form-field" htmlFor="login-password">
          <span>Contraseña</span>
          <input
            autoComplete="current-password"
            className="form-control"
            id="login-password"
            name="password"
            onChange={updateField}
            required
            type="password"
            value={form.password}
          />
        </label>
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
          {isSubmitting ? "Iniciando sesión…" : "Iniciar sesión"}
        </button>
      </form>
    </section>
  );
}
