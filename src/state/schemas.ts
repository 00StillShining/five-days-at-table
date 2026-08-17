// zod schemas for every persisted slice + the import/export envelope.
// Used by state/persist.ts (hydrate-on-boot) and state/importExport.ts.
import { z } from "zod";

export const CoverSchema = z.union([z.literal("w"), z.literal("m")]);
export const WeekSchema = z.union([z.literal("A"), z.literal("B")]);
export const SlotSchema = z.union([z.literal("breakfast"), z.literal("lunch"), z.literal("dinner"), z.literal("snack")]);
export const InventoryLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

/** docs/VARIANT-SPEC.md: default "full", migration-safe — `.default("full")`
 * means an absent key on any prefs blob persisted before this field existed
 * parses to "full" rather than failing validation (see state/persist.ts's
 * hydrateSlice: a schema failure would otherwise fall back to the WHOLE
 * default prefs object, silently discarding cover/week/scale/serveTime/
 * cycleStartSaturday too — `.default` avoids that). */
export const PlanVariantSchema = z.union([z.literal("full"), z.literal("morrisons-tester")]).default("full");

export const PrefsSchema = z.object({
  cover: CoverSchema,
  week: WeekSchema,
  scale: z.number(),
  serveTime: z.string(),
  cycleStartSaturday: z.string().nullable(),
  planVariant: PlanVariantSchema,
});

export const InventoryEntrySchema = z.object({
  level: InventoryLevelSchema,
  updatedAt: z.string(),
  // Optional + nullable: migration-safe for every entry persisted before
  // this field existed (absent -> "not yet thawed", the correct default).
  thawedAt: z.string().nullable().optional(),
});
export const InventorySchema = z.record(z.string(), InventoryEntrySchema);

export const EatenTickSchema = z.object({ mealId: z.string(), at: z.string() });
// Inner key is deliberately z.string() rather than SlotSchema: zod's `record`
// validates provided keys/values but a literal-union key type would make the
// inferred TS type Record<Slot, …> (all four keys required), which doesn't
// match reality (most days only have some slots ticked). Slot correctness is
// enforced by the reducer (state/store.tsx), not by this persistence schema.
export const EatenSchema = z.record(z.string(), z.record(z.string(), EatenTickSchema));

export const ShopTickSchema = z.object({ at: z.string() });
export const ShopTicksSchema = z.record(z.string(), z.record(z.string(), ShopTickSchema));

export const LeftoverSourceSchema = z.union([z.literal("prep"), z.literal("meal")]);
export const LeftoverEntrySchema = z.object({
  id: z.string(),
  source: LeftoverSourceSchema,
  ref: z.string(),
  g: z.number().nullable(),
  price: z.number().nullable(),
  date: z.string(),
  useBy: z.string(),
  consumers: z.array(z.string()),
  sourceWeek: WeekSchema.nullable(),
  sourceSession: z.string().nullable(),
  note: z.string().nullable(),
  consumedAt: z.string().nullable(),
});
export const LeftoversSchema = z.array(LeftoverEntrySchema);

export const WasteEntrySchema = z.object({
  id: z.string(),
  ref: z.string(),
  g: z.number().nullable(),
  price: z.number().nullable(),
  date: z.string(),
  note: z.string().nullable(),
});
export const WasteSchema = z.array(WasteEntrySchema);

export const PriceCheckSchema = z.object({ price: z.number(), on: z.string() });
export const PriceChecksSchema = z.record(z.string(), PriceCheckSchema);

export const TimerSliceStateSchema = z.object({
  programId: z.string().nullable(),
  startedAt: z.number().nullable(),
  pausedAt: z.number().nullable(),
  accumulatedPauseMs: z.number(),
  extraMs: z.number(),
  doneSteps: z.array(z.number()),
});

/** P2-PLAN-001: planned meal id -> replacement meal id. See state/types.ts's
 * `Swaps` doc for the keying rationale. */
export const SwapsSchema = z.record(z.string(), z.string());

export const AppStateSchema = z.object({
  prefs: PrefsSchema,
  inventory: InventorySchema,
  eaten: EatenSchema,
  shopTicks: ShopTicksSchema,
  leftovers: LeftoversSchema,
  waste: WasteSchema,
  priceChecks: PriceChecksSchema,
  timers: TimerSliceStateSchema,
  swaps: SwapsSchema,
});

/** Per-slice schema lookup, keyed exactly like AppState / the fd5.v1.<slice> keys. */
export const SLICE_SCHEMAS = {
  prefs: PrefsSchema,
  inventory: InventorySchema,
  eaten: EatenSchema,
  shopTicks: ShopTicksSchema,
  leftovers: LeftoversSchema,
  waste: WasteSchema,
  priceChecks: PriceChecksSchema,
  timers: TimerSliceStateSchema,
  swaps: SwapsSchema,
} as const;

/** Versioned export envelope for the settings-drawer JSON export/import. */
export const ExportEnvelopeSchema = z.object({
  schema: z.literal("fd5.export.v1"),
  exportedAt: z.string(),
  state: AppStateSchema,
});
export type ExportEnvelope = z.infer<typeof ExportEnvelopeSchema>;
