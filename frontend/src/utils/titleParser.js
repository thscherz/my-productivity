/**
 * Smart Title Parser — erkennt Tokens im Titel und extrahiert sie.
 *
 * Erkannte Patterns:
 *   p1, p2, p3         → Priorität (hoch, mittel, niedrig)
 *   #tagname            → Tag zuordnen (matched gegen verfügbare Tags)
 *   heute               → Due Date = heute
 *   morgen              → Due Date = morgen
 *   übermorgen          → Due Date = übermorgen
 *   montag..sonntag     → Due Date = nächster Wochentag
 *   15.04               → Due Date = 15. April (aktuelles Jahr)
 *   15.04.2026          → Due Date = 15. April 2026
 *   15.4.               → Due Date = 15. April (aktuelles Jahr)
 */

// Wochentage auf Deutsch → Offset berechnen
const WEEKDAYS = {
  montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4,
  freitag: 5, samstag: 6, sonntag: 0,
};

/**
 * Berechnet das Datum des nächsten Vorkommens eines Wochentags.
 */
function nextWeekday(targetDay) {
  const today = new Date();
  const currentDay = today.getDay();
  let diff = targetDay - currentDay;
  if (diff <= 0) diff += 7;
  const result = new Date(today);
  result.setDate(result.getDate() + diff);
  return formatDate(result);
}

/**
 * Formatiert ein Date-Objekt als YYYY-MM-DD.
 */
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parst den Titel-Text und extrahiert erkannte Tokens.
 *
 * @param {string} title - Der eingegebene Titel
 * @param {Array} availableTags - Verfügbare Tags [{id, name, color}]
 * @returns {{ cleanTitle: string, priority: string|null, dueDate: string|null, tagIds: number[], recognized: string[] }}
 */
export function parseTitle(title, availableTags = []) {
  let cleanTitle = title;
  let priority = null;
  let dueDate = null;
  const tagIds = [];
  const recognized = []; // Was erkannt wurde (für visuelles Feedback)

  // --- Priorität: p1, p2, p3 (case-insensitive, als eigenes Wort) ---
  cleanTitle = cleanTitle.replace(/\bp1\b/gi, () => {
    priority = "high";
    recognized.push("Priorität: Hoch");
    return "";
  });
  cleanTitle = cleanTitle.replace(/\bp2\b/gi, () => {
    priority = "medium";
    recognized.push("Priorität: Mittel");
    return "";
  });
  cleanTitle = cleanTitle.replace(/\bp3\b/gi, () => {
    priority = "low";
    recognized.push("Priorität: Niedrig");
    return "";
  });

  // --- Tags: #tagname (case-insensitive Match gegen verfügbare Tags) ---
  cleanTitle = cleanTitle.replace(/#(\S+)/g, (match, tagName) => {
    const tag = availableTags.find(
      (t) => t.name.toLowerCase() === tagName.toLowerCase()
    );
    if (tag) {
      tagIds.push(tag.id);
      recognized.push(`Tag: ${tag.name}`);
      return "";
    }
    return match; // Tag nicht gefunden → im Titel lassen
  });

  // --- Datum: heute, morgen, übermorgen ---
  const today = new Date();

  cleanTitle = cleanTitle.replace(/\bheute\b/gi, () => {
    dueDate = formatDate(today);
    recognized.push("Datum: Heute");
    return "";
  });

  cleanTitle = cleanTitle.replace(/\bmorgen\b/gi, () => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    dueDate = formatDate(d);
    recognized.push("Datum: Morgen");
    return "";
  });

  cleanTitle = cleanTitle.replace(/\bübermorgen\b/gi, () => {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    dueDate = formatDate(d);
    recognized.push("Datum: Übermorgen");
    return "";
  });

  // --- Wochentage: montag, dienstag, ... ---
  for (const [name, dayNum] of Object.entries(WEEKDAYS)) {
    const regex = new RegExp(`\\b${name}\\b`, "gi");
    cleanTitle = cleanTitle.replace(regex, () => {
      dueDate = nextWeekday(dayNum);
      recognized.push(`Datum: ${name.charAt(0).toUpperCase() + name.slice(1)}`);
      return "";
    });
  }

  // --- Datum: DD.MM.YYYY oder DD.MM. oder DD.MM ---
  cleanTitle = cleanTitle.replace(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g, (match, d, m, y) => {
    const day = parseInt(d, 10);
    const month = parseInt(m, 10) - 1;
    const year = parseInt(y, 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime()) && date.getDate() === day) {
      dueDate = formatDate(date);
      recognized.push(`Datum: ${d}.${m}.${y}`);
      return "";
    }
    return match;
  });

  cleanTitle = cleanTitle.replace(/\b(\d{1,2})\.(\d{1,2})\.?\s?/g, (match, d, m) => {
    if (dueDate) return match; // Bereits ein Datum gefunden
    const day = parseInt(d, 10);
    const month = parseInt(m, 10) - 1;
    let year = today.getFullYear();
    let date = new Date(year, month, day);
    if (date < today) {
      year++;
      date = new Date(year, month, day);
    }
    if (!isNaN(date.getTime()) && date.getDate() === day) {
      dueDate = formatDate(date);
      recognized.push(`Datum: ${d}.${parseInt(m, 10) + 1}.${year}`);
      return "";
    }
    return match;
  });

  // Aufräumen: Präpositionen vor entfernten Datums-Tokens löschen (am, bis, zum, vom)
  cleanTitle = cleanTitle.replace(/\b(am|bis|zum|vom|ab|per)\s*$/gi, "");
  cleanTitle = cleanTitle.replace(/\b(am|bis|zum|vom|ab|per)\s{2,}/gi, " ");

  // Doppelte Leerzeichen, alleinstehende Satzzeichen und Whitespace bereinigen
  cleanTitle = cleanTitle.replace(/\s[.,;:]\s/g, " ");
  cleanTitle = cleanTitle.replace(/[.,;:]\s*$/g, "");
  cleanTitle = cleanTitle.replace(/\s{2,}/g, " ").trim();

  return { cleanTitle, priority, dueDate, tagIds, recognized };
}
