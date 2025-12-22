import { getEventsFromHtmlOverview, OverviewEvent } from "./getEventsFromHtmlOverview";
import { closeBrowserClient } from "../clients/browserClient";

describe("getEventsFromHtmlOverview", () => {
  afterAll(async () => {
    // Clean up browser instance after all tests
    await closeBrowserClient();
  });

  it("should extract events from Eggesin HTML overview page", async () => {
    const url = "https://eggesin.sitzung-mv.de/public/si018";
    
    const events: OverviewEvent[] = await getEventsFromHtmlOverview(url);
    
    // Log results for debugging
    console.log(`Found ${events.length} events`);
    console.log("First 3 events:", events.slice(0, 3).map(e => ({
      summary: e.summary,
      start: e.start,
      location: e.location,
      hasDetailUrl: e.url.includes("SILFDNR")
    })));
    
    // Assertions
    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThanOrEqual(100); // Expecting ~119 events
    expect(events.length).toBeLessThanOrEqual(150); // Reasonable upper bound
    
    // Check structure of first event
    const firstEvent = events[0];
    expect(firstEvent).toHaveProperty("uid");
    expect(firstEvent).toHaveProperty("summary");
    expect(firstEvent).toHaveProperty("start");
    expect(firstEvent).toHaveProperty("url");
    expect(firstEvent).toHaveProperty("location");
    expect(firstEvent).toHaveProperty("description");
    
    // Verify UID format
    expect(firstEvent.uid).toMatch(/^ALLRIS-Overview-/);
    
    // Verify date is valid
    expect(firstEvent.start).toBeInstanceOf(Date);
    expect(firstEvent.start?.getTime()).toBeGreaterThan(0);
    
    // Verify some events have detail links and some don't
    const eventsWithDetails = events.filter(e => e.url.includes("SILFDNR"));
    const eventsWithoutDetails = events.filter(e => !e.url.includes("SILFDNR"));
    
    console.log(`Events with detail links: ${eventsWithDetails.length}`);
    console.log(`Events without detail links: ${eventsWithoutDetails.length}`);
    
    // Check that events without detail links have the fallback description
    if (eventsWithoutDetails.length > 0) {
      expect(eventsWithoutDetails[0].description).toBe("Mehr Informationen folgen.");
    }
  }, 30000); // 30 second timeout for network request
});
