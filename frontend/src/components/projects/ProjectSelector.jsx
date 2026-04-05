// Projekt-Auswahl-Dropdown mit Farbpunkten
export default function ProjectSelector({ projects = [], value, onChange, includeNone = true }) {
  const selectedProject = projects.find((p) => p.id === parseInt(value)) || null;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
        {/* Farbpunkt des ausgewaehlten Projekts */}
        {selectedProject ? (
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: selectedProject.color }}
          />
        ) : (
          <span className="h-3 w-3 rounded-full bg-gray-300" />
        )}
      </div>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
        className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-8 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200"
      >
        {includeNone && <option value="">Kein Projekt</option>}
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      {/* Dropdown-Pfeil */}
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
