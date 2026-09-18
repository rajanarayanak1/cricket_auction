import { Routes, Route, Link, Navigate } from 'react-router-dom';
import AuctionRooms from './pages/AuctionRooms.jsx';
import AuctionRoomDetail from './pages/AuctionRoomDetail.jsx';
import TournamentDetail from './pages/TournamentDetail.jsx';
import LiveAuction from './pages/LiveAuction.jsx';
import MatchDetail from './pages/MatchDetail.jsx';
import Scorecard from './pages/Scorecard.jsx';
import LiveMatches from './pages/LiveMatches.jsx';
import PublicMatchView from './pages/PublicMatchView.jsx';
import PublicTournamentView from './pages/PublicTournamentView.jsx';
import PublicAuctionView from './pages/PublicAuctionView.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import UserMenu from './components/UserMenu.jsx';
import { isAuthenticated } from './utils/auth.js';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to={isAuthenticated() ? '/dashboard' : '/'} className="app-brand">
          <span className="app-brand-icon">🏏</span>
          <span className="app-brand-text">
            <span className="app-title">Cricket Auction</span>
            <span className="app-subtitle">Auction Room Manager</span>
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ThemeToggle />
          {isAuthenticated() && (
            <>
              <span className="app-header-tag">ADMIN</span>
              <UserMenu />
            </>
          )}
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/login" element={<LiveMatches />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={isAuthenticated() ? <Navigate to="/dashboard" replace /> : <LiveMatches />} />
          <Route path="/live/:fixtureId" element={<PublicMatchView />} />
          <Route path="/tournaments/:tournamentId" element={<PublicTournamentView />} />
          <Route path="/auctions/:roomId" element={<PublicAuctionView />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AuctionRooms />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rooms/:roomId"
            element={
              <ProtectedRoute>
                <AuctionRoomDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rooms/:roomId/tournaments/:tournamentId"
            element={
              <ProtectedRoute>
                <TournamentDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rooms/:roomId/auction"
            element={
              <ProtectedRoute>
                <LiveAuction />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rooms/:roomId/fixtures/:fixtureId"
            element={
              <ProtectedRoute>
                <MatchDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rooms/:roomId/fixtures/:fixtureId/scorecard"
            element={
              <ProtectedRoute>
                <Scorecard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
