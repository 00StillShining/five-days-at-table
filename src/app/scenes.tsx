import type { ComponentType } from "react";
import type { ScreenId, SceneProps } from "./router";

// Screen builders: swap ONLY the import line for your screen below to point at your
// real src/screens/<name>/... component (keep the default export + SceneProps
// signature: { route: Route }). Nothing else in this file should need to change.
import TodayScene from "../screens/today";
import PlanScene from "../screens/plan";
import MealScene from "../screens/meal";
import CookScene from "../screens/cook";
import StoresScene from "../screens/stores";
import ShopScene from "../screens/shop";
import ListScene from "../screens/list";

export const sceneRegistry: Record<ScreenId, ComponentType<SceneProps>> = {
  today: TodayScene,
  plan: PlanScene,
  meal: MealScene,
  cook: CookScene,
  stores: StoresScene,
  shop: ShopScene,
  list: ListScene,
};
