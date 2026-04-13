import axios, { AxiosRequestConfig } from "axios";
import http from "node:http";
import https from "node:https";
import { getBrowserClient } from "../clients/browserClient";
import { getLocationForOverviewEvent } from "./getLocationForOverviewEvent";
const cheerio = require("cheerio");

// Shared axios instance with keep-alive for connection reuse
const axiosClient = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});

export interface OverviewEvent {
  uid: string;
  summary: string;
  start: Date | null;
  end: Date | null;
  url: string;
  location: string;
  description: string;
}

const parseBerlinLocalDateTime = (
  year: number,
  month: number,
  day: number,
  time: string
): Date => {
  const [hours, minutes] = time.split(":").map((value) => parseInt(value, 10));
  const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(guess);

  const getPart = (type: string) =>
    parseInt(parts.find((part) => part.type === type)?.value || "0", 10);

  const berlinAsUtc = Date.UTC(
    getPart("year"),
    getPart("month") - 1,
    getPart("day"),
    getPart("hour"),
    getPart("minute"),
    getPart("second")
  );

  return new Date(guess.getTime() - (berlinAsUtc - guess.getTime()));
};

const getOverviewUid = (
  detailUrl: string,
  startDate: Date | null,
  index: number,
  summary: string
): string => {
  const silfdnrMatch = /SILFDNR=(\d+)/.exec(detailUrl);
  if (silfdnrMatch) {
    const hostname = new URL(detailUrl).hostname.replace(/\./g, "-");
    return `ALLRIS-${hostname}-${silfdnrMatch[1]}`;
  }

  return `ALLRIS-Overview-${startDate?.getTime() || index}-${summary
    .substring(0, 20)
    .replace(/[^a-zA-Z0-9]/g, "")}`;
};

