import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

interface SystemEntry {
  county?: string;
  state?: string;
  country?: string;
  publicUrl?: string;
}

interface AllrisSystemsYaml {
  domains?: Record<string, unknown>;
  systems?: Record<string, SystemEntry>;
}

const yamlContent = fs.readFileSync(
  path.join(__dirname, "..", "data", "allris-systems.yaml"),
  "utf8"
);
const { systems = {} } = yaml.load(yamlContent) as AllrisSystemsYaml;

const systemEntries = Object.entries(systems).filter(([, s]) => !!s.publicUrl);

test.describe("Allris Systems E2E", () => {
  for (const [hostname, system] of systemEntries) {
    test(`${hostname}: returns valid ICS from HTML overview`, async ({
      request,
    }) => {
      const response = await request.get(
        `/api/ics?htmloverviewurl=${encodeURIComponent(system.publicUrl || "")}`
      );
      const body = await response.text();

      expect(response.status(), `Response for ${hostname}: ${body.slice(0, 500)}`).toBe(200);

      const contentType = response.headers()["content-type"];
      expect(contentType).toContain("text/calendar");

      expect(body).toContain("BEGIN:VCALENDAR");
      expect(body).toContain("END:VCALENDAR");

      // Some systems can legitimately have no meetings in the current window.
      // In that case a valid calendar may contain zero VEVENT blocks.
      if (body.includes("BEGIN:VEVENT")) {
        expect(body).toContain("END:VEVENT");
      }
    });
  }
});
