# Allris ICS Feed Enhancer

A middleware service that enhances ICS calendar feeds from Allris meeting management software by fetching additional details from meeting pages and formatting them for better readability.

## Purpose

Allris ICS feeds often contain minimal information. This service:
- Fetches detailed meeting information from Allris detail pages
- Extracts agenda items with proper formatting
- Converts HTML content to plain text with proper line breaks
- Adds location information and document links
- Supports multiple Allris versions (3.9, 4.0, 4.1.5)

## Features

- **Enhanced Descriptions**: Extracts agenda items from detail pages with proper topic numbering (Ö 1, Ö 2, etc.)
- **Smart Formatting**: Converts HTML tables to readable plain text with line breaks
- **Location Handling**: Prefers detailed location information from meeting pages
- **Semantic HTML**: Adds microformats2 classes for structured data
- **Version Support**: Compatible with Allris 3.9, 4.0, and 4.1.5

## Usage

### API Endpoint

```
GET /api/ics?feedurl={urlEncodedFeedUrl}
GET /api/ics?htmloverviewurl={urlEncodedHtmlUrl}
```

**Parameters:**
- `feedurl` (optional): URL-encoded Allris ICS feed URL
- `htmloverviewurl` (optional): URL-encoded Allris HTML overview page URL (e.g., `https://eggesin.sitzung-mv.de/public/si018`)

Note: Provide either `feedurl` or `htmloverviewurl`, not both.

**Examples:**
```bash
# Using ICS feed
curl "http://localhost:3050/api/ics?feedurl=https%3A%2F%2Fzuessow.sitzung-mv.de%2Fpublic%2Fics%2FSiKalAbo.ics"

# Using HTML overview page (requires headless browser)
curl "http://localhost:3050/api/ics?htmloverviewurl=https%3A%2F%2Feggesin.sitzung-mv.de%2Fpublic%2Fsi018"
```

### HTML Overview Pages

The `htmloverviewurl` parameter uses a headless browser (Playwright) to handle JavaScript-rendered content. This is compatible with serverless environments like Vercel and AWS Lambda.

### Development

```bash
# Install dependencies
yarn install

# Run development server
yarn dev

# Build for production
yarn build

# Run tests
yarn test
```

## Configuration

Set environment variables for caching:
- `CACHE_MAX_AGE`: Cache duration in seconds (default: 86400 = 1 day)
- `CACHE_STALE_WHILE_REVALIDATE`: Stale cache duration (default: 120 = 2 minutes)

## Technical Details

- Built with Next.js and TypeScript
- Uses Cheerio for HTML parsing
- Supports semantic HTML with microformats2
- Formats plain text output using [@schafevormfenster/data-text-mapper](https://www.npmjs.com/package/@schafevormfenster/data-text-mapper)

## License

MIT
