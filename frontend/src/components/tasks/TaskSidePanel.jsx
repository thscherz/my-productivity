import { useState, useEffect, useCallback, useRef } from "react";
import { tasksApi } from "../../api/tasks";
import { tagsApi } from "../../api/tags";
import {
  HORIZON_LABELS,
  HORIZON_DROPDOWN,
  HORIZON_CONFIG,
  DURATION_LABELS,
  DURATION_OPTIONS,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from "../../utils/constants";

// --- Autosave-Status pro Feld ---
function useSaveState() {
  const [states, setStates] = useState({});
  const timers = useRef({});

  const setSaving = (field) =>
    setStates((prev) => ({ ...prev, [field]: "saving" }));

  const setSaved = (field) => {
    setStates((prev) => ({ ...prev, [field]: "saved" }));
    clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(
      () => setStates((prev) => ({ ...prev, [field]: null })),
      1200
    );
  };

  const setError = (field) => {
    setStates((prev) => ({ ...prev, [field]: "error" }));
    clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(
      () => setStates((prev) => ({ ...prev, [field]: null })),
      3000
    );
  };

  return { states, setSaving, setSaved, setError };
}

// --- Kleiner Speicher-Indikator (Punkt neben Feldname) ---
function SaveDot({ status }) {
  if (!status) return null;
  if (status === "saving")
    return <span className="ml-1 h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse inline-block" />;
  if (status === "saved")
    return <span className="ml-1 h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />;
  if (status === "error")
    return <span className="ml-1 h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />;
  return null;
}

// Feldrahmen-Klasse je nach Speicher-Status
function fieldBorderClass(status) {
  if (status === "saved") return "border-green-400 ring-1 ring-green-200";
  if (status === "error") return "border-red-400 ring-1 ring-red-200";
  return "border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200";
}

/**
 * TaskSidePanel — Schnellansicht/Bearbeitung eines Tasks als Sidebar.
 *
 * Props:
 *   taskId      — ID des zu bearbeitenden Tasks (null = Panel geschlossen)
 *   projects    — Liste aller Projekte
 *   onClose     — Callback zum Schliessen
 *   onRefetch   — Callback nach Änderungen (Board neu laden)
 *   onOpenFull  — Callback um zur vollständigen Detail-Seite zu navigieren
 *   isModalOpen — true wenn ein Modal (z.B. TaskCreateModal) offen ist → ESC geht ans Modal, nicht an Sidebar
 */
export default function TaskSidePanel({ taskId, projects = [], onClose, onRefetch, onOpenFull, isModalOpen = false }) {
  const { states: saveStates, setSaving, setSaved, setError: setSaveError } = useSaveState();

  // Task-Daten
  const [task, setTask] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Formular-State (sofortige lokale Aktualisierung)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState(null);
  const [waitingFor, setWaitingFor] = useState("");
  const [horizon, setHorizon] = useState("inbox");
  const [projectId, setProjectId] = useState(null);
  const [durationTag, setDurationTag] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [dueDate, setDueDate] = useState("");

  // Task laden wenn sich die taskId ändert
  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError("");
    try {
      const [data, subtaskData] = await Promise.all([
        tasksApi.getById(taskId),
        tasksApi.getAll({ parent_id: taskId }).catch(() => []),
      ]);
      data.subtasks = subtaskData || [];
      setTask(data);
      setTitle(data.title || "");
      setDescription(data.description || "");
      setStatus(data.status || "open");
      setPriority(data.priority || null);
      setWaitingFor(data.waiting_for || "");
      setHorizon(data.time_horizon || "inbox");
      setProjectId(data.project?.id || null);
      setDurationTag(data.duration_tag || "");
      setSelectedTagIds(data.tags?.map((t) => t.id) || []);
      setDueDate(data.due_date || "");
    } catch (err) {
      setError(err.detail || "Task konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Tags laden (einmalig beim Öffnen)
  useEffect(() => {
    tagsApi.getAll().then(setAvailableTags).catch(() => setAvailableTags([]));
  }, []);

  // Task neu laden wenn taskId sich ändert
  useEffect(() => {
    if (taskId) {
      fetchTask();
    } else {
      setTask(null);
    }
  }, [taskId, fetchTask]);

  // ESC-Taste zum Schliessen — nur wenn kein Modal offen ist (HINWEIS-02)
  useEffect(() => {
    if (!taskId) return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        // Wenn ein Modal offen ist, ESC nicht abfangen — das Modal behandelt es selbst
        if (isModalOpen) return;
        onClose?.();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [taskId, onClose, isModalOpen]);

  // Ref auf aktuellen Formular-State — wird von handleFieldSave gelesen um Race Conditions zu vermeiden (HINWEIS-01)
  const formStateRef = useRef({});
  useEffect(() => {
    formStateRef.current = { title, description, projectId, horizon, durationTag, status, waitingFor, priority, dueDate, selectedTagIds };
  }, [title, description, projectId, horizon, durationTag, status, waitingFor, priority, dueDate, selectedTagIds]);

  // --- Generischer Autosave fuer ein einzelnes Feld ---
  // Liest den State über formStateRef (immer aktuell zum Zeitpunkt des API-Calls),
  // nicht über Closure-Captures — verhindert Race Condition bei gleichzeitiger Bearbeitung mehrerer Felder (HINWEIS-01)
  const handleFieldSave = useCallback(
    async (fieldName, value) => {
      if (!task) return;
      setSaving(fieldName);
      try {
        // Aktuellen State aus Ref lesen — nicht aus Closure, damit kein veralteter Wert anderer Felder verwendet wird
        const s = formStateRef.current;
        const payload = {
          title: s.title,
          description: s.description.trim() || null,
          project_id: s.projectId || null,
          time_horizon: s.horizon,
          duration_tag: s.durationTag || null,
          status: s.status,
          waiting_for: s.status === "waiting" ? (s.waitingFor.trim() || null) : null,
          is_work_package: task.is_work_package || false,
          priority: s.priority || null,
          due_date: s.dueDate || null,
          tag_ids: s.selectedTagIds,
          [fieldName]: value,
        };
        await tasksApi.update(task.id, payload);
        setSaved(fieldName);
        setTask((prev) => ({ ...prev, [fieldName]: value }));
        // Board nach Änderungen neu laden (Horizont, Status etc. beeinflussen das Board)
        onRefetch?.();
      } catch (err) {
        setSaveError(fieldName);
        console.error(`Sidebar: Fehler beim Speichern von ${fieldName}:`, err);
      }
    },
    // Nur stabile Werte in Deps — formStateRef ist ein Ref und ändert sich nicht
    [task, setSaving, setSaved, setSaveError, onRefetch]
  );

  // --- Tags speichern (ebenfalls über formStateRef, nicht Closure) ---
  const handleTagsSave = useCallback(
    async (newTagIds) => {
      if (!task) return;
      setSaving("tag_ids");
      try {
        const s = formStateRef.current;
        await tasksApi.update(task.id, {
          title: s.title,
          description: s.description.trim() || null,
          project_id: s.projectId || null,
          time_horizon: s.horizon,
          duration_tag: s.durationTag || null,
          status: s.status,
          waiting_for: s.status === "waiting" ? (s.waitingFor.trim() || null) : null,
          is_work_package: task.is_work_package || false,
          priority: s.priority || null,
          due_date: s.dueDate || null,
          tag_ids: newTagIds,
        });
        setSaved("tag_ids");
        onRefetch?.();
      } catch {
        setSaveError("tag_ids");
      }
    },
    [task, setSaving, setSaved, setSaveError, onRefetch]
  );

  const handleToggleTag = (tagId) => {
    const newIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    setSelectedTagIds(newIds);
    handleTagsSave(newIds);
  };

  // Panel ist nicht aktiv — nichts rendern
  if (!taskId) return null;

  const horizonConfig = HORIZON_CONFIG[horizon] || HORIZON_CONFIG.someday_maybe;
  const selectedProject = projects.find((p) => p.id === projectId) || null;
  const subtasks = task?.subtasks || [];
  const doneCount = subtasks.filter((s) => s.status === "done").length;

  return (
    <>
      {/* Hintergrund-Overlay: auf Mobile und iPad (bis lg), auf Desktop bleibt Board sichtbar (HINWEIS-03) */}
      <div
        className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        onClick={onClose}
      />

      {/* Sidebar-Panel */}
      <div
        className={`
          fixed right-0 top-0 z-40 flex h-full w-full flex-col bg-white shadow-2xl
          transition-transform duration-300 ease-in-out
          md:w-[420px] md:border-l md:border-gray-200
          ${taskId ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* --- Header --- */}
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 bg-white shrink-0">
          {/* Schliessen */}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Panel schliessen"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <span className="flex-1 text-sm font-medium text-gray-500">
            {task?.is_work_package ? "Arbeitspaket" : task?.parent_id ? "Unteraufgabe" : "Task"}
          </span>

          {/* Zur vollständigen Detail-Seite wechseln */}
          <button
            onClick={() => onOpenFull?.(taskId)}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            title="Vollständige Detail-Seite öffnen"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Detail
          </button>
        </div>

        {/* --- Inhalt --- */}
        <div className="flex-1 overflow-y-auto px-4 py-4">

          {/* Ladeansicht */}
          {loading && (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          )}

          {/* Fehler */}
          {error && !loading && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Task-Inhalt */}
          {task && !loading && (
            <div className="flex flex-col gap-5">

              {/* Parent-Link bei Unteraufgaben */}
              {task.parent_id && task.parent_title && (
                <button
                  onClick={() => onOpenFull?.(task.parent_id)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary-600 transition-colors text-left"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span>Teil von: {task.parent_title}</span>
                </button>
              )}

              {/* Titel */}
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => handleFieldSave("title", title.trim())}
                  placeholder="Titel…"
                  className={`w-full rounded-lg border bg-transparent px-0 py-1 text-xl font-bold text-gray-900 placeholder-gray-300
                    focus:outline-none border-transparent focus:border-b-2 focus:border-primary-400 transition-colors
                    ${saveStates.title === "saved" ? "border-b-2 border-green-400" : ""}
                    ${saveStates.title === "error" ? "border-b-2 border-red-400" : ""}
                  `}
                />
              </div>

              {/* Beschreibung */}
              <div>
                <label className="mb-1 flex items-center text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Beschreibung <SaveDot status={saveStates.description} />
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => handleFieldSave("description", description.trim() || null)}
                  placeholder="Details, Kontext, Links…"
                  rows={3}
                  className={`w-full resize-none rounded-lg border px-3 py-2 text-sm text-gray-700 placeholder-gray-300
                    focus:outline-none transition-colors ${fieldBorderClass(saveStates.description)}`}
                />
              </div>

              {/* Status + Priorität */}
              <div className="flex flex-wrap gap-3 items-start">

                {/* Status */}
                <div className="flex flex-col gap-1">
                  <label className="flex items-center text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Status <SaveDot status={saveStates.status} />
                  </label>
                  <select
                    value={status}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStatus(val);
                      handleFieldSave("status", val);
                    }}
                    className={`rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none transition-colors ${fieldBorderClass(saveStates.status)}`}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Priorität */}
                <div className="flex flex-col gap-1">
                  <label className="flex items-center text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Priorität <SaveDot status={saveStates.priority} />
                  </label>
                  <div className="flex gap-1 mt-0.5">
                    {[
                      { v: "high",   active: "bg-red-500 text-white border-red-500",       inactive: "border-red-200 text-red-600 hover:bg-red-50" },
                      { v: "medium", active: "bg-yellow-500 text-white border-yellow-500", inactive: "border-yellow-200 text-yellow-600 hover:bg-yellow-50" },
                      { v: "low",    active: "bg-blue-400 text-white border-blue-400",     inactive: "border-blue-200 text-blue-500 hover:bg-blue-50" },
                    ].map((p) => (
                      <button
                        key={p.v}
                        type="button"
                        onClick={() => {
                          const val = priority === p.v ? null : p.v;
                          setPriority(val);
                          handleFieldSave("priority", val);
                        }}
                        className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          priority === p.v ? p.active : p.inactive
                        }`}
                      >
                        {PRIORITY_LABELS[p.v]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Wartend-auf (nur wenn Status = waiting) */}
              {status === "waiting" && (
                <div>
                  <label className="mb-1 flex items-center text-xs font-medium text-amber-700 uppercase tracking-wide">
                    Wartend auf <SaveDot status={saveStates.waiting_for} />
                  </label>
                  <input
                    type="text"
                    value={waitingFor}
                    onChange={(e) => setWaitingFor(e.target.value)}
                    onBlur={() => handleFieldSave("waiting_for", waitingFor.trim() || null)}
                    placeholder="z.B. Rückmeldung von Lisa"
                    className={`w-full rounded-lg border px-3 py-2 text-sm bg-amber-50 focus:outline-none transition-colors ${
                      saveStates.waiting_for === "saved" ? "border-green-400" :
                      saveStates.waiting_for === "error" ? "border-red-400" :
                      "border-amber-200 focus:border-amber-400"
                    }`}
                  />
                </div>
              )}

              {/* Horizont + Fällig */}
              <div className="flex flex-wrap gap-3 items-start">

                {/* Horizont */}
                <div className="flex flex-col gap-1">
                  <label className="flex items-center text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Horizont <SaveDot status={saveStates.time_horizon} />
                  </label>
                  <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 bg-white transition-colors ${fieldBorderClass(saveStates.time_horizon)}`}>
                    <span className="text-base">{horizonConfig.icon}</span>
                    <select
                      value={horizon}
                      onChange={(e) => {
                        setHorizon(e.target.value);
                        handleFieldSave("time_horizon", e.target.value);
                      }}
                      className="bg-transparent text-sm text-gray-700 focus:outline-none"
                    >
                      {HORIZON_DROPDOWN.map((h) => (
                        <option key={h} value={h}>{HORIZON_LABELS[h]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Fälligkeitsdatum */}
                <div className="flex flex-col gap-1">
                  <label className="flex items-center text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Fällig am <SaveDot status={saveStates.due_date} />
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
              </div>

              {/* Projekt */}
              <div>
                <label className="mb-1 flex items-center text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Projekt <SaveDot status={saveStates.project_id} />
                </label>
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 bg-white transition-colors ${fieldBorderClass(saveStates.project_id)}`}>
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: selectedProject?.color || "#d1d5db" }}
                  />
                  <select
                    value={projectId || ""}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : null;
                      setProjectId(val);
                      handleFieldSave("project_id", val);
                    }}
                    className="bg-transparent text-sm text-gray-700 focus:outline-none flex-1"
                  >
                    <option value="">Kein Projekt</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Zeitaufwand */}
              <div>
                <label className="mb-2 flex items-center text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Zeitaufwand <SaveDot status={saveStates.duration_tag} />
                </label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        const newVal = durationTag === value ? "" : value;
                        setDurationTag(newVal);
                        handleFieldSave("duration_tag", newVal || null);
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
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

              {/* Tags */}
              <div>
                <label className="mb-2 flex items-center text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Tags <SaveDot status={saveStates.tag_ids} />
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleToggleTag(tag.id)}
                        className="rounded-full px-2.5 py-1 text-xs font-medium border transition-all"
                        style={
                          isSelected
                            ? { backgroundColor: tag.color || "#6b7280", color: "#fff", borderColor: tag.color || "#6b7280" }
                            : { backgroundColor: (tag.color || "#6b7280") + "15", color: tag.color || "#6b7280", borderColor: (tag.color || "#6b7280") + "40" }
                        }
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Unteraufgaben-Übersicht (lesend — Bearbeitung in Detailseite) */}
              {subtasks.length > 0 && (
                <div className="rounded-xl border border-gray-100 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Unteraufgaben
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        {doneCount}/{subtasks.length} erledigt
                      </span>
                    </h4>
                    <button
                      onClick={() => onOpenFull?.(taskId)}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      Alle bearbeiten
                    </button>
                  </div>
                  {/* Fortschrittsbalken */}
                  {subtasks.length > 0 && (
                    <div className="mb-3 h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className="h-1.5 rounded-full bg-primary-500 transition-all"
                        style={{ width: `${Math.round((doneCount / subtasks.length) * 100)}%` }}
                      />
                    </div>
                  )}
                  {/* Subtask-Liste (kompakt) */}
                  <div className="flex flex-col gap-1.5">
                    {subtasks.slice(0, 5).map((st) => (
                      <div key={st.id} className="flex items-center gap-2 text-sm">
                        <div
                          className={`h-3.5 w-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            st.status === "done"
                              ? "border-primary-500 bg-primary-500"
                              : "border-gray-300"
                          }`}
                        >
                          {st.status === "done" && (
                            <svg className="h-2 w-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`flex-1 text-xs ${st.status === "done" ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {st.title}
                        </span>
                      </div>
                    ))}
                    {subtasks.length > 5 && (
                      <button
                        onClick={() => onOpenFull?.(taskId)}
                        className="mt-1 text-xs text-gray-400 hover:text-primary-600 text-left"
                      >
                        + {subtasks.length - 5} weitere…
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </>
  );
}
