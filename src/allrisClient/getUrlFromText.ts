const urlRegexSafe = require("url-regex-safe");

export const getUrlFromText = (text: string): string | null => {
  const matches = text.match(urlRegexSafe());

  if (matches?.length > 0) return matches[0];
  return null;
};
