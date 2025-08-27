const request = require('supertest');
const express = require('express');
const createAuthRouter = require('./auth');
const sqlite3 = require('sqlite3').verbose();

const dbPath = ':memory:';
let db;
let app;

describe('Auth Endpoints', () => {
    beforeAll((done) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) return done(err);
            const createUsersTableSql = `
                CREATE TABLE Users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE,
                    password_hash TEXT,
                    full_name TEXT,
                    phone_number TEXT UNIQUE,
                    role TEXT CHECK(role IN ('customer', 'driver', 'admin')),
                    points INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );`;
            db.run(createUsersTableSql, (err) => {
                if (err) return done(err);

                app = express();
                app.use(express.json());
                const authRouter = createAuthRouter(db);
                app.use('/api/auth', authRouter);
                done();
            });
        });
    });

    afterAll((done) => {
        db.close(done);
    });

    beforeEach((done) => {
        db.run('DELETE FROM Users', done);
    });

    it('should register a new user successfully', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password123',
                full_name: 'Test User',
                phone_number: '1234567890',
                role: 'customer'
            });
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('id');
    });

    it('should fail to register a user with missing fields', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password123'
            });
        expect(res.statusCode).toEqual(400);
    });

    it('should fail to register a user with a duplicate email', async () => {
        await request(app)
            .post('/api/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password123',
                full_name: 'Test User',
                phone_number: '1234567890',
                role: 'customer'
            });

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password456',
                full_name: 'Another User',
                phone_number: '0987654321',
                role: 'customer'
            });
        expect(res.statusCode).toEqual(400);
    });

    describe('Login', () => {
        beforeEach(async () => {
            await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'login@example.com',
                    password: 'password123',
                    full_name: 'Login User',
                    phone_number: '1112223333',
                    role: 'driver'
                });
        });

        it('should login a registered user successfully', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'login@example.com',
                    password: 'password123'
                });
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('token');
        });

        it('should fail to login a non-existent user', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nouser@example.com',
                    password: 'password123'
                });
            expect(res.statusCode).toEqual(400);
        });

        it('should fail to login with a wrong password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'login@example.com',
                    password: 'wrongpassword'
                });
            expect(res.statusCode).toEqual(400);
        });
    });
});
