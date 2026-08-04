// The till odometer — LIST's hero (PLAN §6.9/§6.10): rolling digit drums for
// total-spent-so-far on every tick. Each digit is a 10-row strip translated
// by -digit * (1 digit height); tokens.css's global `[data-motion]` rule
// already collapses that transform's transition to ~0 under
// prefers-reduced-motion (same mechanism PLAN's AdherenceGauge needle uses —
// no reduced-motion-specific code needed here at all). The rolled value is
// purely decorative (aria-hidden); the plain-text readout right below it is
// the ALWAYS-present, aria-live="polite" source of truth (PLAN: "value
// ALWAYS plain text too").
import { formatPence } from "./model";

const DIGITS = "0123456789".split("");

function DigitDrum({ digit }: { digit: string }) {
  const n = Number(digit);
  return (
    <span className="scr-list-odo-digit" aria-hidden="true">
      <span className="scr-list-odo-strip" data-motion style={{ transform: `translateY(${-n * 10}%)` }}>
        {DIGITS.map((d) => (
          <span key={d} className="scr-list-odo-face">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

export interface OdometerProps {
  pence: number;
  got: number;
  total: number;
}

export function Odometer({ pence, got, total }: OdometerProps) {
  const { poundsDigits, penceDigits, plain } = formatPence(pence);

  return (
    <div className="scr-list-odo">
      <div className="scr-list-odo-drums">
        <span className="scr-list-odo-currency" aria-hidden="true">
          £
        </span>
        {poundsDigits.split("").map((d, i) => (
          <DigitDrum key={`p${i}`} digit={d} />
        ))}
        <span className="scr-list-odo-dot" aria-hidden="true">
          .
        </span>
        {penceDigits.split("").map((d, i) => (
          <DigitDrum key={`d${i}`} digit={d} />
        ))}
      </div>
      <p className="scr-list-odo-text" role="status" aria-live="polite">
        {plain}, {got} of {total}
      </p>
    </div>
  );
}
