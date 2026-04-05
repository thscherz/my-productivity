import { useState, useEffect, useRef, useCallback } from "react";
import { tasksApi } from "../../api/tasks";
import { tagsApi } from "../../api/tags";
import ProjectSelector from "../projects/ProjectSelector";
import { HORIZON_LABELS, HORIZON_DROPDOWN, DURATION_OPTIONS, STATUS_LABELS } from "../../utils/constants";
import { parseTitle } from "../../utils/titleParser";

// Berechnet den passenden Zeithorizont aus einem Fälligkeitsdatum
function horizonFromDueDate(dateStr) {
  if (!dateStr) return null;
  const due = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((due - today) / 86400000);

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "tomorrow";
  const dayOfWeek = today.getDay() || 7;
  const daysUntilSunday = 7 - dayOfWeek;
  if (diffDays <= daysUntilSunday) return "this_week";
  if (diffDays <= daysUntilSunday + 7) return "next_week";
  if (due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear()) return "this_month";
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  if (due.getMonth() === nextMonth.getMonth() && due.getFullYear() === nextMonth.getFullYear()) return "next_month";
  if (Math.floor(due.getMonth() / 3) === Math.floor(now.getMonth() / 3) && due.getFullYear() === now.getFullYear()) return "this_quarter";
  // Nächstes Quartal: due liegt im Folgequartal des aktuellen Jahres
  const currentQ = Math.floor(now.getMonth() / 3);
  const dueQ = Math.floor(due.getMonth() / 3);
  if (dueQ === currentQ + 1 && due.getFullYear() === now.getFullYear()) return "next_quarter";
  if (due.getFullYear() === now.getFullYear()) return "this_year";
  if (due.getFullYear() === now.getFullYear() + 1) return "next_year";
  return "someday_maybe";
}

