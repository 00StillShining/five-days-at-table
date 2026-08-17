/**
 * src/screens/cook/cook.test.ts — the claims this screen makes, pinned.
 *
 * Two things are tested here that were otherwise only asserted in prose.
 *
 * 1 · THE REEL'S HONESTY RULE. "Nothing turns without meaning, and nothing
 *     meaningful stands still" is the language's whole thesis, and both ways of
 *     breaking it are run-time failures nobody is watching for.
 *
 * 2 · REDUCED MOTION AS A TRANSLATION, NOT A DELETION. docs/BUILD-STATE.md
 *     records this as an OPEN VERIFICATION GAP for the whole product:
 *     "`prefers-reduced-motion` has never been verified by rendering under the
 *     media query — only by rule inspection. No tool available in this session
 *     can force the media feature ... Close it one of two ways: a confirming
 *     render on a machine with the setting on, or — better, because it then
 *     runs on every commit — an automated rule test over the built CSS
 *     asserting that every animated property has a translating (never deleting)
 *     counterpart inside the media block."
 *
 *     This is that test, for this screen's stylesheet. It is a text analysis of
 *     the source CSS rather than a render, which is a weaker instrument than a
 *     real render under the media feature and is stated as such — but it runs
 *     on every commit, and it catches the failure mode that actually happens:
 *     a motion added later with no entry in the reduced-motion block.
 */

import { describe, expect, it } from "vitest";
import { FONT } from "./glyphs";
import { lampBreathes, lampLit, reelSpins, transportWord } from "./reelState";

/*
  Reading the stylesheet as TEXT, and the two false starts that got here.

  `import css from "./cook.css?raw"` returns an EMPTY STRING under vitest: the
  runner does not process CSS by default, so a .css specifier resolves to the
  stub regardless of the ?raw suffix, and every assertion below passed
  vacuously against "". Measured: `@keyframes` count 0 on a file with four.

  node:fs is the honest reader, but this project's tsconfig sets
  `types: ["vite/client"]` with no node types, and tsconfig is not this
  screen's to edit. The suppressions are therefore deliberate and local: they
  cover the module specifier only, in a test file that never ships.
*/
// @ts-ignore — node types are deliberately absent from this project's tsconfig
import { readFileSync } from "node:fs";
// @ts-ignore
import { fileURLToPath } from "node:url";

const css: string = readFileSync(
  fileURLToPath(new URL("./cook.css", import.meta.url)),
  "utf8"
);

function block(header: string): string {
  const at = css.indexOf(header);
  if (at < 0) return "";
  let depth = 0;
  let i = css.indexOf("{", at);
  const start = i;
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(start, i);
    }
  }
  return "";
}

describe("the reel reports the process, and only the process", () => {
  it("turns only while the program is actually advancing", () => {
    expect(reelSpins("running", false)).toBe(true);
    expect(reelSpins("running", true)).toBe(false); // waiting for a hand
    expect(reelSpins("paused", false)).toBe(false);
    expect(reelSpins("idle", false)).toBe(false);
    expect(reelSpins("complete", false)).toBe(false);
  });

  it("never turns on a stopped process — no ambient theft", () => {
    const stopped: Array<Parameters<typeof reelSpins>[0]> = ["idle", "paused", "complete"];
    for (const s of stopped) {
      expect(reelSpins(s, false)).toBe(false);
      expect(reelSpins(s, true)).toBe(false);
    }
  });

  it("gives a paused-and-overdue deck the operator's word, not the clock's", () => {
    // Both facts are true. HOLD is the one the operator caused; the DUE
    // condition is the annunciator's to carry, so no two instruments print one
    // fact and no fact goes unprinted.
    expect(transportWord("paused", true)).toBe("HOLD");
    expect(transportWord("running", true)).toBe("WAIT");
    expect(transportWord("running", false)).toBe("RUN");
    expect(transportWord("idle", false)).toBe("READY");
  });

  it("lights the lamp on exactly the chassis rec-dot's own condition", () => {
    expect(lampLit("running")).toBe(true);
    expect(lampLit("paused")).toBe(false);
    expect(lampLit("idle")).toBe(false);
    expect(lampLit("complete")).toBe(false);
  });

  it("breathes only for a process actually running (II.4.11)", () => {
    expect(lampBreathes("running", false)).toBe(true);
    expect(lampBreathes("running", true)).toBe(false); // lit, but steady
    expect(lampBreathes("paused", false)).toBe(false);
  });
});

