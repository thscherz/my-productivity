import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import KanbanColumn from "./KanbanColumn";
import HorizonSelector from "./HorizonSelector";
import TaskCard from "./TaskCard";
import { tasksApi } from "../../api/tasks";
import { PRIORITY_SORT_ORDER } from "../../utils/constants";

// Sortiert Tasks nach Priorität: high → medium → low → keine
function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    const pa = a.priority ? PRIORITY_SORT_ORDER[a.priority] : 3;
    const pb = b.priority ? PRIORITY_SORT_ORDER[b.priority] : 3;
    if (pa !== pb) return pa - pb;
    return (a.position || 0) - (b.position || 0);
  });
}

// Filtert Tasks für eine Spalte:
// Subtasks werden ausgeblendet wenn ihr Parent im gleichen Horizont ist
// (sie erscheinen dann nur als Teil des Parent-Cards)
function filterTasksForColumn(tasks, horizon, allColumns) {
  return tasks.filter((task) => {
    if (!task.parent_id) return true; // Top-Level Tasks immer zeigen
    // Prüfen ob der Parent im gleichen Horizont ist
    const parentTasks = allColumns[horizon]?.tasks || [];
    const parentInSameColumn = parentTasks.some(
      (t) => String(t.id) === String(task.parent_id)
    );
    // Subtask ausblenden wenn Parent in gleicher Spalte — wird dort als Teil des Parents gezeigt
    return !parentInSameColumn;
  });
}

// Hauptkomponente des Kanban-Boards mit Drag & Drop
export default function KanbanBoard({ columns = {}, horizons = [], onToggleDone, onRefetch, onNavigate }) {
  // Aktiver Task beim Dragging (fuer DragOverlay)
  const [activeTask, setActiveTask] = useState(null);
  // Mobile: aktuell sichtbarer Zeithorizont — erstes Element des aktiven Views
  const [mobileHorizon, setMobileHorizon] = useState(() => horizons[0] || "inbox");

  // Wenn sich die Horizonte ändern (View-Wechsel), mobilen Horizont anpassen
  const currentHorizonInView = horizons.includes(mobileHorizon);
  const effectiveMobileHorizon = currentHorizonInView ? mobileHorizon : horizons[0] || "inbox";

  // Sensoren: Pointer (Desktop) und Touch (Mobile)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Mindest-Drag-Distanz um versehentliches Ziehen zu verhindern
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // Kurze Verzögerung fuer Touch-Events
        tolerance: 8,
      },
    })
  );

  // Task finden anhand ID — sucht in ALLEN columns (nicht nur sichtbaren)
  const findTaskById = (id) => {
    for (const horizon of Object.keys(columns)) {
      const tasks = columns[horizon]?.tasks || [];
      const task = tasks.find((t) => String(t.id) === String(id));
      if (task) return task;
    }
    return null;
  };

  // Zeithorizont eines Tasks ermitteln — sucht in ALLEN columns
  const findHorizonOfTask = (taskId) => {
    for (const horizon of Object.keys(columns)) {
      const tasks = columns[horizon]?.tasks || [];
      if (tasks.find((t) => String(t.id) === String(taskId))) return horizon;
    }
    return null;
  };

  // Drag beginnt — aktiven Task setzen fuer Overlay
  const handleDragStart = ({ active }) => {
    setActiveTask(findTaskById(active.id));
  };

  // Drag beendet — Task in neue Spalte verschieben
  const handleDragEnd = async ({ active, over }) => {
    setActiveTask(null);
    if (!over) return;

    const taskId = active.id;
    const sourceHorizon = findHorizonOfTask(taskId);

    // Ziel-Horizont: entweder Spalten-ID oder Horizont des Ziel-Tasks
    let targetHorizon = over.id;
    if (!horizons.includes(String(targetHorizon))) {
      // Ziel ist ein Task — dessen Horizont bestimmen
      targetHorizon = findHorizonOfTask(over.id);
    }

    if (!sourceHorizon || !targetHorizon) return;

    // Nichts tun wenn Task an gleicher Stelle bleibt
    if (sourceHorizon === targetHorizon && String(active.id) === String(over.id)) return;

    // Position im Ziel berechnen
    const targetTasks = columns[targetHorizon]?.tasks || [];
    let position = 0;
    if (horizons.includes(String(over.id))) {
      // Auf leere Spalte gedropped → ans Ende
      position = targetTasks.length;
    } else {
      // Auf anderen Task gedropped → dessen Position
      const overIndex = targetTasks.findIndex((t) => String(t.id) === String(over.id));
      position = overIndex >= 0 ? overIndex : targetTasks.length;
    }

    // API-Call: Task verschieben (numerische ID)
    const numericTaskId = findTaskById(active.id)?.id;
    if (!numericTaskId) return;

    try {
      await tasksApi.move(numericTaskId, {
        time_horizon: targetHorizon,
        position,
      });
      onRefetch?.();
    } catch (err) {
      console.error("Fehler beim Verschieben des Tasks:", err);
    }
  };

  // Anzahl Tasks pro Horizon fuer den HorizonSelector (nur sichtbare Horizonte)
  const columnCounts = Object.fromEntries(
    horizons.map((h) => [h, columns[h]?.tasks?.length || 0])
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Mobile: Horizon-Selector + eine Spalte */}
      <div className="md:hidden flex flex-col h-full">
        <div className="bg-white border-b border-gray-200">
          <HorizonSelector
            horizons={horizons}
            activeHorizon={effectiveMobileHorizon}
            onSelect={setMobileHorizon}
            columnCounts={columnCounts}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <KanbanColumn
            horizon={effectiveMobileHorizon}
            tasks={sortByPriority(filterTasksForColumn(columns[effectiveMobileHorizon]?.tasks || [], effectiveMobileHorizon, columns))}
            allTasksInColumn={columns[effectiveMobileHorizon]?.tasks || []}
            onToggleDone={onToggleDone}
            onNavigate={onNavigate}
            isActive={true}
          />
        </div>
      </div>

      {/* Desktop: Spalten des aktiven Views nebeneinander, horizontal scrollbar */}
      <div className="hidden md:flex h-full gap-3 overflow-x-auto px-4 py-4 kanban-scroll">
        {horizons.map((horizon) => (
          <KanbanColumn
            key={horizon}
            horizon={horizon}
            tasks={sortByPriority(filterTasksForColumn(columns[horizon]?.tasks || [], horizon, columns))}
            allTasksInColumn={columns[horizon]?.tasks || []}
            onToggleDone={onToggleDone}
            onNavigate={onNavigate}
          />
        ))}
        {/* Abstand am rechten Rand */}
        <div className="w-4 shrink-0" />
      </div>

      {/* DragOverlay: Zeigt das gezogene Element semi-transparent */}
      <DragOverlay>
        {activeTask ? (
          <div className="rotate-2 opacity-90 pointer-events-none">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
