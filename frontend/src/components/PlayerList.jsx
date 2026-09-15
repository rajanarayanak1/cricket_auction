import { getCategoryMeta, formatCurrency } from '../utils/categoryMeta.js';
import PlayerAvatar from './PlayerAvatar.jsx';

export default function PlayerList({ players, onDelete, onEdit, onEditPhoto, locked, sortDir, onToggleSort }) {
  if (players.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🏏</div>
        <h4>No players added yet</h4>
        <p>Use the form above to add players to this auction.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="th-sortable" onClick={onToggleSort} title="Sort by player name">
              Player
              <span className="sort-arrow">{sortDir === 'asc' ? ' ▲' : sortDir === 'desc' ? ' ▼' : ' ⇕'}</span>
            </th>
            <th>Category</th>
            <th>Base Value</th>
            <th>Tags</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const meta = getCategoryMeta(player.category);

            return (
              <tr key={player.id}>
                <td>
                  <div className="player-name-cell">
                    <PlayerAvatar player={player} />
                    {player.name}
                  </div>
                </td>
                <td>
                  <span className={`chip ${meta.chip}`}>
                    {meta.icon} {player.category}
                  </span>
                </td>
                <td>{formatCurrency(player.base_value)}</td>
                <td>
                  {player.is_captain ? <span className="chip chip-captain">© Captain</span> : null}
                  {player.is_icon ? (
                    <span className="chip chip-icon" style={{ marginLeft: player.is_captain ? 6 : 0 }}>
                      ⭐ Icon
                    </span>
                  ) : null}
                  {!player.is_captain && !player.is_icon ? <span className="hint-text">—</span> : null}
                </td>
                <td>
                  {player.team_id ? (
                    <span className="chip chip-outline">Sold · {formatCurrency(player.sold_price)}</span>
                  ) : player.auction_status === 'unsold' ? (
                    <span className="chip chip-icon">🚫 Unsold</span>
                  ) : (
                    <span className="hint-text">Pending</span>
                  )}
                </td>
                <td className="actions-cell">
                  {locked ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => onEditPhoto(player)}>
                      📷 Photo
                    </button>
                  ) : (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={() => onEdit(player)}>
                        ✏️ Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => onDelete(player.id)}>
                        🗑️ Remove
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
