
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

const router = express.Router();
const db = new sqlite3.Database('./transport.db');
const saltRounds = 10;
const jwtSecret = 'your_jwt_secret'; // Should be in an environment variable

// Register a new user
router.post('/register', async (req, res) => {
    const { email, password, full_name, phone_number, role } = req.body;

    if (!email || !password || !full_name || !phone_number || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const sql = `INSERT INTO Users (email, password_hash, full_name, phone_number, role) VALUES (?, ?, ?, ?, ?)`;

        db.run(sql, [email, hashedPassword, full_name, phone_number, role], function(err) {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            res.status(201).json({ id: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login a user
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const sql = `SELECT * FROM Users WHERE email = ?`;
    db.get(sql, [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '1h' });
        res.json({ token });
    });
});

module.exports = router;
