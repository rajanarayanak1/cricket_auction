import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MatchAPI } from '../api/client.js';
import MatchScorecardSummary, { oversDisplay } from '../components/MatchScorecardSummary.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import CelebrationOverlay from '../components/CelebrationOverlay.jsx';
import { ballLabel, isBoundary } from '../utils/ballFormat.js';

const RUN_OPTIONS = [0, 1, 2, 3, 4, 5, 6];

function RunOutFields({ label, player, onPlayerChange, strikerName, nonStrikerName, runs, onRunsChange }) {
  return (
    <>
      <div className="ball-entry-row">
        <span className="ball-entry-label">{label || "Who's Out"}</span>
        <div className="ball-entry-options">
          <button
            type="button"
            className={`ball-option-btn ${player === 'striker' ? 'selected' : ''}`}
            onClick={() => onPlayerChange('striker')}
          >
            {strikerName}
          </button>
          <button
            type="button"
            className={`ball-option-btn ${player === 'non_striker' ? 'selected' : ''}`}
            onClick={() => onPlayerChange('non_striker')}
          >
            {nonStrikerName}
          </button>
        </div>
      </div>
      <div className="ball-entry-row">
        <span className="ball-entry-label">Runs Completed</span>
        <div className="ball-entry-options">
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              type="button"
              className={`ball-option-btn ${runs === r ? 'selected' : ''}`}
              onClick={() => onRunsChange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function OpenersForm({ battingPlayers, bowlingPlayers, onSubmit }) {
  const [striker, setStriker] = useState('');
  const [nonStriker, setNonStriker] = useState('');
  const [bowler, setBowler] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!striker || !nonStriker || !bowler) {
      setError('Select both opening batsmen and an opening bowler.');
      return;
    }
    if (striker === nonStriker) {
      setError('Choose two different opening batsmen.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ striker_id: Number(striker), non_striker_id: Number(nonStriker), bowler_id: Number(bowler) });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set the openers.');
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title-row" style={{ marginBottom: 14 }}>
        <span className="card-icon-badge">🏏</span>
        <h3 style={{ margin: 0 }}>Select Opening Players</h3>
      </div>
      <div className="form-grid">
        <label>
          Striker
          <select value={striker} onChange={(e) => setStriker(e.target.value)}>
            <option value="">Select…</option>
            {battingPlayers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label>
          Non-Striker
          <select value={nonStriker} onChange={(e) => setNonStriker(e.target.value)}>
            <option value="">Select…</option>
            {battingPlayers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label>
          Opening Bowler
          <select value={bowler} onChange={(e) => setBowler(e.target.value)}>
            <option value="">Select…</option>
            {bowlingPlayers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
      <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Saving…' : '▶ Begin Innings'}
      </button>
    </div>
  );
}

function NewBatsmanForm({ players, onSubmit }) {
  const [playerId, setPlayerId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!playerId) {
      setError('Select the next batsman.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(Number(playerId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to select the batsman.');
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title-row" style={{ marginBottom: 14 }}>
        <span className="card-icon-badge">🏃</span>
        <h3 style={{ margin: 0 }}>Wicket! Select the Next Batsman</h3>
      </div>
      <div className="form-grid">
        <label>
          Next Batsman
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">Select…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
      <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Saving…' : '▶ Send In'}
      </button>
    </div>
  );
}

function NewBowlerForm({ players, onSubmit }) {
  const [playerId, setPlayerId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!playerId) {
      setError('Select the next bowler.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(Number(playerId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to select the bowler.');
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title-row" style={{ marginBottom: 14 }}>
        <span className="card-icon-badge">🎯</span>
        <h3 style={{ margin: 0 }}>Over Complete — Select the Next Bowler</h3>
      </div>
      <div className="form-grid">
        <label>
          Next Bowler
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">Select…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
      <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Saving…' : '▶ Start Over'}
      </button>
    </div>
  );
}

export default function Scorecard() {
  const { roomId, fixtureId } = useParams();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [error, setError] = useState('');
  const [selectedRuns, setSelectedRuns] = useState(0);
  const [extraType, setExtraType] = useState('none');
  const [selectedExtraRuns, setSelectedExtraRuns] = useState(0);
  const [byeType, setByeType] = useState('none');
  const [byeRuns, setByeRuns] = useState(1);
  const [wicketType, setWicketType] = useState('none');
  const [runOutPlayer, setRunOutPlayer] = useState('striker');
  const [runOutRuns, setRunOutRuns] = useState(0);
  const [overthrowEnabled, setOverthrowEnabled] = useState(false);
  const [overthrowMode, setOverthrowMode] = useState('runs');
  const [overthrowRuns, setOverthrowRuns] = useState(1);
  const [overthrowPlayer, setOverthrowPlayer] = useState('striker');
  const [overthrowBeforeRuns, setOverthrowBeforeRuns] = useState(0);
  const [ballSubmitting, setBallSubmitting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const celebrationTimerRef = useRef(null);
  const celebrationKeyRef = useRef(0);
  const [onHatTrickNotice, setOnHatTrickNotice] = useState(false);
  const pendingApplyTimerRef = useRef(null);
  const [showFinish, setShowFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [startingSuperOver, setStartingSuperOver] = useState(false);

  const load = () => {
    MatchAPI.get(roomId, fixtureId)
      .then(setMatch)
      .catch(() => setError('Failed to load this match.'));
  };

  useEffect(() => {
    load();
  }, [roomId, fixtureId]);

  useEffect(() => {
    return () => {
      clearTimeout(celebrationTimerRef.current);
      clearTimeout(pendingApplyTimerRef.current);
    };
  }, []);

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

  if (!match) {
    return (
      <div className="page">
        <div className="skeleton-card" style={{ height: 140 }} />
      </div>
    );
  }

  const teamName = (id) => (id === match.team1_id ? match.team1_name : match.team2_name);
  const allPlayers = [...match.team1Players, ...match.team2Players];
  const playerName = (id) => allPlayers.find((p) => p.id === id)?.name || '—';
  const teamPlayers = (teamId) => (teamId === match.team1_id ? match.team1Players : match.team2Players);

  const currentInnings = match.innings[match.innings.length - 1];
  const isCompleted = match.match_status === 'completed';
  const isSuperOver = currentInnings.innings_number > 2;
  const superOverNumber = isSuperOver ? Math.ceil((currentInnings.innings_number - 2) / 2) : 0;

  // is_completed comes back from MySQL as a tinyint (0/1), not a real
  // boolean — without the !! this whole && chain can evaluate to the bare
  // number 0 instead of false, and every downstream "needsX && <jsx>" below
  // would then render that stray 0 as visible text instead of nothing.
  const lastPairComplete =
    !!(match.innings.length >= 2 && match.innings.length % 2 === 0 && match.innings[match.innings.length - 1].is_completed);
  const decidingFirst = lastPairComplete ? match.innings[match.innings.length - 2] : null;
  const decidingSecond = lastPairComplete ? match.innings[match.innings.length - 1] : null;
  const isTied = lastPairComplete && decidingFirst.total_runs === decidingSecond.total_runs;
  const isDecisiveStage = ['semifinal', 'final'].includes(match.stage);
  const needsSuperOver = !isCompleted && lastPairComplete && isTied && isDecisiveStage;
  const canFinish = !isCompleted && lastPairComplete && !needsSuperOver;

  const strikerVacant = !currentInnings.striker_id;
  const nonStrikerVacant = !currentInnings.non_striker_id;
  const needsOpeners = !isCompleted && strikerVacant && nonStrikerVacant;
  // A run out (unlike every other dismissal) can vacate either end, not just
  // the striker's — so "needs a new batsman" is "exactly one slot is empty",
  // not "the striker slot specifically".
  const needsBatsman = !isCompleted && !currentInnings.is_completed && strikerVacant !== nonStrikerVacant;
  const needsBowler = !isCompleted && !currentInnings.is_completed && !currentInnings.current_bowler_id && !!currentInnings.striker_id;
  const readyToScore = !isCompleted && !currentInnings.is_completed && !needsOpeners && !needsBatsman && !needsBowler;

  const statFor = (playerId) => currentInnings.stats.find((s) => s.player_id === playerId);
  const strikerStat = currentInnings.striker_id ? statFor(currentInnings.striker_id) : null;
  const nonStrikerStat = currentInnings.non_striker_id ? statFor(currentInnings.non_striker_id) : null;
  const bowlerStat = currentInnings.current_bowler_id ? statFor(currentInnings.current_bowler_id) : null;

  const handleSelectOpeners = async (payload) => {
    setMatch(await MatchAPI.selectOpeners(roomId, fixtureId, currentInnings.id, payload));
  };
  const handleSelectBatsman = async (playerId) => {
    setMatch(await MatchAPI.selectBatsman(roomId, fixtureId, currentInnings.id, playerId));
  };
  const handleSelectBowler = async (playerId) => {
    const updated = await MatchAPI.selectBowler(roomId, fixtureId, currentInnings.id, playerId);
    setMatch(updated);
    // Covers the case the ball-by-ball check in handleAddBall can't: a
    // bowler's second straight wicket landing on the over's last ball clears
    // the bowler slot immediately (no bowler = no hat-trick status yet), so
    // the transition only becomes visible once they're picked again here.
    const updatedInnings = updated.innings.find((inn) => inn.id === currentInnings.id);
    if (updatedInnings?.bowlerOnHatTrick) {
      setOnHatTrickNotice(true);
      triggerCelebration('onhattrick', 2000);
    }
  };

  const resetBallEntry = () => {
    setSelectedRuns(0);
    setExtraType('none');
    setSelectedExtraRuns(0);
    setByeType('none');
    setByeRuns(1);
    setWicketType('none');
    setRunOutPlayer('striker');
    setRunOutRuns(0);
    setOverthrowEnabled(false);
    setOverthrowMode('runs');
    setOverthrowRuns(1);
    setOverthrowPlayer('striker');
    setOverthrowBeforeRuns(0);
  };

  const triggerCelebration = (type, durationMs) => {
    celebrationKeyRef.current += 1;
    setCelebration({ type, key: celebrationKeyRef.current });
    clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = setTimeout(() => setCelebration(null), durationMs);
  };

  const handleAddBall = async () => {
    // Figure out what this ball is BEFORE submitting — a plain delivery (no
    // extra/bye/overthrow, no run-out) with runs 4 or 6 is a genuine struck
    // boundary; a non-run-out wicket taken while the bowler was already on a
    // hat-trick (from *before* this ball) completes one. Both read off the
    // exact values about to be submitted, so there's no need to re-derive
    // them from the server's response.
    const isPlainDelivery = extraType === 'none' && byeType === 'none' && wicketType !== 'run_out' && !overthrowEnabled;
    const wasFour = isPlainDelivery && wicketType === 'none' && selectedRuns === 4;
    const wasSix = isPlainDelivery && wicketType === 'none' && selectedRuns === 6;
    const wasNoBall = extraType === 'no_ball';
    const wasNonRunOutWicket = wicketType === 'out';
    const wasRunOutWicket = wicketType === 'run_out' || (overthrowEnabled && overthrowMode === 'run_out');
    const wasAnyWicket = wasNonRunOutWicket || wasRunOutWicket;
    const wasHatTrickBall = currentInnings.bowlerOnHatTrick && wasNonRunOutWicket;
    const wasOnHatTrickBeforeThisBall = currentInnings.bowlerOnHatTrick;

    // The "on hat-trick" notice near the score is cleared the moment the next
    // ball is bowled, no matter what that ball turns out to be — it only
    // reappears below if this very ball is what puts the bowler on one.
    setOnHatTrickNotice(false);

    setBallSubmitting(true);
    setError('');
    try {
      const updated = await MatchAPI.recordBall(roomId, fixtureId, currentInnings.id, {
        runs: selectedRuns,
        extra_type: extraType,
        extra_runs: extraType === 'none' ? 0 : selectedExtraRuns,
        bye_type: byeType,
        bye_runs: byeType === 'none' ? 0 : byeRuns,
        wicket_type: wicketType,
        run_out_player: wicketType === 'run_out' ? runOutPlayer : undefined,
        run_out_runs: wicketType === 'run_out' ? runOutRuns : undefined,
        overthrow: overthrowEnabled || undefined,
        overthrow_runs: overthrowEnabled && overthrowMode === 'runs' ? overthrowRuns : undefined,
        overthrow_run_out: overthrowEnabled && overthrowMode === 'run_out' ? true : undefined,
        overthrow_player: overthrowEnabled && overthrowMode === 'run_out' ? overthrowPlayer : undefined,
        overthrow_before_runs: overthrowEnabled && overthrowMode === 'run_out' ? overthrowBeforeRuns : undefined
      });

      // Did *this* ball put the bowler on a hat-trick? Compare the fresh,
      // authoritative post-ball flag against the pre-ball one rather than
      // re-deriving it — recomputing "were their last two legal balls both
      // wickets" client-side would just duplicate the server's own logic.
      const updatedInnings = updated.innings.find((inn) => inn.id === currentInnings.id);
      const justWentOnHatTrick = !wasOnHatTrickBeforeThisBall && !!updatedInnings?.bowlerOnHatTrick;

      // Applying the new match state is what flips the screen over to the
      // "select next batsman/bowler" prompts (the innings ending works the
      // same way) — for a wicket or a hat-trick moment, that switch is held
      // back until the celebration has actually played out on the scorecard,
      // instead of the prompt appearing underneath/over it immediately.
      const applyUpdate = () => {
        setMatch(updated);
        resetBallEntry();
        if (justWentOnHatTrick) setOnHatTrickNotice(true);
        setBallSubmitting(false);
      };

      if (wasHatTrickBall) {
        triggerCelebration('hattrick', 2500);
        pendingApplyTimerRef.current = setTimeout(applyUpdate, 2500);
      } else if (justWentOnHatTrick) {
        triggerCelebration('onhattrick', 2000);
        pendingApplyTimerRef.current = setTimeout(applyUpdate, 2000);
      } else if (wasAnyWicket) {
        triggerCelebration('wicket', 1000);
        pendingApplyTimerRef.current = setTimeout(applyUpdate, 1000);
      } else {
        if (wasSix) triggerCelebration('six', 1000);
        else if (wasFour) triggerCelebration('four', 1000);
        else if (wasNoBall) triggerCelebration('noball', 1500);
        applyUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record that ball.');
      setBallSubmitting(false);
    }
  };

  const handleUndoLastBall = async () => {
    setUndoing(true);
    setError('');
    try {
      setMatch(await MatchAPI.undoLastBall(roomId, fixtureId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to undo the last ball.');
    } finally {
      setUndoing(false);
    }
  };

  const handleStartSuperOver = async () => {
    setStartingSuperOver(true);
    setError('');
    try {
      setMatch(await MatchAPI.startSuperOver(roomId, fixtureId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start the super over.');
    } finally {
      setStartingSuperOver(false);
    }
  };

  const handleFinish = async () => {
    setFinishing(true);
    try {
      const updated = await MatchAPI.finish(roomId, fixtureId);
      setMatch(updated);
      setShowFinish(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to finish the match.');
      setShowFinish(false);
    } finally {
      setFinishing(false);
    }
  };

  const battingPlayers = teamPlayers(currentInnings.batting_team_id);
  const bowlingPlayers = teamPlayers(currentInnings.bowling_team_id);
  const hasAnyBall = match.innings.some((inn) => inn.total_balls > 0 || inn.extras > 0 || inn.total_wickets > 0);
  const outIds = new Set(currentInnings.stats.filter((s) => s.is_out).map((s) => s.player_id));
  const occupiedBatsmanId = currentInnings.striker_id || currentInnings.non_striker_id;
  const availableBatsmen = battingPlayers.filter((p) => p.id !== occupiedBatsmanId && !outIds.has(p.id));
  const availableBowlers = bowlingPlayers.filter((p) => p.id !== currentInnings.last_over_bowler_id);

  return (
    <div className="page">
      <CelebrationOverlay celebration={celebration} />

      <button
        className="link-btn back-link"
        onClick={() => navigate(`/rooms/${roomId}/tournaments/${match.tournament_id}`, { state: { tab: 'fixture' } })}
      >
        ← Back to Tournament
      </button>

      <section className="card match-detail-header">
        <span className="fixture-order-badge">{match.overs_limit}-Over Match</span>
        {isSuperOver && !isCompleted && (
          <span className="fixture-order-badge super-over-badge">🎯 Super Over {superOverNumber}</span>
        )}
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

      {error && <p className="error-text">{error}</p>}

      {!isCompleted && (
        <section className="card live-score-card">
          <div className="live-score-header">
            <div>
              <div className="live-score-team">{teamName(currentInnings.batting_team_id)}</div>
              <div className="live-score-value">
                {currentInnings.total_runs}/{currentInnings.total_wickets}
                <span className="hint-text"> ({oversDisplay(currentInnings.total_balls)}/{currentInnings.overs_limit} ov)</span>
              </div>
              {!!currentInnings.free_hit && <div className="free-hit-badge">🏏 FREE HIT</div>}
            </div>
            {currentInnings.innings_number % 2 === 0 && currentInnings.target != null && !currentInnings.is_completed && (
              <div className="live-score-target hint-text">
                Target {currentInnings.target} · Need {Math.max(currentInnings.target - currentInnings.total_runs, 0)} runs
                from {Math.max(currentInnings.overs_limit * 6 - currentInnings.total_balls, 0)} balls
              </div>
            )}
          </div>
          <div className="live-score-actions">
            <button
              type="button"
              className="btn btn-sm undo-ball-btn"
              onClick={handleUndoLastBall}
              disabled={undoing || ballSubmitting || !hasAnyBall}
            >
              {undoing ? 'Undoing…' : '↩ Undo Last Ball'}
            </button>
            {onHatTrickNotice && (
              <div className="hattrick-notice">🎩 {playerName(currentInnings.current_bowler_id)} is on a HAT-TRICK!</div>
            )}
          </div>

          {readyToScore && (
            <>
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

              <div className="current-over-strip">
                <span className="hint-text">This over:</span>
                {currentInnings.currentOverBalls.length === 0 ? (
                  <span className="hint-text">—</span>
                ) : (
                  currentInnings.currentOverBalls.map((b) => (
                    <span
                      key={b.id}
                      className={`over-ball-chip ${b.is_wicket ? 'wicket' : ''} ${b.extra_type !== 'none' ? 'extra' : ''} ${isBoundary(b, 4) ? 'four' : ''} ${isBoundary(b, 6) ? 'six' : ''}`}
                    >
                      {ballLabel(b)}
                    </span>
                  ))
                )}
              </div>

              <div className="ball-entry-panel">
                <div className="ball-entry-row">
                  <span className="ball-entry-label">Runs</span>
                  <div className="ball-entry-options">
                    {RUN_OPTIONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`ball-option-btn ${selectedRuns === r && extraType === 'none' && byeType === 'none' ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedRuns(r);
                          if (overthrowEnabled && [4, 6].includes(r)) setOverthrowEnabled(false);
                        }}
                        disabled={extraType !== 'none' || byeType !== 'none' || wicketType === 'run_out'}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ball-entry-row">
                  <span className="ball-entry-label">Extra</span>
                  <div className="ball-entry-options">
                    {[
                      { value: 'none', label: 'None' },
                      { value: 'wide', label: 'Wide' },
                      { value: 'no_ball', label: 'No Ball' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`ball-option-btn ball-option-extra ${extraType === opt.value ? 'selected' : ''}`}
                        onClick={() => {
                          setExtraType(opt.value);
                          setSelectedExtraRuns(0);
                          if (opt.value !== 'none') {
                            setByeType('none');
                            setByeRuns(1);
                            setOverthrowEnabled(false);
                            if (wicketType === 'run_out') setWicketType('none');
                          }
                        }}
                        disabled={wicketType === 'run_out'}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {extraType !== 'none' && (
                  <div className="ball-entry-row">
                    <span className="ball-entry-label">+ Runs Taken</span>
                    <div className="ball-entry-options">
                      {RUN_OPTIONS.filter((r) => (extraType === 'no_ball' ? r <= 6 : r <= 4)).map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={`ball-option-btn ${selectedExtraRuns === r ? 'selected' : ''}`}
                          onClick={() => setSelectedExtraRuns(r)}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {extraType === 'none' && wicketType !== 'run_out' && !overthrowEnabled && (
                  <div className="ball-entry-row">
                    <span className="ball-entry-label">Bye</span>
                    <div className="ball-entry-options">
                      {[
                        { value: 'none', label: 'None' },
                        { value: 'bye', label: 'Bye' },
                        { value: 'leg_bye', label: 'Leg Bye' }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`ball-option-btn ${byeType === opt.value ? 'selected' : ''}`}
                          onClick={() => {
                            setByeType(opt.value);
                            setByeRuns(1);
                            if (opt.value !== 'none') setSelectedRuns(0);
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {byeType !== 'none' && (
                  <div className="ball-entry-row">
                    <span className="ball-entry-label">Bye Runs</span>
                    <div className="ball-entry-options">
                      {[1, 2, 3, 4, 5, 6].map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={`ball-option-btn ${byeRuns === r ? 'selected' : ''}`}
                          onClick={() => setByeRuns(r)}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {extraType === 'none' && byeType === 'none' && wicketType === 'none' && ![4, 6].includes(selectedRuns) && (
                  <div className="ball-entry-row">
                    <span className="ball-entry-label">Over-throw</span>
                    <button
                      type="button"
                      className={`ball-option-btn ${overthrowEnabled ? 'selected' : ''}`}
                      onClick={() => setOverthrowEnabled((prev) => !prev)}
                    >
                      {overthrowEnabled ? 'Over-throw Occurred' : 'No Over-throw'}
                    </button>
                  </div>
                )}

                {overthrowEnabled && (
                  <div className="ball-entry-row">
                    <span className="ball-entry-label">Over-throw Runs</span>
                    <div className="ball-entry-options">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={`ball-option-btn ${overthrowMode === 'runs' && overthrowRuns === r ? 'selected' : ''}`}
                          onClick={() => {
                            setOverthrowMode('runs');
                            setOverthrowRuns(r);
                          }}
                        >
                          {r}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`ball-option-btn ball-option-wicket ${overthrowMode === 'run_out' ? 'selected' : ''}`}
                        onClick={() => setOverthrowMode('run_out')}
                      >
                        🏃 Run Out
                      </button>
                    </div>
                  </div>
                )}

                {overthrowEnabled && overthrowMode === 'run_out' && (
                  <RunOutFields
                    label="Who's Out (over-throw)"
                    player={overthrowPlayer}
                    onPlayerChange={setOverthrowPlayer}
                    strikerName={playerName(currentInnings.striker_id)}
                    nonStrikerName={playerName(currentInnings.non_striker_id)}
                    runs={overthrowBeforeRuns}
                    onRunsChange={setOverthrowBeforeRuns}
                  />
                )}

                {!overthrowEnabled && (
                  <div className="ball-entry-row">
                    <span className="ball-entry-label">Wicket</span>
                    <div className="ball-entry-options">
                      {[
                        { value: 'none', label: 'None' },
                        // Only a run out can dismiss a batsman on a free hit —
                        // every other dismissal is pardoned by the laws of
                        // cricket, so it's left off the list entirely rather
                        // than shown disabled.
                        ...(currentInnings.free_hit ? [] : [{ value: 'out', label: '🎯 Out' }]),
                        { value: 'run_out', label: '🏃 Run Out' }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`ball-option-btn ${opt.value !== 'none' ? 'ball-option-wicket' : ''} ${wicketType === opt.value ? 'selected' : ''}`}
                          onClick={() => {
                            setWicketType(opt.value);
                            if (opt.value === 'run_out') {
                              setExtraType('none');
                              setSelectedExtraRuns(0);
                              setByeType('none');
                              setByeRuns(1);
                              setRunOutPlayer('striker');
                              setRunOutRuns(0);
                            }
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {!!currentInnings.free_hit && (
                      <span className="hint-text">Free Hit — only a run out counts as a dismissal.</span>
                    )}
                  </div>
                )}

                {wicketType === 'run_out' && (
                  <RunOutFields
                    player={runOutPlayer}
                    onPlayerChange={setRunOutPlayer}
                    strikerName={playerName(currentInnings.striker_id)}
                    nonStrikerName={playerName(currentInnings.non_striker_id)}
                    runs={runOutRuns}
                    onRunsChange={setRunOutRuns}
                  />
                )}

                <button className="btn btn-primary btn-block" onClick={handleAddBall} disabled={ballSubmitting}>
                  {ballSubmitting ? 'Saving…' : '✅ Add Ball'}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {needsOpeners && (
        <OpenersForm battingPlayers={battingPlayers} bowlingPlayers={bowlingPlayers} onSubmit={handleSelectOpeners} />
      )}
      {needsBatsman && <NewBatsmanForm players={availableBatsmen} onSubmit={handleSelectBatsman} />}
      {needsBowler && <NewBowlerForm players={availableBowlers} onSubmit={handleSelectBowler} />}

      {needsSuperOver && (
        <section className="card super-over-prompt">
          <div className="card-title-row" style={{ marginBottom: 10 }}>
            <span className="card-icon-badge">🎯</span>
            <h3 style={{ margin: 0 }}>Scores Level!</h3>
          </div>
          <p className="hint-text" style={{ marginBottom: 14 }}>
            {isSuperOver
              ? `Super Over ${superOverNumber} also finished level — this ${match.stage === 'final' ? 'final' : 'semifinal'} needs another Super Over to produce a winner.`
              : `The match finished level. As a ${match.stage === 'final' ? 'final' : 'semifinal'}, this needs a Super Over to decide the winner.`}
          </p>
          <button className="btn btn-accent" onClick={handleStartSuperOver} disabled={startingSuperOver}>
            {startingSuperOver ? 'Starting…' : `🎯 Start Super Over ${superOverNumber + 1}`}
          </button>
        </section>
      )}

      {canFinish && (
        <section className="card">
          <div className="card-title-row" style={{ marginBottom: 10 }}>
            <span className="card-icon-badge">🏁</span>
            <h3 style={{ margin: 0 }}>Match Over</h3>
          </div>
          <p className="hint-text" style={{ marginBottom: 14 }}>
            Both innings are complete. Review the scorecard below, then finish the match to lock it in.
          </p>
          <button className="btn btn-success" onClick={() => setShowFinish(true)}>
            🏁 Finish Match
          </button>
        </section>
      )}

      <section className="card">
        <MatchScorecardSummary match={match} />
      </section>

      {showFinish && (
        <ConfirmModal
          icon="🏁"
          title="Finish Match?"
          message="Once finished, the scorecard is locked and can no longer be edited. Player of the Match is calculated automatically from runs scored and wickets taken."
          confirmLabel="Yes, Finish Match"
          confirming={finishing}
          onCancel={() => setShowFinish(false)}
          onConfirm={handleFinish}
        />
      )}
    </div>
  );
}
