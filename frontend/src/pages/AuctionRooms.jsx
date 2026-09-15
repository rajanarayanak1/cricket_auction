import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuctionRoomsAPI, AuctionEngineAPI, TournamentsAPI } from '../api/client.js';

const emptyForm = {
  name: '',
  auction_date: '',
  num_teams: '',
  purse_value: '',
  bid_step_up: ''
};

const STATUS_ICON = { created: '📋', live: '🔴', completed: '✅' };

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0);

export default function AuctionRooms() {
  const [activeTab, setActiveTab] = useState('auctions');
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tournaments, setTournaments] = useState([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const navigate = useNavigate();

  const loadRooms = async () => {
    try {
      setLoading(true);
      const data = await AuctionRoomsAPI.list();
      setRooms(data);
    } catch (err) {
      setError('Failed to load auction rooms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
    TournamentsAPI.listAll()
      .then(setTournaments)
      .catch(() => {})
      .finally(() => setTournamentsLoading(false));
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await AuctionRoomsAPI.create(form);
      setForm(emptyForm);
      loadRooms();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create auction room.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this auction room? This will remove its players and teams too.')) return;
    try {
      await AuctionRoomsAPI.remove(id);
      loadRooms();
    } catch (err) {
      setError('Failed to delete auction room.');
    }
  };

  const handleReset = async (id) => {
    if (
      !window.confirm(
        'Reset this auction? All sold players will go back into the pool, team purses will be restored, and every tournament, fixture and match result ever played in this auction room will be permanently deleted. This cannot be undone.'
      )
    )
      return;
    setError('');
    try {
      await AuctionEngineAPI.reset(id);
      loadRooms();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset auction.');
    }
  };

  const handleEnterAuction = async (room) => {
    setError('');
    try {
      if (room.status === 'created') {
        await AuctionRoomsAPI.start(room.id);
      }
      navigate(`/rooms/${room.id}/auction`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start auction.');
    }
  };

  return (
    <div className="page">
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'auctions' ? 'active' : ''}`}
          onClick={() => setActiveTab('auctions')}
        >
          🏟️ Auctions <span className="tab-count">{rooms.length}</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'tournaments' ? 'active' : ''}`}
          onClick={() => setActiveTab('tournaments')}
        >
          🏆 Tournaments <span className="tab-count">{tournaments.length}</span>
        </button>
      </div>

      {activeTab === 'auctions' && (
        <>
      <section className="card">
        <div className="card-title-row" style={{ marginBottom: 18 }}>
          <span className="card-icon-badge">🆕</span>
          <h2>Create New Auction Room</h2>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Auction Name
            <input name="name" placeholder="e.g. Premier League 2026" value={form.name} onChange={handleChange} required />
          </label>
          <label>
            Auction Date
            <input type="date" name="auction_date" value={form.auction_date} onChange={handleChange} required />
          </label>
          <label>
            Number of Teams
            <input type="number" min="2" placeholder="8" name="num_teams" value={form.num_teams} onChange={handleChange} required />
          </label>
          <label>
            Purse Value
            <input type="number" min="0" step="0.01" placeholder="1000000" name="purse_value" value={form.purse_value} onChange={handleChange} required />
          </label>
          <label>
            Bid Step Up Value
            <input type="number" min="0" step="0.01" placeholder="500" name="bid_step_up" value={form.bid_step_up} onChange={handleChange} required />
          </label>
          <button type="submit" className="btn btn-accent">✨ Create Auction Room</button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="card">
        <div className="card-header">
          <div className="card-title-row">
            <span className="card-icon-badge">🏟️</span>
            <h2>Auction Rooms <span className="section-count">({rooms.length})</span></h2>
          </div>
        </div>

        {loading ? (
          <div className="skeleton-grid">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏏</div>
            <h4>No auction rooms yet</h4>
            <p>Create your first auction room above to get started.</p>
          </div>
        ) : (
          <div className="room-grid">
            {rooms.map((room) => (
              <div className="room-card" key={room.id}>
                <div className="room-card-top">
                  <div className="room-card-title-group">
                    <button
                      className="room-card-name"
                      title={room.name}
                      onClick={() => navigate(`/rooms/${room.id}`)}
                    >
                      {room.name}
                    </button>
                    <div className="room-card-date">
                      📅 {new Date(room.auction_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <span className={`badge badge-${room.status}`}>
                    {STATUS_ICON[room.status]} {room.status}
                  </span>
                </div>

                <div className="room-stat-row">
                  <div className="room-stat">
                    <span className="room-stat-value">{room.num_teams}</span>
                    <span className="room-stat-label">Teams</span>
                  </div>
                  <div className="room-stat">
                    <span className="room-stat-value">₹{formatCurrency(room.purse_value)}</span>
                    <span className="room-stat-label">Purse</span>
                  </div>
                  <div className="room-stat">
                    <span className="room-stat-value">₹{formatCurrency(room.bid_step_up)}</span>
                    <span className="room-stat-label">Step Up</span>
                  </div>
                </div>

                <div className="room-card-actions">
                  <button className="btn btn-secondary" onClick={() => navigate(`/rooms/${room.id}`)}>
                    ⚙️ Manage
                  </button>
                  <button className="btn btn-success" onClick={() => handleEnterAuction(room)}>
                    {room.status === 'created' && '▶ Start'}
                    {room.status === 'live' && '🔴 Resume'}
                    {room.status === 'completed' && '🏁 Results'}
                  </button>
                  {room.status === 'completed' && (
                    <button className="btn btn-accent icon-btn" title="Reset auction" onClick={() => handleReset(room.id)}>
                      🔄
                    </button>
                  )}
                  <button className="btn btn-danger icon-btn" title="Delete auction room" onClick={() => handleDelete(room.id)}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
        </>
      )}

      {activeTab === 'tournaments' && (
        <section className="card">
          <div className="card-title-row" style={{ marginBottom: 18 }}>
            <span className="card-icon-badge">🏆</span>
            <h2>Tournaments <span className="section-count">({tournaments.length})</span></h2>
          </div>

          {tournamentsLoading ? (
            <div className="skeleton-grid">
              <div className="skeleton-card" />
              <div className="skeleton-card" />
            </div>
          ) : tournaments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏆</div>
              <h4>No tournaments yet</h4>
              <p>Create one from inside an auction room's Tournament tab.</p>
            </div>
          ) : (
            <div className="tournament-grid">
              {tournaments.map((t) => (
                <div
                  key={t.id}
                  className="tournament-card"
                  onClick={() => navigate(`/rooms/${t.auction_room_id}/tournaments/${t.id}`)}
                >
                  <div className="tournament-card-header">
                    <h4>{t.name}</h4>
                    <span className={`badge ${t.is_completed ? 'badge-completed' : 'badge-live'}`}>
                      {t.is_completed ? '✅ Completed' : '🔴 Ongoing'}
                    </span>
                  </div>
                  <p className="hint-text">{t.room_name}</p>
                  <p className="hint-text">
                    {t.fixture_count} match{t.fixture_count === 1 ? '' : 'es'} · {t.completed_count} completed
                  </p>
                  {t.is_completed && t.winner_team_name && (
                    <p className="tournament-card-winner">
                      🏆 {t.winner_team_name} won{t.player_of_tournament_name ? ` · 🌟 ${t.player_of_tournament_name}` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
