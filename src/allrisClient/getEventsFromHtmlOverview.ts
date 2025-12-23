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
    // Create page with resource-saving options for serverless
    const page = await browser.newPage();
    
    // Block unnecessary resources to save memory in serverless
    // Only block images and media, keep fonts for proper rendering
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'media'].includes(resourceType)) {
        route.abort().catch(() => route.continue());
      } else {
        route.continue();
      }
    });
    
    // Navigate to the first page
    // Use 'domcontentloaded' instead of 'networkidle' to reduce resource usage
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    // Wait for the table to load (JavaScript rendered)
    // Give it a bit more time since we're using domcontentloaded
    await page.waitForSelector("table.dataTable", { timeout: 25000 });

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

    // Optional: Try to set date filters if available (yesterday to 90 days in future)
    // Note: Not all Allris instances have date filters or they may be hidden/disabled
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 90);
      
      const formatDateISO = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`; // ISO format for type="date" inputs
      };
      
      const formatDateGerman = (date: Date): string => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`; // German format for type="text" inputs
      };
      
      // Wait a bit for any dynamic content to load
      await page.waitForTimeout(1000);
      
      // Check if date filter panel is collapsed and needs to be expanded
      // Look for the expand link specifically for "Zeitraum" (time period) panel
      const expandLink = await page.$('a[data-simpletooltip-text="Zeitraum einblenden"]');
      if (expandLink) {
        console.log('Date filter panel (Zeitraum) is collapsed, expanding...');
        await expandLink.click();
        
        // Wait for the date inputs to become visible after expansion
        try {
          await page.waitForSelector('input[type="date"], input#beginDateField', { timeout: 3000, state: 'visible' });
          await page.waitForTimeout(500);
          console.log('Date filter panel expanded successfully');
        } catch (e) {
          console.log('Date inputs did not become visible after expanding panel:', e);
        }
      }
      
      // Try to find date input fields with multiple selector strategies
      let beginDateInput = await page.$('input#beginDateField:visible, input[name*="beginDateField"]:visible');
      let endDateInput = await page.$('input[name*="endDateField"]:visible');
      
      // If not found by ID/name, try to find all visible date inputs
      if (!beginDateInput || !endDateInput) {
        const dateInputs = await page.$$('input[type="date"]:visible');
        console.log(`Found ${dateInputs.length} visible date inputs on page`);
        if (dateInputs.length >= 2) {
          beginDateInput = dateInputs[0];
          endDateInput = dateInputs[1];
        }
      }
      
      if (beginDateInput && endDateInput) {
        // Check input type to use correct format
        const beginType = await beginDateInput.getAttribute('type');
        const isDateType = beginType === 'date';
        
        const startDateStr = isDateType ? formatDateISO(yesterday) : formatDateGerman(yesterday);
        const endDateStr = isDateType ? formatDateISO(futureDate) : formatDateGerman(futureDate);
        
        console.log(`Attempting to apply date filter: ${startDateStr} to ${endDateStr} (type=${beginType})`);
        
        // Fill dates
        await beginDateInput.click();
        await beginDateInput.fill(startDateStr);
        await endDateInput.click();
        await endDateInput.fill(endDateStr);
        
        // Trigger form submission - try pressing Enter on the end date field
        await endDateInput.press('Enter');
        
        // Wait for table to update
        await page.waitForTimeout(3000);
        console.log('Date filter applied successfully');
      } else {
        console.log('Date filter inputs not available on this page');
      }
    } catch (e) {
      console.log('Date filter not available or could not be applied:', e);
      // Continue without filter - not all instances support it
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
        const dateText = $row.find("td").eq(0).text().trim().replace(/^[A-Za-z.,\s]+/, ""); // Remove day name and any malformed prefixes
        const timeText = $row.find("td").eq(1).text().trim();
        
        let startDate: Date | null = null;
        const dateMatch = dateText.match(/(\d{2}\.\d{2}\.\d{4})/);
        const timeMatch = timeText.match(/(\d{1,2}:\d{2})/);
        
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
        let koerperschaft = ""; // Organization/body name as fallback
        const cells = $row.find("td");
        if (cells.length >= 5) {
          // Try to find location and Körperschaft columns by checking data-title attribute
          for (let cellIndex = 3; cellIndex < cells.length; cellIndex++) {
            const cellText = cells.eq(cellIndex).text().trim();
            const dataTitle = cells.eq(cellIndex).attr("data-title");
            
            // Skip empty cells, Rang column, and AN (Anwesenheit) column
            if (!cellText || cellText.match(/^\d+%/)) {
              continue;
            }
            
            // Check for Körperschaft column
            if (dataTitle === "Körperschaft" || dataTitle === "Gremium") {
              koerperschaft = cellText;
            } 
            // Location column (but not Rang or AN)
            else if (dataTitle !== "Rang" && dataTitle !== "AN" && !location) {
              location = cellText;
            }
          }
        }
        
        // Use Körperschaft as fallback location if no detail link and no location found
        if (!detailUrl && !location && koerperschaft) {
          location = koerperschaft;
        }

        // Generate stable UID using SILFDNR if available
        let uid: string;
        if (detailUrl) {
          // Extract SILFDNR from detail URL (e.g., SILFDNR=1001429)
          const silfdnrMatch = detailUrl.match(/SILFDNR=(\d+)/);
          if (silfdnrMatch) {
            // Extract hostname and sanitize it for use in UID
            const hostname = new URL(detailUrl).hostname.replace(/\./g, '-');
            uid = `ALLRIS-${hostname}-${silfdnrMatch[1]}`;
          } else {
            // Fallback: use timestamp-based UID
            uid = `ALLRIS-Overview-${startDate?.getTime() || i}-${summary.substring(0, 20).replace(/[^a-zA-Z0-9]/g, "")}`;
          }
        } else {
          // No detail URL, use timestamp-based UID
          uid = `ALLRIS-Overview-${startDate?.getTime() || i}-${summary.substring(0, 20).replace(/[^a-zA-Z0-9]/g, "")}`;
        }

        // Determine URL and description
        const eventUrl = detailUrl || url;
        const description = detailUrl 
          ? "" 
          : url; // For events without details, just provide the overview page URL

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
