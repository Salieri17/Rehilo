import type { CreateNodeInput, JsonValue, NodeType } from "./node";
import {
  parseStructuredCommand,
  structuredCommandToNodeInput,
  type ParseStructuredCommandResult
} from "./input-engine";

export interface NaturalLanguageDateMatch {
  raw: string;
  isoDate: string;
  kind: "explicit" | "relative";
}

export interface NodeMention {
  raw: string;
  title: string;
}

export interface LinkIntent {
  targetTitle: string;
  strategy: "create-or-link";
}

export interface NaturalLanguageExtraction {
  source: string;
  mentions: NodeMention[];
  tags: string[];
  dates: NaturalLanguageDateMatch[];
  dueDateIso?: string;
  urls: string[];
  linkIntents: LinkIntent[];
}

export interface ParseNaturalLanguageOptions {
  referenceDate?: Date;
}

export interface HybridInputOptions extends ParseNaturalLanguageOptions {
  workspaceId: string;
  defaultNaturalType?: NodeType;
}

export interface HybridParseResult {
  mode: "structured" | "natural";
  structured: ParseStructuredCommandResult;
  natural: NaturalLanguageExtraction;
  primary: CreateNodeInput;
  secondary: CreateNodeInput[];
}

export function parseNaturalLanguage(
  input: string,
  options: ParseNaturalLanguageOptions = {}
): NaturalLanguageExtraction {
  const source = input.trim();
  const referenceDate = options.referenceDate ?? new Date();

  const mentions = extractNodeMentions(source);
  const tags = extractTags(source);
  const urls = extractUrls(source);
  const dates = extractDates(source, referenceDate);
  const dueDateIso = extractDueDate(source, referenceDate);

  return {
    source,
    mentions,
    tags,
    dates,
    dueDateIso,
    urls,
    linkIntents: mentions.map((mention) => ({
      targetTitle: mention.title,
      strategy: "create-or-link"
    }))
  };
}

export function parseHybridInput(rawInput: string, options: HybridInputOptions): HybridParseResult {
  const structured = parseStructuredCommand(rawInput);
  const natural = parseNaturalLanguage(rawInput, options);

  if (structured.ok) {
    const base = structuredCommandToNodeInput(structured, {
      workspaceId: options.workspaceId
    });

    return {
      mode: "structured",
      structured,
      natural,
      primary: applyNaturalMetadata(base.primary, natural),
      secondary: [...base.secondary, ...buildSecondaryNodesFromNatural(natural, options.workspaceId)]
    };
  }

  const naturalPrimary = buildNaturalPrimaryNode(rawInput, options.workspaceId, options.defaultNaturalType ?? "note");
  return {
    mode: "natural",
    structured,
    natural,
    primary: applyNaturalMetadata(naturalPrimary, natural),
    secondary: buildSecondaryNodesFromNatural(natural, options.workspaceId)
  };
}

function buildNaturalPrimaryNode(rawInput: string, workspaceId: string, defaultType: NodeType): CreateNodeInput {
  const cleaned = rawInput.trim();
  const type = inferNaturalPrimaryType(cleaned, defaultType);

  if (type === "link") {
    const [firstUrl] = extractUrls(cleaned);
    return {
      workspaceId,
      type: "link",
      title: firstUrl ?? "Untitled link",
      content: cleaned,
      metadata: firstUrl ? { url: firstUrl } : {}
    };
  }

  return {
    workspaceId,
    type,
    title: deriveNaturalTitle(cleaned),
    content: cleaned
  };
}

function applyNaturalMetadata(base: CreateNodeInput, natural: NaturalLanguageExtraction): CreateNodeInput {
  const mergedTags = uniqueStrings([...(base.tags ?? []), ...natural.tags]);

  const naturalMetadata: Record<string, JsonValue> = {
    nodeMentions: natural.mentions.map((mention) => mention.title),
    urls: natural.urls,
    detectedDates: natural.dates.map((dateMatch) => ({
      raw: dateMatch.raw,
      isoDate: dateMatch.isoDate,
      kind: dateMatch.kind
    }))
  };

  if (natural.dueDateIso) {
    naturalMetadata.dueDate = natural.dueDateIso;
  }

  return {
    ...base,
    tags: mergedTags,
    metadata: {
      ...(base.metadata ?? {}),
      ...naturalMetadata,
      ...(natural.dueDateIso ? { dueDate: natural.dueDateIso } : {})
    }
  };
}

function buildSecondaryNodesFromNatural(natural: NaturalLanguageExtraction, workspaceId: string): CreateNodeInput[] {
  const mentionNodes = natural.mentions.map((mention) => ({
    workspaceId,
    type: "note" as const,
    title: mention.title,
    content: "",
    metadata: {
      origin: "mention"
    }
  }));

  const urlNodes = natural.urls.map((url) => ({
    workspaceId,
    type: "link" as const,
    title: url,
    content: "",
    metadata: {
      url,
      origin: "url-detected"
    }
  }));

  return dedupeSecondaryNodes([...mentionNodes, ...urlNodes]);
}

