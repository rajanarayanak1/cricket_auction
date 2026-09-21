import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PublicAPI } from '../api/client.js';
import { oversDisplay } from '../components/MatchScorecardSummary.jsx';
import LoginModal from '../components/LoginModal.jsx';
import { isAuthenticated } from '../utils/auth.js';

function TeamBadge({ name, logo }) {
  return (
    <div className="live-tile-team">
      <span className="fixture-team-logo">{logo ? <img src={`${import.meta.env.VITE_API_URL}${logo}`} alt="" /> : '🛡️'}</span>
      <span className="live-tile-team-name">{name}</span>
    </div>
  );
}

export default function LiveMatches() {
  const navigate = useNavigate();
  const location = useLocation();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [tournaments, setTournaments] = useState([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [tournamentTab, setTournamentTab] = useState('ongoing');
  const [completedAuctions, setCompletedAuctions] = useState([]);
  const [auctionsLoading, setAuctionsLoading] = useState(true);

  // Reached via a ProtectedRoute bounce (or a direct /login visit) — same
  // home page, just with the sign-in modal already open on top of it.
  useEffect(() => {
    if (location.pathname === '/login') setShowLogin(true);
  }, [location.pathname]);

  const closeLogin = () => {
    setShowLogin(false);
    if (location.pathname === '/login') navigate('/', { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      PublicAPI.liveMatches()
        .then((data) => {
          if (cancelled) return;
          setMatches(data);
          setError('');
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) {
            setError('Failed to load live matches.');
            setLoading(false);
          }
        });
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      PublicAPI.tournaments()
        .then((data) => {
          if (cancelled) return;
          setTournaments(data);
          setTournamentsLoading(false);
        })
        .catch(() => {
          if (!cancelled) setTournamentsLoading(false);
        });
    };
    poll();
    // Matched to the live-matches poll interval below — a fixture finishing
    // drops it out of that list almost immediately, so the tournament card's
    // completed count should catch up on the same cadence instead of lagging
    // behind by up to 30s.
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    PublicAPI.completedAuctions()
      .then(setCompletedAuctions)
      .catch(() => {})
      .finally(() => setAuctionsLoading(false));
  }, []);

  const ongoingTournaments = tournaments.filter((t) => !t.is_completed);
  const pastTournaments = tournaments.filter((t) => t.is_completed);
  const shownTournaments = tournamentTab === 'ongoing' ? ongoingTournaments : pastTournaments;

  return (
    <div className="page">
      {showLogin && <LoginModal onClose={closeLogin} />}

      <section className="live-home-hero">
        <div className="live-home-hero-top">
          <div className="live-home-brand">
            <span className="app-brand-icon live-home-brand-icon">🏏</span>
            <div>
              <h1>Live Scores</h1>
              <p>Follow every match, ball by ball — no sign-in required.</p>
            </div>
          </div>
          {!isAuthenticated() && (
            <button className="btn btn-secondary live-home-admin-btn" onClick={() => setShowLogin(true)}>
              🔐 Admin Login
            </button>
          )}
        </div>

        <div className="live-home-status-pill">
          {loading ? (
            <span>Checking for live matches…</span>
          ) : matches.length > 0 ? (
            <>
              <span className="live-dot" /> {matches.length} match{matches.length > 1 ? 'es' : ''} live right now
            </>
          ) : (
            <span>No matches live right now — this page updates automatically the moment one starts.</span>
          )}
        </div>
      </section>

      {loading ? (
        <div className="live-tile-grid">
          <div className="skeleton-card" style={{ height: 180 }} />
          <div className="skeleton-card" style={{ height: 180 }} />
          <div className="skeleton-card" style={{ height: 180 }} />
        </div>
      ) : error ? (
        <p className="error-text">{error}</p>
      ) : matches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏟️</div>
          <h4>No live matches right now</h4>
          <p className="hint-text">Check back once a match is underway — this page refreshes on its own.</p>
        </div>
      ) : (
        <div className="live-tile-grid">
          {matches.map((m) => (
            <button key={m.fixture_id} className="live-tile" onClick={() => navigate(`/live/${m.fixture_id}`)}>
              <div className="live-tile-header">
                <span className={`live-badge ${m.winner_team_name || m.is_tied ? 'live-badge-result' : ''}`}>
                  {m.winner_team_name || m.is_tied ? '🏁 RESULT' : '🔴 LIVE'}
                </span>
                <span className="hint-text">{m.room_name}</span>
              </div>
              <div className="live-tile-teams">
                <TeamBadge name={m.team1_name} logo={m.team1_logo} />
                <span className="live-tile-vs">vs</span>
                <TeamBadge name={m.team2_name} logo={m.team2_logo} />
              </div>
              <div className="live-tile-score">
                <span className="live-tile-batting-team">{m.batting_team_name}</span>
                <span className="live-tile-score-value">
                  {m.total_runs}/{m.total_wickets}
                  <span className="hint-text"> ({oversDisplay(m.total_balls)}/{m.overs_limit} ov)</span>
                </span>
              </div>
              <div className="live-tile-rate">CRR {m.current_run_rate.toFixed(2)}</div>
              {m.winner_team_name ? (
                <div className="live-tile-winner">🏆 {m.winner_team_name} won</div>
              ) : m.is_tied ? (
                <div className="live-tile-winner">Scores level — match tied</div>
              ) : (
                m.target != null && (
                  <div className="live-tile-target">
                    Need {m.required_runs} from {m.balls_left} balls
                    {m.required_run_rate != null ? ` · RRR ${m.required_run_rate.toFixed(2)}` : ''}
                  </div>
                )
              )}
              <span className="live-tile-cta">View full scorecard →</span>
            </button>
          ))}
        </div>
      )}

      <section className="tournament-section" style={{ marginTop: 36 }}>
        <div className="tabs">
          <button
            className={`tab-btn ${tournamentTab === 'ongoing' ? 'active' : ''}`}
            onClick={() => setTournamentTab('ongoing')}
          >
            🏆 Ongoing Tournaments <span className="tab-count">{ongoingTournaments.length}</span>
          </button>
          <button
            className={`tab-btn ${tournamentTab === 'past' ? 'active' : ''}`}
            onClick={() => setTournamentTab('past')}
          >
            📜 Past Tournaments <span className="tab-count">{pastTournaments.length}</span>
          </button>
        </div>

        {tournamentsLoading ? (
          <div className="skeleton-grid">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        ) : shownTournaments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏆</div>
            <h4>{tournamentTab === 'ongoing' ? 'No ongoing tournaments' : 'No past tournaments yet'}</h4>
            <p className="hint-text">
              {tournamentTab === 'ongoing'
                ? 'Check back once an admin creates one.'
                : 'Completed tournaments will show up here.'}
            </p>
          </div>
        ) : (
          <div className="tournament-grid">
            {shownTournaments.map((t) => (
              <div key={t.id} className="tournament-card" onClick={() => navigate(`/tournaments/${t.id}`)}>
                <div className="tournament-card-header">
                  <h4>{t.name}</h4>
                  <span className={`badge ${t.is_completed ? 'badge-completed' : 'badge-live'}`}>
                    {t.is_completed ? '✅ Completed' : '🔴 Ongoing'}
                  </span>
                </div>
                <p className="hint-text">{t.room_name}</p>
                <p className="hint-text">
                  {t.fixture_count} match{t.fixture_count === 1 ? '' : 'es'} · {t.completed_count} completed
                </p>
                {t.is_completed && t.winner_team_name && (
                  <p className="tournament-card-winner">
                    🏆 {t.winner_team_name} won{t.player_of_tournament_name ? ` · 🌟 ${t.player_of_tournament_name}` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="tournament-section" style={{ marginTop: 36 }}>
        <h3 style={{ margin: 0 }}>🏏 Completed Auctions</h3>

        {auctionsLoading ? (
          <div className="skeleton-grid">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        ) : completedAuctions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏏</div>
            <h4>No completed auctions yet</h4>
            <p className="hint-text">Once an auction wraps up, its player list will show up here.</p>
          </div>
        ) : (
          <div className="tournament-grid">
            {completedAuctions.map((a) => (
              <div key={a.id} className="tournament-card" onClick={() => navigate(`/auctions/${a.id}`)}>
                <div className="tournament-card-header">
                  <h4>{a.name}</h4>
                  <span className="badge badge-completed">✅ Completed</span>
                </div>
                <p className="hint-text">{new Date(a.auction_date).toLocaleDateString()}</p>
                <p className="hint-text">{a.num_teams} teams · {a.player_count} players</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
