import chromium from "@sparticuz/chromium";
import { chromium as playwright } from "playwright-core";
import { Browser, Page } from "playwright-core";

/**
 * Browser client for serverless environments
 * Uses @sparticuz/chromium for compatibility with Vercel and AWS Lambda
 * 
 * IMPORTANT: In serverless, each request should launch a fresh browser.
 * Do NOT reuse browser instances across requests as they may be closed
 * by the serverless platform between invocations.
 */
export class BrowserClient {
  /**
   * Launch a new browser instance
   * Uses @sparticuz/chromium for serverless, local Chromium for development
   */
  async launch(): Promise<Browser> {
    try {
      // Try to get executable path from @sparticuz/chromium (serverless)
      const executablePath = await chromium.executablePath();

      // Launch Chromium with the executable path from @sparticuz/chromium
      return await playwright.launch({
        args: chromium.args,
        executablePath: executablePath,
        headless: true,
      });
    } catch (error) {
      // Fallback to local Chromium for development
      console.log("Using local Chromium for development");
      return await playwright.launch({
        headless: true,
      });
    }
  }
}

// No singleton - create new instance per request in serverless
// This is critical for Vercel/Lambda where browser may be closed between requests

/**
 * Get a new browser client instance
 * In serverless environments, this creates a fresh instance for each request
 */
export function getBrowserClient(): BrowserClient {
  return new BrowserClient();
}

/**
 * Clean up browser client (call this at the end of each request)
 */
export async function closeBrowserClient(): Promise<void> {
  // No-op since we don't keep singletons anymore
  // Individual callers should close their browser instances
}
