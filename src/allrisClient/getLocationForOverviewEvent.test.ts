import { getLocationForOverviewEvent } from "./getLocationForOverviewEvent";

describe("getLocationForOverviewEvent", () => {
  test("keeps parsed location when one already exists", () => {
    expect(
      getLocationForOverviewEvent({
        summary: "Sitzung des Ortsrates Zarnekow",
        detailUrl: "",
        location: "Sportlerheim Zarnekow",
        koerperschaft: "",
        overviewUrl: "https://dargun.sitzung-mv.de/public/si018",
      })
    ).toBe("Sportlerheim Zarnekow");
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