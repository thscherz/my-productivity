import { api } from "./client";

// API-Wrapper fuer alle Task-Endpunkte
export const tasksApi = {
  // Kanban-Ansicht: Tasks gruppiert nach Zeithorizont
  getKanban: (params = {}) => {
    // Leere Werte aus den Parametern entfernen
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== "" && v !== null && v !== undefined)
    );
    return api.get(`/tasks/kanban?${new URLSearchParams(filtered)}`);
  },

  // Listenansicht mit optionalen Filtern
  getAll: (params = {}) => {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== "" && v !== null && v !== undefined)
    );
    return api.get(`/tasks?${new URLSearchParams(filtered)}`);
  },

  // Einzelnen Task mit Unteraufgaben laden
  getById: (id) => api.get(`/tasks/${id}`),

  // Neuen Task erstellen
  create: (data) => api.post("/tasks", data),

  // Task aktualisieren
  update: (id, data) => api.put(`/tasks/${id}`, data),

  // Task loeschen
  delete: (id) => api.delete(`/tasks/${id}`),

  // Task in andere Spalte verschieben (Zeithorizont + Position)
  move: (id, data) => api.patch(`/tasks/${id}/move`, data),
};
