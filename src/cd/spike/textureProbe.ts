/**
 * src/cd/spike/textureProbe.ts — what the texture cache actually saved.
 *
 * src/cd/material/textures.ts caches by {pattern, scale, dpr, strength} and
 * exposes `textureCacheSize()` but no hit/miss counters. Rather than edit the
 * landed foundation (it is not mine to edit — the needed change is reported
 * instead), the spike wraps every call and infers the outcome from the cache
 * size before and after, plus a wall-clock paint time on the miss.
 *
 * MITIGATION 2 under test: "one cached canvas texture per family — never per
 * row." The `perRow` mode below deliberately breaks the key (scale varies with
 * the row index) so the cost of getting this wrong is a measured number rather
 * than a warning in a comment.
 */

import { texture, textureCacheSize, type TextureRequest } from "../material/textures";

export interface TextureLedger {
  calls: number;
  hits: number;
  misses: number;
  paintMsTotal: number;
  paintMsMax: number;
  distinctKeys: number;
}

const ledger: TextureLedger = { calls: 0, hits: 0, misses: 0, paintMsTotal: 0, paintMsMax: 0, distinctKeys: 0 };

export function tex(request: TextureRequest): string | null {
  const before = textureCacheSize();
  const t0 = performance.now();
  const url = texture(request);
  const dt = performance.now() - t0;
  const after = textureCacheSize();
  ledger.calls++;
  if (after > before) {
    ledger.misses++;
    ledger.paintMsTotal += dt;
    ledger.paintMsMax = Math.max(ledger.paintMsMax, dt);
  } else {
    ledger.hits++;
  }
  ledger.distinctKeys = after;
  return url;
}

export function textureLedger(): TextureLedger {
  return {
    ...ledger,
    paintMsTotal: +ledger.paintMsTotal.toFixed(2),
    paintMsMax: +ledger.paintMsMax.toFixed(2),
  };
}

export function resetLedger(): void {
  ledger.calls = 0;
  ledger.hits = 0;
  ledger.misses = 0;
  ledger.paintMsTotal = 0;
  ledger.paintMsMax = 0;
}
