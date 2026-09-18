import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PublicAPI } from '../api/client.js';
import PlayerAvatar from '../components/PlayerAvatar.jsx';
import { getCategoryMeta } from '../utils/categoryMeta.js';

function PlayerGrid({ players }) {
  return (
    <div className="player-tile-grid">
      {players.map((player) => {
        const meta = getCategoryMeta(player.category);
        return (
          <div className="player-tile" key={player.id}>
            <PlayerAvatar player={player} size="tile" />
            <p className="player-tile-name">{player.name}</p>
            <span className={`chip ${meta.chip}`}>
              {meta.icon} {player.category}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function PublicAuctionView() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [auction, setAuction] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    PublicAPI.getCompletedAuction(roomId)
      .then(setAuction)
      .catch(() => setError('This auction could not be found.'));
  }, [roomId]);

  if (error) {
    return (
      <div className="page">
        <button className="link-btn back-link" onClick={() => navigate('/')}>← Back to Live Matches</button>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="page">
        <div className="skeleton-card" style={{ height: 180 }} />
      </div>
    );
  }

  const totalPlayers = auction.teams.reduce((sum, t) => sum + t.players.length, 0) + auction.unsold.length;

  return (
    <div className="page">
      <button className="link-btn back-link" onClick={() => navigate('/')}>← Back to Live Matches</button>

      <section className="card room-summary">
        <h2>{auction.name}</h2>
        <p className="hint-text">
          {new Date(auction.auction_date).toLocaleDateString()} · {auction.num_teams} teams · {totalPlayers} players
        </p>
      </section>

      {totalPlayers === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏏</div>
          <h4>No players added</h4>
        </div>
      ) : (
        <>
          {auction.teams.map((team) => (
            <section className="card" key={team.id}>
              <div className="fixture-group-title" style={{ marginBottom: 16 }}>
                <span className="fixture-team-logo fixture-team-logo-lg">
                  {team.logo_path ? (
                    <img src={`${import.meta.env.VITE_API_URL}${team.logo_path}`} alt="" />
                  ) : (
                    '🛡️'
                  )}
                </span>
                <h3 style={{ margin: 0 }}>{team.team_name}</h3>
              </div>
              <PlayerGrid players={team.players} />
            </section>
          ))}

          {auction.unsold.length > 0 && (
            <section className="card">
              <h3 style={{ marginTop: 0 }}>Unsold</h3>
              <PlayerGrid players={auction.unsold} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
