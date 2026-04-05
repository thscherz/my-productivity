// Lade-Spinner fuer asynchrone Operationen
export default function LoadingSpinner({ size = "md", className = "" }) {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-4",
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${sizes[size]} animate-spin rounded-full border-gray-300 border-t-primary-600`}
        role="status"
        aria-label="Laden..."
      />
    </div>
  );
}
