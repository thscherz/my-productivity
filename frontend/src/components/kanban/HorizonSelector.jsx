import { useRef, useEffect } from "react";
import { HORIZON_LABELS } from "../../utils/constants";

// Horizontaler Tab-Selector fuer Mobile — zeigt eine Spalte auf einmal
// Verwendet die horizons-Prop statt alle Horizonte zu zeigen
export default function HorizonSelector({ horizons = [], activeHorizon, onSelect, columnCounts = {} }) {
  const activeRef = useRef(null);
  const containerRef = useRef(null);

  // Aktiven Tab beim Wechsel in den sichtbaren Bereich scrollen
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ inline: "center", behavior: "smooth" });
    }
  }, [activeHorizon]);

  return (
    <div
      ref={containerRef}
      className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none"
      style={{ scrollbarWidth: "none" }}
    >
      {horizons.map((horizon) => {
        const isActive = horizon === activeHorizon;
        const count = columnCounts[horizon] ?? 0;

        return (
          <button
            key={horizon}
            ref={isActive ? activeRef : null}
            onClick={() => onSelect(horizon)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary-600 text-white shadow"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {HORIZON_LABELS[horizon] || horizon}
            {/* Anzahl-Badge */}
            {count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-bold leading-none ${
                  isActive ? "bg-white/30 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
