import axios from 'axios';
import { getToken, clearToken } from '../utils/auth.js';

const client = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/api` });

// A separate, uninstrumented instance for the public/unauthenticated
// endpoints — no Bearer token attached, and no 401-triggers-a-login-redirect
// interceptor. A public visitor watching a live match was never logged in
// to begin with, so nothing here should ever bounce them to /login.
const publicClient = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/api/public` });

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    // A failed login attempt also comes back as a 401, but that's a wrong
    // password, not an expired session — it must resolve locally in the
    // login form's own catch block, never bounce through a page reload.
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest && window.location.pathname !== '/login') {
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const AuthAPI = {
  login: (username, password) => client.post('/auth/login', { username, password }).then((r) => r.data),
  register: (payload) => client.post('/auth/register', payload).then((r) => r.data)
};

export const AdminAPI = {
  getProfile: () => client.get('/admin/profile').then((r) => r.data),
  updateProfile: (payload) => client.put('/admin/profile', payload).then((r) => r.data),
  changePassword: (payload) => client.post('/admin/change-password', payload).then((r) => r.data)
};

export const AuctionRoomsAPI = {
  list: () => client.get('/auction-rooms').then((r) => r.data),
  get: (id) => client.get(`/auction-rooms/${id}`).then((r) => r.data),
  create: (payload) => client.post('/auction-rooms', payload).then((r) => r.data),
  remove: (id) => client.delete(`/auction-rooms/${id}`),
  start: (id) => client.post(`/auction-rooms/${id}/start`).then((r) => r.data)
};

export const PlayersAPI = {
  list: (roomId) => client.get(`/auction-rooms/${roomId}/players`).then((r) => r.data),
  create: (roomId, formData) =>
    client
      .post(`/auction-rooms/${roomId}/players`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      .then((r) => r.data),
  update: (roomId, playerId, formData) =>
    client
      .put(`/auction-rooms/${roomId}/players/${playerId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      .then((r) => r.data),
  updateKit: (roomId, playerId, payload) =>
    client.put(`/auction-rooms/${roomId}/players/${playerId}/kit`, payload).then((r) => r.data),
  remove: (roomId, playerId) => client.delete(`/auction-rooms/${roomId}/players/${playerId}`),
  removeAll: (roomId) => client.delete(`/auction-rooms/${roomId}/players`).then((r) => r.data)
};

export const TeamsAPI = {
  list: (roomId) => client.get(`/auction-rooms/${roomId}/teams`).then((r) => r.data),
  create: (roomId, formData) =>
    client
      .post(`/auction-rooms/${roomId}/teams`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      .then((r) => r.data),
  update: (roomId, teamId, formData) =>
    client
      .put(`/auction-rooms/${roomId}/teams/${teamId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      .then((r) => r.data),
  remove: (roomId, teamId) => client.delete(`/auction-rooms/${roomId}/teams/${teamId}`),
  updateOwner: (roomId, teamId, payload) =>
    client.put(`/auction-rooms/${roomId}/teams/${teamId}/owner`, payload).then((r) => r.data),
  assignCaptain: (roomId, teamId, payload) =>
    client.post(`/auction-rooms/${roomId}/teams/${teamId}/captain`, payload).then((r) => r.data),
  unassignCaptain: (roomId, teamId) =>
    client.delete(`/auction-rooms/${roomId}/teams/${teamId}/captain`).then((r) => r.data)
};

export const FixturesAPI = {
  get: (roomId, fixtureId) => client.get(`/auction-rooms/${roomId}/fixtures/${fixtureId}`).then((r) => r.data)
};

export const TournamentsAPI = {
  list: (roomId) => client.get(`/auction-rooms/${roomId}/tournaments`).then((r) => r.data),
  listAll: () => client.get('/tournaments').then((r) => r.data),
  get: (roomId, tournamentId) => client.get(`/auction-rooms/${roomId}/tournaments/${tournamentId}`).then((r) => r.data),
  create: (roomId, payload) => client.post(`/auction-rooms/${roomId}/tournaments`, payload).then((r) => r.data),
  regenerateFixtures: (roomId, tournamentId, payload) =>
    client.put(`/auction-rooms/${roomId}/tournaments/${tournamentId}/fixtures`, payload).then((r) => r.data),
  finalize: (roomId, tournamentId) =>
    client.post(`/auction-rooms/${roomId}/tournaments/${tournamentId}/fixtures/finalize`).then((r) => r.data)
};

export const TradeAPI = {
  execute: (roomId, payload) => client.post(`/auction-rooms/${roomId}/trade`, payload).then((r) => r.data)
};

export const PointsTableAPI = {
  get: (roomId, tournamentId) => client.get(`/auction-rooms/${roomId}/tournaments/${tournamentId}/points-table`).then((r) => r.data)
};

export const StatsAPI = {
  get: (roomId, tournamentId) => client.get(`/auction-rooms/${roomId}/tournaments/${tournamentId}/stats`).then((r) => r.data)
};

export const MatchAPI = {
  get: (roomId, fixtureId) => client.get(`/auction-rooms/${roomId}/fixtures/${fixtureId}/match`).then((r) => r.data),
  start: (roomId, fixtureId, payload) =>
    client.post(`/auction-rooms/${roomId}/fixtures/${fixtureId}/match/start`, payload).then((r) => r.data),
  finish: (roomId, fixtureId) =>
    client.post(`/auction-rooms/${roomId}/fixtures/${fixtureId}/match/finish`).then((r) => r.data),
  startSuperOver: (roomId, fixtureId) =>
    client.post(`/auction-rooms/${roomId}/fixtures/${fixtureId}/match/super-over`).then((r) => r.data),
  selectOpeners: (roomId, fixtureId, inningsId, payload) =>
    client
      .post(`/auction-rooms/${roomId}/fixtures/${fixtureId}/match/innings/${inningsId}/openers`, payload)
      .then((r) => r.data),
  selectBatsman: (roomId, fixtureId, inningsId, playerId) =>
    client
      .post(`/auction-rooms/${roomId}/fixtures/${fixtureId}/match/innings/${inningsId}/batsman`, { player_id: playerId })
      .then((r) => r.data),
  selectBowler: (roomId, fixtureId, inningsId, playerId) =>
    client
      .post(`/auction-rooms/${roomId}/fixtures/${fixtureId}/match/innings/${inningsId}/bowler`, { player_id: playerId })
      .then((r) => r.data),
  recordBall: (roomId, fixtureId, inningsId, payload) =>
    client
      .post(`/auction-rooms/${roomId}/fixtures/${fixtureId}/match/innings/${inningsId}/ball`, payload)
      .then((r) => r.data),
  undoLastBall: (roomId, fixtureId) =>
    client.post(`/auction-rooms/${roomId}/fixtures/${fixtureId}/match/undo-ball`).then((r) => r.data)
};

export const AuctionEngineAPI = {
  getState: (roomId) => client.get(`/auction-rooms/${roomId}/auction`).then((r) => r.data),
  bid: (roomId, teamId) => client.post(`/auction-rooms/${roomId}/auction/bid`, { team_id: teamId }).then((r) => r.data),
  undo: (roomId) => client.post(`/auction-rooms/${roomId}/auction/undo`).then((r) => r.data),
  sold: (roomId) => client.post(`/auction-rooms/${roomId}/auction/sold`).then((r) => r.data),
  unsold: (roomId) => client.post(`/auction-rooms/${roomId}/auction/unsold`).then((r) => r.data),
  resumeUnsold: (roomId) => client.post(`/auction-rooms/${roomId}/auction/resume-unsold`).then((r) => r.data),
  finish: (roomId) => client.post(`/auction-rooms/${roomId}/auction/finish`).then((r) => r.data),
  reset: (roomId) => client.post(`/auction-rooms/${roomId}/auction/reset`).then((r) => r.data)
};

export const PublicAPI = {
  liveMatches: () => publicClient.get('/live-matches').then((r) => r.data),
  getMatch: (fixtureId) => publicClient.get(`/fixtures/${fixtureId}/match`).then((r) => r.data),
  tournaments: () => publicClient.get('/tournaments').then((r) => r.data),
  getTournament: (tournamentId) => publicClient.get(`/tournaments/${tournamentId}`).then((r) => r.data),
  completedAuctions: () => publicClient.get('/completed-auctions').then((r) => r.data),
  getCompletedAuction: (roomId) => publicClient.get(`/completed-auctions/${roomId}`).then((r) => r.data)
};

export default client;
