import type { SceneProps } from "../router";
import { PlaceholderCard } from "./PlaceholderCard";

/**
 * COOK is the one precision-industrial screen (PLAN §6.0). Its scene root carries
 * data-language="precision-industrial" to locally override the .fd5 tokens for this
 * subtree only — the persistent chassis (masthead/paddles) stays in the playful
 * light base. Future COOK screen builder: keep this attribute on your real scene
 * root when you swap the import in src/app/scenes.tsx.
 */
export default function CookPlaceholder(_props: SceneProps) {
  return (
    <div className="fd5 fd5-scene-cook" data-language="precision-industrial">
      <PlaceholderCard station="cook" note="lid-closed · scene lands in wave 1" />
    </div>
  );
}
