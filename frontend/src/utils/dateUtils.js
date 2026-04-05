// Prueft ob ein Task basierend auf seinem Zeithorizont und Setzdatum ueberfaellig ist
export function isOverdue(timeHorizon, horizonSetAt) {
  if (!horizonSetAt || timeHorizon === "someday_maybe") return false;

  const now = new Date();
  const setDate = new Date(horizonSetAt);

  switch (timeHorizon) {
    case "today":
      // Ueberfaellig wenn nicht heute gesetzt
      return setDate.toDateString() !== now.toDateString();

    case "this_week":
      // Ueberfaellig wenn andere Woche oder anderes Jahr
      return (
        getISOWeek(setDate) !== getISOWeek(now) ||
        setDate.getFullYear() !== now.getFullYear()
      );

    case "this_month":
      // Ueberfaellig wenn anderer Monat oder anderes Jahr
      return (
        setDate.getMonth() !== now.getMonth() ||
        setDate.getFullYear() !== now.getFullYear()
      );

    case "this_quarter":
      // Ueberfaellig wenn anderes Quartal oder anderes Jahr
      return (
        getQuarter(setDate) !== getQuarter(now) ||
        setDate.getFullYear() !== now.getFullYear()
      );

    case "this_year":
      return setDate.getFullYear() !== now.getFullYear();

    case "next_week":
    case "next_month":
    case "next_quarter":
    case "next_year":
      // "Nächste" Horizonte: kein Overdue
      return false;

    default:
      return false;
  }
}

// ISO-Wochennummer berechnen (ISO 8601)
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}

// Quartal (0-3) aus Datum ermitteln
function getQuarter(date) {
  return Math.floor(date.getMonth() / 3);
}

// Jahreshaelfte (0 oder 1) aus Datum ermitteln
function getHalf(date) {
  return date.getMonth() < 6 ? 0 : 1;
}

// Datum als lesbaren deutschen String formatieren
export function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
