import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuctionRoomsAPI, PlayersAPI, FixturesAPI, MatchAPI } from '../api/client.js';
import PlayerAvatar from '../components/PlayerAvatar.jsx';
import StartMatchModal from '../components/StartMatchModal.jsx';
import MatchScorecardSummary from '../components/MatchScorecardSummary.jsx';
import { getCategoryMeta } from '../utils/categoryMeta.js';

function TeamRosterGrid({ players }) {
  if (players.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🏏</div>
        <h4>No players on this team yet</h4>
        <p>Players this team wins in the auction will show up here.</p>
      </div>
    );
  }

  return (
    <div className="roster-player-grid">
      {players.map((player) => {
        const meta = getCategoryMeta(player.category);
        return (
          <div className="roster-player-card" key={player.id}>
            <PlayerAvatar player={player} size="lg" />
            <div className="roster-player-name">{player.name}</div>
            <span className={`chip ${meta.chip} icon-tooltip`} data-tooltip={player.category}>
              {meta.icon} {player.category}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function MatchDetail() {
  const { roomId, fixtureId } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [fixture, setFixture] = useState(null);
  const [matchState, setMatchState] = useState(null);
  const [players, setPlayers] = useState([]);
  const [activeTeam, setActiveTeam] = useState('team1');
  const [error, setError] = useState('');
  const [showStartModal, setShowStartModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [roomData, fixtureData, playersData] = await Promise.all([
          AuctionRoomsAPI.get(roomId),
          FixturesAPI.get(roomId, fixtureId),
          PlayersAPI.list(roomId)
        ]);
        setRoom(roomData);
        setPlayers(playersData);
        setFixture(fixtureData);
        if (fixtureData.match_status !== 'not_started') {
          setMatchState(await MatchAPI.get(roomId, fixtureId));
        }
      } catch (err) {
        setError('That fixture could not be found.');
      }
    })();
  }, [roomId, fixtureId]);

  if (error) {
    return (
      <div className="page">
        <button className="link-btn back-link" onClick={() => navigate(`/rooms/${roomId}`, { state: { tab: 'tournament' } })}>
          ← Back to Tournaments
        </button>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!room || !fixture) {
    return (
      <div className="page">
        <div className="skeleton-card" style={{ height: 140 }} />
      </div>
    );
  }

  const rosterReady = room.status === 'completed';
  const teamsResolved = !!fixture.team1_id && !!fixture.team2_id;
  const team1Label = fixture.team1_name || fixture.team1_placeholder || 'TBD';
  const team2Label = fixture.team2_name || fixture.team2_placeholder || 'TBD';
  const team1Players = players.filter((p) => p.team_id === fixture.team1_id);
  const team2Players = players.filter((p) => p.team_id === fixture.team2_id);

  const handleStartMatch = async (payload) => {
    await MatchAPI.start(roomId, fixtureId, payload);
    navigate(`/rooms/${roomId}/fixtures/${fixtureId}/scorecard`);
  };

  return (
    <div className="page">
      <button
        className="link-btn back-link"
        onClick={() => navigate(`/rooms/${roomId}/tournaments/${fixture.tournament_id}`, { state: { tab: 'fixture' } })}
      >
        ← Back to Tournament
      </button>

      <section className="card match-detail-header">
        <span className="fixture-order-badge">M{fixture.match_order}{fixture.pool_name ? ` · ${fixture.pool_name}` : ''}</span>
        <div className="match-detail-teams">
          <div className="match-detail-team">
            <span className="fixture-team-logo fixture-team-logo-lg">
              {fixture.team1_logo ? <img src={fixture.team1_logo} alt={`${team1Label} logo`} /> : '🛡️'}
            </span>
            <h3 className={!fixture.team1_name ? 'fixture-team-tbd-heading' : ''}>{team1Label}</h3>
          </div>
          <span className="match-detail-vs">VS</span>
          <div className="match-detail-team">
            <span className="fixture-team-logo fixture-team-logo-lg">
              {fixture.team2_logo ? <img src={fixture.team2_logo} alt={`${team2Label} logo`} /> : '🛡️'}
            </span>
            <h3 className={!fixture.team2_name ? 'fixture-team-tbd-heading' : ''}>{team2Label}</h3>
          </div>
        </div>

        {!teamsResolved && (
          <p className="hint-text" style={{ marginTop: 14 }}>
            ⏳ Waiting for both teams to be determined before this match can start.
          </p>
        )}
        {teamsResolved && rosterReady && !fixture.fixtures_finalized && fixture.match_status === 'not_started' && (
          <p className="hint-text" style={{ marginTop: 14 }}>
            🔒 Fixtures must be finalized before this match can start.
          </p>
        )}
        {teamsResolved && rosterReady && !!fixture.fixtures_finalized && fixture.match_status === 'not_started' && (
          <button className="btn btn-accent" style={{ marginTop: 18 }} onClick={() => setShowStartModal(true)}>
            🏏 Start Match
          </button>
        )}
        {fixture.match_status === 'live' && (
          <button className="btn btn-accent" style={{ marginTop: 18 }} onClick={() => navigate(`/rooms/${roomId}/fixtures/${fixtureId}/scorecard`)}>
            ▶ Continue Scoring
          </button>
        )}
        {fixture.match_status === 'completed' && (
          <button className="btn btn-secondary" style={{ marginTop: 18 }} onClick={() => navigate(`/rooms/${roomId}/fixtures/${fixtureId}/scorecard`)}>
            📋 View Full Scorecard
          </button>
        )}
      </section>

      {error && <p className="error-text">{error}</p>}

      {fixture.match_status === 'completed' && matchState && (
        <section className="card">
          <MatchScorecardSummary match={matchState} />
        </section>
      )}

      {!teamsResolved ? (
        <section className="card">
          <p className="hint-text" style={{ textAlign: 'center', padding: '12px 0' }}>
            ⏳ Team rosters will show here once both teams for this match are determined.
          </p>
        </section>
      ) : !rosterReady ? (
        <section className="card">
          <p className="hint-text" style={{ textAlign: 'center', padding: '12px 0' }}>
            🔒 Team rosters will show here once the auction is completed.
          </p>
        </section>
      ) : (
        <section className="card">
          <div className="tabs">
            <button
              className={`tab-btn ${activeTeam === 'team1' ? 'active' : ''}`}
              onClick={() => setActiveTeam('team1')}
            >
              🛡️ {team1Label} <span className="tab-count">{team1Players.length}</span>
            </button>
            <button
              className={`tab-btn ${activeTeam === 'team2' ? 'active' : ''}`}
              onClick={() => setActiveTeam('team2')}
            >
              🛡️ {team2Label} <span className="tab-count">{team2Players.length}</span>
            </button>
          </div>

          <div style={{ marginTop: 20 }}>
            <TeamRosterGrid players={activeTeam === 'team1' ? team1Players : team2Players} />
          </div>
        </section>
      )}

      {showStartModal && (
        <StartMatchModal
          team1={{ id: fixture.team1_id, team_name: fixture.team1_name, logo_path: fixture.team1_logo }}
          team2={{ id: fixture.team2_id, team_name: fixture.team2_name, logo_path: fixture.team2_logo }}
          onClose={() => setShowStartModal(false)}
          onStart={handleStartMatch}
        />
      )}
    </div>
  );
}
