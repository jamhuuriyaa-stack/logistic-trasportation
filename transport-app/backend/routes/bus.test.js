const request = require('supertest');
const express = require('express');
const busRouter = require('./bus');
const authRouter = require('./auth');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const jwtSecret = 'your_jwt_secret';

const dbPath = './transport.db';
let db;

const app = express();
app.use(express.json());
app.use('/api/bus', busRouter);
app.use('/api/auth', authRouter);

describe('Bus API Endpoints', () => {
    let adminToken;
    let userToken;

    beforeAll((done) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) return done(err);

            db.exec('DELETE FROM Users; DELETE FROM Stops;', async () => {
                try {
                    const adminHashedPassword = await bcrypt.hash('adminpassword', 10);
                    const userHashedPassword = await bcrypt.hash('userpassword', 10);

                    db.run('INSERT INTO Users (email, password_hash, full_name, phone_number, role) VALUES (?, ?, ?, ?, ?)',
                        ['admin@test.com', adminHashedPassword, 'Admin User', '1234567891', 'admin'], function (err) {
                            if (err) return done(err);
                            adminToken = jwt.sign({ id: this.lastID, role: 'admin' }, jwtSecret);

                            db.run('INSERT INTO Users (email, password_hash, full_name, phone_number, role) VALUES (?, ?, ?, ?, ?)',
                                ['user@test.com', userHashedPassword, 'Regular User', '1234567892', 'customer'], function (err) {
                                    if (err) return done(err);
                                    userToken = jwt.sign({ id: this.lastID, role: 'customer' }, jwtSecret);
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
        db.exec('DELETE FROM RouteStops; DELETE FROM Schedules; DELETE FROM Stops; DELETE FROM Routes; DELETE FROM Bookings; DELETE FROM Vehicles;', done);
    });

    describe('/api/bus/stops', () => {
        it('should create a new stop as an admin', async () => {
            const res = await request(app)
                .post('/api/bus/stops')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Central Station', latitude: 12.34, longitude: 56.78 });
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Central Station');
        });

        it('should not create a new stop as a regular user', async () => {
            const res = await request(app)
                .post('/api/bus/stops')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ name: 'User Stop', latitude: 1, longitude: 1 });
            expect(res.statusCode).toEqual(403);
        });

        it('should get all stops', async () => {
            await request(app).post('/api/bus/stops').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Stop 1', latitude: 1, longitude: 1 });
            await request(app).post('/api/bus/stops').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Stop 2', latitude: 2, longitude: 2 });

            const res = await request(app).get('/api/bus/stops');
            expect(res.statusCode).toEqual(200);
            expect(res.body.length).toBe(2);
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
                .send({
                    name: 'Route 1',
                    stops: [
                        { stop_id: stop1.id, order: 1 },
                        { stop_id: stop2.id, order: 2 }
                    ]
                });
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('id');
        });
    });

    describe('/api/bus/search', () => {
        let stopA, stopB, route, bus;

        beforeEach(async () => {
            const resA = await request(app).post('/api/bus/stops').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Stop A', latitude: 1, longitude: 1 });
            const resB = await request(app).post('/api/bus/stops').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Stop B', latitude: 2, longitude: 2 });
            stopA = resA.body;
            stopB = resB.body;

            const routeRes = await request(app).post('/api/bus/routes').set('Authorization', `Bearer ${adminToken}`).send({
                name: 'Test Route',
                stops: [{ stop_id: stopA.id, order: 1 }, { stop_id: stopB.id, order: 2 }]
            });
            route = routeRes.body;

            const busRes = await new Promise((resolve) => {
                db.run('INSERT INTO Vehicles (type, make, model, license_plate, total_seats) VALUES (?, ?, ?, ?, ?)',
                    ['bus', 'TestBus', 'T1', 'BUS-123', 50], function(err) {
                        resolve({ id: this.lastID });
                    });
            });
            bus = busRes;

            const departure = new Date();
            departure.setDate(departure.getDate() + 1);
            const arrival = new Date(departure.getTime() + 2 * 60 * 60 * 1000);

            await new Promise((resolve) => {
                db.run('INSERT INTO Schedules (route_id, bus_id, departure_time, arrival_time, price_per_seat) VALUES (?, ?, ?, ?, ?)',
                    [route.id, bus.id, departure.toISOString(), arrival.toISOString(), 25.50], resolve);
            });
        });

        it('should return available schedules for a valid search', async () => {
            const searchDate = new Date();
            searchDate.setDate(searchDate.getDate() + 1);
            const dateString = searchDate.toISOString().split('T')[0];

            const res = await request(app)
                .get('/api/bus/search')
                .query({
                    from_stop_id: stopA.id,
                    to_stop_id: stopB.id,
                    date: dateString
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].route_name).toBe('Test Route');
        });
    });
});
