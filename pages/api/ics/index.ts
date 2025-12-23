import type { NextApiRequest, NextApiResponse } from "next";
import slugify from "slugify";
import {
  getEventsFromIcsUrl,
  ICal,
} from "../../../src/allrisClient/getEventsFromIcsUrl";
import { getHtmlFromUrl } from "../../../src/allrisClient/getHtmlFromUrl";
import { getEventsFromHtmlOverview, OverviewEvent } from "../../../src/allrisClient/getEventsFromHtmlOverview";
import { closeBrowserClient } from "../../../src/clients/browserClient";
import { mapIncomingEventToIcsEvent } from "../../../src/allrisClient/mapIncomingEventToIcsEvent";
import { IcsEvent } from "../../../src/types/icsEvent";
import { htmlToData } from "@schafevormfenster/data-text-mapper/src/htmlToData";
import { dataToText } from "@schafevormfenster/data-text-mapper/src/dataToText";
const ics = require("ics");
const cheerio = require("cheerio");

/**
 * @swagger
 * /api/ics/?feedurl={feedurl}&htmloverviewurl={htmloverviewurl}:
 *   get:
 *     summary: Returns an enhanced allris ics feed.
 *     description: Enhance an existing allris ics feed by adding content from details links, or generate a feed from an HTML overview page.
 *     tags:
 *       - ICS
 *       - Allris
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: feedurl
 *         description: URL of the incoming ICS feed, e.g. "https://www.sitzungsdienst-zuessow.de/bi2/si010_j.asp?selfaction=ws&template=ical&rss=128&sid=aaae7f67689eb066b64ced4a6484c0e2&showSitzung=j&GRA=99999999", "https://usedomsued.sitzung-mv.de/public/ics/SiKalAbo.ics", or "https://eggesin.sitzung-mv.de/public/ics/SiKalAbo.ics"
 *         in: path
 *         required: false
 *         type: string
 *       - name: htmloverviewurl
 *         description: URL of an Allris HTML overview page, e.g. "https://eggesin.sitzung-mv.de/public/si018"
 *         in: path
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *         description: ICS-Feed.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  try {
    const { feedurl, htmloverviewurl } = req.query;

    // TODO: check auth header by middleware

    if (!feedurl && !htmloverviewurl)
      return res
        .status(400)
        .end(
          "Missing feedurl or htmloverviewurl parameter. Please provide either parameter as url encoded string."
        );

    if (feedurl && (feedurl as string).length < 10)
      return res
        .status(400)
        .end(
          "Invalid feedurl parameter. Please provide an feedurl as url encoded string with some more characters."
        );

    if (htmloverviewurl && (htmloverviewurl as string).length < 10)
      return res
        .status(400)
        .end(
          "Invalid htmloverviewurl parameter. Please provide an htmloverviewurl as url encoded string with some more characters."
        );

    let events: any[] = [];
    let organzizerName: string = "Allris";
    let calendarProdId: string = "Allris";
    let calendarDescription: string = "Allris";

    // Handle HTML overview URL
    if (htmloverviewurl) {
      const overviewEvents: OverviewEvent[] = await getEventsFromHtmlOverview(htmloverviewurl as string);
      events = overviewEvents.map((event) => ({
        uid: event.uid,
        summary: event.summary,
        start: event.start,
        end: event.end,
        url: event.url,
        location: event.location,
        description: event.description,
      }));
      
      // Extract organizer name from URL if possible
      try {
        const urlObj = new URL(htmloverviewurl as string);
        organzizerName = urlObj.hostname.split('.')[0];
      } catch (e) {
        organzizerName = "Allris";
      }
    } 
    // Handle ICS feed URL
    else if (feedurl) {
      const icsEvents: ICal = await getEventsFromIcsUrl(feedurl as string);
      events = icsEvents.events;
      organzizerName = icsEvents.calendar["WR-CALNAME"] || "Allris";
      calendarProdId = icsEvents.calendar["PRODID"] || icsEvents.calendar["prodid"] || organzizerName;
      calendarDescription = icsEvents.calendar["WR-CALDESC"] || "Allris";
    }

    // Helper function to delay execution
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Process events in batches with delays to avoid rate limiting
    const batchSize = 7;
    const delayBetweenBatches = 450; // 0.5 second
    const delayBetweenRequests = 150; // 150ms between individual requests
    
    let htmlContents: any[] = new Array();
    const eventsToFetch = events.filter((event: any) => event?.url?.includes("SILFDNR"));
    
    // Extract referer URL from either htmloverviewurl or feedurl
    let refererUrl: string | undefined;
    if (htmloverviewurl) {
      try {
        const urlObj = new URL(htmloverviewurl as string);
        refererUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
      } catch (e) {
        refererUrl = undefined;
      }
    }
    
    for (let i = 0; i < eventsToFetch.length; i += batchSize) {
      const batch = eventsToFetch.slice(i, i + batchSize);
      
      // Process batch sequentially with small delays
      for (const event of batch) {
        try {
          const htmlResult = await getHtmlFromUrl(event.url, refererUrl);
          htmlContents[event.uid] = htmlResult;
        } catch (error) {
          console.error(`Failed to fetch ${event.url}:`, error);
          htmlContents[event.uid] = null;
        }
        
        // Small delay between individual requests
        await delay(delayBetweenRequests);
      }
      
      // Longer delay between batches
      if (i + batchSize < eventsToFetch.length) {
        await delay(delayBetweenBatches);
      }
    }

    const productId: string = slugify(
      `${calendarProdId}-${organzizerName}-${calendarDescription}`,
      {
        lower: true,
        strict: true,
        trim: true,
      }
    );

    // add html content to events
    const enhancedEvents: IcsEvent[] = events.map((event: any) => {
      const htmlResult = htmlContents[event.uid];
      const $ = cheerio.load(htmlResult?.html || "");
      const locationFromHtml: string = $("#location").text();
      const titleFromHtml: string = htmlResult?.title || "";
      const icsLocationFromHtml: string = htmlResult?.location || "";

      // Convert HTML to text by extracting text content from each element
      let plainTextDescription = event.description;
      if (htmlResult?.html) {
        const $desc = cheerio.load(htmlResult.html);
        const textData = htmlToData(htmlResult.html);
        if (textData) {
          // Extract text from the description HTML with proper formatting
          let descText = "";
          
          // Process location
          const location = $desc("#location").text().trim();
          if (location) {
            descText += location + "\n\n";
          }
          
          // Process table rows with proper line breaks
          $desc("table tr").each((i: number, row: any) => {
            const cells = $desc(row).find("td");
            if (cells.length === 1 && $desc(cells[0]).attr("colspan")) {
              // Section header
              descText += "\n" + $desc(cells[0]).text().trim() + "\n";
            } else if (cells.length === 2) {
              // Topic row: "Ö 1" + "Description"
              const topicNum = $desc(cells[0]).text().trim();
              const topicDesc = $desc(cells[1]).text().trim();
              descText += topicNum + " " + topicDesc + "\n";
            }
          });
          
          textData.description = descText.trim();
          plainTextDescription = dataToText(textData);
        }
      }

      const enhancedEvent: IcsEvent = {
        ...(feedurl ? mapIncomingEventToIcsEvent(event) : {
          title: event.summary,
          start: event.start ? [
            event.start.getFullYear(),
            event.start.getMonth() + 1,
            event.start.getDate(),
            event.start.getHours(),
            event.start.getMinutes(),
          ] : [new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate(), 0, 0],
          startInputType: "local" as const,
          end: event.end ? [
            event.end.getFullYear(),
            event.end.getMonth() + 1,
            event.end.getDate(),
            event.end.getHours(),
            event.end.getMinutes(),
          ] : (event.start ? [
            event.start.getFullYear(),
            event.start.getMonth() + 1,
            event.start.getDate(),
            event.start.getHours() + 1,
            event.start.getMinutes(),
          ] : [new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate(), 1, 0]),
          endInputType: "local" as const,
          location: event.location || "",
          url: event.url,
          uid: event.uid,
          method: "PUBLISH" as const,
        }),
        title: titleFromHtml || event.summary,
        location: icsLocationFromHtml || locationFromHtml || event.location,
        description: plainTextDescription,
        htmlContent: htmlResult?.html || "",
        organizer: {
          name: organzizerName,
          email: "info@cc-egov.de",
        },
        categories: [organzizerName || "Sitzung"],
        productId: productId,
      };
      return enhancedEvent;
    });

    // Sort events by start date: earliest (closest to today) first, latest last
    enhancedEvents.sort((a, b) => {
      // Extract start dates - handle both array format and Date objects
      const getStartTime = (event: IcsEvent): number => {
        if (Array.isArray(event.start)) {
          // Convert array format [year, month, day, hour, minute] to timestamp
          const [year, month, day, hour = 0, minute = 0] = event.start;
          return new Date(year, month - 1, day, hour, minute).getTime();
        }
        return 0;
      };
      
      return getStartTime(a) - getStartTime(b);
    });

    // create ics format
    const icsBody = ics.createEvents(enhancedEvents);

    // set content type header
    res.setHeader("Content-Type", "text/calendar; charset=utf8");

    // add cache header to allow cdn caching of responses
    const cacheMaxAge: string = process.env.CACHE_MAX_AGE || "86400"; // 1 day
    const cacheStaleWhileRevalidate: string =
      process.env.CACHE_STALE_WHILE_REVALIDATE || "120"; // 2 minutes
    res.setHeader(
      "Cache-Control",
      `max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge}, stale-while-revalidate=${cacheStaleWhileRevalidate}`
    );

    res.status(200).send(icsBody.value);
  } catch (error) {
    console.error("unexpected error: ", error);
    res.status(500).end("Internal server error");
  } finally {
    // Always clean up browser resources in serverless environment
    await closeBrowserClient();
  }
}
