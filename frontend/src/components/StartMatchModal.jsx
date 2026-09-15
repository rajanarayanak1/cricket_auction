import { useState } from 'react';

export default function StartMatchModal({ team1, team2, onClose, onStart }) {
  const [tossWinnerId, setTossWinnerId] = useState('');
  const [decision, setDecision] = useState('');
  const [overs, setOvers] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!tossWinnerId) {
      setError('Select which team won the toss.');
      return;
    }
    if (!decision) {
      setError('Select whether they chose to bat or field.');
      return;
    }
    const oversValue = Number(overs);
    if (!overs || !Number.isInteger(oversValue) || oversValue < 1) {
      setError('Enter a whole number of at least 1 for the number of overs.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onStart({
        toss_winner_team_id: Number(tossWinnerId),
        toss_decision: decision,
        overs_limit: oversValue
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start the match.');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card start-match-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="card-title-row">
            <span className="card-icon-badge">🏏</span>
            <h3 style={{ margin: 0 }}>Start Match</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="trade-step">
          <div className="trade-step-label">
            <span className="trade-step-number">1</span> Who won the toss?
          </div>
          <div className="trade-team-picker">
            {[team1, team2].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`trade-team-chip ${Number(tossWinnerId) === t.id ? 'selected' : ''}`}
                onClick={() => setTossWinnerId(String(t.id))}
              >
                <span className="trade-team-chip-logo">
                  {t.logo_path ? <img src={t.logo_path} alt="" /> : '🛡️'}
                </span>
                {t.team_name}
              </button>
            ))}
          </div>
        </div>

        <div className="trade-step">
          <div className="trade-step-label">
            <span className="trade-step-number">2</span> What did they choose?
          </div>
          <div className="trade-team-picker">
            <button
              type="button"
              className={`trade-team-chip ${decision === 'bat' ? 'selected' : ''}`}
              onClick={() => setDecision('bat')}
            >
              🏏 Bat First
            </button>
            <button
              type="button"
              className={`trade-team-chip ${decision === 'field' ? 'selected' : ''}`}
              onClick={() => setDecision('field')}
            >
              🧤 Field First
            </button>
          </div>
        </div>

        <div className="trade-step">
          <div className="trade-step-label">
            <span className="trade-step-number">3</span> Overs per innings
          </div>
          <input
            type="number"
            min="1"
            placeholder="e.g. 6"
            value={overs}
            onChange={(e) => setOvers(e.target.value)}
            style={{ maxWidth: 160 }}
          />
        </div>

        {error && <p className="error-text" style={{ marginTop: 16 }}>{error}</p>}

        <div className="modal-footer-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Starting…' : '🏏 Start Match'}
          </button>
        </div>
      </div>
    </div>
  );
}
