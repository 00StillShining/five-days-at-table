import type { SceneProps } from "../router";
import { PlaceholderCard } from "./PlaceholderCard";

export default function MealPlaceholder({ route }: SceneProps) {
  const id = route.params.id;
  return (
    <PlaceholderCard
      station="meal"
      note={id ? `scene lands in wave 1 · id: ${id}` : "scene lands in wave 1"}
    />
  );
}
