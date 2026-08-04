// Settings-drawer JSON export/import (contract: "settings drawer handles
// JSON export/import (round-trip tested)"; "importExport validates with zod
// and refuses partial imports").
import { ExportEnvelopeSchema, type ExportEnvelope } from "./schemas";
import type { AppState } from "./types";

export const EXPORT_SCHEMA = "fd5.export.v1" as const;

/** Serialize the full app state into a versioned, self-describing envelope.
 * Validated before emitting so a corrupt in-memory state (shouldn't happen —
 * the reducer only ever produces schema-valid states — but defence in depth)
 * never produces an export that would fail to re-import. */
export function exportState(state: AppState): string {
  const envelope: ExportEnvelope = { schema: EXPORT_SCHEMA, exportedAt: new Date().toISOString(), state };
  ExportEnvelopeSchema.parse(envelope);
  return JSON.stringify(envelope, null, 2);
}

export type ImportResult = { ok: true; state: AppState } | { ok: false; error: string };

/**
 * Parse + validate an export envelope. All-or-nothing: the envelope's
 * `state` is validated as one whole AppState (every slice's schema nested
 * inside AppStateSchema) — if any single slice is malformed, the entire
 * import is rejected rather than applying the slices that happened to
 * validate. Callers dispatch the returned state via
 * `{ type: "state/replace", state }` on success.
 */
export function importState(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "Not valid JSON." };
  }
  const result = ExportEnvelopeSchema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    return { ok: false, error: `Import rejected — ${detail}` };
  }
  if (result.data.schema !== EXPORT_SCHEMA) {
    return { ok: false, error: `Unrecognized export schema "${result.data.schema}".` };
  }
  return { ok: true, state: result.data.state };
}
