import { getCategoryMeta, getInitials } from '../utils/categoryMeta.js';

export default function PlayerAvatar({ player, size = 'sm' }) {
  const sizeClass =
    size === 'xl' ? 'sold-card-avatar' : size === 'lg' ? 'current-player-avatar' : size === 'tile' ? 'player-tile-avatar' : 'avatar';

  if (player.photo_path) {
    return (
      <span className={`${sizeClass} avatar-photo`}>
        <img src={`${import.meta.env.VITE_API_URL}${player.photo_path}`} alt={player.name} />
      </span>
    );
  }

  const meta = getCategoryMeta(player.category);
  return <span className={`${sizeClass} ${meta.avatar}`}>{getInitials(player.name)}</span>;
}
