// Shared by the admin scorecard and the public live view. `celebration` is
// either null or { type: 'four'|'six'|'wicket'|'onhattrick'|'hattrick'|'noball', key }
// — the key changes on every trigger so React remounts the element and the
// CSS animation restarts even if the same type fires twice in a row.
export default function CelebrationOverlay({ celebration }) {
  if (!celebration) return null;
  return (
    <div className={`celebration-overlay celebration-${celebration.type}`} key={celebration.key}>
      <div className="celebration-content">
        {celebration.type === 'four' && <span className="celebration-text">FOUR!</span>}
        {celebration.type === 'six' && <span className="celebration-text">SIX!</span>}
        {celebration.type === 'wicket' && <span className="celebration-text">🎯 WICKET!</span>}
        {celebration.type === 'onhattrick' && <span className="celebration-text">🎩 ON A HAT-TRICK!</span>}
        {celebration.type === 'hattrick' && <span className="celebration-text">🎩 HAT-TRICK WICKETS!</span>}
        {celebration.type === 'noball' && <span className="celebration-text">🚫 NO BALL!</span>}
      </div>
    </div>
  );
}
