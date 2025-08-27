const request = require('supertest');
const express = require('express');
const createBusRouter = require('./bus');
const createAuthRouter = require('./auth');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const jwtSecret = 'your_jwt_secret';
const dbPath = ':memory:';
let db;
let app;

describe('Bus API Endpoints', () => {
    let adminToken;
    let userToken;

    beforeAll((done) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) return done(err);

            const createTablesSql = `
                CREATE TABLE Users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, full_name TEXT, phone_number TEXT, role TEXT, points INTEGER DEFAULT 0, created_at DATETIME, updated_at DATETIME);
                CREATE TABLE Stops (id INTEGER PRIMARY KEY, name TEXT, latitude REAL, longitude REAL, created_at DATETIME, updated_at DATETIME);
                CREATE TABLE Routes (id INTEGER PRIMARY KEY, name TEXT, created_at DATETIME, updated_at DATETIME);
                CREATE TABLE RouteStops (id INTEGER PRIMARY KEY, route_id INTEGER, stop_id INTEGER, stop_order INTEGER, created_at DATETIME);
                CREATE TABLE Vehicles (id INTEGER PRIMARY KEY, driver_id INTEGER, type TEXT, make TEXT, model TEXT, license_plate TEXT, total_seats INTEGER, status TEXT, current_location_lat REAL, current_location_lng REAL, created_at DATETIME, updated_at DATETIME);
                CREATE TABLE Schedules (id INTEGER PRIMARY KEY, route_id INTEGER, bus_id INTEGER, departure_time TEXT, arrival_time TEXT, price_per_seat REAL, created_at DATETIME, updated_at DATETIME);
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

                        db.run("INSERT INTO Users (email, password_hash, role) VALUES ('user@test.com', ?, 'customer')", [userHashedPassword], function(err) {
                            if (err) return done(err);
                            userToken = jwt.sign({ id: this.lastID, role: 'customer' }, jwtSecret);

                            app = express();
                            app.use(express.json());
                            app.use('/api/bus', createBusRouter(db));
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
        db.exec('DELETE FROM RouteStops; DELETE FROM Schedules; DELETE FROM Stops; DELETE FROM Routes; DELETE FROM Vehicles; DELETE FROM Bookings;', done);
    });

    describe('/api/bus/stops', () => {
        it('should create a new stop as an admin', async () => {
            const res = await request(app)
                .post('/api/bus/stops')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Central Station', latitude: 12.34, longitude: 56.78 });
            expect(res.statusCode).toEqual(201);
            expect(res.body.name).toBe('Central Station');
        });
    });

    describe('/api/bus/routes', () => {
        let stop1, stop2;
        beforeEach(async () => {
            const res1 = await request(app).post('/api/bus/stops').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Stop A', latitude: 1, longitude: 1 });
            const res2 = await request(app).post('/api/bus/stops').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Stop B', latitude: 2, longitude: 2 });
            stop1 = res1.body;
            stop2 = res2.body;
        });
        it('should create a new route as an admin', async () => {
            const res = await request(app)
                .post('/api/bus/routes')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Route 1', stops: [{ stop_id: stop1.id, order: 1 }, { stop_id: stop2.id, order: 2 }] });
            expect(res.statusCode).toEqual(201);
        });
    });

    describe('/api/bus/search', () => {
        let stopA, stopB, route, bus;
        beforeEach(async () => {
            const resA = await request(app).post('/api/bus/stops').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Stop A', latitude: 1, longitude: 1 });
            const resB = await request(app).post('/api/bus/stops').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Stop B', latitude: 2, longitude: 2 });
            stopA = resA.body;
            stopB = resB.body;

            const routeRes = await request(app).post('/api/bus/routes').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Test Route', stops: [{ stop_id: stopA.id, order: 1 }, { stop_id: stopB.id, order: 2 }] });
            route = routeRes.body;

            const busRes = await new Promise((resolve) => {
                db.run("INSERT INTO Vehicles (type, total_seats) VALUES ('bus', 50)", function(err) { resolve({ id: this.lastID }); });
            });
            bus = busRes;

            const departure = new Date();
            departure.setDate(departure.getDate() + 1);
            const arrival = new Date(departure.getTime() + 2 * 60 * 60 * 1000);
            await new Promise((resolve) => {
                db.run('INSERT INTO Schedules (route_id, bus_id, departure_time, arrival_time) VALUES (?, ?, ?, ?)', [route.id, bus.id, departure.toISOString(), arrival.toISOString()], resolve);
            });
        });
        it('should return available schedules for a valid search', async () => {
            const searchDate = new Date();
            searchDate.setDate(searchDate.getDate() + 1);
            const dateString = searchDate.toISOString().split('T')[0];
            const res = await request(app).get('/api/bus/search').query({ from_stop_id: stopA.id, to_stop_id: stopB.id, date: dateString });
            expect(res.statusCode).toEqual(200);
            expect(res.body.length).toBe(1);
        });
    });
});
