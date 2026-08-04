import type { ComponentType } from "react";
import type { ScreenId, SceneProps } from "./router";

// Screen builders: swap ONLY the import line for your screen below to point at your
// real src/screens/<name>/... component (keep the default export + SceneProps
// signature: { route: Route }). Nothing else in this file should need to change.
import TodayScene from "./scenes/TodayPlaceholder";
import PlanScene from "./scenes/PlanPlaceholder";
import MealScene from "./scenes/MealPlaceholder";
import CookScene from "./scenes/CookPlaceholder";
import StoresScene from "./scenes/StoresPlaceholder";
import ShopScene from "./scenes/ShopPlaceholder";
import ListScene from "./scenes/ListPlaceholder";

export const sceneRegistry: Record<ScreenId, ComponentType<SceneProps>> = {
  today: TodayScene,
  plan: PlanScene,
  meal: MealScene,
  cook: CookScene,
  stores: StoresScene,
  shop: ShopScene,
  list: ListScene,
};
