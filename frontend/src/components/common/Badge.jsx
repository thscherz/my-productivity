// Generisches Badge-Element fuer Dauer, Status und Projekt-Tags
export default function Badge({ children, className = "", color = null, style = {} }) {
  // Wenn eine Farbe als Hex-Wert uebergeben wird, wird sie als Hintergrund verwendet
  const customStyle = color
    ? { backgroundColor: color + "20", color: color, ...style }
    : style;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      style={customStyle}
    >
      {children}
    </span>
  );
}

// Spezialisiertes Dauer-Badge
export function DurationBadge({ duration }) {
  if (!duration) return null;
  return (
    <Badge className="bg-gray-100 text-gray-600">
      {duration}
    </Badge>
  );
}

// Spezialisiertes Projekt-Badge mit Farbpunkt
export function ProjectBadge({ project }) {
  if (!project) return null;
  return (
    <Badge color={project.color}>
      <span
        className="mr-1 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: project.color }}
      />
      {project.name}
    </Badge>
  );
}