describe("the dot-matrix can actually print what this screen sends it", () => {
  /*
    THIS TEST EXISTS BECAUSE THE BUILD SHIPPED THE BUG IT CATCHES. W was never
    cast, so the strip printed the transport word WAIT with a blank first cell
    and the operator read "AIT". An uncast glyph fails silently by construction
    — the fallback IS a blank — so the only place it can be caught is here.
  */
  const WORDS = ["READY", "RUN", "WAIT", "HOLD", "DONE", "OVERDUE", "HELD", "NO SIGNAL"];

  it("casts every character of every word COOK can print", () => {
    for (const word of WORDS) {
      for (const ch of word) {
        expect(FONT[ch.toUpperCase()], `'${ch}' (in ${word}) is not cast`).toBeDefined();
      }
    }
  });

  it("casts every character every transport state can produce", () => {
    const states = ["idle", "running", "paused", "complete"] as const;
    for (const s of states) {
      for (const due of [true, false]) {
        for (const ch of transportWord(s, due)) {
          expect(FONT[ch.toUpperCase()], `'${ch}' is not cast`).toBeDefined();
        }
      }
    }
  });

  it("casts the digits and the separator every clock uses", () => {
    for (const ch of "0123456789:-") expect(FONT[ch]).toBeDefined();
  });

  it("keeps every glyph a real 5x7 cell (II.3.21)", () => {
    for (const [name, rows] of Object.entries(FONT)) {
      expect(rows.length, `${name} is not 7 rows`).toBe(7);
      for (const row of rows) expect(row.length, `${name} has a row that is not 5 cells`).toBe(5);
      for (const row of rows) expect(/^[01]{5}$/.test(row), `${name} has a non-binary row`).toBe(true);
    }
  });
});

describe("reduced motion is a translation, never a deletion (II.4.26)", () => {
  const reduced = block("@media (prefers-reduced-motion: reduce)");

  it("declares a reduced-motion block at all", () => {
    expect(reduced.length).toBeGreaterThan(0);
  });

  it("names every keyframe animation this screen owns", () => {
    // Every @keyframes defined in this stylesheet must be accounted for in the
    // reduced dialect — either stopped, or explicitly kept with a reason.
    const declared = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(0);
    const selectorsInReduced = reduced;
    const handled = {
      "ck-reel-spin": /\.ck-grip\s*\{[^}]*animation:\s*none/.test(selectorsInReduced),
      "ck-pulse": /\.ck-lamp\.cd-pulse\s*\{[^}]*animation:\s*none/.test(selectorsInReduced),
      "ck-ann-flash": /\.ck-ann\[data-ck-firing="true"\]\s*\{[^}]*animation:\s*none/.test(
        selectorsInReduced
      ),
      "ck-trophy-dim": /\.ck-trophy-face\s*\{[^}]*animation:\s*none/.test(selectorsInReduced),
    };
    for (const name of declared) {
      expect(handled[name as keyof typeof handled], `@keyframes ${name} is unhandled`).toBe(true);
    }
  });

  it("keeps the warning's COLOUR half when it drops its flash", () => {
    // II.4.26 Pushed: "keep the color half of every pair — the warning still
    // saturates". A reduced-motion alarm that only stopped flashing would have
    // lost a channel, not translated one.
    expect(/\.ck-ann\[data-ck-firing="true"\][\s\S]{0,240}background:\s*var\(--cd-role-danger\)/.test(reduced)).toBe(true);
  });

  it("still MOVES the position that carries meaning", () => {
    // "Position that carries meaning still changes ... over an 80ms linear
    // slide, because position is semantic and the semantic layer is not
    // negotiable." A lane's fill IS the reading.
    expect(/\.ck-lane-fill\s*\{[^}]*transition-duration:\s*var\(--cd-reduced-position\)/.test(reduced)).toBe(true);
    expect(/\.ck-lane-fill\s*\{[^}]*display:\s*none/.test(reduced)).toBe(false);
  });

  it("never replaces a motion with a 0ms flash", () => {
    // "never flash — a 0ms swap of a screen-sized region is the one move worse
    // than the motion it replaced."
    expect(/transition-duration:\s*0m?s\b/.test(reduced)).toBe(false);
    expect(/animation-duration:\s*0m?s\b/.test(reduced)).toBe(false);
  });
});

describe("the shed ladder still bites on this screen (II.4.12)", () => {
  it("re-states the pulse pause, because cd.screen outranks cd.motion", () => {
    // tokens/motion.css pauses .cd-pulse at every stage, but this stylesheet
    // lands in a LATER layer and writes an `animation:` shorthand, which resets
    // play-state to running. Without these rules the ladder would silently stop
    // working here.
    for (const stage of [1, 2, 3]) {
      expect(css.includes(`html[data-cd-shed="${stage}"] .ck-lamp.cd-pulse`)).toBe(true);
    }
  });

  it("never sheds contact, detent, sweep or warning", () => {
    const shedRules = css
      .split("\n")
      .filter((line: string) => line.includes('html[data-cd-shed'))
      .join("\n");
    // the disc's own rate is the state report, not ambient garnish, and the
    // annunciator's flash is the warning presentation
    expect(shedRules.includes(".ck-grip")).toBe(false);
    expect(shedRules.includes(".ck-ann")).toBe(false);
  });
});

describe("forced colours are rendered, not merely survived", () => {
  const forced = block("@media (forced-colors: active)");

  it("declares a forced-colours block", () => {
    expect(forced.length).toBeGreaterThan(0);
  });

  it("keeps the lit/unlit distinction, which IS the reading", () => {
    // A dot-matrix, an arc and a meter all report by lit-vs-unlit. If the OS
    // palette flattens both states to one, the instruments stop reporting.
    expect(/\.ck-arc-cell\[data-on="true"\][\s\S]{0,200}background:\s*Highlight/.test(forced)).toBe(true);
    expect(forced.includes("HighlightText")).toBe(true);
  });
});
