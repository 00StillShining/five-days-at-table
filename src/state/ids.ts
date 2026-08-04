// Synthetic id generation, split out from reducer.ts so it has no dependents
// that would create an import cycle (state/prepCompletion.ts needs it too).
let idCounter = 0;

/** Deterministic-enough synthetic id: timestamp + a monotonic counter, so two
 * entries added within the same millisecond (tests, fast taps) still differ. */
export function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}
