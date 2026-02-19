export function isProbablyUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function deriveTitleFromText(text: string): string {
  const firstLine = text.split(/\r?\n/)[0]?.trim() ?? "";
  if (!firstLine) {
    return "Untitled";
  }
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}
