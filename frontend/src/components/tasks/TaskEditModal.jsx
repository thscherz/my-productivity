import { useState, useEffect } from "react";
import { tasksApi } from "../../api/tasks";
import { tagsApi } from "../../api/tags";
import ProjectSelector from "../projects/ProjectSelector";
import ConfirmDialog from "../common/ConfirmDialog";
import { HORIZON_LABELS, HORIZON_ORDER, DURATION_OPTIONS, STATUS_LABELS } from "../../utils/constants";

// Modal zum Bearbeiten eines bestehenden Tasks
export default function TaskEditModal({ isOpen, onClose, onSuccess, onDelete, task, projects = [] }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    project_id: null,
    time_horizon: "inbox",
    duration_tag: "",
    status: "open",
    waiting_for: "",
    is_work_package: false,
  });
  const [priority, setPriority] = useState(null);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Tags laden wenn Modal öffnet
  useEffect(() => {
    if (isOpen) {
      tagsApi.getAll().then(setAvailableTags).catch(() => setAvailableTags([]));
    }
  }, [isOpen]);

  // Formular mit Task-Daten befuellen wenn sich der Task ändert
  useEffect(() => {
    if (task && isOpen) {
      setForm({
        title: task.title || "",
        description: task.description || "",
        project_id: task.project?.id || null,
        time_horizon: task.time_horizon || "inbox",
        duration_tag: task.duration_tag || "",
        status: task.status || "open",
        waiting_for: task.waiting_for || "",
        is_work_package: task.is_work_package || false,
      });
      setPriority(task.priority || null);
      // Tags des Tasks vorbelegen
      setSelectedTagIds(task.tags?.map((t) => t.id) || []);
      setError("");
    }
  }, [task, isOpen]);

  // ESC-Taste zum Schliessen
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Tag-Auswahl toggeln
  const toggleTag = (tagId) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Titel ist erforderlich.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await tasksApi.update(task.id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        project_id: form.project_id || null,
        time_horizon: form.time_horizon,
        duration_tag: form.duration_tag || null,
        status: form.status,
        waiting_for: form.status === "waiting" ? (form.waiting_for.trim() || null) : null,
        is_work_package: form.is_work_package,
        priority: priority || null,
        tag_ids: selectedTagIds,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.detail || "Fehler beim Speichern.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await tasksApi.delete(task.id);
      onDelete?.();
      onClose();
    } catch (err) {
      setError(err.detail || "Fehler beim Löschen.");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen || !task) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Task bearbeiten</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Fehlermeldung */}
            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Titel */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Titel <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200"
              />
            </div>

            {/* Beschreibung */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Beschreibung</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200"
              />
            </div>

            {/* Priorität */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Priorität</label>
              <div className="flex gap-2">
                {[
                  { v: "high", l: "Hoch", active: "bg-red-500 text-white border-red-500", inactive: "border-red-200 text-red-600 hover:bg-red-50" },
                  { v: "medium", l: "Mittel", active: "bg-yellow-500 text-white border-yellow-500", inactive: "border-yellow-200 text-yellow-600 hover:bg-yellow-50" },
                  { v: "low", l: "Niedrig", active: "bg-blue-400 text-white border-blue-400", inactive: "border-blue-200 text-blue-500 hover:bg-blue-50" },
                ].map((p) => (
                  <button
                    key={p.v}
                    type="button"
                    onClick={() => setPriority(priority === p.v ? null : p.v)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      priority === p.v ? p.active : p.inactive
                    }`}
                  >
                    {p.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Status + Horizont */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Horizont</label>
                <select
                  value={form.time_horizon}
                  onChange={(e) => setForm({ ...form, time_horizon: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                >
                  {HORIZON_ORDER.map((h) => (
                    <option key={h} value={h}>{HORIZON_LABELS[h]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Wartend-Feld: Worauf wartest du? */}
            {form.status === "waiting" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-amber-700">
                  Worauf wartest du?
                </label>
                <input
                  type="text"
                  value={form.waiting_for}
                  onChange={(e) => setForm({ ...form, waiting_for: e.target.value })}
                  placeholder="z.B. Antwort von Max, Lieferung, Entscheidung..."
                  className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-200"
                />
              </div>
            )}

            {/* Projekt */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Projekt</label>
              <ProjectSelector
                projects={projects}
                value={form.project_id}
                onChange={(val) => setForm({ ...form, project_id: val })}
              />
            </div>

            {/* Zeitaufwand */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Zeitaufwand</label>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, duration_tag: form.duration_tag === value ? "" : value })
                    }
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      form.duration_tag === value
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            {availableTags.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className="rounded-full px-3 py-1 text-xs font-medium border transition-all"
                        style={
                          isSelected
                            ? {
                                backgroundColor: tag.color || "#6b7280",
                                color: "#fff",
                                borderColor: tag.color || "#6b7280",
                              }
                            : {
                                backgroundColor: (tag.color || "#6b7280") + "15",
                                color: tag.color || "#6b7280",
                                borderColor: (tag.color || "#6b7280") + "40",
                              }
                        }
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Arbeitspaket (nur wenn kein parent_id) */}
            {!task.parent_id && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_work_package}
                  onChange={(e) => setForm({ ...form, is_work_package: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Arbeitspaket (hat Unteraufgaben)</span>
              </label>
            )}

            {/* Aktionen */}
            <div className="flex gap-3 pt-1">
              {/* Löschen-Button */}
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Löschen
              </button>
              <div className="flex flex-1 gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Speichern..." : "Speichern"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Löschen-Bestätigung */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Task löschen?"
        message={`"${task.title}" wird unwiderruflich gelöscht.`}
        confirmLabel={deleting ? "Löschen..." : "Löschen"}
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
