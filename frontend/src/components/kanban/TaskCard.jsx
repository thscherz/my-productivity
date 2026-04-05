import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { isOverdue } from "../../utils/dateUtils";
import { DURATION_LABELS } from "../../utils/constants";

// Draggable Task-Karte im Kanban-Board
// onNavigate ist optional — fehlt im DragOverlay (kein Router-Kontext)
export default function TaskCard({ task, onToggleDone, onNavigate, inlineSubtasks = [] }) {
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Linke Border-Farbe = Projektfarbe oder grau
    borderLeftColor: task.project?.color || "#e5e7eb",
  };

  const overdue = isOverdue(task.time_horizon, task.horizon_set_at);
  const isDone = task.status === "done";
  const isCancelled = task.status === "cancelled";
  const isWaiting = task.status === "waiting";

  // Karte anklicken → Detail-Seite (ausser bei Drag oder Checkbox)
  const handleCardClick = (e) => {
    if (e.target.closest("[data-checkbox]")) return;
    onNavigate?.(`/task/${task.id}`);
  };

  // Task als erledigt/offen markieren ohne Navigation
  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onToggleDone?.(task);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={`group relative rounded-lg border-l-4 p-3 shadow-sm transition-all cursor-grab active:cursor-grabbing
        ${isDragging ? "opacity-50 shadow-lg scale-105 z-50" : "hover:shadow-md"}
        ${overdue && !isDone ? "ring-1 ring-orange-300" : ""}
        ${isDone ? "opacity-60" : ""}
        ${isWaiting ? "bg-amber-50" : "bg-white"}
      `}
    >

      {/* Inhalt */}
      <div className="flex items-start gap-2">
        {/* Checkbox fuer schnelles Erledigen */}
        <div data-checkbox="true" className="mt-0.5 shrink-0" onClick={handleCheckboxClick}>
          <div
            className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors
              ${isDone
                ? "border-primary-500 bg-primary-500"
                : "border-gray-300 hover:border-primary-400"
              }`}
          >
            {isDone && (
              <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>

        {/* Text-Inhalt */}
        <div className="flex-1 min-w-0">
          {/* Parent-Link für Subtasks */}
          {task.parent_id && task.parent_title && (
            <div
              className="mb-1 flex items-center gap-1 text-xs text-gray-400 cursor-pointer hover:text-primary-600 transition-colors"
              onClick={(e) => { e.stopPropagation(); onNavigate?.(`/task/${task.parent_id}`); }}
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="truncate">{task.parent_title}</span>
            </div>
          )}

          {/* Titel mit Priority-Dot */}
          <div className="flex items-start gap-1.5">
            {task.priority && (
              <span className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${
                task.priority === "high" ? "bg-red-500" :
                task.priority === "medium" ? "bg-yellow-500" : "bg-blue-400"
              }`} />
            )}
            <p
              className={`text-sm font-medium leading-snug text-gray-900 break-words whitespace-normal
                ${isDone || isCancelled ? "line-through text-gray-400" : ""}
              `}
            >
              {task.title}
            </p>
          </div>

          {/* Wartend-Anzeige: Sanduhr + waiting_for Text */}
          {isWaiting && (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-xs">⏳</span>
              {task.waiting_for && (
                <span className="text-xs text-amber-600 truncate">{task.waiting_for}</span>
              )}
            </div>
          )}

          {/* Badges: Projekt, Dauer, Tags, Überfällig */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {/* Projekt-Badge */}
            {task.project && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: task.project.color + "20",
                  color: task.project.color,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: task.project.color }}
                />
                {task.project.name}
              </span>
            )}

            {/* Due Date Badge */}
            {task.due_date && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                📅 {new Date(task.due_date + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
              </span>
            )}

            {/* Dauer-Badge */}
            {task.duration_tag && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {DURATION_LABELS[task.duration_tag] || task.duration_tag}
              </span>
            )}

            {/* Tags als farbige Pills */}
            {task.tags?.map((tag) => (
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

            {/* Überfällig-Indikator */}
            {overdue && !isDone && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">
                Überfällig
              </span>
            )}

            {/* Abgebrochen-Badge */}
            {isCancelled && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
                Abgebrochen
              </span>
            )}
          </div>

          {/* Unteraufgaben — klappbar (default: zu) */}
          {task.is_work_package && task.subtask_summary && task.subtask_summary.total > 0 && (
            <div className="mt-2">
              {/* Klappbare Kopfzeile: Pfeil + Fortschritt */}
              <button
                type="button"
                className="flex items-center gap-1.5 w-full text-left"
                onClick={(e) => { e.stopPropagation(); setSubtasksExpanded(!subtasksExpanded); }}
              >
                <svg
                  className={`h-3 w-3 text-gray-400 transition-transform ${subtasksExpanded ? "rotate-90" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-xs text-gray-400 flex-1">
                  {task.subtask_summary.done}/{task.subtask_summary.total} Unteraufgaben
                </span>
                <span className="text-xs text-gray-400">
                  {Math.round((task.subtask_summary.done / task.subtask_summary.total) * 100)}%
                </span>
              </button>

              {/* Fortschrittsbalken (immer sichtbar) */}
              <div className="mt-1 h-1 w-full rounded-full bg-gray-100">
                <div
                  className="h-1 rounded-full bg-primary-500 transition-all"
                  style={{
                    width: `${(task.subtask_summary.done / task.subtask_summary.total) * 100}%`,
                  }}
                />
              </div>

              {/* Aufgeklappte Subtask-Liste */}
              {subtasksExpanded && inlineSubtasks.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {inlineSubtasks.map((st) => (
                    <div key={st.id}
                      className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 -mx-1"
                      onClick={(e) => { e.stopPropagation(); onNavigate?.(`/task/${st.id}`); }}
                    >
                      <div
                        className={`h-3 w-3 rounded border flex items-center justify-center shrink-0 ${
                          st.status === "done" ? "border-primary-500 bg-primary-500" : "border-gray-300"
                        }`}
                        onClick={(e) => { e.stopPropagation(); onToggleDone?.(st); }}
                      >
                        {st.status === "done" && (
                          <svg className="h-2 w-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`flex-1 whitespace-normal break-words ${st.status === "done" ? "line-through text-gray-400" : "text-gray-600"}`}>
                        {st.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
