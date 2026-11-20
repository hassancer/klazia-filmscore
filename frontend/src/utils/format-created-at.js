/** Interpreta el valor UTC de SQLite y lo presenta en la zona horaria del producto. */
export function formatCreatedAt(value, { includeTime = false } = {}) {
  // SQLite no incluye sufijo de zona; se agrega UTC antes de convertir a Bogotá.
  const utcValue = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" } : {}),
    timeZone: "America/Bogota",
  }).format(new Date(utcValue));
}
