export interface OverviewLocationInput {
  summary: string;
  detailUrl: string;
  location: string;
  koerperschaft: string;
  overviewUrl: string;
}

import { getLocationContextFromUrl } from "./getLocationContextFromUrl";

const extractLocationFromName = (summary: string): string => {
  let regexMatch = /Sitzung des Ortsrates\s+([^\s]+(?:\s+[^\s]+)*?)(?:\s*$|(?=\s+der))/i.exec(summary);
  if (regexMatch?.[1]) return regexMatch[1].trim();

  regexMatch = /der Stadt\s+([^\s]+(?:\s+[^\s]+)*?)(?:\s*$)/i.exec(summary);
  if (regexMatch?.[1]) return regexMatch[1].trim();

  regexMatch = /Sitzung der\s+([^\s]+(?:\s+[^\s]+)*?)(?:\s*$)/i.exec(summary);
  if (regexMatch?.[1] && !regexMatch[1].toLowerCase().includes("ausschuss")) {
    return regexMatch[1].trim();
  }

  regexMatch = /([^\s]+(?:\s+[^\s]+)*?)\s+(?:Ausschuss|ausschuss|Gremium)/i.exec(summary);
  if (regexMatch?.[1]) {
    const extracted = regexMatch[1].trim();
    if (extracted.toLowerCase().includes("stadt")) {
      const cityMatch = /Stadt\s+([A-Z][^\s]+)/.exec(extracted);
      if (cityMatch?.[1]) return cityMatch[1];
    }

    const cityMatch = /(?:Dargun|dargun|[A-Z][a-z]+)\b/.exec(summary);
    if (cityMatch?.[0]) return cityMatch[0];
  }

  return "";
};

export const getLocationForOverviewEvent = ({
  summary,
  detailUrl,
  location,
  koerperschaft,
  overviewUrl,
}: OverviewLocationInput): string => {
  if (location) {
    return location;
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