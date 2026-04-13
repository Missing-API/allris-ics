export interface OverviewLocationInput {
  summary: string;
  detailUrl: string;
  location: string;
  koerperschaft: string;
  overviewUrl: string;
}

import { getLocationContextFromUrl } from "./getLocationContextFromUrl";

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

  // Also enrich plain place names like "Buchholz" when they look like an
  // administrative place label.
  const looksLikePlainPlaceName =
    /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]*(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]*){0,3}$/.test(location);

  if (!isGenericMunicipality && !looksLikePlainPlaceName) return location;

  const [county = "", state = ""] = getLocationContextFromUrl(overviewUrl);
  return [location, county, state].filter(Boolean).join(", ");
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
  if (!/^Sitzung\b/i.test(normalized)) return "";

  const cleaned = normalized.replace(/[.,;:]$/, "");
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

  if (!detailUrl && koerperschaft) {
    const contextParts = getLocationContextFromUrl(overviewUrl);
    return [koerperschaft, ...contextParts].filter(Boolean).join(", ");
  }

  const extractedLocation = extractLocationFromName(summary);
  if (!extractedLocation) {
    return "";
  }

  const contextParts = getLocationContextFromUrl(overviewUrl);
  return [extractedLocation, ...contextParts].filter(Boolean).join(", ");
};