function dedupeSecondaryNodes(nodes: CreateNodeInput[]): CreateNodeInput[] {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    const key = `${node.type}::${node.title.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function extractNodeMentions(input: string): NodeMention[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const results: NodeMention[] = [];

  let match = regex.exec(input);
  while (match) {
    const raw = match[0];
    const title = match[1].trim();
    if (title) {
      results.push({ raw, title });
    }
    match = regex.exec(input);
  }

  return uniqueBy(results, (item) => item.title.toLowerCase());
}

function extractTags(input: string): string[] {
  const regex = /(^|\s)#([a-zA-Z0-9_-]+)/g;
  const tags: string[] = [];

  let match = regex.exec(input);
  while (match) {
    tags.push(match[2].toLowerCase());
    match = regex.exec(input);
  }

  return uniqueStrings(tags);
}

function extractUrls(input: string): string[] {
  const regex = /\bhttps?:\/\/[^\s)\]}]+/gi;
  const matches = input.match(regex) ?? [];
  return uniqueStrings(matches);
}

function extractDates(input: string, referenceDate: Date): NaturalLanguageDateMatch[] {
  const explicitDateRegex = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  const found: NaturalLanguageDateMatch[] = [];

  let explicitMatch = explicitDateRegex.exec(input);
  while (explicitMatch) {
    const day = Number(explicitMatch[1]);
    const month = Number(explicitMatch[2]);
    const year = Number(explicitMatch[3]);

    const isoDate = toIsoDate(year, month, day);
    if (isoDate) {
      found.push({
        raw: explicitMatch[0],
        isoDate,
        kind: "explicit"
      });
    }

    explicitMatch = explicitDateRegex.exec(input);
  }

  const lower = input.toLowerCase();
  if (/\btomorrow\b/.test(lower)) {
    found.push({
      raw: "tomorrow",
      isoDate: toIsoDateFromDate(addDays(referenceDate, 1)),
      kind: "relative"
    });
  }

  if (/\bnext week\b/.test(lower)) {
    found.push({
      raw: "next week",
      isoDate: toIsoDateFromDate(addDays(referenceDate, 7)),
      kind: "relative"
    });
  }

  return uniqueBy(found, (item) => `${item.raw.toLowerCase()}::${item.isoDate}`);
}

function extractDueDate(input: string, referenceDate: Date): string | undefined {
  const match = input.match(/\bbefore\s+([^,.;\n]+)/i);
  if (!match) {
    return undefined;
  }

  const expression = match[1].trim();
  if (!expression) {
    return undefined;
  }

  const parsed = parseDateExpression(expression, referenceDate);
  return parsed?.isoDate;
}

function parseDateExpression(expression: string, referenceDate: Date): NaturalLanguageDateMatch | null {
  const explicitMatch = expression.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (explicitMatch) {
    const day = Number(explicitMatch[1]);
    const month = Number(explicitMatch[2]);
    const year = Number(explicitMatch[3]);
    const isoDate = toIsoDate(year, month, day);
    if (!isoDate) {
      return null;
    }
    return {
      raw: explicitMatch[0],
      isoDate,
      kind: "explicit"
    };
  }

  const normalized = expression.toLowerCase();
  if (normalized.includes("tomorrow")) {
    return {
      raw: "tomorrow",
      isoDate: toIsoDateFromDate(addDays(referenceDate, 1)),
      kind: "relative"
    };
  }

  if (normalized.includes("next week")) {
    return {
      raw: "next week",
      isoDate: toIsoDateFromDate(addDays(referenceDate, 7)),
      kind: "relative"
    };
  }

  return null;
}

function inferNaturalPrimaryType(input: string, fallback: NodeType): NodeType {
  const trimmed = input.trim();
  const urls = extractUrls(trimmed);
  if (urls.length > 0) {
    const inputWithoutUrls = trimmed.replace(/\bhttps?:\/\/[^\s)\]}]+/gi, "").trim();
    if (!inputWithoutUrls || inputWithoutUrls.length < 16) {
      return "link";
    }
  }
  return fallback;
}

function deriveNaturalTitle(input: string): string {
  const withoutMentions = input.replace(/\[\[[^\]]+\]\]/g, "").trim();
  const firstLine = withoutMentions.split(/\r?\n/)[0]?.trim() ?? "";
  if (!firstLine) {
    return "Untitled";
  }
  return firstLine.length <= 80 ? firstLine : `${firstLine.slice(0, 77)}...`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return toIsoDateFromDate(candidate);
}

function toIsoDateFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function uniqueBy<T>(items: T[], selector: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = selector(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
