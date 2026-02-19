import type { CreateNodeInput, NodeType, TodoStatus } from "./node";

type CommandTypeAlias = "N" | "T" | "P" | "I" | "L" | "E";

const TYPE_ALIAS_TO_NODE_TYPE: Record<CommandTypeAlias, NodeType> = {
  N: "note",
  T: "todo",
  P: "project",
  I: "idea",
  L: "link",
  E: "event"
};

const LONG_TYPE_TO_NODE_TYPE: Record<string, NodeType> = {
  note: "note",
  todo: "todo",
  project: "project",
  idea: "idea",
  link: "link",
  event: "event"
};

export interface ParseStructuredCommandSuccess {
  ok: true;
  raw: string;
  typeToken: string;
  nodeType: NodeType;
  title: string;
  args: string[];
}

export interface ParseStructuredCommandError {
  ok: false;
  raw: string;
  message: string;
}

export type ParseStructuredCommandResult = ParseStructuredCommandSuccess | ParseStructuredCommandError;

export interface StructuredCommandToNodeOptions {
  workspaceId: string;
}

export interface StructuredCommandToNodeResult {
  primary: CreateNodeInput;
  secondary: CreateNodeInput[];
}

export function parseStructuredCommand(rawInput: string): ParseStructuredCommandResult {
  const raw = rawInput.trim();

  if (!raw) {
    return {
      ok: false,
      raw,
      message: "Command is empty. Expected TYPE/TITLE/ARG1/..."
    };
  }

  const segments = splitCommandSegments(raw);
  if (segments.length < 2) {
    return {
      ok: false,
      raw,
      message: "Invalid syntax. Expected TYPE/TITLE/ARG1/..."
    };
  }

  const [typeTokenRaw, titleRaw, ...argsRaw] = segments;
  const typeToken = typeTokenRaw.trim();
  const title = titleRaw.trim();

  if (!typeToken) {
    return {
      ok: false,
      raw,
      message: "Missing TYPE token."
    };
  }

  if (!title) {
    return {
      ok: false,
      raw,
      message: "Missing TITLE token."
    };
  }

  const nodeType = mapTypeTokenToNodeType(typeToken);
  if (!nodeType) {
    return {
      ok: false,
      raw,
      message: `Unknown TYPE '${typeToken}'. Supported: N,T,P,I,L,E or full type names.`
    };
  }

  return {
    ok: true,
    raw,
    typeToken,
    nodeType,
    title,
    args: argsRaw.map((arg) => arg.trim()).filter(Boolean)
  };
}

export function structuredCommandToNodeInput(
  parsed: ParseStructuredCommandSuccess,
  options: StructuredCommandToNodeOptions
): StructuredCommandToNodeResult {
  const base: Omit<CreateNodeInput, "type" | "title"> = {
    workspaceId: options.workspaceId
  };

  switch (parsed.nodeType) {
    case "todo": {
      const checklist = parsed.args;
      const content = checklist.length > 0 ? checklist.map((item) => `- [ ] ${item}`).join("\n") : "";
      const status: TodoStatus = "pending";

      return {
        primary: {
          ...base,
          type: "todo",
          title: parsed.title,
          content,
          status,
          metadata: checklist.length > 0 ? { checklist } : {}
        },
        secondary: []
      };
    }

    case "note": {
      return {
        primary: {
          ...base,
          type: "note",
          title: parsed.title,
          content: parsed.args.join("\n")
        },
        secondary: []
      };
    }

    case "project": {
      const milestones = parsed.args;
      const content = milestones.length > 0 ? milestones.map((item) => `- ${item}`).join("\n") : "";
      return {
        primary: {
          ...base,
          type: "project",
          title: parsed.title,
          content,
          metadata: milestones.length > 0 ? { milestones } : {}
        },
        secondary: []
      };
    }

    case "idea": {
      return {
        primary: {
          ...base,
          type: "idea",
          title: parsed.title,
          content: parsed.args.join("\n")
        },
        secondary: []
      };
    }

    case "link": {
      const [url, ...rest] = parsed.args;
      return {
        primary: {
          ...base,
          type: "link",
          title: parsed.title,
          content: rest.join("\n"),
          metadata: url ? { url } : {}
        },
        secondary: []
      };
    }

    case "event": {
      const [startAt, endAt, location, ...notes] = parsed.args;
      return {
        primary: {
          ...base,
          type: "event",
          title: parsed.title,
          content: notes.join("\n"),
          metadata: {
            ...(startAt ? { startAt } : {}),
            ...(endAt ? { endAt } : {}),
            ...(location ? { location } : {})
          }
        },
        secondary: []
      };
    }

    default:
      return {
        primary: {
          ...base,
          type: parsed.nodeType,
          title: parsed.title,
          content: parsed.args.join("\n")
        },
        secondary: []
      };
  }
}

export function mapTypeTokenToNodeType(typeToken: string): NodeType | null {
  const normalized = typeToken.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const aliasMatch = TYPE_ALIAS_TO_NODE_TYPE[normalized as CommandTypeAlias];
  if (aliasMatch) {
    return aliasMatch;
  }

  const longMatch = LONG_TYPE_TO_NODE_TYPE[typeToken.trim().toLowerCase()];
  return longMatch ?? null;
}

function splitCommandSegments(input: string): string[] {
  const segments: string[] = [];
  let current = "";
  let escaping = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (character === "/") {
      segments.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  if (escaping) {
    current += "\\";
  }

  segments.push(current);
  return segments;
}
