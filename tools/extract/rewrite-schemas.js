// tools/extract/rewrite-schemas.js
//
// Zod schemas for every Phase 1 overlay file (REWRITE-SPEC.md "File layout"):
// data/rewrites/<mealId>.json, data/rewrites/prep-a.json / prep-b.json,
// data/rewrites/_ingredients.A.json / _ingredients.B.json,
// tools/extract/approvals.json, tools/extract/owner-rulings.json.
//
// Kept separate from join.js's own Phase 0 output schemas (IngredientSchema,
// MealSchema, PrepSchema etc. defined inline in join.js) so the two concerns
// — "what join.js WRITES" vs "what Phase 1 authors may hand it" — stay easy
// to read independently. All schemas are `.strict()`: an unknown key is a
// validation failure, same as a wrong type, so rewriter typos surface loudly
// instead of silently passing through.
//
// Every schema here is deliberately UNFORGIVING about shape (no invented
// defaults) per the CONTRACT.md standing rule — a rewrite file either
// matches this exactly, or it is treated as not having validated and the
// overlay logic (rewrite-overlay.js) falls back to Phase 0 content for that
// one file. Nothing here guesses a missing field's value.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared fragments
// ---------------------------------------------------------------------------

export const StorageClassSchema = z.enum(["buy-once", "freeze-day0", "buy-frozen", "stagger", "topup"]);
export const ShopCodeSchema = z.enum(["S", "M", "X"]);

export const SkuSchema = z
  .object({
    shop: ShopCodeSchema,
    product: z.string(),
    packG: z.number(),
    price: z.number(),
    estimate: z.boolean(),
    estimateSource: z.string(),
    verifiedOn: z.string().nullable(),
    sharedSkuWith: z.string().nullable(),
  })
  .strict()
  .nullable();

// ---------------------------------------------------------------------------
// data/rewrites/_ingredients.A.json, _ingredients.B.json
//
// Full ingredient records (same shape ingredients.json itself carries) for
// seasonings/oils discovered during the content pass. Deliberately requires
// the FULL shape (spec, storage) rather than defaulting missing pieces — a
// seasoning's shelf life/location is real data the rewriter must state, not
// something join.js should invent. `freebie` on the record itself marks
// zero-cal items (rule 5); non-freebie records enter covers/macros normally.
//
// `addedInContentPass` is accepted-but-ignored if the rewriter includes it
// themselves (join.js's merge always stamps it authoritatively regardless —
// see mergeContentPassIngredients in rewrite-overlay.js) rather than
// rejected as an unknown key: a rewriter anticipating the flag is harmless,
// not an error. `sku` is optional (defaults to null on merge) since a new
// seasoning may genuinely have no priced SKU yet at content-pass time.
// ---------------------------------------------------------------------------

export const ContentPassIngredientSchema = z
  .object({
    id: z.string().min(1),
    name: z
      .object({
        display: z.string().min(1),
        short: z.string().min(1),
        canonical: z.string().min(1),
      })
      .strict(),
    aliases: z.array(z.string()).optional().default([]),
    per100g: z
      .object({
        kcal: z.number(),
        protein: z.number(),
        fat: z.number(),
        carb: z.number(),
        fibre: z.number(),
      })
      .strict(),
    spec: z
      .object({
        weightState: z.string(),
        householdUnitG: z.number().nullable(),
        unitSingular: z.string(),
        unitPlural: z.string(),
      })
      .strict(),
    aisle: z.string().nullable(),
    freebie: z.boolean(),
    addedInContentPass: z.boolean().optional(),
    storage: z
      .object({
        class: StorageClassSchema,
        location: z.string(),
        note: z.string(),
        life: z
          .object({
            sealedDays: z.number().nullable().optional(),
            openDays: z.number().nullable().optional(),
            frozenDays: z.number().nullable().optional(),
            freshDays: z.number().nullable().optional(),
            prose: z.string(),
          })
          .strict(),
      })
      .strict(),
    sku: SkuSchema.optional(),
  })
  .strict();

export const ContentPassIngredientsFileSchema = z.array(ContentPassIngredientSchema);

// ---------------------------------------------------------------------------
// data/rewrites/<mealId>.json — REWRITE-SPEC.md "Meal rewrite schema"
// ---------------------------------------------------------------------------

