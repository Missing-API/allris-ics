export const trimHtml = (html: string): string => {
  let newHtml: string = html.trim();
  newHtml = newHtml.replaceAll(/\n/g, " ");
  newHtml = newHtml.replaceAll(/\t/g, " ");
  newHtml = newHtml.replaceAll(/\s\s+/g, " ");
  newHtml = newHtml.replaceAll(/> </g, "><");
  return newHtml;
};

export const removeSpanTags = (html: string): string => {
  let newHtml: string = html.trim();
  newHtml = newHtml.replaceAll(/<span>/g, "");
  newHtml = newHtml.replaceAll(/<\/span>/g, "");
  return newHtml;
};

export const removeEmtyTableRow = (html: string): string => {
  let newHtml: string = html;
  newHtml = newHtml.replaceAll(/<tr><td><hr><\/td><\/tr>/g, "");
  return newHtml;
};

export const addTableAndRemoveTbody = (html: string): string => {
  let newHtml: string = html;
  newHtml = newHtml.replaceAll(/<tbody>/g, "");
  newHtml = newHtml.replaceAll(/<\/tbody>/g, "");
  newHtml = "<table>" + newHtml + "</table>";
  return newHtml;
};

export const removeClassAttributes = (html: string): string => {
  const newHtml: string = html.replaceAll(/<([^ >]+)[^>]*>/gi, "<$1>");

  return newHtml;
};

export const cleanHtmlTable = (html: string): string => {
  let newHtml: string = html;
  newHtml = trimHtml(newHtml);
  newHtml = addTableAndRemoveTbody(newHtml);
  newHtml = removeClassAttributes(newHtml);
  newHtml = removeEmtyTableRow(newHtml);
  return newHtml;
};

export const cleanHtml = (html: string): string => {
  let newHtml: string = html;
  newHtml = trimHtml(newHtml);
  newHtml = removeClassAttributes(newHtml);
  newHtml = removeSpanTags(newHtml);
  return newHtml;
};
