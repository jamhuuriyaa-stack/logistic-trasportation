const request = require('supertest');
const express = require('express');
const createBookingsRouter = require('./bookings');
const createUsersRouter = require('./users');
const createAuthRouter = require('./auth');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const jwtSecret = 'your_jwt_secret';
const dbPath = ':memory:';
let db;
let app;

describe('Points System API', () => {
    let adminToken, userToken, regularUser;
    let bookingToComplete;

    beforeAll((done) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) return done(err);
            const createTablesSql = `
                CREATE TABLE Users (id INTEGER PRIMARY KEY, email TEXT, password_hash TEXT, full_name TEXT, phone_number TEXT, role TEXT, points INTEGER DEFAULT 0, created_at DATETIME, updated_at DATETIME);
                CREATE TABLE Bookings (id INTEGER PRIMARY KEY, customer_id INTEGER, vehicle_id INTEGER, type TEXT, status TEXT, origin_address TEXT, destination_address TEXT, price REAL, booked_at DATETIME, start_time DATETIME, end_time DATETIME, details TEXT, schedule_id INTEGER, seat_number INTEGER, created_at DATETIME, updated_at DATETIME);
                CREATE TABLE PointTransactions (id INTEGER PRIMARY KEY, user_id INTEGER, booking_id INTEGER, points_change INTEGER, transaction_type TEXT, created_at DATETIME);
            `;
            db.exec(createTablesSql, async (err) => {
                if (err) return done(err);
                try {
                    const adminHashedPassword = await bcrypt.hash('adminpassword', 10);
                    const userHashedPassword = await bcrypt.hash('userpassword', 10);

                    db.run("INSERT INTO Users (email, password_hash, role) VALUES ('admin@test.com', ?, 'admin')", [adminHashedPassword], function(err) {
                        if (err) return done(err);
                        adminToken = jwt.sign({ id: this.lastID, role: 'admin' }, jwtSecret);

                        db.run("INSERT INTO Users (email, password_hash, role, points) VALUES ('user@test.com', ?, 'customer', 100)", [userHashedPassword], function(err) {
                            if (err) return done(err);
                            regularUser = { id: this.lastID };
                            userToken = jwt.sign({ id: this.lastID, role: 'customer' }, jwtSecret);

                            app = express();
                            app.use(express.json());
                            app.use('/api/bookings', createBookingsRouter(db));
                            app.use('/api/users', createUsersRouter(db));
                            app.use('/api/auth', createAuthRouter(db));
                            done();
                        });
                    });
                } catch (error) {
                    done(error);
                }
            });
        });
    });

    afterAll((done) => {
        db.close(done);
    });

    beforeEach((done) => {
        db.exec('DELETE FROM PointTransactions; DELETE FROM Bookings;', () => {
            db.run(`UPDATE Users SET points = 100 WHERE id = ?`, [regularUser.id], () => {
                db.run(`INSERT INTO Bookings (customer_id, type, price, status) VALUES (?, 'taxi_ride', 50, 'requested')`, [regularUser.id], function(err) {
                    if(err) return done(err);
                    bookingToComplete = { id: this.lastID };
                    done();
                });
            });
        });
    });

    it('should allow a user to check their points balance and history', async () => {
        const res = await request(app)
            .get('/api/users/me/points')
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.current_points).toBe(100);
        expect(res.body.history).toBeInstanceOf(Array);
    });

    it('should award points to a user when a booking is completed', async () => {
        const res = await request(app)
            .post(`/api/bookings/${bookingToComplete.id}/complete`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(200);

        const userRes = await request(app).get('/api/users/me/points').set('Authorization', `Bearer ${userToken}`);
        expect(userRes.body.current_points).toBe(150);
        expect(userRes.body.history.length).toBe(1);
        expect(userRes.body.history[0].points_change).toBe(50);
    });

    it('should allow a user to spend points on a new booking', async () => {
        const res = await request(app)
            .post('/api/bookings')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                type: 'taxi_ride',
                price: 30,
                points_to_use: 100
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body.finalPrice).toBe(20);

        const userRes = await request(app).get('/api/users/me/points').set('Authorization', `Bearer ${userToken}`);
        expect(userRes.body.current_points).toBe(0);
        expect(userRes.body.history.length).toBe(1);
        expect(userRes.body.history[0].points_change).toBe(-100);
    });

    it('should not allow a user to spend more points than they have', async () => {
        const res = await request(app)
            .post('/api/bookings')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                type: 'taxi_ride',
                price: 30,
                points_to_use: 200
            });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toBe('Not enough points');
    });
});
