import axios, { AxiosRequestConfig } from "axios";
import { getBrowserClient } from "../clients/browserClient";
const cheerio = require("cheerio");

export interface OverviewEvent {
  uid: string;
  summary: string;
  start: Date | null;
  end: Date | null;
  url: string;
  location: string;
  description: string;
}

/**
 * Extract events from Allris HTML overview page
 * Example: https://eggesin.sitzung-mv.de/public/si018
 * 
 * Uses headless browser (Playwright) to handle JavaScript-rendered content
 * Handles pagination by fetching all pages in parallel
 */
export const getEventsFromHtmlOverview = async (
  url: string
): Promise<OverviewEvent[]> => {
  try {
    const browserClient = getBrowserClient();
    
    // Fetch the first page
    const data = await browserClient.fetchHtmlWithSelector(url, "table.dataTable", 30000);
    const $ = cheerio.load(data);
    
    // Parse pagination info to determine total pages
    // Format: "Zeige 1 bis 25 von 119"
    const pagingInfo = $("table tfoot .paging.info").first().text().trim();
    const match = pagingInfo.match(/von\s+(\d+)/);
    const totalItems = match ? parseInt(match[1]) : 0;
    
    // Count items per page from the first page
    const itemsOnPage = $("table.dataTable tbody tr").length;
    const totalPages = itemsOnPage > 0 ? Math.ceil(totalItems / itemsOnPage) : 1;
    
    console.log(`Found ${totalItems} items across ${totalPages} pages (${itemsOnPage} per page)`);

    // Fetch all pages in parallel by opening multiple browser tabs
    // Each tab will click its respective pagination button
    const allPagesPromises: Promise<string>[] = [Promise.resolve(data)];
    
    for (let page = 2; page <= totalPages; page++) {
      // For each additional page, click the pagination button
      // Use a more specific selector: button in .goto span that contains the page number
      allPagesPromises.push(
        browserClient.clickAndWaitForSelector(
          url,
          `.goto button span:text("${page}")`,
          "table.dataTable",
          30000
        )
      );
    }

    const allPagesData = await Promise.all(allPagesPromises);

    const allEvents: OverviewEvent[] = [];

    // Extract events from all pages
    for (const pageData of allPagesData) {
      const $page = cheerio.load(pageData);
      
      // Extract events from table.dataTable
      $page("table.dataTable tbody tr").each((i: number, row: any) => {
        const $row = $page(row);
        
        // Extract date and time from separate cells
        // Cell 0: Date (e.g., "Do., 26.02.2026")
        // Cell 1: Time (e.g., "19:00")
        const dateText = $row.find("td").eq(0).text().trim().replace(/^[A-Za-z]+,?\s*/, ""); // Remove day name
        const timeText = $row.find("td").eq(1).text().trim();
        
        let startDate: Date | null = null;
        const dateMatch = dateText.match(/(\d{2}\.\d{2}\.\d{4})/);
        const timeMatch = timeText.match(/(\d{2}:\d{2})/);
        
        if (dateMatch && timeMatch) {
          const [, dateStr] = dateMatch;
          const [, timeStr] = timeMatch;
          const [day, month, year] = dateStr.split(".");
          const [hours, minutes] = timeStr.split(":");
          startDate = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hours),
            parseInt(minutes)
          );
        }

        // Extract title and detail link from cell 2
        const titleCell = $row.find("td").eq(2);
        const titleLink = titleCell.find("a").first();
        const summary = titleLink.length > 0 
          ? titleLink.text().trim() 
          : titleCell.text().trim();
        
        const detailLink = titleLink.attr("href");
        const detailUrl = detailLink 
          ? (detailLink.startsWith("http") ? detailLink : new URL(detailLink, url).href)
          : "";

        // Extract location if present (some instances don't have a location column)
        // Look for a cell that's not the Rang (ranking) column which contains percentages
        let location = "";
        const cells = $row.find("td");
        if (cells.length >= 5) {
          // Try to find location column by checking for non-percentage text in cells after title
          for (let cellIndex = 3; cellIndex < cells.length; cellIndex++) {
            const cellText = cells.eq(cellIndex).text().trim();
            const dataTitle = cells.eq(cellIndex).attr("data-title");
            // Skip empty cells, Rang column, and AN (Anwesenheit) column
            if (cellText && 
                !cellText.match(/^\d+%/) && 
                dataTitle !== "Rang" && 
                dataTitle !== "AN") {
              location = cellText;
              break;
            }
          }
        }

        // Generate UID
        const uid = `ALLRIS-Overview-${startDate?.getTime() || i}-${summary.substring(0, 20).replace(/[^a-zA-Z0-9]/g, "")}`;

        // Determine URL and description
        const eventUrl = detailUrl || url;
        const description = detailUrl 
          ? "" 
          : "Mehr Informationen folgen.";

        if (summary && startDate) {
          allEvents.push({
            uid,
            summary,
            start: startDate,
            end: null, // We don't have end time from overview
            url: eventUrl,
            location,
            description,
          });
        }
      });
    }

    console.log(`Extracted ${allEvents.length} total events from ${allPagesData.length} pages`);

    return allEvents;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("error message: ", error.message);
      throw error;
    } else {
      console.error("unexpected error: ", error);
      throw error;
    }
  }
};
