import axios, { AxiosRequestConfig } from "axios";
import { cleanHtml, cleanHtmlTable } from "./cleanHtml";
const cheerio = require("cheerio");

/**
 * Split up html functions based on Allris version
 * 
 * <meta name="description" content="ALLRIS net Version 3.9.4SP1 (210504m)"> (e.g. Amt Züssow, detail https://www.sitzungsdienst-zuessow.de/bi2/to010.asp?SILFDNR=2861)
 * <meta name="description" content="ALLRIS net Version 4.0.7 (4070018) - 13.10.2020"> (e.g. Amt Eggesin, detail https://eggesin.sitzung-mv.de/public/to010?SILFDNR=656)
 * <meta name="description" content="ALLRIS net Version 4.0.8 (4080038) - 27.05.2021"> (e.g. Amt Usedom, detail https://usedomsued.sitzung-mv.de/public/to010?SILFDNR=1000096&refresh=false)
 * <meta name="description" content="ALLRIS net Version 4.1.5 (4150026) - 17.01.2025"> (e.g. Amt Züssow, detail https://zuessow.sitzung-mv.de/public/to010?SILFDNR=3458)
 
 */

export interface HtmlResult {
  html: string;
  title: string;
  location: string;
}

export const getHtmlFromUrl = async (url: string, referer?: string): Promise<HtmlResult | null> => {
  try {
    // Extract base URL for Referer header
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
    
    // set options to properly decode iso-8859-1 from allris html
    const options: AxiosRequestConfig = {
      method: "GET",
      url: url,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Referer": referer || baseUrl,
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
      },
      responseType: "text",
      responseEncoding: "utf8",
      decompress: true,
    };

    // get pure data
    const { data } = await axios.get<string>(url, options);

    // parse html
    let $ = cheerio.load(data);

    // get allris version from metadata header
    const metaDescription: string = $("meta[name=description]").attr("content");
    const versionMatches: RegExpMatchArray | null =
      metaDescription.match(/(\d\.\d\.\d)/);
    const allrisVersion: string = versionMatches ? versionMatches[0] : "";
    const allrisMajorVersion: string =
      allrisVersion.split(".")[0] + "." + allrisVersion.split(".")[1];

    if (allrisMajorVersion === "3.9") {
      // load detail page again with latin1 encoding

      // set options to properly decode iso-8859-1 from allris html
      const options: AxiosRequestConfig = {
        method: "GET",
        url: url,
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Referer": referer || baseUrl,
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
        },
        responseType: "text",
        responseEncoding: "latin1",
        decompress: true,
      };

      // get pure data
      const { data } = await axios.get<string>(url, options);

      // parse html
      $ = cheerio.load(data);
    }

    // get title from html
    const titleSelector: any = {
      "3.9": "#risname h1",
      "4.0": "#sibetreff",
      "4.1": "#sibetreff",
    };
    const title: string = $(titleSelector[allrisMajorVersion]).html();

    // get agenda from html
    const agendaTableSelector: any = {
      "3.9": "table.tl1",
      "4.0": "table.dataTable",
      "4.1": "table#toTreeTable.dataTable",
    };
    const agendaTableRaw: string =
      title !== "Kalender"
        ? $(agendaTableSelector[allrisMajorVersion]).html()
        : "";

    // Simplify agenda table - keep only topic number and description columns
    let agendaTable: string = "";
    if (agendaTableRaw) {
      const $table = cheerio.load(`<table>${agendaTableRaw}</table>`);
      const simplifiedRows: string[] = [];
      
      $table("tr").each((i: number, row: any) => {
        const $row = $table(row);
        const rowClass = $row.attr("class") || "";
        const topicNumberRaw = $row.find("td.tonr").html() || "";
        const topicDescriptionRaw = $row.find("td.tobetreff").html() || "";
        
        // Clean the content
        const topicNumber = cleanHtml(topicNumberRaw);
        const topicDescription = cleanHtml(topicDescriptionRaw);
        
        // Check if this is a section header row (beratung class with text ending in "Teil")
        const isBeratungRow = rowClass.includes("beratung") && 
          topicDescription.match(/\w+\s+Teil/i);
        
        // Only add row if it has content in either column
        if (topicNumber || topicDescription) {
          if (isBeratungRow) {
            // Section header: single cell with colspan
            simplifiedRows.push(`<tr><td colspan="2">${topicDescription}</td></tr>`);
          } else {
            // Regular row: two columns
            simplifiedRows.push(`<tr><td>${topicNumber}</td><td>${topicDescription}</td></tr>`);
          }
        }
      });
      
      agendaTable = simplifiedRows.join("");
    }

    // get room and location from html
    const roomSelector: any = {
      "3.9":
        "#rismain table.risdeco tbody tr td table.tk1 tbody tr td.ko1 table.tk1 tbody tr td.text2",
      "4.0": "#siraum",
      "4.1": "#siraum",
    };
    const room: string = $(roomSelector[allrisMajorVersion]).html();

    const locationSelector: any = {
      "3.9":
        "#rismain table.risdeco tbody tr td table.tk1 tbody tr td.ko1 table.tk1 tbody tr td.text2",
      "4.0": "#siort",
      "4.1": "#siort",
    };
    const location: string = $(locationSelector[allrisMajorVersion]).html();
    
    // Determine location strings for ICS and HTML description
    // For ICS LOCATION: prefer location (#siort) over room (#siraum)
    let icsLocation: string = location || room || "";
    
    // For HTML description: if one contains the other, prefer room (#siraum)
    // Otherwise use "room, location"
    let descriptionLocation: string = "";
    if (room && location) {
      if (room.includes(location) || location.includes(room)) {
        // One contains the other, prefer room
        descriptionLocation = room;
      } else {
        // Both have nothing in common, use both
        descriptionLocation = `${room}, ${location}`;
      }
    } else {
      descriptionLocation = room || location || "";
    }

    // wow, for old allris we have to do some creapy magic
    if (allrisMajorVersion === "3.9") {
      const headerTable = $(
        "#rismain table.risdeco tbody tr td table.tk1 tbody tr td.ko1 table.tk1"
      ).html();

      // regexp for room
      const roomHtmlRegExp =
        /<tr valign="top">\s*<td class="kb1">Raum:<\/td>\s*<td colspan="3" class="text2">(.*)<\/td>\s*<\/tr>/;
      const roomFromCreapyHtml: string = headerTable.match(roomHtmlRegExp)?.[1];

      // regexp for location
      const locationHtmlRegExp =
        /<tr valign="top">\s*<td class="kb1">Ort:<\/td>\s*<td colspan="3" class="text2">(.*)<\/td>\s*<\/tr>/;
      const locationFromCreapyHtml: string =
        headerTable.match(locationHtmlRegExp)?.[1];

      // this is done specially for Amt Züssow, because they have a different html structure
      let roomStr = roomFromCreapyHtml
        .replace(locationFromCreapyHtml, "")
        .trim();
      let locationStr = locationFromCreapyHtml
        .replace(roomFromCreapyHtml, "")
        .trim();

      // For ICS LOCATION: prefer location over room
      icsLocation = locationStr || roomStr || "";
      
      // For HTML description: apply the same logic
      if (roomStr && locationStr) {
        if (roomStr.includes(locationStr) || locationStr.includes(roomStr)) {
          descriptionLocation = roomStr;
        } else {
          descriptionLocation = `${roomStr}, ${locationStr}`;
        }
      } else {
        descriptionLocation = roomStr || locationStr || "";
      }
      descriptionLocation = descriptionLocation.replace(",,", ",");
    }

    // get PDF documents
    const pdfLinks: string[] = [];
    $("#dokumenteHeaderPanel a.pdf").each((i: number, elem: any) => {
      const href = $(elem).attr("href");
      const text = $(elem).text();
      if (href && text) {
        // Convert relative URLs to absolute URLs
        const absoluteUrl = href.startsWith("http") ? href : new URL(href, url).href;
        pdfLinks.push(`<a class="u-document" href="${absoluteUrl}" target="_blank">${text}</a>`);
      }
    });
    const pdfDocumentsHtml = pdfLinks.length > 0 
      ? `<p class="attachment">${pdfLinks.join(" ")}</p>` 
      : "";

    // compose description
    const htmlDescription: string = `<div class="p-description"><p id="location">${descriptionLocation}</p><table>${
      agendaTable || ""
    }</table></div>${pdfDocumentsHtml}<p class="taxonomy"><span class="p-category">#Gemeindeleben</span> <span class="p-scope">@Gemeinde</span></p><p class="link"><a class="u-url" href="${url}">${url}</a></p>`;

    return {
      html: `<!DOCTYPE html><html><body>${htmlDescription}</body></html>`,
      title: cleanHtml(title || ""),
      location: icsLocation,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("error message: ", error.message);
      return Promise.reject(error);
    } else {
      console.error("unexpected error: ", error);
      return Promise.reject(error);
    }
  }
};
