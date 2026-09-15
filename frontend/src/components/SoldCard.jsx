import { useEffect, useRef, useState } from 'react';
import PlayerAvatar from './PlayerAvatar.jsx';
import { getCategoryMeta, formatCurrency } from '../utils/categoryMeta.js';

// Total on-screen lifetime: ~1.4s held front-and-center, then a 0.6s flight
// into the winning team's card — matching the "visible 2 seconds, then flies
// into the team" requirement. `targetEl` is read lazily (via a ref getter,
// not a snapshot) since the grid can reflow between trigger and flight.
const HOLD_MS = 1400;
const FLIGHT_MS = 600;

export default function SoldCard({ sale, getTeamCardEl, onDone }) {
  const cardRef = useRef(null);
  // 'enter' -> 'entered' -> 'flying', each step driven by the SAME CSS
  // transition (see .sold-card / .sold-card-entered / .sold-card-flying) —
  // deliberately no keyframe animation on this element, see styles.css.
  const [phase, setPhase] = useState('enter');
  const [flightStyle, setFlightStyle] = useState({});

  useEffect(() => {
    if (!sale) return undefined;
    setPhase('enter');
    setFlightStyle({});

    // Two rAFs, not one: the browser needs to actually paint the "enter"
    // (opacity:0, scaled-down) style at least once before switching classes,
    // or the transition has no starting point to animate from.
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPhase('entered'));
    });

    const flyTimer = setTimeout(() => {
      const cardEl = cardRef.current;
      const targetEl = getTeamCardEl?.(sale.team.id);
      if (cardEl && targetEl) {
        const cardRect = cardEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const dx = targetRect.left + targetRect.width / 2 - (cardRect.left + cardRect.width / 2);
        const dy = targetRect.top + targetRect.height / 2 - (cardRect.top + cardRect.height / 2);
        setFlightStyle({ '--sold-dx': `${dx}px`, '--sold-dy': `${dy}px` });
      }
      setPhase('flying');
    }, HOLD_MS);

    const doneTimer = setTimeout(() => onDone(), HOLD_MS + FLIGHT_MS);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(flyTimer);
      clearTimeout(doneTimer);
    };
  }, [sale, getTeamCardEl, onDone]);

  if (!sale) return null;

  const meta = getCategoryMeta(sale.player.category);

  return (
    <div className="sold-card-overlay">
      <div ref={cardRef} className={`sold-card sold-card-${phase}`} style={flightStyle}>
        <div className="sold-stamp">SOLD!</div>
        <PlayerAvatar player={sale.player} size="xl" />
        <h3 className="sold-card-name">{sale.player.name}</h3>
        <span className={`chip ${meta.chip}`}>
          {meta.icon} {sale.player.category}
        </span>
        <div className="sold-card-divider" />
        <div className="sold-card-team">
          <span className="sold-card-team-logo">
            {sale.team.logo_path ? <img src={sale.team.logo_path} alt="" /> : '🛡️'}
          </span>
          <div>
            <div className="sold-card-team-label">Sold to</div>
            <div className="sold-card-team-name">{sale.team.team_name}</div>
          </div>
        </div>
        <div className="sold-card-price">{formatCurrency(sale.price)}</div>
      </div>
    </div>
  );
}
