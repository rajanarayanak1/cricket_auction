import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PublicAPI } from '../api/client.js';

function FixtureTeamBadge({ name, logo, placeholder }) {
  const label = name || placeholder || 'TBD';
  return (
    <div className={`fixture-team ${!name ? 'fixture-team-tbd' : ''}`}>
      <span className="fixture-team-logo">
        {logo ? <img src={logo} alt={`${label} logo`} /> : '🛡️'}
      </span>
      <span className="fixture-team-name">{label}</span>
    </div>
  );
}

export default function PublicTournamentView() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    PublicAPI.getTournament(tournamentId)
      .then(setTournament)
      .catch(() => setError('This tournament could not be found.'));
  }, [tournamentId]);

  if (error) {
    return (
      <div className="page">
        <button className="link-btn back-link" onClick={() => navigate('/')}>← Back to Live Matches</button>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="page">
        <div className="skeleton-card" style={{ height: 180 }} />
      </div>
    );
  }

  const finalFixture = tournament.fixtures.find((f) => f.stage === 'final');
  const tournamentWinner = finalFixture?.match_status === 'completed' ? finalFixture.winner_team_name : null;

  const groups = tournament.fixtures.reduce((acc, f) => {
    const key = f.pool_name || 'Round Robin Schedule';
    (acc[key] = acc[key] || []).push(f);
    return acc;
  }, {});

  return (
    <div className="page">
      <button className="link-btn back-link" onClick={() => navigate('/')}>← Back to Live Matches</button>

      <section className="card room-summary">
        <h2>{tournament.name}</h2>
        <div className="room-meta">
          <span className={`badge ${tournament.is_completed ? 'badge-completed' : 'badge-live'}`}>
            {tournament.is_completed ? '✅ Completed' : '🔴 Ongoing'}
          </span>
        </div>
        {tournamentWinner && (
          <p className="tournament-card-winner" style={{ marginTop: 12 }}>
            🏆 {tournamentWinner} won{tournament.player_of_tournament_name ? ` · 🌟 ${tournament.player_of_tournament_name}` : ''}
          </p>
        )}
      </section>

      {error && <p className="error-text">{error}</p>}

      {tournament.fixtures.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏆</div>
          <h4>No fixtures yet</h4>
          <p>This tournament's schedule hasn't been generated yet.</p>
        </div>
      ) : (
        Object.entries(groups).map(([groupName, matches]) => (
          <section className="card" key={groupName}>
            <div className="fixture-group">
              <h3 className="fixture-group-title">{groupName}</h3>
              <div className="fixture-list">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="fixture-row"
                    onClick={() => navigate(`/live/${match.id}`)}
                  >
                    <span className="fixture-order-badge">M{match.match_order}</span>
                    <FixtureTeamBadge name={match.team1_name} logo={match.team1_logo} placeholder={match.team1_placeholder} />
                    <span className="fixture-vs">vs</span>
                    <FixtureTeamBadge name={match.team2_name} logo={match.team2_logo} placeholder={match.team2_placeholder} />
                    <span className="chip chip-outline">
                      {match.match_status === 'completed' ? '✅ Completed' : match.match_status === 'live' ? '🔴 Live' : '⏳ Not Started'}
                    </span>
                    <span className="fixture-row-arrow">›</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
