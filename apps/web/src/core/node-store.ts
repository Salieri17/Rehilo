import {
  createEmptyGraphState,
  normalizeGraphState,
  type Connection,
  type GraphState,
  type NodeEntity
} from "./node-engine";

const GRAPH_STORAGE_KEY = "rehilo.graph.v2";
const LEGACY_NOTES_STORAGE_KEY = "rehilo.notes.v1";

interface LegacyNotesState {
  notesById?: Record<
    string,
    {
      id?: string;
      title?: string;
      content?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  >;
  relationsByNoteId?: Record<string, string[]>;
}

export function loadGraphState(): GraphState {
  if (typeof window === "undefined") {
    return createEmptyGraphState();
  }

  const raw = window.localStorage.getItem(GRAPH_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<GraphState>;
      return normalizeGraphState(parsed);
    } catch {
      return createEmptyGraphState();
    }
  }

  const migrated = migrateFromLegacyNotes();
  if (Object.keys(migrated.nodesById).length > 0 || Object.keys(migrated.connectionsById).length > 0) {
    saveGraphState(migrated);
  }

  return migrated;
}

export function saveGraphState(state: GraphState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(state));
}

function migrateFromLegacyNotes(): GraphState {
  if (typeof window === "undefined") {
    return createEmptyGraphState();
  }

  const raw = window.localStorage.getItem(LEGACY_NOTES_STORAGE_KEY);
  if (!raw) {
    return createEmptyGraphState();
  }

  try {
    const parsed = JSON.parse(raw) as LegacyNotesState;
    const legacyNotes = parsed.notesById ?? {};
    const legacyRelations = parsed.relationsByNoteId ?? {};

    const nodesById: Record<string, NodeEntity> = {};
    for (const [nodeId, note] of Object.entries(legacyNotes)) {
      nodesById[nodeId] = {
        id: nodeId,
        type: "note",
        data: {
          title: note.title?.trim() || "Untitled",
          content: note.content ?? "",
          done: false,
          checklistItems: []
        },
        createdAt: note.createdAt ?? new Date().toISOString(),
        updatedAt: note.updatedAt ?? note.createdAt ?? new Date().toISOString()
      };
    }

    const connectionsById: Record<string, Connection> = {};
    const seen = new Set<string>();

    for (const [sourceId, targets] of Object.entries(legacyRelations)) {
      if (!nodesById[sourceId]) {
        continue;
      }

      for (const targetId of targets ?? []) {
        if (!nodesById[targetId] || sourceId === targetId) {
          continue;
        }

        const key = [sourceId, targetId].sort().join("::");
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        const connectionId = crypto.randomUUID();
        connectionsById[connectionId] = {
          id: connectionId,
          fromId: sourceId,
          toId: targetId
        };
      }
    }

    return normalizeGraphState({ nodesById, connectionsById });
  } catch {
    return createEmptyGraphState();
  }
}
