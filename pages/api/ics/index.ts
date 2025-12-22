import type { NextApiRequest, NextApiResponse } from "next";
import slugify from "slugify";
import {
  getEventsFromIcsUrl,
  ICal,
} from "../../../src/allrisClient/getEventsFromIcsUrl";
import { getHtmlFromUrl } from "../../../src/allrisClient/getHtmlFromUrl";
import { mapIncomingEventToIcsEvent } from "../../../src/allrisClient/mapIncomingEventToIcsEvent";
import { IcsEvent } from "../../../src/types/icsEvent";
import { htmlToData } from "@schafevormfenster/data-text-mapper/src/htmlToData";
import { dataToText } from "@schafevormfenster/data-text-mapper/src/dataToText";
const ics = require("ics");
const cheerio = require("cheerio");

/**
 * @swagger
 * /api/ics/?feedurl={feedurl}:
 *   get:
 *     summary: Returns an enhanced allris ics feed.
 *     description: Enhance an existing allris ics feed by adding content from details links.
 *     tags:
 *       - ICS
 *       - Allris
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: feedurl
 *         description: URL of the incoming ICS feed, e.g. "https://www.sitzungsdienst-zuessow.de/bi2/si010_j.asp?selfaction=ws&template=ical&rss=128&sid=aaae7f67689eb066b64ced4a6484c0e2&showSitzung=j&GRA=99999999", "https://usedomsued.sitzung-mv.de/public/ics/SiKalAbo.ics", or "https://eggesin.sitzung-mv.de/public/ics/SiKalAbo.ics"
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: ICS-Feed.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const { feedurl } = req.query;

  // TODO: check auth header by middleware

  if (!feedurl)
    return res
      .status(400)
      .end(
        "Missing feedurl parameter. Please provide an feedurl as url encoded string."
      );

  if (feedurl.length < 10)
    return res
      .status(400)
      .end(
        "Invalid feedurl parameter. Please provide an feedurl as url encoded string with some more characters."
      );

  // get events from feed
  const icsEvents: ICal = await getEventsFromIcsUrl(feedurl as string);

  // get html content for each event (in parallel to speed it up)
  let htmlContents: any[] = new Array();
  await Promise.all(
    icsEvents.events.map(async (event: any) => {
      // only fetch details html, if url contains an event id
      const htmlResult = event?.url?.includes("SILFDNR")
        ? await getHtmlFromUrl(event?.url)
        : null;
      htmlContents[event.uid] = htmlResult;
      return Promise.resolve();
    })
  );

  const organzizerName: string = icsEvents.calendar["WR-CALNAME"] || "Allris";
  const calendarProdId: string =
    icsEvents.calendar["PRODID"] ||
    icsEvents.calendar["prodid"] ||
    organzizerName;
  const calendarDescription: string =
    icsEvents.calendar["WR-CALDESC"] || "Allris";

  const productId: string = slugify(
    `${calendarProdId}-${organzizerName}-${calendarDescription}`,
    {
      lower: true,
      strict: true,
      trim: true,
    }
  );

  // add html content to events
  const enhancedEvents: IcsEvent[] = icsEvents.events.map((event: any) => {
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
        $desc("table tr").each((i, row) => {
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
      ...mapIncomingEventToIcsEvent(event),
      title: titleFromHtml || event.summary,
      location: icsLocationFromHtml || locationFromHtml || event.location,
      description: plainTextDescription,
      htmlContent: htmlResult?.html || "",
      organizer: {
        name: organzizerName,
        email: "info@cc-egov.de",
      },
      categories: [icsEvents.calendar["WR-CALNAME"] || "Sitzung"],
      productId: productId,
    };
    return enhancedEvent;
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
}
