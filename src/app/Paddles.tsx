import { useStore } from "../state/store";
import { Paddle } from "../components/Paddle";

/** The two global paddles — week [a|b] and cover [her 70|him 85] — wired to prefs. */
export function Paddles() {
  const { state, dispatch } = useStore();
  const { week, cover } = state.prefs;

  return (
    <div className="fd5-paddles" role="group" aria-label="global settings">
      <Paddle
        name="week"
        checked={week === "B"}
        optionA={{ value: "A", label: "a" }}
        optionB={{ value: "B", label: "b" }}
        onToggle={() => dispatch({ type: "prefs/set", patch: { week: week === "A" ? "B" : "A" } })}
      />
      <Paddle
        name="cover"
        checked={cover === "m"}
        optionA={{ value: "w", label: "her 70" }}
        optionB={{ value: "m", label: "him 85" }}
        onToggle={() => dispatch({ type: "prefs/set", patch: { cover: cover === "w" ? "m" : "w" } })}
      />
    </div>
  );
}
