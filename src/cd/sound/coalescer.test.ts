import { describe, expect, it } from "vitest";
import {
  DUCK_EXEMPT,
  DUCK_FLOOR_DB,
  DUCK_RESET_MS,
  DUCK_STEP_DB,
  MERGE_12DB,
  MERGE_6DB,
  MERGE_THRESHOLD,
  PAN_LEAN,
  SLOT_MS,
  coalesce,
  createCoalescerState,
  duckGain,
  flushMerged,
  panFor,
  type DuckState,
} from "./coalescer";

describe("eight a second, then merge (II.5.11)", () => {
  it("caps at 8 events/second — one voice per 125ms slot", () => {
    expect(SLOT_MS).toBe(125);
    expect(1000 / SLOT_MS).toBe(8);
  });

  it("fires the first detent at FULL voice and closes the slot", () => {
    const s = createCoalescerState();
    const d = coalesce(s, 10);
    expect(d).toEqual({ fire: true, at: 10, gain: 1 });
    expect(s.slotEnd).toBeCloseTo(10.125, 6);
  });

  it("coalesces everything arriving inside a closed slot", () => {
    const s = createCoalescerState();
    coalesce(s, 10);
    const second = coalesce(s, 10.02);
    expect(second.fire).toBe(false);
    if (!second.fire) expect(second.scheduleAt).toBeCloseTo(10.125, 6);
    expect(s.pending).toBe(1);
  });

  it("books ONE merged tick however many arrive — never one per arrival", () => {
    const s = createCoalescerState();
    coalesce(s, 0);
    for (let i = 1; i <= 20; i++) coalesce(s, 0.001 * i);
    expect(s.pending).toBe(20);
    // the caller schedules exactly one flush; the merged tick is that one voice
    const gain = flushMerged(s, 0.125);
    expect(gain).toBe(MERGE_12DB);
    expect(s.pending).toBe(0);
  });

  it("merges the first overflow at -6dB (0.5)", () => {
    const s = createCoalescerState();
    coalesce(s, 0);
    coalesce(s, 0.01);
    expect(flushMerged(s, 0.125)).toBe(MERGE_6DB);
  });

  it("drops to -12dB (0.25) above three pending — a rate over 24/s", () => {
    const s = createCoalescerState();
    coalesce(s, 0);
    for (let i = 0; i < MERGE_THRESHOLD; i++) coalesce(s, 0.001 * i);
    expect(flushMerged(s, 0.125)).toBe(MERGE_6DB); // exactly three: still -6
    const t = createCoalescerState();
    coalesce(t, 0);
    for (let i = 0; i <= MERGE_THRESHOLD; i++) coalesce(t, 0.001 * i);
    expect(flushMerged(t, 0.125)).toBe(MERGE_12DB); // MORE than three: -12
  });

  it("reopens after the slot boundary passes", () => {
    const s = createCoalescerState();
    coalesce(s, 0);
    const later = coalesce(s, 0.2); // past 125ms, nothing pending
    expect(later).toEqual({ fire: true, at: 0.2, gain: 1 });
  });

  it("the semantic layer still counted every one — pending is the receipt", () => {
    const s = createCoalescerState();
    coalesce(s, 0);
    for (let i = 0; i < 47; i++) coalesce(s, 0.001);
    expect(s.pending).toBe(47);
  });
});

describe("repeats duck (II.5.12)", () => {
  it("steps down 3dB per repeat inside 1000ms", () => {
    expect(DUCK_STEP_DB).toBe(-3);
    const ducks = new Map<string, DuckState>();
    expect(duckGain(ducks, "confirm", 0)).toBeCloseTo(1, 6);
    expect(duckGain(ducks, "confirm", 100)).toBeCloseTo(10 ** (-3 / 20), 6);
    expect(duckGain(ducks, "confirm", 200)).toBeCloseTo(10 ** (-6 / 20), 6);
  });

  it("floors at -12dB however many repeats arrive", () => {
    const ducks = new Map<string, DuckState>();
    let g = 1;
    for (let i = 0; i < 30; i++) g = duckGain(ducks, "contact", i * 10);
    expect(g).toBeCloseTo(10 ** (DUCK_FLOOR_DB / 20), 6);
  });

  it("resets to full voice after 1000ms of silence", () => {
    const ducks = new Map<string, DuckState>();
    duckGain(ducks, "latch", 0);
    duckGain(ducks, "latch", 100);
    expect(duckGain(ducks, "latch", 100 + DUCK_RESET_MS)).toBeCloseTo(1, 6);
  });

  it("EXEMPTS THE WARNING — urgency does not fatigue on schedule", () => {
    expect(DUCK_EXEMPT).toBe("warning");
    const ducks = new Map<string, DuckState>();
    for (let i = 0; i < 20; i++) {
      expect(duckGain(ducks, "warning", i * 10)).toBe(1);
    }
  });

  it("ducks each cue on its own clock", () => {
    const ducks = new Map<string, DuckState>();
    duckGain(ducks, "contact", 0);
    duckGain(ducks, "contact", 10);
    expect(duckGain(ducks, "confirm", 20)).toBeCloseTo(1, 6);
  });
});

describe("sound sits where the control sits (II.5.13)", () => {
  it("leans +/-0.3 across the viewport and never further", () => {
    expect(PAN_LEAN).toBe(0.3);
    expect(panFor("contact", 0)).toBeCloseTo(-0.3, 6);
    expect(panFor("contact", 0.5)).toBeCloseTo(0, 6);
    expect(panFor("contact", 1)).toBeCloseTo(0.3, 6);
  });

  it("clamps a control measured off-screen back into the lean", () => {
    expect(panFor("contact", -5)).toBeCloseTo(-0.3, 6);
    expect(panFor("contact", 5)).toBeCloseTo(0.3, 6);
  });

  it("plays the WARNING dead centre — danger has no address", () => {
    expect(panFor("warning", 0)).toBe(0);
    expect(panFor("warning", 1)).toBe(0);
  });
});
