const express = require('express');
const authRouter = require('./routes/auth');
const busRouter = require('./routes/bus');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Auth routes
app.use('/api/auth', authRouter);
app.use('/api/bus', busRouter);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
