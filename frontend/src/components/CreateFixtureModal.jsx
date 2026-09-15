import { useState } from 'react';

const POOL_MIN_TEAMS = 6;

export default function CreateFixtureModal({ teamCount, mode = 'create', onClose, onCreate }) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState('round_robin');
  const [maxTeamsPerPool, setMaxTeamsPerPool] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const poolEligible = teamCount > POOL_MIN_TEAMS;
  const isCreate = mode === 'create';

  const handleSubmit = async () => {
    setError('');

    if (isCreate && !name.trim()) {
      setError('Enter a name for this tournament.');
      return;
    }

    if (format === 'pool') {
      const max = Number(maxTeamsPerPool);
      if (!maxTeamsPerPool || !Number.isInteger(max) || max < 2) {
        setError('Enter a whole number of at least 2 for max teams per pool.');
        return;
      }
      if (max >= teamCount) {
        setError(`Max teams per pool must be less than the total team count (${teamCount}), so at least 2 pools are formed.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await onCreate({
        ...(isCreate ? { name: name.trim() } : {}),
        type: format,
        ...(format === 'pool' ? { max_teams_per_pool: Number(maxTeamsPerPool) } : {})
      });
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${isCreate ? 'create tournament' : 'regenerate fixtures'}.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card fixture-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="card-title-row">
            <span className="card-icon-badge">🏆</span>
            <h3 style={{ margin: 0 }}>{isCreate ? 'Create Tournament' : 'Regenerate Fixtures'}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <p className="hint-text" style={{ marginTop: -6, marginBottom: 18 }}>
          Schedule matches for {teamCount} teams. Matches are ordered so the same team doesn't play back-to-back unless it's unavoidable.
        </p>

        {isCreate && (
          <label className="field" style={{ marginBottom: 18 }}>
            Tournament Name
            <input
              type="text"
              placeholder="e.g. Summer Cup 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>
        )}

        <div className="fixture-format-options">
          <label className={`fixture-format-card ${format === 'round_robin' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="fixture-format"
              value="round_robin"
              checked={format === 'round_robin'}
              onChange={() => setFormat('round_robin')}
            />
            <div>
              <div className="fixture-format-title">🔁 Round Robin</div>
              <p className="hint-text">Every team plays every other team once.</p>
            </div>
          </label>

          <label
            className={`fixture-format-card ${format === 'pool' ? 'selected' : ''} ${!poolEligible ? 'disabled' : ''}`}
            title={!poolEligible ? `Needs more than ${POOL_MIN_TEAMS} teams` : ''}
          >
            <input
              type="radio"
              name="fixture-format"
              value="pool"
              disabled={!poolEligible}
              checked={format === 'pool'}
              onChange={() => setFormat('pool')}
            />
            <div>
              <div className="fixture-format-title">🗂️ Pool Play</div>
              <p className="hint-text">
                {poolEligible
                  ? 'Split teams randomly into pools, round-robin within each pool.'
                  : `Needs more than ${POOL_MIN_TEAMS} teams (currently ${teamCount}).`}
              </p>
            </div>
          </label>
        </div>

        {format === 'pool' && (
          <label className="field" style={{ marginTop: 4 }}>
            Max Teams per Pool
            <input
              type="number"
              min="2"
              max={teamCount - 1}
              placeholder="e.g. 4"
              value={maxTeamsPerPool}
              onChange={(e) => setMaxTeamsPerPool(e.target.value)}
            />
          </label>
        )}

        {error && <p className="error-text" style={{ marginTop: 16 }}>{error}</p>}

        <div className="modal-footer-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : isCreate ? '🏆 Create Tournament' : '🎯 Regenerate Fixtures'}
          </button>
        </div>
      </div>
    </div>
  );
}
