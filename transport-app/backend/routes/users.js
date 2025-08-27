const express = require('express');
const { protect } = require('../middleware/authMiddleware');

const createUsersRouter = (db) => {
    const router = express.Router();

    router.get('/me/points', protect, (req, res) => {
        const userId = req.user.id;

        db.get('SELECT points FROM Users WHERE id = ?', [userId], (err, user) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const points = user.points;

            db.all('SELECT * FROM PointTransactions WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, transactions) => {
                if (err) {
                    return res.status(500).json({ message: err.message });
                }

                res.json({
                    current_points: points,
                    history: transactions
                });
            });
        });
    });

    return router;
};

module.exports = createUsersRouter;
