import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PublicAPI } from '../api/client.js';
import MatchScorecardSummary, { oversDisplay } from '../components/MatchScorecardSummary.jsx';
import CelebrationOverlay from '../components/CelebrationOverlay.jsx';
import { ballLabel, isBoundary } from '../utils/ballFormat.js';

export default function PublicMatchView() {
  const { fixtureId } = useParams();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [error, setError] = useState('');
  const [celebration, setCelebration] = useState(null);

  const celebrationTimerRef = useRef(null);
  const celebrationKeyRef = useRef(0);
  const lastBallIdRef = useRef(null);
  const prevHatTrickRef = useRef(false);
  const firstLoadRef = useRef(true);
  const pollIntervalRef = useRef(null);

  const triggerCelebration = (type, durationMs) => {
    celebrationKeyRef.current += 1;
    setCelebration({ type, key: celebrationKeyRef.current });
    clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = setTimeout(() => setCelebration(null), durationMs);
  };

  useEffect(() => {
    let cancelled = false;
    firstLoadRef.current = true;
    lastBallIdRef.current = null;
    prevHatTrickRef.current = false;

    const poll = async () => {
      try {
        const data = await PublicAPI.getMatch(fixtureId);
        if (cancelled) return;

        const inn = data.innings?.[data.innings.length - 1];
        if (inn) {
          const lastBall = inn.last12Balls?.[inn.last12Balls.length - 1];
          const nowOnHatTrick = !!inn.bowlerOnHatTrick;
          const wasOnHatTrickBefore = prevHatTrickRef.current;
          const justWentOnHatTrick = !wasOnHatTrickBefore && nowOnHatTrick;

          // Detect what changed purely by diffing against the previous poll
          // — this page never submits a ball itself, it only ever watches.
          const newBallArrived = !firstLoadRef.current && lastBall && lastBall.id !== lastBallIdRef.current;
          if (newBallArrived) {
            const isFour = isBoundary(lastBall, 4);
            const isSix = isBoundary(lastBall, 6);
            const isWicket = !!lastBall.is_wicket;
            const isNoBall = lastBall.extra_type === 'no_ball';
            const isHatTrickBall = wasOnHatTrickBefore && isWicket && !lastBall.is_run_out;

            if (isHatTrickBall) triggerCelebration('hattrick', 2500);
            else if (justWentOnHatTrick) triggerCelebration('onhattrick', 2000);
            else if (isSix) triggerCelebration('six', 1000);
            else if (isFour) triggerCelebration('four', 1000);
            else if (isNoBall) triggerCelebration('noball', 1500);
            else if (isWicket) triggerCelebration('wicket', 1000);
          } else if (justWentOnHatTrick && !firstLoadRef.current) {
            // A bowler can go on a hat-trick purely by being RESELECTED for a
            // new over (their last two legal balls, from an over ago, were
            // both wickets) — no new ball is bowled at that instant, so the
            // newBallArrived branch above would never catch this transition.
            triggerCelebration('onhattrick', 2000);
          }

          lastBallIdRef.current = lastBall ? lastBall.id : lastBallIdRef.current;
          prevHatTrickRef.current = nowOnHatTrick;
        }

        firstLoadRef.current = false;
        setMatch(data);
        setError('');

        if (data.match_status === 'completed' && pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      } catch (err) {
        if (!cancelled) setError('This match could not be found.');
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(pollIntervalRef.current);
      clearTimeout(celebrationTimerRef.current);
    };
  }, [fixtureId]);

  if (error) {
    return (
      <div className="page">
        <button className="link-btn back-link" onClick={() => navigate('/')}>← Back to Live Matches</button>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="page">
        <div className="skeleton-card" style={{ height: 240 }} />
      </div>
    );
  }

  const teamName = (id) => (id === match.team1_id ? match.team1_name : match.team2_name);
  const allPlayers = [...match.team1Players, ...match.team2Players];
  const playerName = (id) => allPlayers.find((p) => p.id === id)?.name || '—';

  const isLive = match.match_status === 'live';
  const currentInnings = match.innings?.[match.innings.length - 1];
  const statFor = (playerId) => currentInnings?.stats.find((s) => s.player_id === playerId);
  const strikerStat = currentInnings?.striker_id ? statFor(currentInnings.striker_id) : null;
  const nonStrikerStat = currentInnings?.non_striker_id ? statFor(currentInnings.non_striker_id) : null;
  const bowlerStat = currentInnings?.current_bowler_id ? statFor(currentInnings.current_bowler_id) : null;
  const oversFaced = currentInnings ? currentInnings.total_balls / 6 : 0;
  const currentRunRate = currentInnings && oversFaced > 0 ? currentInnings.total_runs / oversFaced : 0;

  return (
    <div className="page">
      <CelebrationOverlay celebration={celebration} />

      <button className="link-btn back-link" onClick={() => navigate('/')}>← Back to Live Matches</button>

      <section className="card match-detail-header">
        {isLive && <span className="fixture-order-badge live-badge">🔴 LIVE</span>}
        <span className="fixture-order-badge">{match.overs_limit}-Over Match</span>
        <div className="match-detail-teams">
          <div className="match-detail-team">
            <span className="fixture-team-logo fixture-team-logo-lg">
              {match.team1_logo ? <img src={match.team1_logo} alt="" /> : '🛡️'}
            </span>
            <h3>{match.team1_name}</h3>
          </div>
          <span className="match-detail-vs">VS</span>
          <div className="match-detail-team">
            <span className="fixture-team-logo fixture-team-logo-lg">
              {match.team2_logo ? <img src={match.team2_logo} alt="" /> : '🛡️'}
            </span>
            <h3>{match.team2_name}</h3>
          </div>
        </div>
      </section>

      {isLive && currentInnings && (
        <>
          {currentInnings.bowlerOnHatTrick && (
            <div className="hattrick-notice public-hattrick-notice">
              🎩 {playerName(currentInnings.current_bowler_id)} is on a HAT-TRICK!
            </div>
          )}

          <section className="card live-score-card">
            <div className="live-score-header">
              <div>
                <div className="live-score-team">{teamName(currentInnings.batting_team_id)}</div>
                <div className="live-score-value">
                  {currentInnings.total_runs}/{currentInnings.total_wickets}
                  <span className="hint-text"> ({oversDisplay(currentInnings.total_balls)}/{currentInnings.overs_limit} ov)</span>
                </div>
                <div className="hint-text">CRR {currentRunRate.toFixed(2)}</div>
                {!!currentInnings.free_hit && <div className="free-hit-badge">🏏 FREE HIT</div>}
              </div>
              {currentInnings.innings_number % 2 === 0 && currentInnings.target != null && !currentInnings.is_completed && (
                <div className="live-score-target hint-text">
                  Target {currentInnings.target} · Need {Math.max(currentInnings.target - currentInnings.total_runs, 0)} runs
                  from {Math.max(currentInnings.overs_limit * 6 - currentInnings.total_balls, 0)} balls
                  {(() => {
                    const ballsLeft = Math.max(currentInnings.overs_limit * 6 - currentInnings.total_balls, 0);
                    const required = Math.max(currentInnings.target - currentInnings.total_runs, 0);
                    const rrr = ballsLeft > 0 ? required / (ballsLeft / 6) : null;
                    return rrr != null ? ` · RRR ${rrr.toFixed(2)}` : '';
                  })()}
                </div>
              )}
            </div>

            {currentInnings.striker_id && currentInnings.non_striker_id && currentInnings.current_bowler_id && (
              <div className="live-players-row">
                <div className="live-player-card">
                  <span className="hint-text">STRIKER</span>
                  <div className="live-player-name">{playerName(currentInnings.striker_id)} *</div>
                  <div className="live-player-figures">{strikerStat?.runs_scored || 0} ({strikerStat?.balls_faced || 0})</div>
                </div>
                <div className="live-player-card">
                  <span className="hint-text">NON-STRIKER</span>
                  <div className="live-player-name">{playerName(currentInnings.non_striker_id)}</div>
                  <div className="live-player-figures">{nonStrikerStat?.runs_scored || 0} ({nonStrikerStat?.balls_faced || 0})</div>
                </div>
                <div className="live-player-card">
                  <span className="hint-text">BOWLER</span>
                  <div className="live-player-name">{playerName(currentInnings.current_bowler_id)}</div>
                  <div className="live-player-figures">
                    {oversDisplay(bowlerStat?.balls_bowled || 0)}-{bowlerStat?.runs_conceded || 0}-{bowlerStat?.wickets_taken || 0}
                  </div>
                </div>
              </div>
            )}

            <div className="current-over-strip">
              <span className="hint-text">Last 12 balls:</span>
              {!currentInnings.last12Balls || currentInnings.last12Balls.length === 0 ? (
                <span className="hint-text">—</span>
              ) : (
                currentInnings.last12Balls.map((b) => (
                  <span
                    key={b.id}
                    className={`over-ball-chip ${b.is_wicket ? 'wicket' : ''} ${b.extra_type !== 'none' ? 'extra' : ''} ${isBoundary(b, 4) ? 'four' : ''} ${isBoundary(b, 6) ? 'six' : ''}`}
                  >
                    {ballLabel(b)}
                  </span>
                ))
              )}
            </div>
          </section>
        </>
      )}

      {!isLive && (
        <section className="card">
          <p className="hint-text" style={{ margin: 0 }}>
            {match.match_status === 'completed' ? 'This match has finished.' : 'This match has not started yet.'}
          </p>
        </section>
      )}

      <section className="card">
        <MatchScorecardSummary match={match} />
      </section>
    </div>
  );
}
