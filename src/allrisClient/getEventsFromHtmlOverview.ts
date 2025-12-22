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
 * Handles pagination sequentially using a single page (required for serverless)
 */
export const getEventsFromHtmlOverview = async (
  url: string
): Promise<OverviewEvent[]> => {
  const browserClient = getBrowserClient();
  const browser = await browserClient.launch();
  
  try {
    const page = await browser.newPage();
    // Navigate to the first page
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for the table to load
    await page.waitForSelector("table.dataTable", { timeout: 30000 });

    // Dismiss cookie dialog if present
    try {
      const cookieButton = await page.$("#cookieDialog button, .cookie-message button");
      if (cookieButton) {
        await cookieButton.click();
        await page.waitForTimeout(500);
      }
    } catch (e) {
      // Cookie dialog not found or already dismissed, continue
    }

    // Get first page HTML
    let data = await page.content();
    let $ = cheerio.load(data);
    
    // Parse pagination info to determine total pages
    // Format: "Zeige 1 bis 25 von 119"
    const pagingInfo = $("table tfoot .paging.info").first().text().trim();
    const match = pagingInfo.match(/von\s+(\d+)/);
    const totalItems = match ? parseInt(match[1]) : 0;
    
    // Count items per page from the first page
    const itemsOnPage = $("table.dataTable tbody tr").length;
    const totalPages = itemsOnPage > 0 ? Math.ceil(totalItems / itemsOnPage) : 1;
    
    console.log(`Found ${totalItems} items across ${totalPages} pages (${itemsOnPage} per page)`);

    // Collect all pages HTML using the same page instance
    const allPagesData: string[] = [data];
    
    for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
      // Click the pagination button for the next page
      const clickSelector = `.goto button span:text("${pageNum}")`;
      
      // Wait for the click target to appear
      await page.waitForSelector(clickSelector, { timeout: 30000 });

      // Click the element with force option to bypass overlays
      await page.click(clickSelector, { force: true });

      // Wait for the table to update
      await page.waitForSelector("table.dataTable", { timeout: 30000 });

      // Wait a bit for any dynamic content to load
      await page.waitForTimeout(1000);

      // Get the HTML content
      const pageData = await page.content();
      allPagesData.push(pageData);
    }

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
    console.error("Error in getEventsFromHtmlOverview:", error);
    throw error;
  } finally {
    // Always close the browser in serverless environments
    await browser.close();
  }
};
