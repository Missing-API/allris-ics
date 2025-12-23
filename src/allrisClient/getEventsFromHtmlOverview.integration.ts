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
    // Note: With date filtering (yesterday to +90 days), we get fewer events than the full list
    // The exact number depends on upcoming meetings in the timeframe
    expect(events.length).toBeGreaterThanOrEqual(3); // At least a few events
    expect(events.length).toBeLessThanOrEqual(150); // Reasonable upper bound
    
    // Check structure of first event
    const firstEvent = events[0];
    expect(firstEvent).toHaveProperty("uid");
    expect(firstEvent).toHaveProperty("summary");
    expect(firstEvent).toHaveProperty("start");
    expect(firstEvent).toHaveProperty("url");
    expect(firstEvent).toHaveProperty("location");
    expect(firstEvent).toHaveProperty("description");
    
    // Verify UID format - should use SILFDNR-based format
    expect(firstEvent.uid).toMatch(/^ALLRIS-(eggesin-sitzung-mv-de|Overview)-/);
    
    // If event has a SILFDNR, verify the UID uses it
    if (firstEvent.url.includes('SILFDNR=')) {
      const silfdnrMatch = firstEvent.url.match(/SILFDNR=(\d+)/);
      if (silfdnrMatch) {
        expect(firstEvent.uid).toContain(silfdnrMatch[1]);
      }
    }
    
    // Verify date is valid
    expect(firstEvent.start).toBeInstanceOf(Date);
    expect(firstEvent.start?.getTime()).toBeGreaterThan(0);
    
    // Verify some events have detail links and some don't
    const eventsWithDetails = events.filter(e => e.url.includes("SILFDNR"));
    const eventsWithoutDetails = events.filter(e => !e.url.includes("SILFDNR"));
    
    console.log(`Events with detail links: ${eventsWithDetails.length}`);
    console.log(`Events without detail links: ${eventsWithoutDetails.length}`);
    
    // Check that events without detail links have the overview URL as description
    if (eventsWithoutDetails.length > 0) {
      expect(eventsWithoutDetails[0].description).toBe(url);
    }
  }, 30000); // 30 second timeout for network request

  it("should extract events from Züssow HTML overview page with date filter", async () => {
    const url = "https://zuessow.sitzung-mv.de/public/si018";
    
    const events: OverviewEvent[] = await getEventsFromHtmlOverview(url);
    
    // Log results for debugging
    console.log(`Found ${events.length} events from Züssow`);
    console.log("First 3 events:", events.slice(0, 3).map(e => ({
      summary: e.summary,
      start: e.start,
      location: e.location,
      hasDetailUrl: e.url.includes("SILFDNR"),
      uid: e.uid
    })));
    
    // Assertions
    expect(events.length).toBeGreaterThan(0);
    
    // Check structure of first event
    const firstEvent = events[0];
    expect(firstEvent).toHaveProperty("uid");
    expect(firstEvent).toHaveProperty("summary");
    expect(firstEvent).toHaveProperty("start");
    expect(firstEvent).toHaveProperty("url");
    expect(firstEvent).toHaveProperty("location");
    expect(firstEvent).toHaveProperty("description");
    
    // Verify UID format - should use SILFDNR-based format
    expect(firstEvent.uid).toMatch(/^ALLRIS-(zuessow-sitzung-mv-de|Overview)-/);
    
    // If event has a SILFDNR, verify the UID uses it
    if (firstEvent.url.includes('SILFDNR=')) {
      const silfdnrMatch = firstEvent.url.match(/SILFDNR=(\d+)/);
      if (silfdnrMatch) {
        expect(firstEvent.uid).toContain(silfdnrMatch[1]);
        console.log(`UID correctly uses SILFDNR: ${firstEvent.uid}`);
      }
    }
    
    // Verify date is valid
    expect(firstEvent.start).toBeInstanceOf(Date);
    expect(firstEvent.start?.getTime()).toBeGreaterThan(0);
    
    // Verify dates are within the filtered range (yesterday to +90 days)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const futureLimit = new Date();
    futureLimit.setDate(futureLimit.getDate() + 90);
    futureLimit.setHours(23, 59, 59, 999);
    
    const datesOutOfRange = events.filter(e => 
      e.start && (e.start < yesterday || e.start > futureLimit)
    );
    
    console.log(`Events within date range: ${events.length - datesOutOfRange.length}/${events.length}`);
    console.log(`Date range: ${yesterday.toISOString().split('T')[0]} to ${futureLimit.toISOString().split('T')[0]}`);
    
    // Most events should be within the filtered range
    // Allow a small margin for edge cases (e.g., events already in progress)
    expect(datesOutOfRange.length).toBeLessThanOrEqual(events.length * 0.1);
    
    // Verify events have detail links
    const eventsWithDetails = events.filter(e => e.url.includes("SILFDNR"));
    console.log(`Events with detail links: ${eventsWithDetails.length}/${events.length}`);
    expect(eventsWithDetails.length).toBeGreaterThan(0);
  }, 45000); // 45 second timeout for network request
});
