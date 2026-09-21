import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { TournamentsAPI, PointsTableAPI, StatsAPI, TeamsAPI } from '../api/client.js';
import CreateFixtureModal from '../components/CreateFixtureModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

function FixtureTeamBadge({ name, logo, placeholder }) {
  const label = name || placeholder || 'TBD';
  return (
    <div className={`fixture-team ${!name ? 'fixture-team-tbd' : ''}`}>
      <span className="fixture-team-logo">
        {logo ? <img src={`${import.meta.env.VITE_API_URL}${logo}`} alt={`${label} logo`} /> : '🛡️'}
      </span>
      <span className="fixture-team-name">{label}</span>
    </div>
  );
}

export default function TournamentDetail() {
  const { roomId, tournamentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [tournament, setTournament] = useState(null);
  const [teamCount, setTeamCount] = useState(0);
  const [pointsTable, setPointsTable] = useState([]);
  const [stats, setStats] = useState({ topBatsmen: [], topBowlers: [] });
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'fixture');
  const [error, setError] = useState('');
  const [showFixtureModal, setShowFixtureModal] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');

  const loadAll = async () => {
    try {
      const [tournamentData, pointsTableData, statsData] = await Promise.all([
        TournamentsAPI.get(roomId, tournamentId),
        PointsTableAPI.get(roomId, tournamentId),
        StatsAPI.get(roomId, tournamentId)
      ]);
      setTournament(tournamentData);
      setPointsTable(pointsTableData);
      setStats(statsData);
    } catch (err) {
      setError('Failed to load this tournament.');
    }
  };

  useEffect(() => {
    loadAll();
  }, [roomId, tournamentId]);

  // Only needed to size/enable the Pool Play option in the regenerate modal
  // — reuses the same team roster the room's auction already built.
  useEffect(() => {
    TeamsAPI.list(roomId).then((t) => setTeamCount(t.length));
  }, [roomId]);

  const handleRegenerateFixtures = async (payload) => {
    const updated = await TournamentsAPI.regenerateFixtures(roomId, tournamentId, payload);
    setTournament(updated);
    setShowFixtureModal(false);
  };

  const handleFinalizeFixtures = async () => {
    setFinalizing(true);
    setFinalizeError('');
    try {
      const updated = await TournamentsAPI.finalize(roomId, tournamentId);
      setTournament(updated);
      setShowFinalizeConfirm(false);
    } catch (err) {
      setFinalizeError(err.response?.data?.message || 'Failed to finalize fixtures.');
    } finally {
      setFinalizing(false);
    }
  };

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

  if (!tournament) {
    return (
      <div className="page">
        <div className="skeleton-card" style={{ height: 140 }} />
      </div>
    );
  }

  const fixtures = tournament.fixtures;
  const finalFixture = fixtures.find((f) => f.stage === 'final');
  const tournamentWinner = finalFixture?.match_status === 'completed' ? finalFixture.winner_team_name : null;

  return (
    <div className="page">
      <button className="link-btn back-link" onClick={() => navigate(`/rooms/${roomId}`, { state: { tab: 'tournament' } })}>
        ← Back to Tournaments
      </button>

      {tournamentWinner && (
        <section className="tournament-winner-banner">
          <span className="tournament-winner-icon">🏆</span>
          <div>
            <div className="tournament-winner-title">{tournamentWinner} won {tournament.name}!</div>
            {tournament.player_of_tournament_name && (
              <div className="tournament-winner-pot">
                🌟 Player of the Tournament: <strong>{tournament.player_of_tournament_name}</strong>
              </div>
            )}
            <button className="link-btn" onClick={() => navigate(`/rooms/${roomId}/fixtures/${finalFixture.id}`)}>
              View the Final →
            </button>
          </div>
        </section>
      )}

      <section className="card room-summary">
        <h2>{tournament.name}</h2>
        <div className="room-meta">
          <span className={`badge ${tournament.is_completed ? 'badge-completed' : 'badge-live'}`}>
            {tournament.is_completed ? '✅ Completed' : '🔴 Ongoing'}
          </span>
          {!!tournament.fixtures_finalized && <span className="chip chip-outline">🔒 Finalized</span>}
        </div>
      </section>

      {error && <p className="error-text">{error}</p>}

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'fixture' ? 'active' : ''}`}
          onClick={() => setActiveTab('fixture')}
        >
          🏆 Fixture <span className="tab-count">{fixtures.length}</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'statistic' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistic')}
        >
          📈 Statistic
        </button>
      </div>

      {activeTab === 'fixture' && (
        <>
          <section className="card">
            <div className="card-header">
              <div className="card-title-row">
                <span className="card-icon-badge">🏆</span>
                <h3 style={{ margin: 0 }}>Fixtures</h3>
              </div>
              {fixtures.length > 0 && !tournament.fixtures_finalized && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowFixtureModal(true)}>
                    🎯 Regenerate Fixture
                  </button>
                  <button className="btn btn-success btn-sm" onClick={() => setShowFinalizeConfirm(true)}>
                    ✅ Finalize Fixtures
                  </button>
                </div>
              )}
            </div>

            {Object.entries(
              fixtures.reduce((acc, f) => {
                const key = f.pool_name || 'Round Robin Schedule';
                (acc[key] = acc[key] || []).push(f);
                return acc;
              }, {})
            ).map(([groupName, matches]) => (
              <div className="fixture-group" key={groupName}>
                <h3 className="fixture-group-title">{groupName}</h3>
                <div className="fixture-list">
                  {matches.map((match) => (
                    <div
                      key={match.id}
                      className="fixture-row"
                      onClick={() => navigate(`/rooms/${roomId}/fixtures/${match.id}`)}
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
            ))}
          </section>

          {pointsTable.length > 0 && (
            <section className="card">
              <div className="card-title-row" style={{ marginBottom: 14 }}>
                <span className="card-icon-badge">📊</span>
                <h3 style={{ margin: 0 }}>Points Table</h3>
              </div>
              <div className="points-table-wrap">
                <table className="points-table">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>P</th>
                      <th>W</th>
                      <th>L</th>
                      <th>T</th>
                      <th>Pts</th>
                      <th>NRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pointsTable.map((row) => (
                      <tr key={row.team_id}>
                        <td>
                          <div className="points-table-team-cell">
                            <span className="points-table-logo">
                              {row.logo_path ? <img src={`${import.meta.env.VITE_API_URL}${row.logo_path}`} alt="" /> : '🛡️'}
                            </span>
                            {row.team_name}
                          </div>
                        </td>
                        <td>{row.played}</td>
                        <td>{row.won}</td>
                        <td>{row.lost}</td>
                        <td>{row.tied}</td>
                        <td className="points-cell">{row.points}</td>
                        <td>{row.nrr > 0 ? '+' : ''}{row.nrr.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === 'statistic' && (
        <section className="card">
          <div className="card-title-row" style={{ marginBottom: 4 }}>
            <span className="card-icon-badge">📈</span>
            <h3 style={{ margin: 0 }}>Statistics</h3>
          </div>
          <p className="hint-text" style={{ marginBottom: 18 }}>
            Aggregated across every completed match in this tournament.
          </p>

          {stats.topBatsmen.length === 0 && stats.topBowlers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📈</div>
              <h4>No stats yet</h4>
              <p>Finish a match to see leading run scorers and wicket takers here.</p>
            </div>
          ) : (
            <div className="stats-columns">
              <div>
                <h3 style={{ marginTop: 0 }}>🏏 Top 5 Run Scorers</h3>
                {stats.topBatsmen.length === 0 ? (
                  <p className="hint-text">No runs scored yet.</p>
                ) : (
                  <div className="stats-leader-list">
                    {stats.topBatsmen.map((p, i) => (
                      <div className="stats-leader-row" key={p.player_id}>
                        <span className="stats-leader-rank">{i + 1}</span>
                        <div className="stats-leader-info">
                          <div className="stats-leader-name">{p.player_name}</div>
                          <span className="hint-text">{p.team_name}</span>
                        </div>
                        <div className="stats-leader-value">{p.total_runs}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 style={{ marginTop: 0 }}>🎯 Top 5 Wicket Takers</h3>
                {stats.topBowlers.length === 0 ? (
                  <p className="hint-text">No wickets taken yet.</p>
                ) : (
                  <div className="stats-leader-list">
                    {stats.topBowlers.map((p, i) => (
                      <div className="stats-leader-row" key={p.player_id}>
                        <span className="stats-leader-rank">{i + 1}</span>
                        <div className="stats-leader-info">
                          <div className="stats-leader-name">{p.player_name}</div>
                          <span className="hint-text">{p.team_name}</span>
                        </div>
                        <div className="stats-leader-value">{p.total_wickets}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {showFixtureModal && (
        <CreateFixtureModal
          teamCount={teamCount}
          mode="regenerate"
          onClose={() => setShowFixtureModal(false)}
          onCreate={handleRegenerateFixtures}
        />
      )}

      {showFinalizeConfirm && (
        <ConfirmModal
          icon="✅"
          title="Finalize Fixtures?"
          message="Once finalized, this match schedule is locked and can no longer be regenerated. Make sure it's correct before proceeding."
          confirmLabel="Yes, Finalize"
          confirming={finalizing}
          error={finalizeError}
          onCancel={() => {
            setShowFinalizeConfirm(false);
            setFinalizeError('');
          }}
          onConfirm={handleFinalizeFixtures}
        />
      )}
    </div>
  );
}
