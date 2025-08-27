const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const createAuthRouter = require('./routes/auth');
const createBusRouter = require('./routes/bus');
const createBookingsRouter = require('./routes/bookings');
const createUsersRouter = require('./routes/users');

// Database setup
const db = new sqlite3.Database('./transport.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the transport database.');
});

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Create routers and inject the database connection
const authRouter = createAuthRouter(db);
const busRouter = createBusRouter(db);
const bookingsRouter = createBookingsRouter(db);
const usersRouter = createUsersRouter(db);

// API routes
app.use('/api/auth', authRouter);
app.use('/api/bus', busRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/users', usersRouter);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});
