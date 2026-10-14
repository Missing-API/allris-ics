import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

interface DomainEntry {
  state?: string;
  country?: string;
}

interface SystemEntry {
  name?: string;
  locality?: string;
  county?: string;
  state?: string;
  country?: string;
  publicUrl?: string;
}

interface AllrisSystemsYaml {
  domains?: Record<string, DomainEntry>;
  systems?: Record<string, SystemEntry>;
}

const loadYaml = (): AllrisSystemsYaml => {
  const filePath = path.join(process.cwd(), "data", "allris-systems.yaml");
  const content = fs.readFileSync(filePath, "utf8");
  return (yaml.load(content) as AllrisSystemsYaml) ?? {};
};

// Load once at module initialisation (server startup)
const { domains = {}, systems = {} } = loadYaml();

// Allris hosts are reached both with and without "www.", so try both spellings.
const findSystem = (hostname: string): SystemEntry | undefined =>
  systems[hostname] ?? systems[hostname.replace(/^www\./, "")];

const resolveState = (hostname: string): string => {
  const system = findSystem(hostname);
  // System-level override takes precedence
  if (system?.state) return system.state;
  // Fall back to domain-level state
  for (const [domain, entry] of Object.entries(domains)) {
    if (hostname.endsWith(`.${domain}`) || hostname === domain) {
      return entry.state ?? "";
    }
  }
  return "";
};

const resolveCountry = (hostname: string): string => {
  const system = findSystem(hostname);
  if (system?.country) return system.country;
  for (const [domain, entry] of Object.entries(domains)) {
    if (hostname.endsWith(`.${domain}`) || hostname === domain) {
      return entry.country ?? "";
    }
  }
  return "";
};

export const getLocationContextFromUrl = (url: string): string[] => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const county = findSystem(hostname)?.county ?? "";
    const state = resolveState(hostname);
    const country = resolveCountry(hostname);

    return [county, state, country].filter(Boolean);
  } catch {
    return [];
  }
};

export const getNameFromUrl = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return findSystem(hostname)?.name ?? "";
  } catch {
    return "";
  }
};

export const getLocalityFromUrl = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return findSystem(hostname)?.locality ?? "";
  } catch {
    return "";
  }
};