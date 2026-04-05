import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { projectsApi } from "../api/projects";
import { tagsApi } from "../api/tags";
import { api } from "../api/client";
import ConfirmDialog from "../components/common/ConfirmDialog";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { PROJECT_COLORS } from "../utils/constants";

// Preset-Farben fuer Tags
const TAG_COLORS = [
  "#3b82f6", // blau
  "#10b981", // grün
  "#f59e0b", // gelb
  "#ef4444", // rot
  "#8b5cf6", // violett
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#84cc16", // lime
  "#6b7280", // grau
];

// Einstellungs-Seite: App-Info + Projekt-Verwaltung + Tag-Verwaltung
export default function SettingsPage({ onLogout }) {
  const navigate = useNavigate();

  // Projekte-State
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Neues Projekt Formular
  const [newProject, setNewProject] = useState({ name: "", color: PROJECT_COLORS[0] });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Projekt Bearbeiten-State
  const [editingProject, setEditingProject] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", color: "" });
  const [saving, setSaving] = useState(false);

  // Projekt Löschen-State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Tags-State
  const [tags, setTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [newTag, setNewTag] = useState({ name: "", color: TAG_COLORS[0] });
  const [creatingTag, setCreatingTag] = useState(false);
  const [createTagError, setCreateTagError] = useState("");
  const [editingTag, setEditingTag] = useState(null);
  const [editTagForm, setEditTagForm] = useState({ name: "", color: "" });
  const [savingTag, setSavingTag] = useState(false);
  const [deleteTagTarget, setDeleteTagTarget] = useState(null);
  const [deletingTag, setDeletingTag] = useState(false);

  const fetchProjects = async () => {
    try {
      const data = await projectsApi.getAll();
      setProjects(data);
    } catch {
      // Fehler ignorieren
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const data = await tagsApi.getAll();
      setTags(data);
    } catch {
      // Fehler ignorieren
    } finally {
      setTagsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchTags();
  }, []);

  // Projekt erstellen
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProject.name.trim()) {
      setCreateError("Projektname erforderlich.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      await projectsApi.create({ name: newProject.name.trim(), color: newProject.color });
      setNewProject({ name: "", color: PROJECT_COLORS[0] });
      fetchProjects();
    } catch (err) {
      setCreateError(err.detail || "Fehler beim Erstellen.");
    } finally {
      setCreating(false);
    }
  };

  // Projekt-Bearbeitung starten
  const startEdit = (project) => {
    setEditingProject(project.id);
    setEditForm({ name: project.name, color: project.color });
  };

  // Projekt speichern
  const handleSaveProject = async (id) => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    try {
      await projectsApi.update(id, { name: editForm.name.trim(), color: editForm.color });
      setEditingProject(null);
      fetchProjects();
    } catch {
      // Fehler ignorieren
    } finally {
      setSaving(false);
    }
  };

  // Projekt löschen
  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await projectsApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      fetchProjects();
    } catch {
      // Fehler ignorieren
    } finally {
      setDeleting(false);
    }
  };

  // Tag erstellen
  const handleCreateTag = async (e) => {
    e.preventDefault();
    if (!newTag.name.trim()) {
      setCreateTagError("Tag-Name erforderlich.");
      return;
    }
    setCreatingTag(true);
    setCreateTagError("");
    try {
      await tagsApi.create({ name: newTag.name.trim(), color: newTag.color });
      setNewTag({ name: "", color: TAG_COLORS[0] });
      fetchTags();
    } catch (err) {
      setCreateTagError(err.detail || "Fehler beim Erstellen.");
    } finally {
      setCreatingTag(false);
    }
  };

  // Tag-Bearbeitung starten
  const startEditTag = (tag) => {
    setEditingTag(tag.id);
    setEditTagForm({ name: tag.name, color: tag.color || TAG_COLORS[0] });
  };

  // Tag speichern
  const handleSaveTag = async (id) => {
    if (!editTagForm.name.trim()) return;
    setSavingTag(true);
    try {
      await tagsApi.update(id, { name: editTagForm.name.trim(), color: editTagForm.color });
      setEditingTag(null);
      fetchTags();
    } catch {
      // Fehler ignorieren
    } finally {
      setSavingTag(false);
    }
  };

  // Tag löschen
  const handleDeleteTag = async () => {
    if (!deleteTagTarget) return;
    setDeletingTag(true);
    try {
      await tagsApi.delete(deleteTagTarget.id);
      setDeleteTagTarget(null);
      fetchTags();
    } catch {
      // Fehler ignorieren
    } finally {
      setDeletingTag(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await api.post("/auth/logout", {});
    } catch {
      // Trotzdem ausloggen
    }
    onLogout?.();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">Einstellungen</h1>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-6">
        {/* App-Info */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600">
              <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900">myProductivity</h2>
              <p className="text-sm text-gray-500">Version 2.0.0 — R2</p>
              <p className="text-xs text-gray-400">Persönliches Task-Management System</p>
            </div>
          </div>
        </div>

        {/* Projekt-Verwaltung */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Projekte</h3>

          {/* Neues Projekt erstellen */}
          <form onSubmit={handleCreateProject} className="mb-5 flex flex-col gap-3">
            <h4 className="text-sm font-medium text-gray-700">Neues Projekt</h4>
            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                placeholder="Projektname"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {creating ? "..." : "Erstellen"}
              </button>
            </div>
            {/* Farbauswahl */}
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewProject({ ...newProject, color })}
                  className={`h-7 w-7 rounded-full transition-all ${
                    newProject.color === color ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </form>

          {/* Projekt-Liste */}
          <div className="border-t border-gray-100 pt-4">
            <h4 className="mb-3 text-sm font-medium text-gray-700">Bestehende Projekte</h4>
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : projects.length === 0 ? (
              <p className="text-sm text-gray-400">Noch keine Projekte erstellt.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {projects.map((project) => (
                  <div key={project.id} className="rounded-lg border border-gray-100 p-3">
                    {editingProject === project.id ? (
                      // Bearbeitungs-Modus
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {PROJECT_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setEditForm({ ...editForm, color })}
                              className={`h-6 w-6 rounded-full transition-all ${
                                editForm.color === color ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : ""
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingProject(null)}
                            className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                          >
                            Abbrechen
                          </button>
                          <button
                            onClick={() => handleSaveProject(project.id)}
                            disabled={saving}
                            className="flex-1 rounded-lg bg-primary-600 py-1.5 text-xs text-white hover:bg-primary-700 disabled:opacity-50"
                          >
                            {saving ? "..." : "Speichern"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Anzeige-Modus
                      <div className="flex items-center gap-3">
                        <span
                          className="h-4 w-4 rounded-full shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="flex-1 text-sm text-gray-800">{project.name}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(project)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(project)}
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tag-Verwaltung */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Tags verwalten</h3>

          {/* Neuer Tag */}
          <form onSubmit={handleCreateTag} className="mb-5 flex flex-col gap-3">
            <h4 className="text-sm font-medium text-gray-700">Neuer Tag</h4>
            {createTagError && (
              <p className="text-sm text-red-600">{createTagError}</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag.name}
                onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                placeholder="Tag-Name"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
              {/* Vorschau des Tags */}
              <span
                className="flex items-center rounded-full px-3 py-1 text-xs font-medium shrink-0"
                style={{
                  backgroundColor: newTag.color + "20",
                  color: newTag.color,
                }}
              >
                {newTag.name || "Vorschau"}
              </span>
              <button
                type="submit"
                disabled={creatingTag}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {creatingTag ? "..." : "Erstellen"}
              </button>
            </div>
            {/* Farbauswahl */}
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewTag({ ...newTag, color })}
                  className={`h-7 w-7 rounded-full transition-all ${
                    newTag.color === color ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </form>

          {/* Tag-Liste */}
          <div className="border-t border-gray-100 pt-4">
            <h4 className="mb-3 text-sm font-medium text-gray-700">Bestehende Tags</h4>
            {tagsLoading ? (
              <LoadingSpinner size="sm" />
            ) : tags.length === 0 ? (
              <p className="text-sm text-gray-400">Noch keine Tags erstellt.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {tags.map((tag) => (
                  <div key={tag.id} className="rounded-lg border border-gray-100 p-3">
                    {editingTag === tag.id ? (
                      // Bearbeitungs-Modus
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={editTagForm.name}
                          onChange={(e) => setEditTagForm({ ...editTagForm, name: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {TAG_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setEditTagForm({ ...editTagForm, color })}
                              className={`h-6 w-6 rounded-full transition-all ${
                                editTagForm.color === color ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : ""
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingTag(null)}
                            className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                          >
                            Abbrechen
                          </button>
                          <button
                            onClick={() => handleSaveTag(tag.id)}
                            disabled={savingTag}
                            className="flex-1 rounded-lg bg-primary-600 py-1.5 text-xs text-white hover:bg-primary-700 disabled:opacity-50"
                          >
                            {savingTag ? "..." : "Speichern"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Anzeige-Modus
                      <div className="flex items-center gap-3">
                        {/* Tag als Pill-Vorschau */}
                        <span
                          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: (tag.color || "#6b7280") + "20",
                            color: tag.color || "#6b7280",
                          }}
                        >
                          {tag.name}
                        </span>
                        <div className="flex gap-1 ml-auto">
                          <button
                            onClick={() => startEditTag(tag)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteTagTarget(tag)}
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Logout */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-900">Konto</h3>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Abmelden
          </button>
        </div>
      </div>

      {/* Projekt Löschen-Bestätigung */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Projekt löschen?"
        message={`"${deleteTarget?.name}" und alle zugehörigen Verbindungen werden entfernt. Tasks bleiben erhalten.`}
        confirmLabel={deleting ? "Löschen..." : "Löschen"}
        danger
        onConfirm={handleDeleteProject}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Tag Löschen-Bestätigung */}
      <ConfirmDialog
        isOpen={!!deleteTagTarget}
        title="Tag löschen?"
        message={`Tag "${deleteTagTarget?.name}" wird gelöscht und von allen Tasks entfernt.`}
        confirmLabel={deletingTag ? "Löschen..." : "Löschen"}
        danger
        onConfirm={handleDeleteTag}
        onCancel={() => setDeleteTagTarget(null)}
      />
    </div>
  );
}
