const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./transport.db');

const migrationSql = [
    `ALTER TABLE Users ADD COLUMN points INTEGER DEFAULT 0;`,
    `CREATE TABLE IF NOT EXISTS PointTransactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        booking_id INTEGER,
        points_change INTEGER,
        transaction_type TEXT CHECK(transaction_type IN ('earned', 'spent', 'correction')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(id),
        FOREIGN KEY (booking_id) REFERENCES Bookings(id)
    );`
];

db.serialize(() => {
    migrationSql.forEach((sql, index) => {
        db.run(sql, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`Migration step ${index + 1} (ALTER TABLE) already applied.`);
                } else {
                    console.error(`Error executing migration step ${index + 1}:`, err.message);
                }
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
