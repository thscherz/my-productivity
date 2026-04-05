// Basis-URL der API — ueber Vite-Proxy auf Port 8001 weitergeleitet
const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

// Typisierter API-Fehler mit HTTP-Status
class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

// Zentrale Fetch-Funktion mit Cookie-Authentifizierung
async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const config = {
    headers: { "Content-Type": "application/json" },
    credentials: "include", // Session-Cookie mitsenden
    ...options,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.detail || "Unbekannter Fehler");
  }

  // DELETE gibt manchmal kein JSON zurueck
  if (response.status === 204) return null;

  return response.json();
}

// Exportierter API-Client mit HTTP-Methoden
export const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) =>
    request(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body) =>
    request(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
};
