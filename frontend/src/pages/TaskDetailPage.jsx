import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { tasksApi } from "../api/tasks";
import { tagsApi } from "../api/tags";
import { projectsApi } from "../api/projects";
import { attachmentsApi } from "../api/attachments";
import TaskCreateModal from "../components/tasks/TaskCreateModal";
import AttachmentSection from "../components/tasks/AttachmentSection";
import ConfirmDialog from "../components/common/ConfirmDialog";
import LoadingSpinner from "../components/common/LoadingSpinner";
import {
  HORIZON_LABELS,
  HORIZON_DROPDOWN,
  HORIZON_CONFIG,
  DURATION_LABELS,
  DURATION_OPTIONS,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "../utils/constants";

// --- Hilfsfunktion: Autosave-Status pro Feld ---
// Status: null | "saving" | "saved" | "error"
function useSaveState() {
  const [states, setStates] = useState({});
  const timers = useRef({});

  const setSaving = (field) => {
    setStates((prev) => ({ ...prev, [field]: "saving" }));
  };

  const setSaved = (field) => {
    setStates((prev) => ({ ...prev, [field]: "saved" }));
    // Grünes Feedback nach 1.2 Sekunden wieder ausblenden
    clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(() => {
      setStates((prev) => ({ ...prev, [field]: null }));
    }, 1200);
  };

  const setError = (field) => {
    setStates((prev) => ({ ...prev, [field]: "error" }));
    clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(() => {
      setStates((prev) => ({ ...prev, [field]: null }));
    }, 3000);
  };

  return { states, setSaving, setSaved, setError };
}

// --- Visueller Indikator fuer den Speicher-Status eines Feldes ---
function SaveIndicator({ status }) {
  if (!status) return null;
  if (status === "saving") {
    return (
      <span className="ml-1.5 inline-flex items-center text-xs text-gray-400 animate-pulse">
        speichert…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-green-600">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        Gespeichert
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-red-600">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        Fehler
      </span>
    );
  }
  return null;
}

// --- Klassen fuer Feldrahmen je nach Speicher-Status ---
function fieldBorderClass(status) {
  if (status === "saved") return "border-green-400 ring-1 ring-green-200";
  if (status === "error") return "border-red-400 ring-1 ring-red-200";
  return "border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200";
}

// --- Detail-Ansicht mit direktem Inline-Edit ---
export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromView = location.state?.fromView || "short";

  // Zurück-Navigation: Subtask → Parent, sonst → Board
  const navigateBack = () => {
    if (task?.parent_id) {
      navigate(`/task/${task.parent_id}`);
    } else {
      navigate("/");
    }
  };

  // Daten-State
  const [task, setTask] = useState(null);
  const [projects, setProjects] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // Lokale Formular-Werte (werden sofort aktualisiert, ohne auf Server zu warten)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState(null);
  const [waitingFor, setWaitingFor] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [horizon, setHorizon] = useState("inbox");
  const [projectId, setProjectId] = useState(null);
  const [durationTag, setDurationTag] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  // Anhänge
  const [attachments, setAttachments] = useState([]);

  // Neuer Tag via # Eingabe
  const [newTagInput, setNewTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  // Inline-Edit fuer Subtask-Titel
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");

  // Modals
  const [createSubtaskModalOpen, setCreateSubtaskModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Autosave-Status
  const { states: saveStates, setSaving, setSaved, setError: setSaveError } = useSaveState();

  // Task laden (inkl. Anhänge + Subtasks)
  const fetchTask = useCallback(async () => {
    try {
      const [data, attData, subtaskData] = await Promise.all([
        tasksApi.getById(id),
        attachmentsApi.list(id).catch(() => []),
        tasksApi.getAll({ parent_id: id }).catch(() => []),
      ]);
      // Subtasks in task-Objekt einfügen damit der Rest der Seite funktioniert
      data.subtasks = subtaskData || [];
      setTask(data);
      setAttachments(attData || []);
      // Lokale State-Werte synchronisieren
      setTitle(data.title || "");
      setDescription(data.description || "");
      setStatus(data.status || "open");
      setPriority(data.priority || null);
      setWaitingFor(data.waiting_for || "");
      setDueDate(data.due_date || "");
      setHorizon(data.time_horizon || "inbox");
      setProjectId(data.project?.id || null);
      setDurationTag(data.duration_tag || "");
      setSelectedTagIds(data.tags?.map((t) => t.id) || []);
      setPageError("");
    } catch (err) {
      setPageError(err.detail || "Task nicht gefunden.");
    }
  }, [id]);

  // Projekte + Tags laden
  const fetchProjects = useCallback(async () => {
    try {
      const data = await projectsApi.getAll();
      setProjects(data);
    } catch {
      // Optional — Fehler ignorieren
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const data = await tagsApi.getAll();
      setAvailableTags(data);
    } catch {
      // Optional
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchTask(), fetchProjects(), fetchTags()]);
      setLoading(false);
    };
    init();
  }, [fetchTask, fetchProjects, fetchTags]);

  // --- Generischer Autosave fuer ein einzelnes Feld ---
  const handleFieldSave = useCallback(
    async (fieldName, value) => {
      if (!task) return;
      setSaving(fieldName);
      try {
        // Vollstaendigen Task-Datensatz aufbauen (API erwartet alle Pflichtfelder)
        const payload = {
          title,
          description: description.trim() || null,
          project_id: projectId || null,
          time_horizon: horizon,
          duration_tag: durationTag || null,
          status,
          waiting_for: status === "waiting" ? (waitingFor.trim() || null) : null,
          is_work_package: task.is_work_package || false,
          priority: priority || null,
          due_date: dueDate || null,
          tag_ids: selectedTagIds,
          // Das gerade geaenderte Feld ueberschreiben
          [fieldName]: value,
        };
        await tasksApi.update(task.id, payload);
        setSaved(fieldName);
        // Task-Daten im lokalen State aktualisieren (ohne neu zu laden)
        setTask((prev) => ({ ...prev, [fieldName]: value }));
      } catch (err) {
        setSaveError(fieldName);
        console.error(`Fehler beim Speichern von ${fieldName}:`, err);
      }
    },
    [task, title, description, projectId, horizon, durationTag, status, waitingFor, priority, dueDate, selectedTagIds, setSaving, setSaved, setSaveError]
  );

  // --- Spezieller Tag-Save: sendet immer alle tag_ids ---
  const handleTagsSave = useCallback(
    async (newTagIds) => {
      if (!task) return;
      setSaving("tag_ids");
      try {
        await tasksApi.update(task.id, {
          title,
          description: description.trim() || null,
          project_id: projectId || null,
          time_horizon: horizon,
          duration_tag: durationTag || null,
          status,
          waiting_for: status === "waiting" ? (waitingFor.trim() || null) : null,
          is_work_package: task.is_work_package || false,
          priority: priority || null,
          due_date: dueDate || null,
          tag_ids: newTagIds,
        });
        setSaved("tag_ids");
      } catch (err) {
        setSaveError("tag_ids");
        console.error("Fehler beim Speichern der Tags:", err);
      }
    },
    [task, title, description, projectId, horizon, durationTag, status, waitingFor, priority, dueDate, setSaving, setSaved, setSaveError]
  );

  // Tag toggeln und sofort speichern
  const handleToggleTag = (tagId) => {
    const newIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    setSelectedTagIds(newIds);
    handleTagsSave(newIds);
  };

  // Neuen Tag erstellen und hinzufuegen
  const handleCreateTag = async () => {
    const name = newTagInput.replace(/^#/, "").trim();
    if (!name) return;
    try {
      const newTag = await tagsApi.create({ name, color: "#6b7280" });
      setAvailableTags((prev) => [...prev, newTag]);
      const newIds = [...selectedTagIds, newTag.id];
      setSelectedTagIds(newIds);
      handleTagsSave(newIds);
      setNewTagInput("");
      setShowTagInput(false);
    } catch {
      // Fehler ignorieren
    }
  };

  // Unteraufgabe erledigt/offen toggeln
  const handleToggleSubtask = async (subtask) => {
    const newStatus = subtask.status === "done" ? "open" : "done";
    try {
      await tasksApi.update(subtask.id, { ...subtask, status: newStatus, tag_ids: subtask.tags?.map((t) => t.id) || [] });
      fetchTask();
    } catch (err) {
      console.error("Fehler beim Status-Update der Unteraufgabe:", err);
    }
  };

  // Subtask-Titel inline bearbeiten
  const handleSubtaskTitleBlur = async (subtask) => {
    if (editingSubtaskTitle.trim() === subtask.title) {
      setEditingSubtaskId(null);
      return;
    }
    try {
      await tasksApi.update(subtask.id, {
        ...subtask,
        title: editingSubtaskTitle.trim() || subtask.title,
        tag_ids: subtask.tags?.map((t) => t.id) || [],
      });
      setEditingSubtaskId(null);
      fetchTask();
    } catch (err) {
      console.error("Fehler beim Umbenennen der Unteraufgabe:", err);
      setEditingSubtaskId(null);
    }
  };

  // Task loeschen
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await tasksApi.delete(task.id);
      navigate("/", { state: { fromView } });
    } catch (err) {
      console.error("Fehler beim Löschen:", err);
      setDeleting(false);
    }
  };

  // --- Status-Aenderung speichern (inkl. waiting_for-Logik) ---
  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    // Wenn Status auf "wartend" gesetzt wird, waiting_for-Feld nicht leeren
    handleFieldSave("status", newStatus);
  };

  // --- Prioritäts-Aenderung speichern ---
  const handlePriorityChange = (newPriority) => {
    const val = priority === newPriority ? null : newPriority;
    setPriority(val);
    handleFieldSave("priority", val);
  };

  // --- Horizont-Aenderung speichern ---
  const handleHorizonChange = (newHorizon) => {
    setHorizon(newHorizon);
    handleFieldSave("time_horizon", newHorizon);
  };

  // --- Projekt-Aenderung speichern ---
  const handleProjectChange = (newProjectId) => {
    setProjectId(newProjectId);
    handleFieldSave("project_id", newProjectId || null);
  };

  // --- Zeitaufwand-Aenderung speichern ---
  const handleDurationChange = (value) => {
    const newVal = durationTag === value ? "" : value;
    setDurationTag(newVal);
    handleFieldSave("duration_tag", newVal || null);
  };

  // --- Ladeansicht ---
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (pageError || !task) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-gray-500">{pageError || "Task nicht gefunden."}</p>
        <button
          onClick={() => navigate("/", { state: { fromView } })}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
        >
          Zurück zur Übersicht
        </button>
      </div>
    );
  }

  const subtasks = task.subtasks || [];
  const doneCount = subtasks.filter((s) => s.status === "done").length;
  const progressPercent = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;
  const horizonConfig = HORIZON_CONFIG[horizon] || HORIZON_CONFIG.someday_maybe;
  const selectedProject = projects.find((p) => p.id === projectId) || null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header — Zurück + Löschen */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 flex items-center gap-3">
        <button
          onClick={navigateBack}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Zurück"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="flex-1 text-sm text-gray-500">
          {task.parent_id && task.parent_title ? (
            <span
              className="cursor-pointer hover:text-primary-600 transition-colors flex items-center gap-1"
              onClick={() => navigate(`/task/${task.parent_id}`)}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Unteraufgabe von: {task.parent_title}
            </span>
          ) : task.is_work_package ? "Arbeitspaket" : "Task"}
        </span>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          Löschen
        </button>
      </div>

      {/* Seiteninhalt */}
      <div className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-5">

        {/* --- Titel (grosses rahmenloses Input) --- */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => handleFieldSave("title", title.trim())}
            placeholder="Titel…"
            className={`w-full rounded-lg border bg-transparent px-0 py-1 text-2xl font-bold text-gray-900 placeholder-gray-300
              focus:outline-none border-transparent focus:border-b-2 focus:border-primary-400 transition-colors
              ${saveStates.title === "saved" ? "border-b-2 border-green-400" : ""}
              ${saveStates.title === "error" ? "border-b-2 border-red-400" : ""}
            `}
          />
          <SaveIndicator status={saveStates.title} />
        </div>

        {/* --- Beschreibung --- */}
        <div>
          <label className="mb-1 flex items-center text-xs font-medium text-gray-500 uppercase tracking-wide">
            Beschreibung
            <SaveIndicator status={saveStates.description} />
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => handleFieldSave("description", description.trim() || null)}
            placeholder="Details, Kontext, Links…"
            rows={3}
            className={`w-full resize-none rounded-lg border px-3 py-2 text-sm text-gray-700 placeholder-gray-300
              focus:outline-none transition-colors
              ${fieldBorderClass(saveStates.description)}
            `}
          />
        </div>

        {/* --- Status + Priorität + Wartend auf --- */}
        <div className="flex flex-wrap gap-3 items-start">

          {/* Status-Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="flex items-center text-xs font-medium text-gray-500 uppercase tracking-wide">
              Status
              <SaveIndicator status={saveStates.status} />
            </label>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className={`rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none transition-colors ${fieldBorderClass(saveStates.status)}`}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Priorität als Pills */}
          <div className="flex flex-col gap-1">
            <label className="flex items-center text-xs font-medium text-gray-500 uppercase tracking-wide">
              Priorität
              <SaveIndicator status={saveStates.priority} />
            </label>
            <div className="flex gap-1.5 mt-0.5">
              {[
                { v: "high",   l: "Hoch",    active: "bg-red-500 text-white border-red-500",       inactive: "border-red-200 text-red-600 hover:bg-red-50" },
                { v: "medium", l: "Mittel",  active: "bg-yellow-500 text-white border-yellow-500", inactive: "border-yellow-200 text-yellow-600 hover:bg-yellow-50" },
                { v: "low",    l: "Niedrig", active: "bg-blue-400 text-white border-blue-400",     inactive: "border-blue-200 text-blue-500 hover:bg-blue-50" },
              ].map((p) => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => handlePriorityChange(p.v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    priority === p.v ? p.active : p.inactive
                  }`}
                >
                  {p.l}
                </button>
              ))}
            </div>
          </div>

          {/* Wartend-auf Feld — nur wenn Status = waiting */}
          {status === "waiting" && (
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label className="flex items-center text-xs font-medium text-amber-700 uppercase tracking-wide">
                ⏳ Wartend auf
                <SaveIndicator status={saveStates.waiting_for} />
              </label>
              <input
                type="text"
                value={waitingFor}
                onChange={(e) => setWaitingFor(e.target.value)}
                onBlur={() => handleFieldSave("waiting_for", waitingFor.trim() || null)}
                placeholder="z.B. Rückmeldung von Lisa"
                className={`rounded-lg border px-3 py-2 text-sm bg-amber-50 focus:outline-none transition-colors ${
                  saveStates.waiting_for === "saved"
                    ? "border-green-400 ring-1 ring-green-200"
                    : saveStates.waiting_for === "error"
                    ? "border-red-400 ring-1 ring-red-200"
                    : "border-amber-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                }`}
              />
            </div>
          )}
        </div>

        {/* --- Fällig + Horizont + Projekt --- */}
        <div className="flex flex-wrap gap-3 items-start">

          {/* Fälligkeitsdatum */}
          <div className="flex flex-col gap-1">
            <label className="flex items-center text-xs font-medium text-gray-500 uppercase tracking-wide">
              Fällig am
              <SaveIndicator status={saveStates.due_date} />
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                handleFieldSave("due_date", e.target.value || null);
              }}
              className={`rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none transition-colors ${fieldBorderClass(saveStates.due_date)}`}
            />
          </div>

          {/* Horizont-Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="flex items-center text-xs font-medium text-gray-500 uppercase tracking-wide">
              Horizont
              <SaveIndicator status={saveStates.time_horizon} />
            </label>
            <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 bg-white transition-colors ${fieldBorderClass(saveStates.time_horizon)}`}>
              <span className="text-base">{horizonConfig.icon}</span>
              <select
                value={horizon}
                onChange={(e) => handleHorizonChange(e.target.value)}
                className="bg-transparent text-sm text-gray-700 focus:outline-none"
              >
                {HORIZON_DROPDOWN.map((h) => (
                  <option key={h} value={h}>{HORIZON_LABELS[h]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Projekt-Dropdown */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="flex items-center text-xs font-medium text-gray-500 uppercase tracking-wide">
              Projekt
              <SaveIndicator status={saveStates.project_id} />
            </label>
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 bg-white transition-colors ${fieldBorderClass(saveStates.project_id)}`}>
              {/* Farbpunkt des Projekts */}
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: selectedProject?.color || "#d1d5db" }}
              />
              <select
                value={projectId || ""}
                onChange={(e) => handleProjectChange(e.target.value ? parseInt(e.target.value) : null)}
                className="bg-transparent text-sm text-gray-700 focus:outline-none flex-1"
              >
                <option value="">Kein Projekt</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* --- Zeitaufwand als Pills --- */}
        <div>
          <label className="mb-2 flex items-center text-xs font-medium text-gray-500 uppercase tracking-wide">
            Zeitaufwand
            <SaveIndicator status={saveStates.duration_tag} />
          </label>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleDurationChange(value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  durationTag === value
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* --- Tags --- */}
        <div>
          <label className="mb-2 flex items-center text-xs font-medium text-gray-500 uppercase tracking-wide">
            Tags
            <SaveIndicator status={saveStates.tag_ids} />
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            {availableTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggleTag(tag.id)}
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

            {/* Neuen Tag hinzufuegen */}
            {showTagInput ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleCreateTag(); }
                    if (e.key === "Escape") { setShowTagInput(false); setNewTagInput(""); }
                  }}
                  onBlur={() => {
                    if (newTagInput.trim()) handleCreateTag();
                    else { setShowTagInput(false); setNewTagInput(""); }
                  }}
                  placeholder="#neuer-tag"
                  autoFocus
                  className="rounded-full border border-gray-300 px-3 py-1 text-xs w-32 focus:outline-none focus:border-primary-400"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowTagInput(true)}
                className="rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
              >
                + Tag
              </button>
            )}
          </div>
        </div>

        {/* --- Anhänge --- */}
        <AttachmentSection
          taskId={task.id}
          attachments={attachments}
          onUpdate={fetchTask}
        />

        {/* --- Unteraufgaben (für alle Tasks ausser Subtasks selbst) --- */}
        {!task.parent_id && (
          <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Unteraufgaben
                <span className="ml-2 text-sm font-normal text-gray-400">
                  {doneCount}/{subtasks.length} erledigt
                </span>
              </h3>
              <button
                onClick={() => setCreateSubtaskModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-100 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Unteraufgabe
              </button>
            </div>

            {/* Fortschritts-Balken */}
            {subtasks.length > 0 && (
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                  <span>Fortschritt</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-primary-500 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Subtask-Liste */}
            {subtasks.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-4">
                Noch keine Unteraufgaben
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {subtasks.map((subtask) => {
                  const subtaskHorizonConfig = HORIZON_CONFIG[subtask.time_horizon] || HORIZON_CONFIG.someday_maybe;
                  return (
                    <div
                      key={subtask.id}
                      className="flex items-start gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors"
                    >
                      {/* Checkbox zum Erledigen */}
                      <button
                        onClick={() => handleToggleSubtask(subtask)}
                        className="mt-0.5 shrink-0"
                        aria-label={subtask.status === "done" ? "Als offen markieren" : "Als erledigt markieren"}
                      >
                        <div
                          className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors
                            ${subtask.status === "done"
                              ? "border-primary-500 bg-primary-500"
                              : "border-gray-300 hover:border-primary-400"
                            }`}
                        >
                          {subtask.status === "done" && (
                            <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </button>

                      {/* Subtask-Titel — inline editierbar */}
                      <div className="flex-1 min-w-0">
                        {editingSubtaskId === subtask.id ? (
                          <input
                            type="text"
                            value={editingSubtaskTitle}
                            onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                            onBlur={() => handleSubtaskTitleBlur(subtask)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.currentTarget.blur(); }
                              if (e.key === "Escape") { setEditingSubtaskId(null); }
                            }}
                            autoFocus
                            className="w-full rounded border border-primary-300 px-2 py-0.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary-200"
                          />
                        ) : (
                          <p
                            onClick={() => {
                              setEditingSubtaskId(subtask.id);
                              setEditingSubtaskTitle(subtask.title);
                            }}
                            className={`text-sm cursor-text ${
                              subtask.status === "done"
                                ? "line-through text-gray-400"
                                : "text-gray-800 hover:text-primary-700"
                            }`}
                            title="Klicken zum Bearbeiten"
                          >
                            {subtask.title}
                          </p>
                        )}

                        {/* Horizont-Badge + Tags der Unteraufgabe */}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {subtask.time_horizon && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${subtaskHorizonConfig.countBg} ${subtaskHorizonConfig.countText}`}
                            >
                              {subtaskHorizonConfig.icon} {HORIZON_LABELS[subtask.time_horizon]}
                            </span>
                          )}
                          {subtask.duration_tag && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                              {DURATION_LABELS[subtask.duration_tag] || subtask.duration_tag}
                            </span>
                          )}
                          {subtask.tags?.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: (tag.color || "#6b7280") + "20",
                                color: tag.color || "#6b7280",
                              }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Link zur Subtask-Detailseite */}
                      <button
                        onClick={() => navigate(`/task/${subtask.id}`)}
                        className="shrink-0 rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        title="Zur Detailseite"
                        aria-label="Unteraufgabe öffnen"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subtask-Erstellen-Modal */}
      <TaskCreateModal
        isOpen={createSubtaskModalOpen}
        onClose={() => setCreateSubtaskModalOpen(false)}
        onSuccess={() => {
          fetchTask();
          setCreateSubtaskModalOpen(false);
        }}
        projects={projects}
        parentTask={task}
        defaultHorizon={task.time_horizon}
      />

      {/* Löschen-Bestätigung */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Task löschen?"
        message={`"${task.title}" wird unwiderruflich gelöscht.`}
        confirmLabel={deleting ? "Löschen…" : "Löschen"}
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
