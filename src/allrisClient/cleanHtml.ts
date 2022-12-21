export const trimHtml = (html: string): string => {
  let newHtml: string = html?.trim() || "";
  newHtml = newHtml.replaceAll(/<!--.*?-->/gs, " ");
  newHtml = newHtml.replaceAll(/\n/g, " ");
  newHtml = newHtml.replaceAll(/\t/g, " ");
  newHtml = newHtml.replaceAll(/\s\s+/g, " ");
  newHtml = newHtml.replaceAll(/> </g, "><");
  newHtml = newHtml.replaceAll(/ <\//g, "</");
  newHtml = newHtml.replaceAll(/&nbsp;/g, " ");
  return newHtml;
};

export const removeForms = (html: string): string => {
  const newHtml = html.replaceAll(/<form\b[^>]*>(.*?)<\/form>/g, " ");
  return newHtml;
};

export const removeSpanTags = (html: string): string => {
  let newHtml: string = html.trim();
  newHtml = newHtml.replaceAll(/<span>/g, "");
  newHtml = newHtml.replaceAll(/<\/span>/g, "");
  return newHtml;
};

export const removeEmptyTableRow = (html: string): string => {
  let newHtml: string = html;
  newHtml = newHtml.replaceAll(/<tr>(\s*)<\/tr>/g, "");
  newHtml = newHtml.replaceAll(/<tr><td><hr><\/td><\/tr>/g, "");
  newHtml = newHtml.replaceAll(
    /<tr><td><\/td><td><\/td><td><\/td><td><\/td><td><\/td><td><\/td><td><\/td><td><\/td><\/tr>/g,
    ""
  );
  return newHtml;
};

export const removeTableHeaders = (html: string): string => {
  let newHtml = html.replaceAll(/<th\b[^>]*>(.*?)<\/th>/g, " ");
  newHtml = removeEmptyTableRow(newHtml);
  return newHtml;
};

export const addTableAndRemoveTbody = (html: string): string => {
  let newHtml: string = html;
  newHtml = newHtml.replaceAll(/<tbody>/g, "");
  newHtml = newHtml.replaceAll(/<\/tbody>/g, "");
  newHtml = "<table>" + newHtml + "</table>";
  return newHtml;
};

export const removeTagAttributes = (html: string): string => {
  const newHtml: string = html.replaceAll(/<([^ >]+)[^>]*>/gi, "<$1>");

  return newHtml;
};

export const trimLinks = (html: string): string => {
  let newHtml: string = removeTagAttributes(html);
  newHtml = newHtml.replaceAll(/<a>/g, "");
  newHtml = newHtml.replaceAll(/<\/a>/g, "");
  return newHtml;
};

export const trimWrapperTags = (html: string): string => {
  let newHtml: string = removeTagAttributes(html);
  newHtml = newHtml.replaceAll(/<span>/g, "");
  newHtml = newHtml.replaceAll(/<\/span>/g, "");
  newHtml = newHtml.replaceAll(/<div>/g, "");
  newHtml = newHtml.replaceAll(/<\/div>/g, "");
  newHtml = newHtml.replaceAll(/<p>/g, "");
  newHtml = newHtml.replaceAll(/<\/p>/g, "");
  return newHtml;
};

export const cleanHtmlTable = (html: string): string => {
  let newHtml: string = html;
  newHtml = trimHtml(newHtml);
  newHtml = removeTagAttributes(newHtml);
  newHtml = removeForms(newHtml);
  newHtml = trimLinks(newHtml);
  newHtml = trimWrapperTags(newHtml);
  newHtml = removeTableHeaders(newHtml);
  newHtml = addTableAndRemoveTbody(newHtml);
  newHtml = removeEmptyTableRow(newHtml);
  return newHtml;
};

export const cleanHtml = (html: string): string => {
  let newHtml: string = html;
  newHtml = trimHtml(newHtml);
  newHtml = removeForms(newHtml);
  newHtml = trimLinks(newHtml);
  newHtml = trimWrapperTags(newHtml);
  newHtml = removeTagAttributes(newHtml);
  newHtml = removeSpanTags(newHtml);
  return newHtml;
};
