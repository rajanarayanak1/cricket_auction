import { useState } from 'react';
import { TradeAPI } from '../api/client.js';
import { getCategoryMeta, formatCurrency } from '../utils/categoryMeta.js';
import PlayerAvatar from './PlayerAvatar.jsx';
import ConfirmModal from './ConfirmModal.jsx';

export default function TradeModal({ roomId, sourcePlayer, teams, players, onClose, onCompleted }) {
  const [targetTeamId, setTargetTeamId] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const sourceTeam = teams.find((t) => t.id === sourcePlayer.team_id);
  const otherTeams = teams.filter((t) => t.id !== sourcePlayer.team_id);
  const targetTeam = teams.find((t) => t.id === Number(targetTeamId));
  const targetTeamPlayers = targetTeamId ? players.filter((p) => p.team_id === Number(targetTeamId)) : [];
  const selectedPlayers = targetTeamPlayers.filter((p) => selectedIds.includes(p.id));
  const sourceMeta = getCategoryMeta(sourcePlayer.category);

  const selectTargetTeam = (teamId) => {
    setTargetTeamId(String(teamId));
    setSelectedIds([]);
    setError('');
  };

  const toggleSelect = (playerId) => {
    setSelectedIds((prev) => (prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]));
  };

  const handleSubmit = () => {
    if (!targetTeamId || selectedIds.length === 0) {
      setError('Select a team and at least one player to trade for.');
      return;
    }
    setError('');
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const updatedPlayers = await TradeAPI.execute(roomId, {
        player_out_id: sourcePlayer.id,
        team_in_id: Number(targetTeamId),
        players_in_ids: selectedIds
      });
      onCompleted(updatedPlayers);
    } catch (err) {
      setShowConfirm(false);
      setError(err.response?.data?.message || 'Failed to complete trade.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card trade-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="card-title-row">
              <span className="card-icon-badge">🔁</span>
              <h3 style={{ margin: 0 }}>Trade Player</h3>
            </div>
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="trade-modal-body">
            <div className="trade-source-row">
              <PlayerAvatar player={sourcePlayer} size="lg" />
              <div className="trade-source-info">
                <span className="trade-source-label">Trading Away</span>
                <div className="trade-source-name">{sourcePlayer.name}</div>
                <div className="trade-source-meta">
                  <span className={`chip ${sourceMeta.chip}`}>{sourceMeta.icon} {sourcePlayer.category}</span>
                  <span className="hint-text">{formatCurrency(sourcePlayer.sold_price)}</span>
                </div>
              </div>
              <span className="chip chip-outline trade-source-team">🛡️ {sourceTeam?.team_name}</span>
            </div>

            <div className="trade-flow-divider">
              <span className="trade-flow-divider-icon">⇄</span>
            </div>

            <div className="trade-step">
              <div className="trade-step-label">
                <span className="trade-step-number">1</span> Trade with which team?
              </div>
              <div className="trade-team-picker">
                {otherTeams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`trade-team-chip ${Number(targetTeamId) === t.id ? 'selected' : ''}`}
                    onClick={() => selectTargetTeam(t.id)}
                  >
                    <span className="trade-team-chip-logo">
                      {t.logo_path ? <img src={t.logo_path} alt="" /> : '🛡️'}
                    </span>
                    {t.team_name}
                  </button>
                ))}
              </div>
            </div>

            {targetTeamId && (
              <div className="trade-step">
                <div className="trade-step-label">
                  <span className="trade-step-number">2</span> Receive which player(s) in return?
                  {selectedIds.length > 0 && (
                    <span className="chip chip-captain trade-step-count">✓ {selectedIds.length} selected</span>
                  )}
                </div>
                {targetTeamPlayers.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 12px' }}>
                    <div className="empty-state-icon">🏏</div>
                    <p>{targetTeam?.team_name} has no players to trade yet.</p>
                  </div>
                ) : (
                  <div className="trade-player-list">
                    {targetTeamPlayers.map((player) => {
                      const meta = getCategoryMeta(player.category);
                      const checked = selectedIds.includes(player.id);
                      const isCaptain = !!player.is_captain;
                      return (
                        <label
                          key={player.id}
                          className={`trade-player-row ${checked ? 'selected' : ''} ${isCaptain ? 'disabled' : ''}`}
                          title={isCaptain ? 'Captains cannot be traded' : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isCaptain}
                            onChange={() => toggleSelect(player.id)}
                          />
                          <PlayerAvatar player={player} />
                          <div className="trade-player-row-info">
                            <div className="trade-player-row-name">{player.name}</div>
                            <div className="trade-chip-row">
                              <span className={`chip ${meta.chip}`}>{meta.icon} {player.category}</span>
                              {isCaptain && <span className="chip chip-captain">© Captain</span>}
                            </div>
                          </div>
                          <div className="trade-player-row-price">{formatCurrency(player.sold_price)}</div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {selectedPlayers.length > 0 && (
              <div className="trade-summary-bar">
                <span className="trade-summary-player">{sourcePlayer.name}</span>
                <span className="trade-summary-arrow">⇄</span>
                <span className="trade-summary-player">{selectedPlayers.map((p) => p.name).join(', ')}</span>
              </div>
            )}

            {error && !showConfirm && <p className="error-text" style={{ marginTop: 16 }}>{error}</p>}
          </div>

          <div className="modal-footer-actions">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={!targetTeamId || selectedIds.length === 0}>
              🔁 Submit Trade{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          icon="🔁"
          title="Confirm Trade?"
          message={`Send ${sourcePlayer.name} to ${targetTeam?.team_name} in exchange for ${selectedPlayers.map((p) => p.name).join(', ')}?`}
          confirmLabel="Yes, Complete Trade"
          confirming={submitting}
          error={error}
          onCancel={() => {
            setShowConfirm(false);
            setError('');
          }}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
