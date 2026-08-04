export interface PlaceholderCardProps {
  station: string;
  note?: string;
}

/** Plain tokened placeholder scene — replaced screen-by-screen as Phase 2 waves land. */
export function PlaceholderCard({ station, note }: PlaceholderCardProps) {
  return (
    <div className="fd5-placeholder-card">
      <p className="fd5-placeholder-station">{station}</p>
      <p className="fd5-placeholder-note">{note ?? "scene lands in wave 1"}</p>
    </div>
  );
}
