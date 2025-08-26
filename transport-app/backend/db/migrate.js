const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./transport.db');

const migrationSql = [
    `CREATE TABLE IF NOT EXISTS Vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        driver_id INTEGER,
        type TEXT CHECK(type IN ('taxi', 'bus', 'delivery_van', 'gas_tanker')),
        make TEXT,
        model TEXT,
        license_plate TEXT UNIQUE,
        total_seats INTEGER,
        status TEXT CHECK(status IN ('available', 'on_trip', 'maintenance')),
        current_location_lat REAL,
        current_location_lng REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (driver_id) REFERENCES Users(id)
    );`,
    `CREATE TABLE IF NOT EXISTS Bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        vehicle_id INTEGER,
        type TEXT CHECK(type IN ('taxi_ride', 'parcel_delivery', 'bus_ticket', 'gas_order')),
        status TEXT CHECK(status IN ('requested', 'accepted', 'in_progress', 'completed', 'cancelled')),
        origin_address TEXT,
        destination_address TEXT,
        price REAL,
        booked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        start_time DATETIME,
        end_time DATETIME,
        details TEXT,
        schedule_id INTEGER,
        seat_number INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES Users(id),
        FOREIGN KEY (vehicle_id) REFERENCES Vehicles(id)
    );`,
    `CREATE TABLE IF NOT EXISTS Routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS Stops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        latitude REAL,
        longitude REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS RouteStops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_id INTEGER,
        stop_id INTEGER,
        stop_order INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (route_id) REFERENCES Routes(id),
        FOREIGN KEY (stop_id) REFERENCES Stops(id)
    );`,
    `CREATE TABLE IF NOT EXISTS Schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_id INTEGER,
        bus_id INTEGER,
        departure_time DATETIME,
        arrival_time DATETIME,
        price_per_seat REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (route_id) REFERENCES Routes(id),
        FOREIGN KEY (bus_id) REFERENCES Vehicles(id)
    );`
];

db.serialize(() => {
    migrationSql.forEach((sql, index) => {
        db.run(sql, (err) => {
            if (err) {
                console.error(`Error executing migration step ${index + 1}:`, err.message);
            } else {
                console.log(`Migration step ${index + 1} executed successfully.`);
            }
        });
    });
});

db.close((err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Database connection closed.');
});
