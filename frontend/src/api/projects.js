import { api } from "./client";

// API-Wrapper fuer alle Projekt-Endpunkte
export const projectsApi = {
  // Alle Projekte laden
  getAll: () => api.get("/projects"),

  // Einzelnes Projekt laden
  getById: (id) => api.get(`/projects/${id}`),

  // Neues Projekt erstellen
  create: (data) => api.post("/projects", data),

  // Projekt aktualisieren
  update: (id, data) => api.put(`/projects/${id}`, data),

  // Projekt loeschen
  delete: (id) => api.delete(`/projects/${id}`),
};
