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
      responseEncoding: "latin1",
      decompress: true,
    };

    // get pure data
    const { data } = await axios.get<string>(url, options);

    // parse html
    const $ = cheerio.load(data);
    const title: string = $("#risname h1").html();
    const agendaTable: string = $("table.tl1").html();

    // compose description
    const htmlDescription: string = `<p>${cleanHtml(title)}</p>${cleanHtmlTable(
      agendaTable
    )}<p><a href="${url}">Mehr Details</a></p>`;

    return htmlDescription;
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
