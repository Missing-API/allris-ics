import { getUrlFromText } from "./getUrlFromText";

describe("should return a valid url from a plain text", () => {
  test("returns simple url", () => {
    const text: string = "Lorem https://www.domain.de/ Ipsum";
    const url: string | null = getUrlFromText(text);
    expect(url).toBe("https://www.domain.de/");
  });
  test("returns url with parameters", () => {
    const text: string =
      "Exportiert aus ALLRIS am 14.12.2022\n\n\nDie Sitzung in ALLRIS net:\nhttps://www.sitzungsdienst-zuessow.de/bi2/to010.asp?SILFDNR=2996";
    const url: string | null = getUrlFromText(text);
    expect(url).toBe(
      "https://www.sitzungsdienst-zuessow.de/bi2/to010.asp?SILFDNR=2996"
    );
  });

  test("returns first url if multiple urls are includes", () => {
    const text: string =
      "Lorem https://www.first.de/ Ipsum https://www.second.de/ Lorem";
    const url: string | null = getUrlFromText(text);
    expect(url).toBe("https://www.first.de/");
  });

  test("returns null if no url is included", () => {
    const text: string = "Lorem Ipsum";
    const url: string | null = getUrlFromText(text);
    expect(url).toBeNull();
  });
});
