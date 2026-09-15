import { useState } from 'react';
import { PlayersAPI, TeamsAPI } from '../api/client.js';
import { formatCurrency } from '../utils/categoryMeta.js';
import { generateTeamRosterPdf } from '../utils/generateTeamRosterPdf.js';
import PlayerAvatar from './PlayerAvatar.jsx';

const JERSEY_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL'];
const SLEEVE_TYPES = ['Half', 'Full'];

function RosterRow({ roomId, player, onSaved }) {
  const [kit, setKit] = useState({
    jersey_number: player.jersey_number || '',
    jersey_size: player.jersey_size || '',
    sleeve_type: player.sleeve_type || ''
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (e) => {
    setSaved(false);
    setKit({ ...kit, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await PlayersAPI.updateKit(roomId, player.id, kit);
      onSaved(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="roster-row">
      <div className="roster-row-name">
        <PlayerAvatar player={player} />
        <div className="roster-player-info">
          <div className="roster-player-name" title={player.name}>
            {player.name}
            {player.is_captain ? ' 👑' : null}
          </div>
          <div className="hint-text" style={{ fontSize: 11 }}>{formatCurrency(player.sold_price)}</div>
        </div>
      </div>
      <input
        className="jersey-number-input"
        name="jersey_number"
        placeholder="#"
        maxLength={3}
        value={kit.jersey_number}
        onChange={handleChange}
      />
      <select name="jersey_size" value={kit.jersey_size} onChange={handleChange}>
        <option value="">Size…</option>
        {JERSEY_SIZES.map((size) => (
          <option key={size} value={size}>{size}</option>
        ))}
      </select>
      <select name="sleeve_type" value={kit.sleeve_type} onChange={handleChange}>
        <option value="">Sleeve…</option>
        {SLEEVE_TYPES.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <div>
        {saved ? (
          <span className="roster-save-status">✓ Saved</span>
        ) : (
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
            {saving ? '…' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
}

function OwnerEditor({ roomId, team, onSaved }) {
  const [ownerName, setOwnerName] = useState(team.owner_name || '');
  const [ownerJerseyNumber, setOwnerJerseyNumber] = useState(team.owner_jersey_number || '');
  const [ownerJerseySize, setOwnerJerseySize] = useState(team.owner_jersey_size || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const markDirty = () => setSaved(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await TeamsAPI.updateOwner(roomId, team.id, {
        owner_name: ownerName,
        owner_jersey_number: ownerJerseyNumber,
        owner_jersey_size: ownerJerseySize
      });
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="owner-editor">
      <span className="hint-text">👤 Team Owner</span>
      <div className="owner-editor-row">
        <input
          placeholder="Owner name"
          value={ownerName}
          onChange={(e) => {
            setOwnerName(e.target.value);
            markDirty();
          }}
        />
        <input
          className="jersey-number-input"
          placeholder="Jersey #"
          maxLength={3}
          value={ownerJerseyNumber}
          onChange={(e) => {
            setOwnerJerseyNumber(e.target.value);
            markDirty();
          }}
        />
        <select
          value={ownerJerseySize}
          onChange={(e) => {
            setOwnerJerseySize(e.target.value);
            markDirty();
          }}
        >
          <option value="">Size…</option>
          {JERSEY_SIZES.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
          {saving ? '…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function CaptainSection({ roomId, team, captain, captainCandidates, locked, onChanged }) {
  const [playerId, setPlayerId] = useState('');
  const [baseValue, setBaseValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handlePlayerChange = (e) => {
    const id = e.target.value;
    setPlayerId(id);
    const player = captainCandidates.find((p) => String(p.id) === id);
    setBaseValue(player ? String(player.base_value) : '');
  };

  const handleAssign = async () => {
    if (!playerId || !baseValue) {
      setError('Select a player and enter a base value.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const result = await TeamsAPI.assignCaptain(roomId, team.id, {
        player_id: Number(playerId),
        base_value: Number(baseValue)
      });
      onChanged(result);
      setPlayerId('');
      setBaseValue('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign captain.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    if (!window.confirm(`Unassign ${captain.name} as ${team.team_name}'s captain? Their purse will be refunded.`)) return;
    setSubmitting(true);
    try {
      const result = await TeamsAPI.unassignCaptain(roomId, team.id);
      onChanged(result);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to unassign captain.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="captain-section">
      <span className="hint-text">👑 Captain</span>
      {captain ? (
        <div className="captain-assigned-row">
          <PlayerAvatar player={captain} />
          <div style={{ flex: 1 }}>
            <div>{captain.name}</div>
            <div className="hint-text" style={{ fontSize: 11 }}>{formatCurrency(captain.sold_price)}</div>
          </div>
          {!locked && (
            <button className="btn btn-danger btn-sm" disabled={submitting} onClick={handleUnassign}>
              Unassign
            </button>
          )}
        </div>
      ) : locked ? (
        <p className="hint-text">Captains can only be assigned before the auction starts.</p>
      ) : captainCandidates.length === 0 ? (
        <p className="hint-text">
          No captain-flagged players available — mark a player as Captain in the Players tab first.
        </p>
      ) : (
        <div className="captain-assign-row">
          <select value={playerId} onChange={handlePlayerChange}>
            <option value="">Select a player…</option>
            {captainCandidates.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Base value"
            value={baseValue}
            onChange={(e) => setBaseValue(e.target.value)}
            style={{ width: 110 }}
          />
          <button className="btn btn-primary btn-sm" disabled={submitting} onClick={handleAssign}>
            {submitting ? '…' : 'Assign'}
          </button>
        </div>
      )}
      {error && <p className="error-text" style={{ marginTop: 6, fontSize: 12.5 }}>{error}</p>}
    </div>
  );
}

export default function TeamRosterModal({ roomId, team, players, captainCandidates, locked, onClose, onPlayerSaved, onOwnerSaved, onCaptainChanged }) {
  const captain = players.find((p) => p.is_captain);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState('');

  const handleGenerateReport = async () => {
    setReportError('');
    setGeneratingReport(true);
    try {
      await generateTeamRosterPdf(team, players);
    } catch (err) {
      setReportError('Failed to generate the report. Please try again.');
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card roster-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="card-title-row">
            <span className="card-icon-badge">🛡️</span>
            <h3 style={{ margin: 0 }}>{team.team_name} Roster</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <OwnerEditor roomId={roomId} team={team} onSaved={onOwnerSaved} />
          <CaptainSection
            roomId={roomId}
            team={team}
            captain={captain}
            captainCandidates={captainCandidates}
            locked={locked}
            onChanged={onCaptainChanged}
          />

          {players.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏏</div>
              <h4>No players purchased yet</h4>
              <p>Players this team wins in the auction will show up here for jersey assignment.</p>
            </div>
          ) : (
            <div>
              <div className="roster-row roster-header-row">
                <span className="hint-text">Player</span>
                <span className="hint-text">Jersey #</span>
                <span className="hint-text">Size</span>
                <span className="hint-text">Sleeve</span>
                <span></span>
              </div>
              {players.map((player) => (
                <RosterRow key={player.id} roomId={roomId} player={player} onSaved={onPlayerSaved} />
              ))}
            </div>
          )}

          <div className="modal-footer-actions roster-report-actions">
            <span className="hint-text roster-report-hint">
              {reportError || 'Includes jersey number, size and sleeve for each player where entered.'}
            </span>
            <button
              className="btn btn-primary"
              disabled={players.length === 0 || generatingReport}
              onClick={handleGenerateReport}
            >
              {generatingReport ? 'Generating…' : '📄 Generate Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
