// Barrel: everything screens/state/engine need from the canonical dataset.
// The UI must contain no food facts — it imports typed accessors from here
// (or from the individual modules), never data/*.json directly.
export * from "./types";
export * from "./ingredients";
export * from "./meals";
export * from "./prep";
export * from "./calendar";
export * from "./plan";
export * from "./yieldMap";
export * from "./lifeEstimate";
export * from "./variant";
export * from "./variantMorrisons";
