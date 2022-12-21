import {
  cleanHtmlTable,
  removeTagAttributes,
  removeEmptyTableRow,
  removeForms,
  trimHtml,
  trimLinks,
  removeTableHeaders,
  trimWrapperTags,
} from "./cleanHtml";

describe("should return a simplified html based on creapy html", () => {
  test("remove class attributes from tr", () => {
    const html: string = '<tr class="lorem123"><td>Lorem Ipsum</td></tr>';
    const resultHtml: string = removeTagAttributes(html);
    expect(resultHtml).toBe("<tr><td>Lorem Ipsum</td></tr>");
  });

  test("remove class attributes from td", () => {
    const html: string = '<td class="lorem123">Lorem Ipsum</td>';
    const resultHtml: string = removeTagAttributes(html);
    expect(resultHtml).toBe("<td>Lorem Ipsum</td>");
  });

  test("wrap into table tag", () => {
    const html: string = "<tr><td>Lorem Ipsum</td></tr>";
    const resultHtml: string = cleanHtmlTable(html);
    expect(resultHtml).toBe("<table><tr><td>Lorem Ipsum</td></tr></table>");
  });

  test("remove wrong used tbody", () => {
    const html: string = "<tbody><tr><td>Lorem Ipsum</td></tr></tbody>";
    const resultHtml: string = cleanHtmlTable(html);
    expect(resultHtml).toBe("<table><tr><td>Lorem Ipsum</td></tr></table>");
  });

  test("remove empty table rows", () => {
    const html: string = "<tr><td>Lorem Ipsum</td></tr><tr><td><hr></td></tr>";
    const resultHtml: string = removeEmptyTableRow(html);
    expect(resultHtml).toBe("<tr><td>Lorem Ipsum</td></tr>");
  });

  test("remove totally empty table rows", () => {
    const html: string = "<tr><td>Lorem Ipsum</td></tr><tr></tr>";
    const resultHtml: string = removeEmptyTableRow(html);
    expect(resultHtml).toBe("<tr><td>Lorem Ipsum</td></tr>");
  });

  test("remove table headers", () => {
    const html: string = "<tr><th>Lorem</th></tr><tr><td>Ipsum</td></tr>";
    const resultHtml: string = removeTableHeaders(html);
    expect(resultHtml).toBe("<tr><td>Ipsum</td></tr>");
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

  test("trim non-breaking spaces in table cells", () => {
    const html: string = "<td>&nbsp;</td>";
    const resultHtml: string = trimHtml(html);
    expect(resultHtml).toBe("<td> </td>");
  });

  test("trim non-breaking spaces in text", () => {
    const html: string = "<div>Lorem&nbsp;Ipsum</div>";
    const resultHtml: string = trimHtml(html);
    expect(resultHtml).toBe("<div>Lorem Ipsum</div>");
  });

  test("trim a tags", () => {
    const html: string =
      '<div>Lorem <a href="https://">Linktext</a> Ipsum</div>';
    const resultHtml: string = trimLinks(html);
    expect(resultHtml).toBe("<div>Lorem Linktext Ipsum</div>");
  });

  test("trim wrapper tags", () => {
    const html: string = "<div>Lorem <span>Ipsum</span> Text <p>Para</p></div>";
    const resultHtml: string = trimWrapperTags(html);
    expect(resultHtml).toBe("Lorem Ipsum Text Para");
  });

  test("trim reduced a tags", () => {
    const html: string = "<div>Lorem <a>Linktext</a> Ipsum</div>";
    const resultHtml: string = trimLinks(html);
    expect(resultHtml).toBe("<div>Lorem Linktext Ipsum</div>");
  });

  test("trim multiple a tags", () => {
    const html: string =
      "<div>Lorem <a>Linktext</a> Ipsum <a>Another Link</a></div>";
    const resultHtml: string = trimLinks(html);
    expect(resultHtml).toBe("<div>Lorem Linktext Ipsum Another Link</div>");
  });

  test("remove form tags", () => {
    const html: string =
      '<div>Lorem<form action="sth"><input /></form>Ipsum</div>';
    const resultHtml: string = removeForms(html);
    expect(resultHtml).toBe("<div>Lorem Ipsum</div>");
  });

  test("trim minified form tags", () => {
    const html: string = "<div>Lorem<form><input><input></form>Ipsum</div>";
    const resultHtml: string = removeForms(html);
    expect(resultHtml).toBe("<div>Lorem Ipsum</div>");
  });
});
