/**
 * src/cd/spike/probe.ts — the measuring instruments of the spike itself.
 *
 * CORRECTIONARY 6.2: "Code that 'should look right' is worthless testimony."
 * The same applies to frame budgets. Nothing in the report is estimated; every
 * figure below is sampled in the page, in the same frames the material is
 * actually compositing, and read back out through `window.__spike`.
 *
 * Three things are measured:
 *
 *  1. FRAME COST — inter-frame delta on requestAnimationFrame. 60fps = 16.67ms.
 *     The probe reports mean / p50 / p95 / p99 / max and two counts: frames over
 *     16.7ms (a dropped frame) and frames over 12ms (II.4.12's own shed trigger).
 *
 *  2. ACKNOWLEDGEMENT LATENCY — the Floor's 16ms, measured the way the Floor
 *     states it: "input acknowledged within 16ms", and II.4.1's "the semantic
 *     layer commits in the same frame the command arrives". So the sample is
 *     `now - event.timeStamp` taken at the instant the model has been mutated,
 *     BEFORE React has re-rendered anything. The paint that follows is the
 *     report, not the commit, and is sampled separately so the two are never
 *     confused with each other.
 *
 *  3. LAYER / PAINT COUNT — box-shadow layers actually declared on live nodes,
 *     counted off computed style, plus backdrop-filter and filter users. This
 *     is the "260 shadow layers" claim, checked rather than assumed.
 */

export interface FrameStats {
  label: string;
  frames: number;
  durationMs: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  /** Frames that missed 60fps. */
  over167: number;
  /** II.4.12's shed trigger threshold. */
  over12: number;
  fps: number;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
  return sorted[i]!;
}

function summarise(label: string, samples: number[], durationMs: number): FrameStats {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  return {
    label,
    frames: samples.length,
    durationMs: Math.round(durationMs),
    mean: +(sum / Math.max(1, samples.length)).toFixed(2),
    p50: +quantile(sorted, 0.5).toFixed(2),
    p95: +quantile(sorted, 0.95).toFixed(2),
    p99: +quantile(sorted, 0.99).toFixed(2),
    max: +(sorted[sorted.length - 1] ?? 0).toFixed(2),
    over167: samples.filter((d) => d > 16.7).length,
    over12: samples.filter((d) => d > 12).length,
    fps: +((samples.length / Math.max(1, durationMs)) * 1000).toFixed(1),
  };
}

let frameSamples: number[] = [];
let frameLabel = "";
let frameStart = 0;
let frameHandle: number | null = null;
let lastFrame = 0;

export function startFrames(label: string): void {
  stopFrames();
  frameSamples = [];
  frameLabel = label;
  frameStart = performance.now();
  lastFrame = frameStart;
  const tick = (now: number): void => {
    const d = now - lastFrame;
    lastFrame = now;
    // Discount the first frame (probe start is not a frame boundary) and any
    // resumption past the integrator's own 50ms accumulator clamp — the same
    // discount useFrameBudget already applies, for the same reason.
    if (frameSamples.length > 0 || d < 50) frameSamples.push(d);
    frameHandle = requestAnimationFrame(tick);
  };
  frameHandle = requestAnimationFrame(tick);
}

export function stopFrames(): FrameStats | null {
  if (frameHandle === null) return null;
  cancelAnimationFrame(frameHandle);
  frameHandle = null;
  const stats = summarise(frameLabel, frameSamples.slice(1), performance.now() - frameStart);
  return stats;
}

// ---------------------------------------------------------------------------
// acknowledgement latency
// ---------------------------------------------------------------------------

export interface AckSample {
  /** ms from the hardware event timestamp to the semantic commit. FLOOR: <=16. */
  commitMs: number;
  /** ms from the same event to the first frame painted after the commit. */
  paintMs: number;
  kind: string;
}

const acks: AckSample[] = [];

/**
 * Call the instant the model has been mutated and BEFORE any render work.
 * `eventTs` is the DOM event's own `timeStamp`, which shares performance.now()'s
 * time origin in every browser this product targets.
 */
export function recordCommit(kind: string, eventTs: number): void {
  const commitMs = performance.now() - eventTs;
  const sample: AckSample = { kind, commitMs: +commitMs.toFixed(2), paintMs: -1 };
  acks.push(sample);
  // rAF fires BEFORE paint; a task queued from inside it runs immediately AFTER
  // that same frame's paint. Double-rAF would have had a two-frame floor by
  // construction, which reads as a 33ms paint latency on a page that is in fact
  // painting in one frame — a measurement artefact reported as a defect.
  requestAnimationFrame(() => {
    setTimeout(() => {
      sample.paintMs = +(performance.now() - eventTs).toFixed(2);
    }, 0);
  });
}

/** Render cost: semantic commit -> React has finished mutating the DOM. */
const renderSamples: number[] = [];

export function recordRender(ms: number): void {
  renderSamples.push(+ms.toFixed(2));
}

export function renderStats(): FrameStats {
  return summarise("react-render", renderSamples, 0);
}

export function resetRender(): void {
  renderSamples.length = 0;
}

export function ackStats(): { n: number; commit: FrameStats; paint: FrameStats } {
  const commits = acks.map((a) => a.commitMs);
  const paints = acks.filter((a) => a.paintMs >= 0).map((a) => a.paintMs);
  return {
    n: acks.length,
    commit: summarise("ack-commit", commits, 0),
    paint: summarise("ack-paint", paints, 0),
  };
}

