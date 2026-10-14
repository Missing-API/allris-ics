export interface OverviewLocationInput {
  summary: string;
  detailUrl: string;
  location: string;
  koerperschaft: string;
  overviewUrl: string;
}

import {
  getLocalityFromUrl,
  getLocationContextFromUrl,
} from "./getLocationContextFromUrl";

const CONNECTOR_WORDS = new Set([
  "am", "an", "auf", "bei", "beim", "das", "dem", "den", "der", "des", "die",
  "für", "im", "in", "und", "vom", "von", "zu", "zum", "zur",
]);

const CAPITALIZED_WORD = /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]*$/;

const QUOTES = /["„“”‚‘’]/g;

// Removes separators left at the edges, e.g. "Dorfgemeinschaftshaus Flechtorf - Gruppenraum -".
const trimDanglingSeparators = (location: string): string =>
  location.replace(/^[\s\-–—]+|[\s\-–—]+$/g, "");

// Keeps the venue and drops a room note after a dash separator, which misleads
// geocoding: "Dorfgemeinschaftshaus Flechtorf - Gruppenraum -" -> "Dorfgemeinschaftshaus Flechtorf".
const venueName = (location: string): string =>
  trimDanglingSeparators(location).split(/\s[-–—]\s/)[0].trim();

// A venue or place label such as "Foyer der Börnekenhalle" or
// 'Gaststätte "Zur Schönen Aussicht"': up to four capitalised words, optionally
// joined by articles or prepositions, dash separators and quotes ignored.
const looksLikePlainPlaceName = (location: string): boolean => {
  const words = trimDanglingSeparators(location.replace(QUOTES, ""))
    .replace(/\s[-–—]\s/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0 || !CAPITALIZED_WORD.test(words[0])) return false;

  const nameWords = words.filter((word) => !CONNECTOR_WORDS.has(word.toLowerCase()));
  if (nameWords.length === 0 || nameWords.length > 4) return false;
  return nameWords.every((word) => CAPITALIZED_WORD.test(word));
};

const augmentGenericLocationWithContext = (
  rawLocation: string,
  overviewUrl: string
): string => {
  const location = rawLocation.trim();
  if (!location) return "";

  // Keep explicit, already contextualized addresses untouched.
  if (location.includes(",")) return location;

  // Generic municipality names are often ambiguous for geocoding.
  const isGenericMunicipality = /^(Gemeinde|Stadt|Amt)\b/i.test(location);

  if (!isGenericMunicipality && !looksLikePlainPlaceName(location)) return location;

  const locality = getLocalityFromUrl(overviewUrl);
  const [county = "", state = ""] = getLocationContextFromUrl(overviewUrl);
  if (!locality && !county && !state) return location;

  return [venueName(location), locality, county, state].filter(Boolean).join(", ");
};

const isBodyToken = (token: string): boolean => {
  const t = token.toLowerCase();
  return (
    t.includes("ausschuss") ||
    t.includes("auschuss") ||
    t.includes("vertretung") ||
    t.includes("beirat") ||
    t.includes("vorstand") ||
    t.includes("gremium") ||
    t === "rat" ||
    t === "rates" ||
    t === "ortsrat" ||
    t === "ortsrates" ||
    t === "amtsausschuss" ||
    t === "amtsausschusses"
  );
};

const normalizeTailAfterArticle = (tail: string): string => {
  const tailTokens = tail.split(" ").filter(Boolean);

  while (tailTokens.length > 1 && isBodyToken(tailTokens[0])) {
    tailTokens.shift();
  }

  if (tailTokens.length === 2 && isBodyToken(tailTokens[1])) {
    return "";
  }

  if (tailTokens.length === 2 && /^(stadt|gemeinde)$/i.test(tailTokens[0])) {
    tailTokens.shift();
  }

  return tailTokens.join(" ").replace(/^Amtes\b/i, "Amt").trim();
};

const extractLocationFromName = (summary: string): string => {
  const normalized = summary.replaceAll(/\s+/g, " ").trim();
  if (!/\bSitzung\b/i.test(normalized)) return "";

  const sitzungIndex = normalized.toLowerCase().indexOf("sitzung");
  const summaryFromSitzung = sitzungIndex >= 0 ? normalized.slice(sitzungIndex) : normalized;

  const cleaned = summaryFromSitzung.replace(/[.,;:]$/, "");
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length < 2) return "";

  const last = words.at(-1) || "";

  // e.g. "... Röbel/Müritz"
  if (last.includes("/")) return last;

  // Generic: take the tail after the last "der/des", e.g.
  // "... der Reuterstadt Stavenhagen" -> "Reuterstadt Stavenhagen".
  let tailAfterArticle = /.*\b(?:der|des)\s+(.+?)\s*$/i.exec(cleaned)?.[1]?.trim() || "";
  if (tailAfterArticle) {
    tailAfterArticle = normalizeTailAfterArticle(tailAfterArticle);
    if (tailAfterArticle) return tailAfterArticle;
  }

  // Avoid returning body terms as locations.
  if (/^(gremium|gremiums|ausschuss|ausschusses|beirat|beirates|vorstand|vorstandes|rat|rates|ortsrat|ortsrates|vertretung|stadtvertretung|gemeindevertretung)$/i.test(last)) {
    return "";
  }

  // Fall back to one-word suffix location.
  return last;
};

export const getLocationForOverviewEvent = ({
  summary,
  detailUrl,
  location,
  koerperschaft,
  overviewUrl,
}: OverviewLocationInput): string => {
  if (location) {
    return augmentGenericLocationWithContext(location, overviewUrl);
  }

  const locality = getLocalityFromUrl(overviewUrl);

  if (!detailUrl && koerperschaft) {
    const contextParts = getLocationContextFromUrl(overviewUrl);
    return [koerperschaft, locality, ...contextParts].filter(Boolean).join(", ");
  }

  const extractedLocation = extractLocationFromName(summary);
  if (!extractedLocation) {
    return "";
  }

  const contextParts = getLocationContextFromUrl(overviewUrl);
  return [extractedLocation, locality, ...contextParts].filter(Boolean).join(", ");
};