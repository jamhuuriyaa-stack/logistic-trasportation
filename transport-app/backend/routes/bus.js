const express = require('express');
const { protect, isAdmin } = require('../middleware/authMiddleware');

const createBusRouter = (db) => {
    const router = express.Router();

    // --- Stops CRUD ---

    router.post('/stops', protect, isAdmin, (req, res) => {
        const { name, latitude, longitude } = req.body;
        if (!name || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ message: 'Please provide name, latitude, and longitude' });
        }
        const sql = `INSERT INTO Stops (name, latitude, longitude) VALUES (?, ?, ?)`;
        db.run(sql, [name, latitude, longitude], function (err) {
            if (err) {
                return res.status(400).json({ message: err.message });
            }
            res.status(201).json({ id: this.lastID, name, latitude, longitude });
        });
    });

    router.get('/stops', (req, res) => {
        const sql = `SELECT * FROM Stops`;
        db.all(sql, [], (err, rows) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.json(rows);
        });
    });

    router.get('/stops/:id', (req, res) => {
        const sql = `SELECT * FROM Stops WHERE id = ?`;
        db.get(sql, [req.params.id], (err, row) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            if (!row) {
                return res.status(404).json({ message: 'Stop not found' });
            }
            res.json(row);
        });
    });

    router.put('/stops/:id', protect, isAdmin, (req, res) => {
        const { name, latitude, longitude } = req.body;
        if (!name || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ message: 'Please provide name, latitude, and longitude' });
        }
        const sql = `UPDATE Stops SET name = ?, latitude = ?, longitude = ? WHERE id = ?`;
        db.run(sql, [name, latitude, longitude, req.params.id], function (err) {
            if (err) {
                return res.status(400).json({ message: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ message: 'Stop not found' });
            }
            res.json({ id: req.params.id, name, latitude, longitude });
        });
    });

    router.delete('/stops/:id', protect, isAdmin, (req, res) => {
        const sql = `DELETE FROM Stops WHERE id = ?`;
        db.run(sql, [req.params.id], function (err) {
            if (err) {
                return res.status(400).json({ message: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ message: 'Stop not found' });
            }
            res.json({ message: 'Stop deleted successfully' });
        });
    });

    // --- Routes CRUD ---

    router.post('/routes', protect, isAdmin, (req, res) => {
        const { name, stops } = req.body;
        if (!name || !stops || !Array.isArray(stops) || stops.length === 0) {
            return res.status(400).json({ message: 'Please provide a route name and an array of stops' });
        }
        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');
            const routeSql = `INSERT INTO Routes (name) VALUES (?)`;
            db.run(routeSql, [name], function (err) {
                if (err) {
                    db.run('ROLLBACK;');
                    return res.status(400).json({ message: err.message });
                }
                const routeId = this.lastID;
                const routeStopsSql = `INSERT INTO RouteStops (route_id, stop_id, stop_order) VALUES (?, ?, ?)`;
                stops.forEach(stop => {
                    db.run(routeStopsSql, [routeId, stop.stop_id, stop.order], (err) => {
                        if (err) {
                            db.run('ROLLBACK;');
                            return res.status(400).json({ message: `Error adding stop ${stop.stop_id}: ${err.message}` });
                        }
                    });
                });
                db.run('COMMIT;');
                res.status(201).json({ id: routeId, name, stops });
            });
        });
    });

    router.get('/routes', (req, res) => {
        const sql = `SELECT * FROM Routes`;
        db.all(sql, [], (err, rows) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.json(rows);
        });
    });

    router.get('/routes/:id', (req, res) => {
        const routeSql = `SELECT * FROM Routes WHERE id = ?`;
        db.get(routeSql, [req.params.id], (err, route) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            if (!route) {
                return res.status(404).json({ message: 'Route not found' });
            }
            const stopsSql = `
                SELECT s.id, s.name, s.latitude, s.longitude, rs.stop_order
                FROM Stops s
                JOIN RouteStops rs ON s.id = rs.stop_id
                WHERE rs.route_id = ?
                ORDER BY rs.stop_order ASC
            `;
            db.all(stopsSql, [req.params.id], (err, stops) => {
                if (err) {
                    return res.status(500).json({ message: err.message });
                }
                res.json({ ...route, stops });
            });
        });
    });

    router.put('/routes/:id', protect, isAdmin, (req, res) => {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Please provide a new name for the route' });
        }
        const sql = `UPDATE Routes SET name = ? WHERE id = ?`;
        db.run(sql, [name, req.params.id], function (err) {
            if (err) {
                return res.status(400).json({ message: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ message: 'Route not found' });
            }
            res.json({ id: req.params.id, name });
        });
    });

    router.delete('/routes/:id', protect, isAdmin, (req, res) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');
            const deleteRouteStopsSql = `DELETE FROM RouteStops WHERE route_id = ?`;
            db.run(deleteRouteStopsSql, [req.params.id], (err) => {
                if (err) {
                    db.run('ROLLBACK;');
                    return res.status(400).json({ message: err.message });
                }
                const deleteRouteSql = `DELETE FROM Routes WHERE id = ?`;
                db.run(deleteRouteSql, [req.params.id], function (err) {
                    if (err) {
                        db.run('ROLLBACK;');
                        return res.status(400).json({ message: err.message });
                    }
                    if (this.changes === 0) {
                        db.run('ROLLBACK;');
                        return res.status(404).json({ message: 'Route not found' });
                    }
                    db.run('COMMIT;');
                    res.json({ message: 'Route deleted successfully' });
                });
            });
        });
    });

    router.get('/search', (req, res) => {
        const { from_stop_id, to_stop_id, date } = req.query;
        if (!from_stop_id || !to_stop_id || !date) {
            return res.status(400).json({ message: 'Please provide from_stop_id, to_stop_id, and date' });
        }
        const sql = `
            SELECT
                s.id as schedule_id,
                s.departure_time,
                s.arrival_time,
                s.price_per_seat,
                r.id as route_id,
                r.name as route_name,
                v.id as bus_id,
                v.make as bus_make,
                v.model as bus_model
            FROM Schedules s
            JOIN Routes r ON s.route_id = r.id
            JOIN Vehicles v ON s.bus_id = v.id
            WHERE
                DATE(s.departure_time) = ?
                AND
                r.id IN (
                    SELECT r1.route_id
                    FROM RouteStops r1
                    JOIN RouteStops r2 ON r1.route_id = r2.route_id
                    WHERE
                        r1.stop_id = ?
                        AND r2.stop_id = ?
                        AND r1.stop_order < r2.stop_order
                )
        `;
        db.all(sql, [date, from_stop_id, to_stop_id], (err, rows) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.json(rows);
        });
    });

    return router;
};

module.exports = createBusRouter;
