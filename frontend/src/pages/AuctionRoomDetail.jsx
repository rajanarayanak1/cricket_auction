import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AuctionRoomsAPI, PlayersAPI, TeamsAPI, AuctionEngineAPI, TournamentsAPI } from '../api/client.js';
import PlayerForm from '../components/PlayerForm.jsx';
import PlayerList from '../components/PlayerList.jsx';
import TeamList from '../components/TeamList.jsx';
import TeamRosterModal from '../components/TeamRosterModal.jsx';
import TeamEditModal from '../components/TeamEditModal.jsx';
import TeamAddModal from '../components/TeamAddModal.jsx';
import PlayerEditModal from '../components/PlayerEditModal.jsx';
import PlayerImportExportBar from '../components/PlayerImportExportBar.jsx';
import CreateFixtureModal from '../components/CreateFixtureModal.jsx';
import TradeModal from '../components/TradeModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import TabBar from '../components/TabBar.jsx';
import PlayerAvatar from '../components/PlayerAvatar.jsx';
import { getCategoryMeta, formatCurrency } from '../utils/categoryMeta.js';
import { generateAuctionPdf } from '../utils/generateAuctionPdf.js';
import { generatePoolPlayersPdf } from '../utils/generatePoolPlayersPdf.js';

export default function AuctionRoomDetail() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [room, setRoom] = useState(null);
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'players');
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState('');
  const [rosterTeam, setRosterTeam] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editPhotoOnly, setEditPhotoOnly] = useState(false);
  const [sortDir, setSortDir] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [showCreateTournamentModal, setShowCreateTournamentModal] = useState(false);
  const [tradeTeam, setTradeTeam] = useState(null);
  const [tradingPlayer, setTradingPlayer] = useState(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState('');
  const [generatingPoolPdf, setGeneratingPoolPdf] = useState(false);

  const loadAll = async () => {
    try {
      const [roomData, playersData, teamsData, tournamentsData] = await Promise.all([
        AuctionRoomsAPI.get(roomId),
        PlayersAPI.list(roomId),
        TeamsAPI.list(roomId),
        TournamentsAPI.list(roomId)
      ]);
      setRoom(roomData);
      setPlayers(playersData);
      setTeams(teamsData);
      setTournaments(tournamentsData);
    } catch (err) {
      setError('Failed to load auction room details.');
    }
  };

  useEffect(() => {
    loadAll();
  }, [roomId]);

  const handleAddPlayer = async (payload) => {
    try {
      const newPlayer = await PlayersAPI.create(roomId, payload);
      setPlayers((prev) => [newPlayer, ...prev]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add player.');
    }
  };

  const handleDeletePlayer = async (playerId) => {
    if (!window.confirm('Remove this player?')) return;
    await PlayersAPI.remove(roomId, playerId);
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
  };

  const handleDeleteAllPlayers = async () => {
    setDeleteAllError('');
    setDeletingAll(true);
    try {
      await PlayersAPI.removeAll(roomId);
      setPlayers([]);
      setShowDeleteAllConfirm(false);
    } catch (err) {
      setDeleteAllError(err.response?.data?.message || 'Failed to delete all players.');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleDownloadPoolPlayers = async () => {
    setError('');
    setGeneratingPoolPdf(true);
    try {
      await generatePoolPlayersPdf(room, players);
    } catch (err) {
      setError('Failed to generate the pool players report.');
    } finally {
      setGeneratingPoolPdf(false);
    }
  };

  const handlePlayerUpdated = (updatedPlayer) => {
    setPlayers((prev) => prev.map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p)));
  };

  const handleTeamUpdated = (updatedTeam) => {
    setTeams((prev) => prev.map((t) => (t.id === updatedTeam.id ? updatedTeam : t)));
    setRosterTeam((prev) => (prev && prev.id === updatedTeam.id ? updatedTeam : prev));
  };

  const handleTeamAdded = (newTeam) => {
    setTeams((prev) => [newTeam, ...prev]);
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('Remove this team?')) return;
    await TeamsAPI.remove(roomId, teamId);
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
  };

  const handleCreateTournament = async (payload) => {
    const created = await TournamentsAPI.create(roomId, payload);
    setShowCreateTournamentModal(false);
    navigate(`/rooms/${roomId}/tournaments/${created.id}`);
  };

  const handleTradeCompleted = (updatedPlayers) => {
    setPlayers(updatedPlayers);
    setTradingPlayer(null);
  };

  const handlePlayerKitSaved = (updatedPlayer) => {
    setPlayers((prev) => prev.map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p)));
  };

  const handleTeamOwnerSaved = (updatedTeam) => {
    setTeams((prev) => prev.map((t) => (t.id === updatedTeam.id ? updatedTeam : t)));
    setRosterTeam((prev) => (prev && prev.id === updatedTeam.id ? updatedTeam : prev));
  };

  const handleCaptainChanged = ({ player, team }) => {
    setPlayers((prev) => prev.map((p) => (p.id === player.id ? player : p)));
    setTeams((prev) => prev.map((t) => (t.id === team.id ? team : t)));
    setRosterTeam((prev) => (prev && prev.id === team.id ? team : prev));
  };

  const handleResumeUnsold = async () => {
    setError('');
    try {
      await AuctionEngineAPI.resumeUnsold(roomId);
      navigate(`/rooms/${roomId}/auction`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resume auction for unsold players.');
    }
  };

  const handleStartAuction = async () => {
    setError('');
    try {
      await AuctionRoomsAPI.start(roomId);
      navigate(`/rooms/${roomId}/auction`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start the auction.');
    }
  };

  if (!room) {
    return (
      <div className="page">
        {error ? <p className="error-text">{error}</p> : <div className="skeleton-card" style={{ height: 140 }} />}
      </div>
    );
  }

  const locked = room.status !== 'created';
  const toggleSort = () => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  const sortedPlayers = sortDir
    ? [...players].sort((a, b) =>
        sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      )
    : players;
  const unsoldPlayers = players.filter((p) => p.auction_status === 'unsold' && !p.team_id);
  const canResumeUnsold = room.phase === 'completed' && unsoldPlayers.length > 0;
  const auctionCompleted = room.status === 'completed';
  const poolPlayerCount = players.filter((p) => !p.team_id).length;

  return (
    <div className="page">
      <button className="link-btn back-link" onClick={() => navigate('/dashboard')}>
        ← Back to Auction Rooms
      </button>

      <section className="card room-summary">
        <h2>{room.name}</h2>
        <div className="room-meta">
          <span className="meta-pill">📅 {new Date(room.auction_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span className="meta-pill">🏟️ {room.num_teams} Teams</span>
          <span className="meta-pill">💰 Purse ₹{Number(room.purse_value).toLocaleString('en-IN')}</span>
          <span className="meta-pill">📈 Step Up ₹{Number(room.bid_step_up).toLocaleString('en-IN')}</span>
          <span className={`badge badge-${room.status}`}>{room.status}</span>
          {room.status === 'created' && (
            <button
              className="btn btn-accent btn-sm"
              disabled={teams.length === 0 || players.length === 0}
              title={teams.length === 0 || players.length === 0 ? 'Add at least one team and one player first' : ''}
              onClick={handleStartAuction}
            >
              ▶ Start Auction
            </button>
          )}
          {room.status !== 'created' && (
            <button className="btn btn-accent btn-sm" onClick={() => navigate(`/rooms/${roomId}/auction`)}>
              {room.status === 'live' ? '🔴 Go to Live Auction' : '🏁 View Results'}
            </button>
          )}
        </div>
      </section>

      {error && <p className="error-text">{error}</p>}

      {unsoldPlayers.length > 0 && (
        <section className="card">
          <div className="card-header">
            <div className="card-title-row">
              <span className="card-icon-badge">🔁</span>
              <h3 style={{ margin: 0 }}>Unsold Players <span className="section-count">({unsoldPlayers.length})</span></h3>
            </div>
            {canResumeUnsold && (
              <button className="btn btn-accent" onClick={handleResumeUnsold}>
                ▶ Resume Auction for Unsold Players
              </button>
            )}
          </div>
          <p className="hint-text" style={{ marginBottom: 14 }}>
            {canResumeUnsold
              ? 'The auction has finished with these players still unsold. Resume to give them another shot.'
              : 'No team bid on these — they’ll automatically come up again once the current auction pool is exhausted.'}
          </p>
          <div className="team-bid-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {unsoldPlayers.map((player) => {
              const meta = getCategoryMeta(player.category);
              return (
                <div className="chip-outline" key={player.id} style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{player.name}</div>
                  <span className={`chip ${meta.chip}`}>
                    {meta.icon} {player.category}
                  </span>
                  <div className="hint-text" style={{ marginTop: 6 }}>{formatCurrency(player.base_value)}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: 'players', icon: '🏏', label: 'Players', count: players.length },
          { key: 'teams', icon: '🛡️', label: 'Teams', count: teams.length },
          { key: 'trade', icon: '🔁', label: 'Trade' },
          { key: 'tournament', icon: '🏆', label: 'Tournament', count: tournaments.length }
        ]}
      />

      {activeTab === 'players' && (
        <section className="card">
          {locked ? (
            <p className="hint-text">
              🔒 The auction has started — players can no longer be added, removed, or edited, aside from updating a photo (📷 button).
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                <div className="card-title-row" style={{ margin: 0 }}>
                  <span className="card-icon-badge">➕</span>
                  <h3 style={{ margin: 0 }}>Add Player</h3>
                </div>
                {players.length > 0 && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      setDeleteAllError('');
                      setShowDeleteAllConfirm(true);
                    }}
                  >
                    🗑️ Delete All Players
                  </button>
                )}
              </div>
              <PlayerForm onSubmit={handleAddPlayer} />
            </>
          )}
          <h3>Players <span className="section-count">({players.length})</span></h3>
          <PlayerImportExportBar
            roomId={roomId}
            roomName={room.name}
            players={sortedPlayers}
            locked={locked}
            onImportComplete={loadAll}
          />
          <PlayerList
            players={sortedPlayers}
            onDelete={handleDeletePlayer}
            onEdit={(player) => {
              setEditingPlayer(player);
              setEditPhotoOnly(false);
            }}
            onEditPhoto={(player) => {
              setEditingPlayer(player);
              setEditPhotoOnly(true);
            }}
            locked={locked}
            sortDir={sortDir}
            onToggleSort={toggleSort}
          />
        </section>
      )}

      {activeTab === 'teams' && (
        <section className="card">
          <div className="card-header">
            <div className="card-title-row">
              <span className="card-icon-badge">🛡️</span>
              <h3 style={{ margin: 0 }}>Teams <span className="section-count">({teams.length})</span></h3>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={teams.length === 0}
                onClick={() => generateAuctionPdf(room, teams, players)}
              >
                📄 Download Auction Report
              </button>
              {!auctionCompleted && (
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={poolPlayerCount === 0 || generatingPoolPdf}
                  onClick={handleDownloadPoolPlayers}
                >
                  {generatingPoolPdf ? 'Generating…' : '🏊 Pool Players'}
                </button>
              )}
              {!locked && (
                <button className="btn btn-primary" onClick={() => setShowAddTeamModal(true)}>
                  ➕ Add Team
                </button>
              )}
            </div>
          </div>
          {locked ? (
            <p className="hint-text">
              🔒 The auction has started — teams are locked. Click a team below to manage jersey numbers and sizes.
            </p>
          ) : (
            <p className="hint-text" style={{ marginTop: -6, marginBottom: 14 }}>
              Click a team to assign jersey numbers, sizes and sleeve types for its players.
            </p>
          )}
          <TeamList
            teams={teams}
            players={players}
            onDelete={handleDeleteTeam}
            onManageRoster={setRosterTeam}
            onEdit={setEditingTeam}
            locked={locked}
          />
        </section>
      )}

      {activeTab === 'tournament' && (
        <section className="card">
          <div className="card-header">
            <div className="card-title-row">
              <span className="card-icon-badge">🏆</span>
              <h3 style={{ margin: 0 }}>Tournaments <span className="section-count">({tournaments.length})</span></h3>
            </div>
            <button
              className="btn btn-primary"
              disabled={teams.length < 2}
              title={teams.length < 2 ? 'Add at least 2 teams first' : ''}
              onClick={() => setShowCreateTournamentModal(true)}
            >
              ➕ Create Tournament
            </button>
          </div>

          {tournaments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏆</div>
              <h4>No tournaments yet</h4>
              <p>Create a tournament to schedule Round Robin or Pool Play matches for these teams.</p>
            </div>
          ) : (
            <div className="tournament-grid">
              {tournaments.map((t) => (
                <div key={t.id} className="tournament-card" onClick={() => navigate(`/rooms/${roomId}/tournaments/${t.id}`)}>
                  <div className="tournament-card-header">
                    <h4>{t.name}</h4>
                    <span className={`badge ${t.is_completed ? 'badge-completed' : 'badge-live'}`}>
                      {t.is_completed ? '✅ Completed' : '🔴 Ongoing'}
                    </span>
                  </div>
                  <p className="hint-text">
                    {t.fixture_count} match{t.fixture_count === 1 ? '' : 'es'} · {t.completed_count} completed
                  </p>
                  {t.is_completed && t.winner_team_name && (
                    <p className="tournament-card-winner">
                      🏆 {t.winner_team_name} won{t.player_of_tournament_name ? ` · 🌟 ${t.player_of_tournament_name}` : ''}
                    </p>
                  )}
                  <span className="hint-text">
                    Created {new Date(t.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'trade' && (
        <section className="card">
          <div className="card-title-row" style={{ marginBottom: 4 }}>
            <span className="card-icon-badge">🔁</span>
            <h3 style={{ margin: 0 }}>Trade Players</h3>
          </div>
          <p className="hint-text" style={{ marginBottom: 18 }}>
            Pick a team to see its roster, then trade any player away for one or more players from another team.
          </p>

          {teams.length < 2 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔁</div>
              <h4>Need at least 2 teams</h4>
              <p>Add more teams before trades can happen.</p>
            </div>
          ) : !tradeTeam ? (
            <div className="team-grid">
              {teams.map((team) => {
                const count = players.filter((p) => p.team_id === team.id).length;
                return (
                  <div
                    className="team-card trade-team-card"
                    key={team.id}
                    onClick={() => setTradeTeam(team)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="team-logo">
                      {team.logo_path ? (
                        <img src={team.logo_path} alt={`${team.team_name} logo`} />
                      ) : (
                        <div className="team-logo-placeholder">🛡️</div>
                      )}
                    </div>
                    <h3>{team.team_name}</h3>
                    <p className="team-card-count">👥 {count} players</p>
                    <span className="trade-team-cta">🔁 View &amp; Trade</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="trade-roster-header">
                <button className="link-btn back-link" onClick={() => setTradeTeam(null)}>
                  ← Back to Teams
                </button>
                <div className="trade-roster-heading">
                  <span className="trade-roster-team-logo">
                    {tradeTeam.logo_path ? (
                      <img src={tradeTeam.logo_path} alt={`${tradeTeam.team_name} logo`} />
                    ) : (
                      '🛡️'
                    )}
                  </span>
                  <div>
                    <h3>{tradeTeam.team_name}</h3>
                    <span className="hint-text">
                      {players.filter((p) => p.team_id === tradeTeam.id).length} players on roster
                    </span>
                  </div>
                </div>
              </div>

              {players.filter((p) => p.team_id === tradeTeam.id).length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🏏</div>
                  <h4>No players on this team yet</h4>
                  <p>Players this team wins in the auction will show up here for trading.</p>
                </div>
              ) : (
                <div className="trade-roster-list">
                  {players
                    .filter((p) => p.team_id === tradeTeam.id)
                    .map((player) => {
                      const meta = getCategoryMeta(player.category);
                      const isCaptain = !!player.is_captain;
                      return (
                        <div className="trade-roster-row" key={player.id}>
                          <PlayerAvatar player={player} />
                          <div className="trade-roster-row-info">
                            <div className="trade-roster-row-name">{player.name}</div>
                            <div className="trade-chip-row">
                              <span className={`chip ${meta.chip}`}>
                                {meta.icon} {player.category}
                              </span>
                              {isCaptain && <span className="chip chip-captain">© Captain</span>}
                            </div>
                          </div>
                          <div className="trade-roster-row-price">{formatCurrency(player.sold_price)}</div>
                          {isCaptain ? (
                            <button className="btn btn-secondary btn-sm" disabled title="Captains cannot be traded">
                              🔒 Trade
                            </button>
                          ) : (
                            <button className="btn btn-accent btn-sm" onClick={() => setTradingPlayer(player)}>
                              🔁 Trade
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {rosterTeam && (
        <TeamRosterModal
          roomId={roomId}
          team={rosterTeam}
          players={players.filter((p) => p.team_id === rosterTeam.id)}
          captainCandidates={players.filter((p) => !p.team_id && p.auction_status === 'pending' && p.is_captain)}
          locked={locked}
          onClose={() => setRosterTeam(null)}
          onPlayerSaved={handlePlayerKitSaved}
          onOwnerSaved={handleTeamOwnerSaved}
          onCaptainChanged={handleCaptainChanged}
        />
      )}

      {editingTeam && (
        <TeamEditModal
          roomId={roomId}
          team={editingTeam}
          boughtCount={players.filter((p) => p.team_id === editingTeam.id).length}
          locked={locked}
          onClose={() => setEditingTeam(null)}
          onSaved={handleTeamUpdated}
        />
      )}

      {showAddTeamModal && (
        <TeamAddModal roomId={roomId} onClose={() => setShowAddTeamModal(false)} onCreated={handleTeamAdded} />
      )}

      {showDeleteAllConfirm && (
        <ConfirmModal
          icon="🗑️"
          title="Delete All Players?"
          message={`This will permanently delete all ${players.length} player(s) from this room, including their profile pictures. This cannot be undone.`}
          confirmLabel="Yes, Delete All"
          confirmVariant="danger"
          confirming={deletingAll}
          error={deleteAllError}
          onCancel={() => { setShowDeleteAllConfirm(false); setDeleteAllError(''); }}
          onConfirm={handleDeleteAllPlayers}
        />
      )}

      {showCreateTournamentModal && (
        <CreateFixtureModal
          teamCount={teams.length}
          mode="create"
          onClose={() => setShowCreateTournamentModal(false)}
          onCreate={handleCreateTournament}
        />
      )}

      {tradingPlayer && (
        <TradeModal
          roomId={roomId}
          sourcePlayer={tradingPlayer}
          teams={teams}
          players={players}
          onClose={() => setTradingPlayer(null)}
          onCompleted={handleTradeCompleted}
        />
      )}

      {editingPlayer && (
        <PlayerEditModal
          roomId={roomId}
          player={editingPlayer}
          photoOnly={editPhotoOnly}
          onClose={() => {
            setEditingPlayer(null);
            setEditPhotoOnly(false);
          }}
          onSaved={handlePlayerUpdated}
        />
      )}
    </div>
  );
}
