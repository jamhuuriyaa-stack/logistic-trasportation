const express = require('express');
const { protect } = require('../middleware/authMiddleware');

const createBookingsRouter = (db) => {
    const router = express.Router();

    router.post('/', protect, (req, res) => {
        const {
            type, vehicle_id, schedule_id, seat_number,
            origin_address, destination_address, price,
            start_time, end_time, points_to_use = 0
        } = req.body;

        const customer_id = req.user.id;

        if (!type || price === undefined) {
            return res.status(400).json({ message: 'Booking type and price are required' });
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');

            let finalPrice = price;

            const processBooking = (finalPrice, pointsWereSpent, pointsToUse) => {
                const bookingSql = `INSERT INTO Bookings (
                    customer_id, type, vehicle_id, schedule_id, seat_number,
                    origin_address, destination_address, price, start_time, end_time, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested')`;

                db.run(bookingSql, [
                    customer_id, type, vehicle_id, schedule_id, seat_number,
                    origin_address, destination_address, finalPrice, start_time, end_time
                ], function (err) {
                    if (err) {
                        db.run('ROLLBACK;');
                        return res.status(400).json({ message: err.message });
                    }
                    const newBookingId = this.lastID;

                    if (pointsWereSpent) {
                        const transactionSql = `INSERT INTO PointTransactions (user_id, booking_id, points_change, transaction_type) VALUES (?, ?, ?, 'spent')`;
                        db.run(transactionSql, [customer_id, newBookingId, -pointsToUse], (err) => {
                            if (err) {
                                db.run('ROLLBACK;');
                                return res.status(500).json({ message: err.message });
                            }
                            db.run('COMMIT;');
                            res.status(201).json({ id: newBookingId, finalPrice });
                        });
                    } else {
                        db.run('COMMIT;');
                        res.status(201).json({ id: newBookingId, finalPrice });
                    }
                });
            };

            if (points_to_use > 0) {
                db.get(`SELECT points FROM Users WHERE id = ?`, [customer_id], (err, user) => {
                    if (err) {
                        db.run('ROLLBACK;');
                        return res.status(500).json({ message: err.message });
                    }
                    if (!user || user.points < points_to_use) {
                        db.run('ROLLBACK;');
                        return res.status(400).json({ message: 'Not enough points' });
                    }

                    const discount = points_to_use / 10; // 10 points = $1
                    finalPrice = Math.max(0, price - discount);

                    const updateUserSql = `UPDATE Users SET points = points - ? WHERE id = ?`;
                    db.run(updateUserSql, [points_to_use, customer_id], (err) => {
                        if (err) {
                            db.run('ROLLBACK;');
                            return res.status(500).json({ message: err.message });
                        }
                        processBooking(finalPrice, true, points_to_use);
                    });
                });
            } else {
                processBooking(finalPrice, false, 0);
            }
        });
    });

    router.post('/:id/complete', protect, (req, res) => {
        const bookingId = req.params.id;

        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');

            const getBookingSql = `SELECT * FROM Bookings WHERE id = ?`;
            db.get(getBookingSql, [bookingId], (err, booking) => {
                if (err) {
                    db.run('ROLLBACK;');
                    return res.status(500).json({ message: err.message });
                }
                if (!booking) {
                    db.run('ROLLBACK;');
                    return res.status(404).json({ message: 'Booking not found' });
                }
                if (booking.status === 'completed') {
                    db.run('ROLLBACK;');
                    return res.status(400).json({ message: 'Booking is already completed' });
                }

                const updateBookingSql = `UPDATE Bookings SET status = 'completed' WHERE id = ?`;
                db.run(updateBookingSql, [bookingId], function(err) {
                    if (err) {
                        db.run('ROLLBACK;');
                        return res.status(500).json({ message: err.message });
                    }

                    const pointsToAward = Math.floor(booking.price);
                    if (pointsToAward > 0) {
                        const updateUserSql = `UPDATE Users SET points = points + ? WHERE id = ?`;
                        db.run(updateUserSql, [pointsToAward, booking.customer_id], (err) => {
                            if (err) {
                                db.run('ROLLBACK;');
                                return res.status(500).json({ message: err.message });
                            }

                            const transactionSql = `INSERT INTO PointTransactions (user_id, booking_id, points_change, transaction_type) VALUES (?, ?, ?, 'earned')`;
                            db.run(transactionSql, [booking.customer_id, bookingId, pointsToAward], (err) => {
                                if (err) {
                                    db.run('ROLLBACK;');
                                    return res.status(500).json({ message: err.message });
                                }

                                db.run('COMMIT;');
                                res.json({ message: `Booking completed. ${pointsToAward} points awarded.` });
                            });
                        });
                    } else {
                        db.run('COMMIT;');
                        res.json({ message: 'Booking marked as complete' });
                    }
                });
            });
        });
    });

    return router;
};

module.exports = createBookingsRouter;
