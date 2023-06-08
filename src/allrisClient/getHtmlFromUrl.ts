import axios, { AxiosRequestConfig } from "axios";
import { cleanHtml, cleanHtmlTable } from "./cleanHtml";
const cheerio = require("cheerio");

/**
 * Split up html functions based on Allris version
 * 
 * <meta name="description" content="ALLRIS net Version 3.9.4SP1 (210504m)"> (e.g. Amt Züssow, detail https://www.sitzungsdienst-zuessow.de/bi2/to010.asp?SILFDNR=2861)
 * <meta name="description" content="ALLRIS net Version 4.0.7 (4070018) - 13.10.2020"> (e.g. Amt Eggesin, detail https://eggesin.sitzung-mv.de/public/to010?SILFDNR=656)
 * <meta name="description" content="ALLRIS net Version 4.0.8 (4080038) - 27.05.2021"> (e.g. Amt Usedom, detail https://usedomsued.sitzung-mv.de/public/to010?SILFDNR=1000096&refresh=false)
 
 */

export const getHtmlFromUrl = async (url: string): Promise<string | null> => {
  try {
    // set options to properly decode iso-8859-1 from allris html
    const options: AxiosRequestConfig = {
      method: "GET",
      url: url,
      headers: {
        Accept: "application/text",
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
          Accept: "application/text",
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
      "4.0": "#header h1 span.title",
    };
    const title: string = $(titleSelector[allrisMajorVersion]).html();

    // get agenda from html
    const agendaTableSelector: any = {
      "3.9": "table.tl1",
      "4.0": "table.dataTable",
    };
    const agendaTable: string =
      title !== "Kalender"
        ? $(agendaTableSelector[allrisMajorVersion]).html()
        : "";

    // get room and location from html
    const roomSelector: any = {
      "3.9":
        "#rismain table.risdeco tbody tr td table.tk1 tbody tr td.ko1 table.tk1 tbody tr td.text2",
      "4.0": "#siraum",
    };
    const room: string = $(roomSelector[allrisMajorVersion]).html();

    const locationSelector: any = {
      "3.9":
        "#rismain table.risdeco tbody tr td table.tk1 tbody tr td.ko1 table.tk1 tbody tr td.text2",
      "4.0": "#siort",
    };
    const location: string = $(locationSelector[allrisMajorVersion]).html();
    let locationString: string =
      room && location ? `${room}, ${location}` : room || location || "";

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

      locationString = (
        roomStr && locationStr
          ? `${roomStr}, ${locationStr}`
          : roomStr || locationStr || ""
      ).replace(",,", ",");
    }

    // compose description
    const htmlDescription: string = `<p id="title">${cleanHtml(
      title || ""
    )}</p><p id="location">${locationString}</p>${cleanHtmlTable(
      agendaTable || ""
    )}<p><a href="${url}">${url}</a></p>`;

    return `<!DOCTYPE html><html><body>${htmlDescription}</body></html>`;
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