// Modal zum Erstellen eines neuen Tasks oder einer Unteraufgabe
export default function TaskCreateModal({ isOpen, onClose, onSuccess, projects = [], parentTask = null, defaultHorizon = "inbox" }) {
  const titleRef = useRef(null);
  const dateRef = useRef(null);
  const statusRef = useRef(null);
  const horizonRef = useRef(null);
  const tagDropdownRef = useRef(null);

  // Formular-State
  const [form, setForm] = useState({
    title: "", description: "", project_id: null, time_horizon: defaultHorizon,
    duration_tag: "", is_work_package: false, status: "open", waiting_for: "", due_date: "",
  });
  const [priority, setPriority] = useState(null);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [horizonManual, setHorizonManual] = useState(false);
  const [recognized, setRecognized] = useState([]);

  // Tag-Autocomplete State
  const [tagQuery, setTagQuery] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagCursorPos, setTagCursorPos] = useState(null);

  // Inline-Subtask-Erstellung
  const [subtaskTitles, setSubtaskTitles] = useState([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState("");
  const subtaskInputRef = useRef(null);

  // Multi-Line Paste State
  const [pastedLines, setPastedLines] = useState(null);

  // Tags laden
  const reloadTags = useCallback(() => {
    tagsApi.getAll().then(setAvailableTags).catch(() => setAvailableTags([]));
  }, []);

  useEffect(() => {
    if (isOpen) reloadTags();
  }, [isOpen, reloadTags]);

  // Formular zurücksetzen
  useEffect(() => {
    if (isOpen) {
      setForm({
        title: "", description: "", project_id: null, time_horizon: defaultHorizon,
        duration_tag: "", is_work_package: false, status: "open", waiting_for: "", due_date: "",
      });
      setPriority(null);
      setSelectedTagIds([]);
      setHorizonManual(false);
      setError("");
      setRecognized([]);
      setShowTagDropdown(false);
      setPastedLines(null);
      setSubtaskTitles([]);
      setNewSubtaskInput("");
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [isOpen, defaultHorizon]);

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (showTagDropdown) { setShowTagDropdown(false); return; }
        if (pastedLines) { setPastedLines(null); return; }
        onClose(); return;
      }
      if (e.metaKey || e.ctrlKey) {
        // Cmd+Enter = Task erstellen (Form submitten)
        if (e.key === "Enter") {
          e.preventDefault();
          document.querySelector("[data-submit-btn]")?.click();
          return;
        }
        switch (e.key.toLowerCase()) {
          case "d": e.preventDefault(); dateRef.current?.focus(); dateRef.current?.showPicker?.(); break;
          case "p": e.preventDefault(); setPriority((prev) => (!prev ? "high" : prev === "high" ? "medium" : prev === "medium" ? "low" : null)); break;
          case "s": e.preventDefault(); statusRef.current?.focus(); break;
          case "h": e.preventDefault(); horizonRef.current?.focus(); break;
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, showTagDropdown, pastedLines]);

  // Klick ausserhalb des Tag-Dropdowns schliesst es
  useEffect(() => {
    if (!showTagDropdown) return;
    const handleClick = (e) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target)) {
        setShowTagDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showTagDropdown]);

  // --- Tag-Autocomplete: # im Titel erkennen ---
  const handleTitleChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setForm((prev) => ({ ...prev, title: value }));

    // Prüfe ob gerade ein # getippt wird
    const textBeforeCursor = value.slice(0, cursorPos);
    const hashMatch = textBeforeCursor.match(/#(\S*)$/);
    if (hashMatch) {
      setTagQuery(hashMatch[1].toLowerCase());
      setTagCursorPos(cursorPos);
      setShowTagDropdown(true);
    } else {
      setShowTagDropdown(false);
    }
  };

  // Tag aus Dropdown auswählen (bestehend oder neu)
  const selectTag = async (tag) => {
    // Tag-Token aus dem Titel entfernen
    const textBeforeCursor = form.title.slice(0, tagCursorPos);
    const hashStart = textBeforeCursor.lastIndexOf("#");
    const cleanTitle = form.title.slice(0, hashStart) + form.title.slice(tagCursorPos);
    setForm((prev) => ({ ...prev, title: cleanTitle.replace(/\s{2,}/g, " ").trim() }));

    if (tag._isNew) {
      // Neuen Tag erstellen
      try {
        const newTag = await tagsApi.create({ name: tag.name, color: "#6b7280" });
        setAvailableTags((prev) => [...prev, newTag]);
        setSelectedTagIds((prev) => [...prev, newTag.id]);
      } catch {
        setError("Tag konnte nicht erstellt werden.");
      }
    } else {
      setSelectedTagIds((prev) => prev.includes(tag.id) ? prev : [...prev, tag.id]);
    }
    setShowTagDropdown(false);
    titleRef.current?.focus();
  };

  // Gefilterte Tags für Dropdown
  const filteredTags = availableTags.filter(
    (t) => t.name.toLowerCase().includes(tagQuery) && !selectedTagIds.includes(t.id)
  );
  const showCreateOption = tagQuery.length > 0 && !availableTags.some(
    (t) => t.name.toLowerCase() === tagQuery
  );

  // --- Multi-Line Paste Detection ---
  const handlePaste = (e) => {
    const text = e.clipboardData.getData("text/plain");
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length > 1) {
      e.preventDefault();
      setPastedLines(lines);
    }
  };

  // Batch-Tasks erstellen (alle Zeilen als separate Tasks)
  const handleBatchCreate = async () => {
    if (!pastedLines) return;
    setLoading(true);
    setError("");
    try {
      for (const line of pastedLines) {
        await tasksApi.create({
          title: line,
          time_horizon: form.time_horizon,
          project_id: form.project_id || null,
          parent_id: parentTask?.id || null,
          priority: priority || null,
          status: "open",
          tag_ids: selectedTagIds,
        });
      }
      setPastedLines(null);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.detail || "Fehler beim Erstellen der Tasks.");
    } finally {
      setLoading(false);
    }
  };

  // Paste als einzelnen Task verwenden
  const handleSingleFromPaste = () => {
    setForm((prev) => ({ ...prev, title: pastedLines.join(" — ") }));
    setPastedLines(null);
  };

  // Due Date Handler
  const handleDueDateChange = (dateStr) => {
    setForm((prev) => {
      const updates = { ...prev, due_date: dateStr };
      if (!horizonManual && dateStr) {
        const h = horizonFromDueDate(dateStr);
        if (h) updates.time_horizon = h;
      }
      return updates;
    });
  };

  const handleHorizonChange = (horizon) => {
    setForm((prev) => ({ ...prev, time_horizon: horizon }));
    setHorizonManual(true);
  };

  const toggleTag = (tagId) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // Smart Parsing beim Verlassen des Titelfelds
  const handleTitleBlur = () => {
    if (showTagDropdown) return; // Nicht parsen wenn Tag-Dropdown offen
    const result = parseTitle(form.title, availableTags);
    if (result.recognized.length > 0) {
      setForm((prev) => {
        const updates = { ...prev, title: result.cleanTitle };
        if (result.dueDate) {
          updates.due_date = result.dueDate;
          if (!horizonManual) {
            const h = horizonFromDueDate(result.dueDate);
            if (h) updates.time_horizon = h;
          }
        }
        return updates;
      });
      if (result.priority) setPriority(result.priority);
      if (result.tagIds.length > 0) {
        setSelectedTagIds((prev) => [...new Set([...prev, ...result.tagIds])]);
      }
      setRecognized(result.recognized);
      setTimeout(() => setRecognized([]), 3000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("Titel ist erforderlich."); return; }
    setLoading(true);
    setError("");
    try {
      const hasSubtasks = subtaskTitles.length > 0 && !parentTask;
      const createdTask = await tasksApi.create({
        title: form.title.trim(),
        description: form.description.trim() || null,
        project_id: form.project_id || null,
        time_horizon: form.time_horizon,
        duration_tag: form.duration_tag || null,
        is_work_package: hasSubtasks ? true : false,
        parent_id: parentTask?.id || null,
        priority: priority || null,
        status: form.status,
        waiting_for: form.status === "waiting" ? (form.waiting_for.trim() || null) : null,
        due_date: form.due_date || null,
        tag_ids: selectedTagIds,
      });

      // Subtasks erstellen (Projekt wird vom Backend vererbt)
      if (hasSubtasks && createdTask?.id) {
        for (const st of subtaskTitles) {
          await tasksApi.create({
            title: st,
            parent_id: createdTask.id,
            time_horizon: form.time_horizon,
            status: "open",
          });
        }
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.detail || "Fehler beim Erstellen des Tasks.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // --- Multi-Line Paste Dialog ---
  if (pastedLines) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPastedLines(null)}>
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Mehrere Zeilen erkannt</h2>
          <p className="text-sm text-gray-600 mb-4">
            Du hast {pastedLines.length} Zeilen eingefügt. Sollen daraus einzelne Tasks erstellt werden?
          </p>

          {/* Vorschau */}
          <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
            {pastedLines.map((line, i) => (
              <div key={i} className="flex items-start gap-2 py-1 text-sm">
                <span className="text-gray-400 text-xs mt-0.5">{i + 1}.</span>
                <span className="text-gray-700">{line}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={handleSingleFromPaste}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              1 Task erstellen
            </button>
            <button onClick={handleBatchCreate} disabled={loading}
              className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {loading ? "Erstelle..." : `${pastedLines.length} Tasks erstellen`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {parentTask ? `Unteraufgabe zu: ${parentTask.title}` : "Neuer Task"}
            <span className="ml-2 text-xs font-normal text-gray-400">⌘↵ erstellen</span>
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          {/* Titel mit Smart Parsing + Tag-Autocomplete */}
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Titel <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-400 font-normal">p1 p2 p3 #tag morgen 15.04</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={form.title}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onPaste={handlePaste}
              placeholder="Was ist zu tun?"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200"
            />

            {/* Tag-Autocomplete Dropdown */}
            {showTagDropdown && (filteredTags.length > 0 || showCreateOption) && (
              <div ref={tagDropdownRef}
                className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg max-h-40 overflow-y-auto">
                {filteredTags.map((tag) => (
                  <button key={tag.id} type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectTag(tag); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color || "#6b7280" }} />
                    {tag.name}
                  </button>
                ))}
                {showCreateOption && (
                  <button type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectTag({ _isNew: true, name: tagQuery }); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-primary-50 text-primary-700 border-t border-gray-100">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Tag "{tagQuery}" erstellen
                  </button>
                )}
              </div>
            )}

            {/* Feedback: erkannte Tokens */}
            {recognized.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {recognized.map((r, i) => (
                  <span key={i} className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700">{r}</span>
                ))}
              </div>
            )}
          </div>

          {/* Beschreibung */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Beschreibung</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Details, Kontext, Links..." rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200" />
          </div>

          {/* Status + Priorität */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status <span className="text-xs text-gray-400">⌘S</span></label>
              <select ref={statusRef} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Priorität <span className="text-xs text-gray-400">⌘P</span></label>
              <div className="flex gap-1.5 mt-1">
                {[
                  { v: "high", l: "Hoch", active: "bg-red-500 text-white border-red-500", inactive: "border-red-200 text-red-600 hover:bg-red-50" },
                  { v: "medium", l: "Mittel", active: "bg-yellow-500 text-white border-yellow-500", inactive: "border-yellow-200 text-yellow-600 hover:bg-yellow-50" },
                  { v: "low", l: "Niedrig", active: "bg-blue-400 text-white border-blue-400", inactive: "border-blue-200 text-blue-500 hover:bg-blue-50" },
                ].map((p) => (
                  <button key={p.v} type="button" onClick={() => setPriority(priority === p.v ? null : p.v)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${priority === p.v ? p.active : p.inactive}`}>
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Wartend-Feld */}
          {form.status === "waiting" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-amber-700">⏳ Worauf wartest du?</label>
              <input type="text" value={form.waiting_for} onChange={(e) => setForm({ ...form, waiting_for: e.target.value })}
                placeholder="z.B. Rückmeldung von Lisa"
                className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-200" />
            </div>
          )}

          {/* Due Date + Horizont + Projekt */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fällig am <span className="text-xs text-gray-400">⌘D</span></label>
              <input ref={dateRef} type="date" value={form.due_date} onChange={(e) => handleDueDateChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Horizont <span className="text-xs text-gray-400">⌘H</span></label>
              <select ref={horizonRef} value={form.time_horizon} onChange={(e) => handleHorizonChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
                {HORIZON_DROPDOWN.map((h) => (
                  <option key={h} value={h}>{HORIZON_LABELS[h]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Projekt</label>
              <ProjectSelector projects={projects} value={form.project_id}
                onChange={(val) => setForm({ ...form, project_id: val })} />
            </div>
          </div>

          {/* Zeitaufwand */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Zeitaufwand</label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map(({ value, label }) => (
                <button key={value} type="button"
                  onClick={() => setForm({ ...form, duration_tag: form.duration_tag === value ? "" : value })}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    form.duration_tag === value ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>{label}</button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {(availableTags.length > 0 || selectedTagIds.length > 0) && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Tags <span className="text-xs text-gray-400 font-normal">oder #tag im Titel</span></label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                      className="rounded-full px-3 py-1 text-xs font-medium border transition-all"
                      style={isSelected
                        ? { backgroundColor: tag.color || "#6b7280", color: "#fff", borderColor: tag.color || "#6b7280" }
                        : { backgroundColor: (tag.color || "#6b7280") + "15", color: tag.color || "#6b7280", borderColor: (tag.color || "#6b7280") + "40" }
                      }>{tag.name}</button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unteraufgaben — nur bei Haupt-Tasks (nicht bei Subtask-Erstellung) */}
          {!parentTask && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Unteraufgaben
                {subtaskTitles.length > 0 && (
                  <span className="ml-1 text-xs text-gray-400 font-normal">({subtaskTitles.length})</span>
                )}
              </label>

              {/* Liste der bereits hinzugefügten Subtasks */}
              {subtaskTitles.length > 0 && (
                <div className="mb-2 flex flex-col gap-1">
                  {subtaskTitles.map((st, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                      <span className="text-gray-400 text-xs">↳</span>
                      <span className="flex-1 text-gray-700">{st}</span>
                      <button type="button"
                        onClick={() => setSubtaskTitles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-gray-300 hover:text-red-500 transition-colors">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input für neue Unteraufgabe */}
              <div className="flex gap-2">
                <input
                  ref={subtaskInputRef}
                  type="text"
                  value={newSubtaskInput}
                  onChange={(e) => setNewSubtaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSubtaskInput.trim()) {
                      e.preventDefault();
                      setSubtaskTitles((prev) => [...prev, newSubtaskInput.trim()]);
                      setNewSubtaskInput("");
                    }
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text/plain");
                    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
                    if (lines.length > 1) {
                      e.preventDefault();
                      setSubtaskTitles((prev) => [...prev, ...lines]);
                      setNewSubtaskInput("");
                    }
                  }}
                  placeholder="Unteraufgabe hinzufügen (Enter)"
                  className="flex-1 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm focus:border-primary-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Aktionen */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Abbrechen
            </button>
            <button type="submit" data-submit-btn disabled={loading}
              className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {loading ? "Erstellen..." : "Task erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