export const RewriteStepSchema = z
  .object({
    n: z.number().int().positive(),
    text: z.string().min(1),
    minutes: z.number().nullable(),
    tempC: z.number().nullable(),
    // A free-form lane/component label for the tape-timeline (COOK screen) —
    // "pan"/"oven"/"prep" in REWRITE-SPEC.md's own JSONC example are
    // illustrative for ONE meal, not an exhaustive enum: a multi-tray dish
    // legitimately tracks its own named components ("chicken", "rice",
    // "sauce", "beans", …). Any non-empty string is a valid track name.
    track: z.string().min(1).nullable(),
    clockStart: z.number().nullable(),
    station: z.string().nullable().optional(),
    untimed: z.boolean().optional(),
  })
  .strict();

export const BatchTakeGSchema = z
  .object({
    w: z.number(),
    m: z.number(),
    total: z.number(),
  })
  .strict()
  .nullable();

export const RewriteMealSchema = z
  .object({
    mealId: z.string().min(1),
    rev: z.literal("B"),
    covers: z
      .object({
        w: z.record(z.string(), z.number()),
        m: z.record(z.string(), z.number()),
      })
      .strict(),
    freebies: z.array(z.string()).optional().default([]),
    steps: z.array(RewriteStepSchema).min(1),
    why: z.string().min(1),
    batchSource: z.string().nullable(),
    batchTakeG: BatchTakeGSchema,
    notes: z.array(z.string()).optional().default([]),
  })
  .strict();

// ---------------------------------------------------------------------------
// data/rewrites/prep-a.json, prep-b.json — REWRITE-SPEC.md rule 10
// ---------------------------------------------------------------------------

export const RewritePrepOpIngredientSchema = z
  .object({
    ingId: z.string().min(1),
    g: z.number(),
  })
  .strict();

export const RewritePrepOpSchema = z
  .object({
    clock: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    station: z.string().min(1),
    minutes: z.number().nullable(),
    // Present on any op that's an oven/hob op running at a set temperature
    // (mirrors the meal-step tempC field one level up).
    tempC: z.number().nullable().optional(),
    untimed: z.boolean().optional(),
    ingredients: z.array(RewritePrepOpIngredientSchema),
  })
  .strict();

export const RewritePrepYieldSchema = z
  .object({
    component: z.string().min(1),
    qty: z.string().min(1),
    consumers: z.array(z.string()).nullable(),
    storage: z.string(),
    // Free-text remark on the yield — headroom vs consumer demand (D0-020)
    // is the most common use, but any reviewer-facing note belongs here.
    // Accepts both names the two Week A/B rewriters independently used
    // ("note" and "headroomNote") — rewrite-overlay.js normalizes to `note`
    // on load rather than rejecting one week's files over a naming choice.
    note: z.string().nullable().optional(),
    headroomNote: z.string().nullable().optional(),
  })
  .strict();

export const RewritePrepMidweekSchema = z
  .object({
    heading: z.string(),
    body: z.string(),
  })
  .strict();

export const RewritePrepSchema = z
  .object({
    week: z.enum(["A", "B"]),
    sessionName: z.string().min(1),
    totalMin: z.number().nullable(),
    ops: z.array(RewritePrepOpSchema).min(1),
    yields: z.array(RewritePrepYieldSchema).min(1),
    midweek: z.array(RewritePrepMidweekSchema),
    // Rewriter remarks for the reviewer, same role as a meal rewrite's
    // top-level `notes` (REWRITE-SPEC.md meal schema).
    notes: z.array(z.string()).optional().default([]),
  })
  .strict();

// ---------------------------------------------------------------------------
// tools/extract/approvals.json
// ---------------------------------------------------------------------------

export const ApprovalBatchSchema = z
  .object({
    approved: z.boolean(),
    mealIds: z.array(z.string()).min(1),
    sessionIds: z.array(z.string()),
  })
  .strict();

export const ApprovalsSchema = z
  .object({
    a1: ApprovalBatchSchema,
    a2: ApprovalBatchSchema,
    b1: ApprovalBatchSchema,
    b2: ApprovalBatchSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// tools/extract/owner-rulings.json
// ---------------------------------------------------------------------------

export const OwnerRulingEntrySchema = z
  .object({
    status: z.enum(["resolved", "open", "resolved-by-default"]),
    resolvedTo: z.string().nullable(),
  })
  .strict();

export const OwnerRulingsSchema = z
  .object({
    checkpointDate: z.string(),
    resolvedBy: z.string().min(1),
    rulings: z.record(z.string(), OwnerRulingEntrySchema),
    confirmedDefaults: z
      .object({
        note: z.string(),
        confirmedCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
