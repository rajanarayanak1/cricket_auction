import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuctionRoomsAPI, AuctionEngineAPI } from '../api/client.js';
import { getCategoryMeta, formatCurrency } from '../utils/categoryMeta.js';
import { generateAuctionPdf } from '../utils/generateAuctionPdf.js';
import PlayerAvatar from '../components/PlayerAvatar.jsx';
import SoldCard from '../components/SoldCard.jsx';

const PHASE_LABEL = {
  not_started: { label: 'Not Started', icon: '⏳', className: 'phase-captains' },
  captains: { label: 'Captains Auction', icon: '©', className: 'phase-captains' },
  icons: { label: 'Icon Players Auction', icon: '⭐', className: 'phase-icons' },
  normal: { label: 'Player Auction', icon: '🏏', className: 'phase-normal' },
  unsold_round: { label: 'Unsold Players Round', icon: '🔁', className: 'phase-unsold' },
  completed: { label: 'Auction Complete', icon: '🏁', className: 'phase-completed' }
};

function maxAllowedBid(team, currentPlayer) {
  const remainingAfterThis = Math.max(team.num_players - team.bought_count - 1, 0);
  const reserve = remainingAfterThis * Number(currentPlayer.base_value);
  return Number(team.purse_remaining) - reserve;
}