const getEventsFromClassicHtmlOverview = async (
  url: string
): Promise<OverviewEvent[] | null> => {
  const { hostname, pathname, protocol } = new URL(url);
  if (!hostname.endsWith("sitzung-online.de") || !pathname.endsWith("si010_e.asp")) {
    return null;
  }

  const options: AxiosRequestConfig = {
    method: "GET",
    url,
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Referer: `${protocol}//${hostname}`,
    },
    responseType: "text",
    responseEncoding: "latin1",
    decompress: true,
  };

  const { data } = await axiosClient.get<string>(url, options);
  const $ = cheerio.load(data);
  const metaDescription = $("meta[name=description]").attr("content") || "";
  const fromValue =
    $("input#kaldatvon").attr("value") || $("input[name='kaldatvon']").attr("value") || "";
  const fromMatch = fromValue.match(/(\d{2})\.(\d{2})\.(\d{4})/);

  if (!metaDescription.includes("ALLRIS net Version 3.9") || !fromMatch) {
    return null;
  }

  const [, , monthText, yearText] = fromMatch;
  const month = parseInt(monthText, 10);
  const year = parseInt(yearText, 10);
  const events: OverviewEvent[] = [];
  let currentDay: number | null = null;

  $("table.tl1 tr").each((index: number, row: any) => {
    const $row = $(row);
    const cells = $row.find("td");
    if (cells.length < 9) {
      return;
    }

    const dayText = cells.eq(1).text().replace(/\D/g, "").trim();
    if (dayText) {
      currentDay = parseInt(dayText, 10);
    }

    if (!currentDay) {
      return;
    }

    const timeText = cells.eq(2).text().replaceAll("\u00a0", " ").trim();
    const titleLink = cells.eq(5).find("a[href*='to010.asp']").first();
    const summary = titleLink.text().replaceAll(/\s+/g, " ").trim();
    if (!summary) {
      return;
    }

    const href = titleLink.attr("href");
    if (!href) {
      return;
    }

    const detailUrl = new URL(href, url).href;
    const timeMatch = timeText.match(/(\d{1,2}:\d{2})(?:\s*-\s*(\d{1,2}:\d{2}))?/);
    const start = timeMatch
      ? parseBerlinLocalDateTime(year, month, currentDay, timeMatch[1])
      : null;
    let end: Date | null = null;
    if (timeMatch?.[2]) {
      end = parseBerlinLocalDateTime(year, month, currentDay, timeMatch[2]);
    } else if (start) {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }

    const rawLocation = cells
      .last()
      .text()
      .replaceAll("\u00a0", " ")
      .replaceAll(/\s+/g, " ")
      .trim();
    const location = getLocationForOverviewEvent({
      summary,
      detailUrl,
      location: rawLocation,
      koerperschaft: "",
      overviewUrl: url,
    });

    events.push({
      uid: getOverviewUid(detailUrl, start, index, summary),
      summary,
      start,
      end,
      url: detailUrl,
      location,
      description: "",
    });
  });

  return events.length > 0 ? events : null;
};

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
  const classicEvents = await getEventsFromClassicHtmlOverview(url);
  if (classicEvents) {
    return classicEvents;
  }

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

    // Dismiss cookie dialog if present - MUST be done before other interactions
    // The Allris cookie dialog uses ID #cookieMessageBtn with display: none toggle
    try {
      console.log("Attempting to dismiss cookie modal...");
      
      // Wait a moment for cookie modal to render
      await page.waitForTimeout(500);
      
      // Try the most specific selectors first (matching Allris structure)
      const cookieSelectors = [
        // Allris standard: button with id cookieMessageBtn
        '#cookieMessageBtn',
        // Fallback selectors for other Allris instances
        '#cookieDialog button',
        'button#cookieMessageBtn',
        '[role="dialog"] button',
        '.cookie-message button',
      ];
      
      let cookieDismissed = false;
      for (const selector of cookieSelectors) {
        try {
          const buttons = page.locator(selector);
          const count = await buttons.count();
          if (count > 0) {
            console.log(`Found cookie dismiss button with selector: ${selector}`);
            // Use the first matching button
            await buttons.first().click({ force: true, timeout: 5000 });
            console.log("Cookie modal dismissed successfully");
            
            // Wait for any navigation or modal to close
            await page.waitForTimeout(500);
            cookieDismissed = true;
            break;
          }
        } catch (e) {
          // Selector didn't work, try next one
          continue;
        }
      }
      
      if (!cookieDismissed) {
        console.log("No cookie dismiss button found - proceeding anyway");
      }
    } catch (error) {
      console.log("Cookie modal handling encountered non-blocking error:", error);
      // Continue even if cookie handling fails - it's not critical
    }

    // Wait for the table to load (JavaScript rendered)
    // Give it a bit more time since we're using domcontentloaded
    try {
      await page.waitForSelector("table.dataTable", { timeout: 25000 });
      console.log("Table loaded successfully");
    } catch (error) {
      console.error("Failed to load table - page might have closed or navigation occurred:", error);
      throw new Error(`Failed to load Allris table from ${url}. The page may have navigated or closed unexpectedly, possibly due to cookie modal interaction.`);
    }

    // Optional: Try to set date filters if available (yesterday to 90 days in future)
    // Note: Not all Allris instances have date filters or they may be hidden/disabled
    // DISABLED: Date filtering removed to fetch all available events
    const APPLY_DATE_FILTER = false;
    
    if (APPLY_DATE_FILTER) {
      try {
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
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 90);
      
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
    }

    // Get first page HTML
    let data = await page.content();
    let $ = cheerio.load(data);
    
    // Parse pagination info to determine total pages
    // Format: "Zeige 1 bis 25 von 119"
    const pagingInfo = $("table tfoot .paging.info").first().text().trim();
    console.log("Paging info text:", pagingInfo);
    
    // Try alternative selectors if first one doesn't work
    let totalItems = 0;
    let match = pagingInfo.match(/von\s+(\d+)/);
    if (!match) {
      // Try alternative format or selector
      const allPagingElements = $(".paging.info, .dataTables_info, [class*='paging']");
      console.log("Found paging elements:", allPagingElements.length);
      allPagingElements.each((i: number, el: any) => {
        const text = $(el).text().trim();
        if (text) {
          console.log(`Paging element ${i}: "${text}"`);
          const m = text.match(/von\s+(\d+)/);
          if (m && !match) {
            match = m;
          }
        }
      });
    }
    
    totalItems = match ? parseInt(match[1]) : 0;
    
    // Count items per page from the first page
    const itemsOnPage = $("table.dataTable tbody tr").length;
    const totalPages = itemsOnPage > 0 ? Math.ceil(totalItems / itemsOnPage) : 1;
    
    console.log(`Found ${totalItems} items across ${totalPages} pages (${itemsOnPage} per page)`);

    // Collect all pages HTML using the same page instance
    const allPagesData: string[] = [data];
    
    for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
      try {
        // Click the pagination button for the next page
        // Try multiple selector strategies as different Allris instances have different pagination markup
        
        let clicked = false;
        
        // Strategy 1: Use Playwright locator with :has-text for robust text matching
        const pageButton = page.locator(`.goto button, .goto a`).filter({ hasText: pageNum.toString() });
        if (await pageButton.count() > 0) {
          console.log(`Clicking page ${pageNum} using .goto button selector`);
          await pageButton.first().click({ force: true });
          clicked = true;
        }
        
        // Strategy 2: If that doesn't work, try looking for span with page number inside button
        if (!clicked) {
          const spanInButton = page.locator(`.goto button:has(span:text("${pageNum}")) , .goto button:has(span:has-text("${pageNum}"))`);
          if (await spanInButton.count() > 0) {
            console.log(`Clicking page ${pageNum} using button>span selector`);
            await spanInButton.first().click({ force: true });
            clicked = true;
          }
        }
        
        // Strategy 3: Try link elements
        if (!clicked) {
          const pageLink = page.locator(`a:has-text("${pageNum}")`);
          if (await pageLink.count() > 0) {
            console.log(`Clicking page ${pageNum} using link selector`);
            await pageLink.first().click({ force: true });
            clicked = true;
          }
        }
        
        if (!clicked) {
          console.warn(`Could not find pagination button for page ${pageNum}`);
          break; // Stop pagination if we can't find the button
        }

        // Wait for actual content change — check that the first row's text differs from before
        const prevFirstRowText = (() => {
          const $prev = cheerio.load(allPagesData.at(-1));
          return $prev("table.dataTable tbody tr").first().text().trim();
        })();

        try {
          await page.waitForFunction(
            (prev: string) => {
              const firstRow = document.querySelector('table.dataTable tbody tr');
              return firstRow && firstRow.textContent?.trim() !== prev;
            },
            prevFirstRowText,
            { timeout: 30000 }
          );
        } catch (e) {
          console.warn(`Timeout waiting for content change on page ${pageNum}`);
        }

        // Get the HTML content
        const pageData = await page.content();
        allPagesData.push(pageData);
        
        console.log(`Successfully loaded page ${pageNum}`);
      } catch (error) {
        console.error(`Error loading page ${pageNum}:`, error);
        break; // Stop pagination on error
      }
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
          
          const y = parseInt(year);
          const m = parseInt(month) - 1;
          const d = parseInt(day);
          const h = parseInt(hours);
          const min = parseInt(minutes);

          // Parse as Europe/Berlin time to handle timezone correctly
          // 1. Create a date assuming the input time is UTC
          const guess = new Date(Date.UTC(y, m, d, h, min));
          
          // 2. Get the time components of this moment in Europe/Berlin
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Berlin',
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric',
            hour12: false
          }).formatToParts(guess);
          
          const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
          
          // 3. Reconstruct the "face value" time in Berlin as a UTC timestamp
          const berlinAsUtc = Date.UTC(
            getPart('year'),
            getPart('month') - 1,
            getPart('day'),
            getPart('hour'),
            getPart('minute'),
            getPart('second')
          );
          
          // 4. Calculate the offset (Berlin Time - UTC Time)
          const offset = berlinAsUtc - guess.getTime();
          
          // 5. Subtract the offset to get the correct UTC time
          startDate = new Date(guess.getTime() - offset);
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
        
        const enhancedLocation = getLocationForOverviewEvent({
          summary,
          detailUrl,
          location,
          koerperschaft,
          overviewUrl: url,
        });

        if (!location && enhancedLocation) {
          location = enhancedLocation;
          if (!detailUrl) {
            console.log(`Extracted location from name: "${summary}" → "${location}"`);
          }
        }

        // Generate stable UID using SILFDNR if available
        let uid: string;
        if (detailUrl) {
          // Extract SILFDNR from detail URL (e.g., SILFDNR=1001429)
          const silfdnrMatch = detailUrl.match(/SILFDNR=(\d+)/);
          if (silfdnrMatch) {
            // Extract hostname and sanitize it for use in UID
            const hostname = new URL(detailUrl).hostname.replaceAll('.', '-');
            uid = `ALLRIS-${hostname}-${silfdnrMatch[1]}`;
          } else {
            // Fallback: use timestamp-based UID
            uid = `ALLRIS-Overview-${startDate?.getTime() || i}-${summary.substring(0, 20).replaceAll(/[^a-zA-Z0-9]/g, "")}`;
          }
        } else {
          // No detail URL, use timestamp-based UID
          uid = `ALLRIS-Overview-${startDate?.getTime() || i}-${summary.substring(0, 20).replaceAll(/[^a-zA-Z0-9]/g, "")}`;
        }

        // Use the overview URL as fallback "detail" URL when no dedicated detail page exists.
        const eventUrl = detailUrl || url;
        let description = "";
        if (!detailUrl) {
          description = "Diese Sitzung ist als Termin geplant, es liegen aber noch keine Details und keine Agenda vor.";
        }

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

    if (allEvents.length === 0) {
      console.warn(`No events extracted from HTML overview page: ${url}`);
    }

    return allEvents;
  } catch (error) {
    console.error("Error in getEventsFromHtmlOverview:", error);
    throw error;
  } finally {
    // Always close the browser in serverless environments
    await browser.close();
  }
};
