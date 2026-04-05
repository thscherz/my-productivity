import { api } from "./client";

// CRUD-Operationen fuer Tags
export const tagsApi = {
  getAll: () => api.get("/tags"),
  create: (data) => api.post("/tags", data),
  update: (id, data) => api.put(`/tags/${id}`, data),
  delete: (id) => api.delete(`/tags/${id}`),
};
