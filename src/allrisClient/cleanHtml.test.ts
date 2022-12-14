import {
  cleanHtmlTable,
  removeClassAttributes,
  removeEmtyTableRow,
  trimHtml,
} from "./cleanHtml";

describe("should return a simplified html based on creapy html", () => {
  test("remove class attributes from tr", () => {
    const html: string = '<tr class="lorem123"><td>Lorem Ipsum</td></tr>';
    const resultHtml: string = removeClassAttributes(html);
    expect(resultHtml).toBe("<tr><td>Lorem Ipsum</td></tr>");
  });

  test("remove class attributes from td", () => {
    const html: string = '<td class="lorem123">Lorem Ipsum</td>';
    const resultHtml: string = removeClassAttributes(html);
    expect(resultHtml).toBe("<td>Lorem Ipsum</td>");
  });

  test("wrap into table tag", () => {
    const html: string = "<tr><td>Lorem Ipsum</td></tr>";
    const resultHtml: string = cleanHtmlTable(html);
    expect(resultHtml).toBe("<table><tr><td>Lorem Ipsum</td></tr></table>");
  });

  test("remove wrong used tbody", () => {
    const html: string = "<tbody><tr><th>Lorem Ipsum</th></tr></tbody>";
    const resultHtml: string = cleanHtmlTable(html);
    expect(resultHtml).toBe("<table><tr><th>Lorem Ipsum</th></tr></table>");
  });

  test("remove empty table rows", () => {
    const html: string = "<tr><td>Lorem Ipsum</td></tr><tr><td><hr></td></tr>";
    const resultHtml: string = removeEmtyTableRow(html);
    expect(resultHtml).toBe("<tr><td>Lorem Ipsum</td></tr>");
  });

  test("trim spaces at beginning and end", () => {
    const html: string = " <div>Lorem Ipsum</div>";
    const resultHtml: string = trimHtml(html);
    expect(resultHtml).toBe("<div>Lorem Ipsum</div>");
  });

  test("trim tabs", () => {
    const html: string = "\t<div>Lorem\t\tIpsum</div>\t";
    const resultHtml: string = trimHtml(html);
    expect(resultHtml).toBe("<div>Lorem Ipsum</div>");
  });

  test("trim new lines", () => {
    const html: string = "\n<div>Lorem\n\nIpsum</div>\n";
    const resultHtml: string = trimHtml(html);
    expect(resultHtml).toBe("<div>Lorem Ipsum</div>");
  });

  test("trim double spaces", () => {
    const html: string = "<div>Lorem  Ipsum</div>";
    const resultHtml: string = trimHtml(html);
    expect(resultHtml).toBe("<div>Lorem Ipsum</div>");
  });

  test("trim multiple spaces", () => {
    const html: string = "<div>Lorem    Ipsum</div>";
    const resultHtml: string = trimHtml(html);
    expect(resultHtml).toBe("<div>Lorem Ipsum</div>");
  });
});