export default function LiveAuction() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [liveState, setLiveState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [soldSale, setSoldSale] = useState(null);
  const toastTimer = useRef(null);
  const teamCardRefs = useRef({});
  const getTeamCardEl = (teamId) => teamCardRefs.current[teamId] || null;

  const showToast = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  };

  const bootstrap = async () => {
    try {
      setLoading(true);
      const room = await AuctionRoomsAPI.get(roomId);
      if (room.status === 'created') {
        await AuctionRoomsAPI.start(roomId);
      }
      const state = await AuctionEngineAPI.getState(roomId);
      setLiveState(state);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load the live auction.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bootstrap();
    return () => clearTimeout(toastTimer.current);
  }, [roomId]);

  const handleBid = async (teamId) => {
    setBusy(true);
    setError('');
    try {
      const state = await AuctionEngineAPI.bid(roomId, teamId);
      setLiveState(state);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place bid.');
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    setBusy(true);
    setError('');
    try {
      const state = await AuctionEngineAPI.undo(roomId);
      setLiveState(state);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to undo bid.');
    } finally {
      setBusy(false);
    }
  };

  const handleSold = async () => {
    if (!liveState.currentPlayer || !liveState.room.current_bid_team_id) return;
    const soldTeam = liveState.teams.find((t) => t.id === liveState.room.current_bid_team_id);
    const soldPlayer = liveState.currentPlayer;
    const soldPrice = liveState.room.current_bid_amount;

    setBusy(true);
    setError('');
    try {
      const state = await AuctionEngineAPI.sold(roomId);
      setLiveState(state);
      // The animated SoldCard (player -> team) replaces the plain toast here —
      // it already conveys player/team/price, more attractively.
      setSoldSale({ player: soldPlayer, team: soldTeam, price: soldPrice, key: Date.now() });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark player as sold.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnsold = async () => {
    if (!liveState.currentPlayer) return;
    const playerName = liveState.currentPlayer.name;

    setBusy(true);
    setError('');
    try {
      const state = await AuctionEngineAPI.unsold(roomId);
      setLiveState(state);
      showToast(`🚫 ${playerName} went unsold — back in the pool`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark player as unsold.');
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = async () => {
    setPdfGenerating(true);
    setError('');
    try {
      const state = await AuctionEngineAPI.finish(roomId);
      setLiveState(state);
      generateAuctionPdf(state.room, state.teams, state.players);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to finish auction.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleDownloadAgain = () => {
    generateAuctionPdf(liveState.room, liveState.teams, liveState.players);
  };

  const performReset = async () => {
    setResetting(true);
    setError('');
    try {
      await AuctionEngineAPI.reset(roomId);
      navigate(`/rooms/${roomId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset auction.');
    } finally {
      setResetting(false);
    }
  };

  const handleReset = () => {
    if (
      window.confirm(
        'Reset this auction? All sold players will go back into the pool, team purses will be restored, and every tournament, fixture and match result ever played in this auction room will be permanently deleted. Teams and players themselves are kept. The auction will be ready to start again.'
      )
    ) {
      performReset();
    }
  };

  const handleAbort = () => {
    if (
      window.confirm(
        'Abort this auction? Bidding will stop immediately, every sale made so far will be undone, all players will return to the pool, team purses will be restored to their starting amount, and every tournament, fixture and match result ever played in this auction room will be permanently deleted. Teams and players themselves are kept. This cannot be undone. Continue?'
      )
    ) {
      performReset();
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton-card" style={{ height: 220 }} />
      </div>
    );
  }

  if (error && !liveState) {
    return (
      <div className="page">
        <p className="error-text">{error}</p>
        <button className="link-btn" onClick={() => navigate(`/rooms/${roomId}`)}>
          ← Back to Manage Auction
        </button>
      </div>
    );
  }

  const { room, teams, currentPlayer, remainingCount } = liveState;
  const phaseInfo = PHASE_LABEL[room.phase] || PHASE_LABEL.not_started;
  const isAuctionOver = room.phase === 'completed' && !currentPlayer;

  const effectiveCurrentBid = currentPlayer
    ? room.current_bid_amount != null
      ? Number(room.current_bid_amount)
      : Number(currentPlayer.base_value)
    : 0;

  // The first bid on a player just claims them at their base price — the
  // step-up only applies once there's an existing bid to raise. Mirrors the
  // same rule in backend/src/controllers/auctionEngineController.js.
  const nextBidAmount = currentPlayer
    ? room.current_bid_amount == null
      ? Number(currentPlayer.base_value)
      : effectiveCurrentBid + Number(room.bid_step_up)
    : 0;

  const leadingTeam = room.current_bid_team_id ? teams.find((t) => t.id === room.current_bid_team_id) : null;

  return (
    <div className="page">
      <SoldCard sale={soldSale} getTeamCardEl={getTeamCardEl} onDone={() => setSoldSale(null)} />

      <div className="live-header">
        <div className="live-header-left">
          <Link to={`/rooms/${roomId}`} className="link-btn back-link">
            ← Back to Manage Auction
          </Link>
          <h2>{room.name}</h2>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`phase-banner ${phaseInfo.className}`}>
            {phaseInfo.icon} {phaseInfo.label}
          </span>
          {!isAuctionOver && <span className="remaining-pill">👥 {remainingCount} players remaining</span>}
          {!isAuctionOver && (
            <button className="btn btn-danger btn-sm" disabled={resetting} onClick={handleAbort}>
              {resetting ? 'Aborting…' : '🛑 Abort Auction'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {isAuctionOver ? (
        <section className="card">
          <div className="completion-panel">
            <div className="completion-trophy">🏆</div>
            <h2>Auction Complete!</h2>
            <p className="hint-text">Every player has been auctioned off. Here's how the teams shaped up.</p>

            <div className="completion-summary-grid">
              {teams.map((team) => {
                const spent = Number(room.purse_value) - Number(team.purse_remaining);
                return (
                  <div className="completion-team-card" key={team.id}>
                    <div className="team-bid-logo">
                      {team.logo_path ? <img src={team.logo_path} alt={team.team_name} /> : '🛡️'}
                    </div>
                    <div>
                      <div className="team-bid-name">{team.team_name}</div>
                      <div className="completion-team-meta">
                        {team.bought_count}/{team.num_players} players · Spent {formatCurrency(spent)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {room.status === 'completed' ? (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-accent" onClick={handleDownloadAgain}>
                  📄 Download Results PDF
                </button>
                <button className="btn btn-secondary" disabled={resetting} onClick={handleReset}>
                  {resetting ? 'Resetting…' : '🔄 Reset Auction'}
                </button>
              </div>
            ) : (
              <button className="btn btn-accent" disabled={pdfGenerating} onClick={handleFinish}>
                {pdfGenerating ? 'Generating…' : '🏁 Finish Auction & Download PDF'}
              </button>
            )}
          </div>
        </section>
      ) : (
        <>
          {currentPlayer && (
            <section className="current-player-card">
              <div className="current-player-info">
                <PlayerAvatar player={currentPlayer} size="lg" />
                <div>
                  <h3 className="current-player-name">{currentPlayer.name}</h3>
                  <div className="current-player-tags">
                    <span className="chip">
                      {getCategoryMeta(currentPlayer.category).icon} {currentPlayer.category}
                    </span>
                    <span className="chip">Base {formatCurrency(currentPlayer.base_value)}</span>
                    {currentPlayer.is_captain ? <span className="chip">© Captain</span> : null}
                    {currentPlayer.is_icon ? <span className="chip">⭐ Icon</span> : null}
                  </div>
                </div>
              </div>

              <div className="bid-display">
                <div className="bid-display-label">Current Bid</div>
                <div className="bid-display-amount">{formatCurrency(effectiveCurrentBid)}</div>
                <div className="bid-display-team">
                  {leadingTeam ? (
                    <>🏆 {leadingTeam.team_name}</>
                  ) : (
                    <span style={{ opacity: 0.75 }}>No bids yet</span>
                  )}
                </div>
                <div className="bid-controls" style={{ marginTop: 14 }}>
                  <button className="btn btn-secondary btn-sm" disabled={busy || room.current_bid_amount == null} onClick={handleUndo}>
                    ↺ Undo Bid
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={busy || !!room.current_bid_team_id}
                    title={room.current_bid_team_id ? 'Undo the bid first to mark this player unsold' : 'No bids — mark unsold'}
                    onClick={handleUnsold}
                  >
                    🚫 Unsold
                  </button>
                  <button className="btn btn-success btn-sm" disabled={busy || !room.current_bid_team_id} onClick={handleSold}>
                    ✅ Sold
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-title-row" style={{ marginBottom: 16 }}>
              <span className="card-icon-badge">🛡️</span>
              <h3 style={{ margin: 0 }}>Teams — tap to bid</h3>
            </div>
            <div className="team-bid-grid">
              {teams.map((team) => {
                const isLeader = team.id === room.current_bid_team_id;
                const rosterFull = team.bought_count >= team.num_players;
                const canAfford = currentPlayer ? nextBidAmount <= maxAllowedBid(team, currentPlayer) : false;
                const disabled = busy || !currentPlayer || isLeader || rosterFull || !canAfford;

                let statusLabel = null;
                if (isLeader) statusLabel = '🏆 Leading';
                else if (rosterFull) statusLabel = 'Roster Full';
                else if (!canAfford) statusLabel = 'Insufficient Purse';

                return (
                  <button
                    key={team.id}
                    ref={(el) => {
                      teamCardRefs.current[team.id] = el;
                    }}
                    className={`team-bid-card ${isLeader ? 'leading' : ''}`}
                    disabled={disabled}
                    onClick={() => handleBid(team.id)}
                    title={statusLabel || `Bid ${formatCurrency(nextBidAmount)}`}
                  >
                    <div className="team-bid-logo">
                      {team.logo_path ? <img src={team.logo_path} alt={team.team_name} /> : '🛡️'}
                    </div>
                    <div className="team-bid-name">{team.team_name}</div>
                    <div className="team-bid-purse">{formatCurrency(team.purse_remaining)} left</div>
                    <div className="team-bid-roster">
                      {team.bought_count}/{team.num_players} players
                    </div>
                    {statusLabel && <div className="team-bid-status">{statusLabel}</div>}
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
