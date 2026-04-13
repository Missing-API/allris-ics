import { getLocationForOverviewEvent } from "./getLocationForOverviewEvent";

describe("getLocationForOverviewEvent", () => {
  test("augments generic municipality location with county and state", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung der Gemeindevertretung Buchholz",
        detailUrl: "",
        location: "Gemeinde Buchholz",
        koerperschaft: "",
        overviewUrl: "https://amtneverin.sitzung-mv.de/public/si018",
      })
    ).toBe("Gemeinde Buchholz, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern");
  });

  test("augments plain place name location with county and state", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung der Gemeindevertretung Buchholz",
        detailUrl: "",
        location: "Buchholz",
        koerperschaft: "",
        overviewUrl: "https://amtneverin.sitzung-mv.de/public/si018",
      })
    ).toBe("Buchholz, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern");
  });

  test("augments plain two-word venue-like names without comma", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung der Gemeindevertretung Buchholz",
        detailUrl: "",
        location: "Sportlerheim Zarnekow",
        koerperschaft: "",
        overviewUrl: "https://dargun.sitzung-mv.de/public/si018",
      })
    ).toBe("Sportlerheim Zarnekow, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern");
  });

  test("keeps locations with comma unchanged", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung der Gemeindevertretung Buchholz",
        detailUrl: "",
        location: "Sportlerheim Zarnekow, Zarnekow",
        koerperschaft: "",
        overviewUrl: "https://dargun.sitzung-mv.de/public/si018",
      })
    ).toBe("Sportlerheim Zarnekow, Zarnekow");
  });

  test("augments parsed location when one already exists", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung des Ortsrates Zarnekow",
        detailUrl: "",
        location: "Sportlerheim Zarnekow",
        koerperschaft: "",
        overviewUrl: "https://dargun.sitzung-mv.de/public/si018",
      })
    ).toBe("Sportlerheim Zarnekow, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern");
  });

  test("uses koerperschaft for events without detail url", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung des Ortsrates Zarnekow",
        detailUrl: "",
        location: "",
        koerperschaft: "Gemeinde Dargun",
        overviewUrl: "https://dargun.sitzung-mv.de/public/si018",
      })
    ).toBe("Gemeinde Dargun, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern, Germany");
  });

  test("extracts ortsrat location from summary", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung des Ortsrates Zarnekow",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://dargun.sitzung-mv.de/public/si018",
      })
    ).toBe("Zarnekow, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern, Germany");
  });

  test("extracts city from committee summary", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung des Rechnungsprüfungsauschuss der Stadt Dargun",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://dargun.sitzung-mv.de/public/si018",
      })
    ).toBe("Dargun, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern, Germany");
  });

  test("extracts place from gemeinde summary with repeated article", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung der Gemeindevertretung der Gemeinde Ritzerow",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://stavenhagen.sitzung-mv.de/public/si018",
      })
    ).toBe("Ritzerow, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern, Germany");
  });

  test("extracts place from gemeinde summary without trailing article", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung der Gemeindevertretung Eldetal",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://roebelmueritz.sitzung-mv.de/public/si018",
      })
    ).toBe("Eldetal, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern, Germany");
  });

  test("extracts two-word place from gemeinde summary without trailing article", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung der Gemeindevertretung Groß Kelle",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://roebelmueritz.sitzung-mv.de/public/si018",
      })
    ).toBe("Groß Kelle, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern, Germany");
  });

  test("extracts office name from amtsausschuss summary", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung des Amtsausschusses des Amtes Röbel-Müritz",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://roebelmueritz.sitzung-mv.de/public/si018",
      })
    ).toBe("Amt Röbel-Müritz, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern, Germany");
  });

  test("extracts office name from committee summary with office article", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung des Finanzausschusses des Amtes Röbel-Müritz",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://roebelmueritz.sitzung-mv.de/public/si018",
      })
    ).toBe("Amt Röbel-Müritz, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern, Germany");
  });

  test("extracts location from Finanzausschuss summary", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung des Finanzausschusses Leizen",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://roebelmueritz.sitzung-mv.de/public/si018",
      })
    ).toBe("Leizen, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern, Germany");
  });

  test("extracts location from Hauptausschuss summary", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung des Hauptausschusses Rechlin",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://roebelmueritz.sitzung-mv.de/public/si018",
      })
    ).toBe("Rechlin, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern, Germany");
  });

  test("extracts location with slash from Hauptausschuss summary", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung des Hauptausschusses Röbel/Müritz",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://roebelmueritz.sitzung-mv.de/public/si018",
      })
    ).toBe("Röbel/Müritz, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern, Germany");
  });

  test("extracts location from Ortsrat-style wording", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung des Ortsrates Vipperow",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://roebelmueritz.sitzung-mv.de/public/si018",
      })
    ).toBe("Vipperow, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern, Germany");
  });

  test("extracts location from Stadtvertretung wording", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung der Stadtvertretung Rechlin",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://roebelmueritz.sitzung-mv.de/public/si018",
      })
    ).toBe("Rechlin, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern, Germany");
  });

  test("extracts two-word location with city prefix", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung der Stadtvertretung der Reuterstadt Stavenhagen",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://stavenhagen.sitzung-mv.de/public/si018",
      })
    ).toBe("Reuterstadt Stavenhagen, Mecklenburgische Seenplatte, Mecklenburg-Vorpommern, Germany");
  });

  test("uses site-specific county mapping when available", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung des Ortsrates Beispielort",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://zuessow.sitzung-mv.de/public/si018",
      })
    ).toBe("Beispielort, Vorpommern-Greifswald, Mecklenburg-Vorpommern, Germany");
  });

  test("returns empty string when no location hint exists", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung des Unbekannten Gremiums",
        detailUrl: "",
        location: "",
        koerperschaft: "",
        overviewUrl: "https://dargun.sitzung-mv.de/public/si018",
      })
    ).toBe("");
  });
});