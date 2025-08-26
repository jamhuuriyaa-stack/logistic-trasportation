
const sqlite3 = require("sqlite3").verbose();

// Create a new database file
const db = new sqlite3.Database("./transport.db", (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Connected to the in-memory SQlite database.");
});

// SQL statement to create a new table
const createUsersTableSql = `
CREATE TABLE Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    full_name TEXT,
    phone_number TEXT UNIQUE,
    role TEXT CHECK(role IN ("customer", "driver", "admin")),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`;

// Create the Users table
db.run(createUsersTableSql, (err) => {
  if (err) {
    // Table already created
    return console.error(err.message);
  }
  console.log("Users table created.");
});

// Close the database connection
db.close((err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Close the database connection.");
});
