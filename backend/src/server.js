const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const auctionRoomsRouter = require('./routes/auctionRooms');
const playersRouter = require('./routes/players');
const teamsRouter = require('./routes/teams');
const fixturesRouter = require('./routes/fixtures');
const tournamentsRouter = require('./routes/tournaments');
const tradeRouter = require('./routes/trade');
const auctionEngineRouter = require('./routes/auctionEngine');
const publicRouter = require('./routes/public');
const tournamentController = require('./controllers/tournamentController');
const requireAuth = require('./middleware/auth');
const requireRoomOwner = require('./middleware/roomOwner');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.use('/api/admin', requireAuth, adminRouter);
app.get('/api/tournaments', requireAuth, tournamentController.listAllTournaments);

app.use('/api/auction-rooms', requireAuth, auctionRoomsRouter);
app.use('/api/auction-rooms/:roomId/players', requireAuth, requireRoomOwner, playersRouter);
app.use('/api/auction-rooms/:roomId/teams', requireAuth, requireRoomOwner, teamsRouter);
app.use('/api/auction-rooms/:roomId/fixtures', requireAuth, requireRoomOwner, fixturesRouter);
app.use('/api/auction-rooms/:roomId/tournaments', requireAuth, requireRoomOwner, tournamentsRouter);
app.use('/api/auction-rooms/:roomId/trade', requireAuth, requireRoomOwner, tradeRouter);
app.use('/api/auction-rooms/:roomId/auction', requireAuth, requireRoomOwner, auctionEngineRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Cricket Auction API running on port ${PORT}`));
