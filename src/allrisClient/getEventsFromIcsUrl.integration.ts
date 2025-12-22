import { getEventsFromIcsUrl, ICal } from "./getEventsFromIcsUrl";

describe("getEventsFromIcsUrl", () => {
  it("should fetch and parse ICS feed from Eggesin", async () => {
    const icsUrl = "https://eggesin.sitzung-mv.de/public/ics/SiKalAbo.ics";
    
    const result: ICal = await getEventsFromIcsUrl(icsUrl);
    
    // Log results for debugging
    console.log(`Found ${result.events.length} events in ICS feed`);
    console.log("First 3 events:", result.events.slice(0, 3).map((e: any) => ({
      summary: e.summary,
      start: e.start,
      location: e.location,
      hasUrl: !!e.url
    })));
    
    // Assertions
    expect(result).toHaveProperty("calendar");
    expect(result).toHaveProperty("events");
    expect(result.events.length).toBeGreaterThan(0);
    
    // Check structure of first event
    const firstEvent: any = result.events[0];
    expect(firstEvent).toHaveProperty("summary");
    expect(firstEvent).toHaveProperty("start");
    expect(firstEvent).toHaveProperty("location");
    expect(firstEvent).toHaveProperty("url");
    
    // Verify summary is cleaned (no HTML)
    expect(firstEvent.summary).not.toMatch(/<[^>]*>/);
    
    // Verify date is valid
    expect(firstEvent.start).toBeInstanceOf(Date);
    expect(firstEvent.start?.getTime()).toBeGreaterThan(0);
    
    // Verify some events have URLs extracted
    const eventsWithUrls = result.events.filter((e: any) => e.url);
    console.log(`Events with extracted URLs: ${eventsWithUrls.length}`);
    expect(eventsWithUrls.length).toBeGreaterThan(0);
    
    // Verify calendar info exists
    expect(result.calendar).toHaveProperty("type");
    expect((result.calendar as any).type).toBe("VCALENDAR");
  }, 30000); // 30 second timeout for network request
});
