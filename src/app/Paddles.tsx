import { useStore } from "../state/store";
import { Paddle } from "../components/Paddle";

/** The two global paddles — week [a|b] and cover [her 70|him 85] — wired to prefs. */
export function Paddles() {
  const { state, dispatch } = useStore();
  const { week, cover } = state.prefs;
  const weekValueLabel = week === "B" ? "b" : "a";
  const coverValueLabel = cover === "m" ? "him 85" : "her 70";

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
      {/*
        Each Paddle keeps a stable aria-label (atlas §4.4 switch rule). Since on/off
        doesn't map to a/b or her/him for assistive tech, the current VALUE is
        announced here instead, in one shared live region for the whole group.
      */}
      <span className="fd5-visually-hidden" role="status" aria-live="polite">
        {`week: ${weekValueLabel} · cover: ${coverValueLabel}`}
      </span>
    </div>
  );
}
