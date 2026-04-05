import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import TaskCard from "./TaskCard";
import EmptyState from "../common/EmptyState";
import { HORIZON_LABELS, HORIZON_CONFIG } from "../../utils/constants";

// Einzelne Kanban-Spalte fuer einen Zeithorizont
export default function KanbanColumn({ horizon, tasks = [], allTasksInColumn = [], onToggleDone, onNavigate, isActive = false }) {
  // Droppable-Zone fuer dnd-kit
  const { setNodeRef, isOver } = useDroppable({ id: horizon });

  // IDs fuer SortableContext
  const taskIds = tasks.map((t) => t.id);

  // Konfiguration fuer diesen Horizont (Icon + Farben)
  const config = HORIZON_CONFIG[horizon] || HORIZON_CONFIG.someday_maybe;

  // Inbox-Spalte bekommt zusaetzlich gestrichelten Border
  const isInbox = horizon === "inbox";

  return (
    <div
      className={`flex h-full w-72 shrink-0 flex-col rounded-xl border transition-all md:w-72
        ${isActive ? "md:ring-2 md:ring-primary-300" : ""}
        ${isInbox ? "border-dashed border-gray-300" : "border-gray-200"}
      `}
    >
      {/* Spalten-Header mit horizon-spezifischer Farbe */}
      <div
        className={`flex items-center justify-between rounded-t-xl px-3 py-2.5 border-b-0
          ${config.headerBg}
          ${isInbox ? "border border-dashed border-gray-300" : "border border-gray-200"}
        `}
      >
        <h3 className={`text-sm font-semibold flex items-center gap-1.5 ${config.headerText}`}>
          <span className="text-base">{config.icon}</span>
          {HORIZON_LABELS[horizon] || horizon}
        </h3>
        {/* Task-Anzahl mit passender Farbe */}
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.countBg} ${config.countText}`}>
          {tasks.length}
        </span>
      </div>

      {/* Drop-Bereich — leicht getönt passend zur Spaltenfarbe */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto rounded-b-xl border border-t-0 p-2 transition-colors
          ${isOver
            ? "bg-primary-50 border-primary-200"
            : isInbox
              ? "bg-slate-50/40 border-dashed border-gray-300"
              : `${config.headerBg}/30 border-gray-200`
          }
        `}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {tasks.length === 0 ? (
              <EmptyState compact message={isInbox ? "Inbox ist leer" : "Keine Tasks"} />
            ) : (
              tasks.map((task) => {
                // Subtasks im gleichen Horizont finden (für Inline-Darstellung unter dem Parent)
                const inlineSubs = task.is_work_package
                  ? allTasksInColumn.filter((t) => String(t.parent_id) === String(task.id))
                  : [];
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggleDone={onToggleDone}
                    onNavigate={onNavigate}
                    inlineSubtasks={inlineSubs}
                  />
                );
              })
            )}
          </div>
        </SortableContext>

        {/* Visuelles Highlight wenn Drag darueber */}
        {isOver && (
          <div className="mt-2 h-1 rounded-full bg-primary-300 opacity-50" />
        )}
      </div>
    </div>
  );
}
