import chromium from "@sparticuz/chromium";
import { chromium as playwright } from "playwright-core";
import { Browser, Page } from "playwright-core";

/**
 * Browser client for serverless environments
 * Uses @sparticuz/chromium for compatibility with Vercel and AWS Lambda
 */
export class BrowserClient {
  private browser: Browser | null = null;

  /**
   * Launch browser instance
   * Uses @sparticuz/chromium which works in both local and serverless environments
   */
  async launch(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    // Get the executable path from @sparticuz/chromium
    const executablePath = await chromium.executablePath();

    // Launch Chromium with the executable path
    this.browser = await playwright.launch({
      args: chromium.args,
      executablePath: executablePath,
      headless: true,
    });

    return this.browser;
  }

  /**
   * Create a new page
   */
  async newPage(): Promise<Page> {
    const browser = await this.launch();
    return await browser.newPage();
  }

  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Fetch HTML content from a URL using headless browser
   */
  async fetchHtml(url: string): Promise<string> {
    const page = await this.newPage();
    
    try {
      // Navigate to the page and wait for network to be idle
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Get the HTML content
      const html = await page.content();
      return html;
    } finally {
      await page.close();
    }
  }

  /**
   * Fetch HTML and wait for a specific selector
   */
  async fetchHtmlWithSelector(
    url: string,
    selector: string,
    timeout: number = 30000
  ): Promise<string> {
    const page = await this.newPage();
    
    try {
      // Navigate to the page
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout,
      });

      // Wait for the specific selector to appear
      await page.waitForSelector(selector, { timeout });

      // Get the HTML content
      const html = await page.content();
      return html;
    } finally {
      await page.close();
    }
  }

  /**
   * Fetch page, click an element, wait for selector, and return HTML
   * Useful for clicking dropdown options or pagination controls
   */
  async clickAndWaitForSelector(
    url: string,
    clickSelector: string,
    waitSelector: string,
    timeout: number = 30000
  ): Promise<string> {
    const page = await this.newPage();
    
    try {
      // Navigate to the page
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout,
      });

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

      // Wait for the click target to appear
      await page.waitForSelector(clickSelector, { timeout });

      // Click the element with force option to bypass overlays
      await page.click(clickSelector, { force: true });

      // Wait for the result selector to appear
      await page.waitForSelector(waitSelector, { timeout });

      // Wait a bit for any dynamic content to load
      await page.waitForTimeout(1000);

      // Get the HTML content
      const html = await page.content();
      return html;
    } finally {
      await page.close();
    }
  }
}

// Singleton instance for reuse across requests
let browserClientInstance: BrowserClient | null = null;

/**
 * Get or create browser client instance
 */
export function getBrowserClient(): BrowserClient {
  if (!browserClientInstance) {
    browserClientInstance = new BrowserClient();
  }
  return browserClientInstance;
}

/**
 * Clean up browser client (call this when shutting down)
 */
export async function closeBrowserClient(): Promise<void> {
  if (browserClientInstance) {
    await browserClientInstance.close();
    browserClientInstance = null;
  }
}
