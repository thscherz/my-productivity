import { api } from "./client";

// Basis-URL fuer direkte Fetch-Aufrufe (Upload mit multipart/form-data)
const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

export const attachmentsApi = {
  // Anhänge eines Tasks laden
  list: (taskId) => api.get(`/tasks/${taskId}/attachments`),

  // Datei hochladen — KEIN Content-Type Header, Browser setzt multipart/form-data automatisch
  upload: async (taskId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${BASE_URL}/tasks/${taskId}/attachments`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Upload fehlgeschlagen");
    }
    return response.json();
  },

  // Datei herunterladen — öffnet in neuem Tab
  download: (taskId, attachmentId) => {
    window.open(`${BASE_URL}/tasks/${taskId}/attachments/${attachmentId}/download`, "_blank");
  },

  // Anhang löschen
  delete: (taskId, attachmentId) =>
    api.delete(`/tasks/${taskId}/attachments/${attachmentId}`),
};