export function resetAcks(): void {
  acks.length = 0;
}

// ---------------------------------------------------------------------------
// layer / paint census
// ---------------------------------------------------------------------------

export interface LayerCensus {
  nodes: number;
  shadowNodes: number;
  shadowLayers: number;
  insetLayers: number;
  backdropFilterNodes: number;
  filterNodes: number;
  willChangeNodes: number;
  blendNodes: number;
  contentVisibilityAuto: number;
}

/** Split a box-shadow value on top-level commas — the recipe layers, not the
 *  commas inside rgb()/color() functions. */
export function countShadowLayers(value: string): number {
  if (!value || value === "none") return 0;
  let depth = 0;
  let n = 1;
  for (const ch of value) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) n++;
  }
  return n;
}

export function census(root: ParentNode = document): LayerCensus {
  const all = Array.from(root.querySelectorAll<HTMLElement>("*"));
  const out: LayerCensus = {
    nodes: all.length,
    shadowNodes: 0,
    shadowLayers: 0,
    insetLayers: 0,
    backdropFilterNodes: 0,
    filterNodes: 0,
    willChangeNodes: 0,
    blendNodes: 0,
    contentVisibilityAuto: 0,
  };
  for (const el of all) {
    const cs = getComputedStyle(el);
    const shadow = cs.boxShadow;
    const layers = countShadowLayers(shadow);
    if (layers > 0) {
      out.shadowNodes++;
      out.shadowLayers += layers;
      out.insetLayers += (shadow.match(/inset/g) ?? []).length;
    }
    const bd = cs.backdropFilter || (cs as unknown as Record<string, string>).webkitBackdropFilter;
    if (bd && bd !== "none") out.backdropFilterNodes++;
    if (cs.filter && cs.filter !== "none") out.filterNodes++;
    if (cs.willChange && cs.willChange !== "auto") out.willChangeNodes++;
    if (cs.mixBlendMode && cs.mixBlendMode !== "normal") out.blendNodes++;
    if ((cs as unknown as Record<string, string>).contentVisibility === "auto") out.contentVisibilityAuto++;
    // ::after carries the grain layer and the acrylic pane; count its shadows too.
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.content === "none" || ps.content === "normal") continue;
      const pl = countShadowLayers(ps.boxShadow);
      if (pl > 0) {
        out.shadowNodes++;
        out.shadowLayers += pl;
        out.insetLayers += (ps.boxShadow.match(/inset/g) ?? []).length;
      }
      const pbd = ps.backdropFilter || (ps as unknown as Record<string, string>).webkitBackdropFilter;
      if (pbd && pbd !== "none") out.backdropFilterNodes++;
      if (ps.filter && ps.filter !== "none") out.filterNodes++;
      if (ps.mixBlendMode && ps.mixBlendMode !== "normal") out.blendNodes++;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// contrast — measured, never eyeballed (the Floor: 4.5:1 text, 3:1 controls)
// ---------------------------------------------------------------------------

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(rgb: [number, number, number]): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function parseColor(value: string): [number, number, number] | null {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some((n) => Number.isNaN(n))) return null;
  return [parts[0]!, parts[1]!, parts[2]!];
}

export function contrast(a: string, b: string): number | null {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return null;
  const la = luminance(ca);
  const lb = luminance(cb);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
}

/** Walk up for the first non-transparent background — the ground the ink sits on. */
export function groundOf(el: Element): string {
  let node: Element | null = el;
  while (node) {
    const bg = getComputedStyle(node).backgroundColor;
    const rgba = bg.match(/rgba?\(([^)]+)\)/);
    if (rgba) {
      const parts = rgba[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
      const alpha = parts.length > 3 ? parts[3]! : 1;
      if (alpha > 0.9) return bg;
    }
    node = node.parentElement;
  }
  return "rgb(255, 255, 255)";
}

export interface ContrastRow {
  selector: string;
  sample: string;
  ink: string;
  ground: string;
  ratio: number | null;
  floor: number;
  pass: boolean;
}

export function measureContrast(pairs: { selector: string; floor: number }[]): ContrastRow[] {
  const rows: ContrastRow[] = [];
  for (const { selector, floor } of pairs) {
    const el = document.querySelector(selector);
    if (!el) {
      rows.push({ selector, sample: "(absent)", ink: "", ground: "", ratio: null, floor, pass: false });
      continue;
    }
    const cs = getComputedStyle(el);
    const ink = cs.color;
    const ground = groundOf(el);
    const ratio = contrast(ink, ground);
    rows.push({
      selector,
      sample: (el.textContent ?? "").trim().slice(0, 28),
      ink,
      ground,
      ratio,
      floor,
      pass: ratio !== null && ratio >= floor,
    });
  }
  return rows;
}

/** The Floor's 44px, both axes, on every interactive node in a subtree. */
export function measureTargets(selector: string): { total: number; failures: { text: string; w: number; h: number }[] } {
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const failures: { text: string; w: number; h: number }[] = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue; // not rendered (closed group)
    if (r.width < 44 || r.height < 44) {
      failures.push({ text: (el.textContent ?? el.tagName).trim().slice(0, 24), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
    }
  }
  return { total: els.length, failures };
}
