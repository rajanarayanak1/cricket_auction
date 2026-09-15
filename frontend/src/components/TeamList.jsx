import { formatCurrency } from '../utils/categoryMeta.js';

export default function TeamList({ teams, players, onDelete, onManageRoster, onEdit, locked }) {
  if (teams.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🛡️</div>
        <h4>No teams added yet</h4>
        <p>Use the form above to register teams for this auction.</p>
      </div>
    );
  }

  return (
    <div className="team-grid">
      {teams.map((team) => {
        const boughtCount = players.filter((p) => p.team_id === team.id).length;
        const captain = players.find((p) => p.team_id === team.id && p.is_captain);
        const rosterPct = team.num_players > 0 ? Math.min((boughtCount / team.num_players) * 100, 100) : 0;

        return (
          <div className="team-card" key={team.id} onClick={() => onManageRoster(team)}>
            <div className="team-card-actions">
              <button
                className="team-card-icon-btn edit"
                title="Edit team"
                aria-label="Edit team"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(team);
                }}
              >
                ✏️
              </button>
              {!locked && (
                <button
                  className="team-card-icon-btn remove"
                  title="Remove team"
                  aria-label="Remove team"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(team.id);
                  }}
                >
                  🗑️
                </button>
              )}
            </div>

            <div className="team-card-top">
              <div className="team-logo">
                {team.logo_path ? (
                  <img src={team.logo_path} alt={`${team.team_name} logo`} />
                ) : (
                  <div className="team-logo-placeholder">🛡️</div>
                )}
              </div>
              <h3>{team.team_name}</h3>
              {captain && <span className="team-card-captain-badge">👑 {captain.name}</span>}
            </div>

            <div className="team-card-divider" />

            <div className="team-card-stats">
              <div className="team-card-stat-row">
                <span>👥 Roster</span>
                <span className="team-card-stat-value">
                  {boughtCount}/{team.num_players}
                </span>
              </div>
              <div className="team-card-progress-track">
                <div className="team-card-progress-fill" style={{ width: `${rosterPct}%` }} />
              </div>
              {team.purse_remaining != null && (
                <div className="team-card-stat-row">
                  <span>💰 Purse Left</span>
                  <span className="team-card-stat-value">{formatCurrency(team.purse_remaining)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
