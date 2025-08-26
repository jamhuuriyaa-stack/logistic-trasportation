# Database Schema

This document outlines the database schema for the transportation app.

## Core Tables

### Users Table
Stores information about all users (customers, drivers, admins).
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `email`: TEXT UNIQUE
- `password_hash`: TEXT
- `full_name`: TEXT
- `phone_number`: TEXT UNIQUE
- `role`: TEXT CHECK(role IN ('customer', 'driver', 'admin'))
- `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `updated_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

### Vehicles Table
Stores details for all registered vehicles.
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `driver_id`: INTEGER (Foreign Key to `Users.id`)
- `type`: TEXT CHECK(type IN ('taxi', 'bus', 'delivery_van', 'gas_tanker'))
- `make`: TEXT
- `model`: TEXT
- `license_plate`: TEXT UNIQUE
- `total_seats`: INTEGER (e.g., 4 for a taxi, 50 for a bus)
- `status`: TEXT CHECK(status IN ('available', 'on_trip', 'maintenance'))
- `current_location_lat`: REAL
- `current_location_lng`: REAL
- `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `updated_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

### Bookings Table
A versatile table to handle all types of transportation requests.
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `customer_id`: INTEGER (Foreign Key to `Users.id`)
- `vehicle_id`: INTEGER (Foreign Key to `Vehicles.id`)
- `type`: TEXT CHECK(type IN ('taxi_ride', 'parcel_delivery', 'bus_ticket', 'gas_order'))
- `status`: TEXT CHECK(status IN ('requested', 'accepted', 'in_progress', 'completed', 'cancelled'))
- `origin_address`: TEXT
- `destination_address`: TEXT
- `price`: REAL
- `booked_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `start_time`: DATETIME
- `end_time`: DATETIME
- `details`: TEXT (JSON formatted string for specific details, e.g., `{"parcel_weight": 5, "parcel_description": "Books"}`)
- `schedule_id`: INTEGER (Foreign Key to `Schedules.id`, for bus bookings)
- `seat_number`: INTEGER (for bus bookings)
- `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `updated_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

## Bus Booking Tables

### Routes Table
Defines the bus routes.
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `name`: TEXT (e.g., "City A - City B Express")
- `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `updated_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

### Stops Table
Defines the bus stops.
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `name`: TEXT (e.g., "Downtown Bus Terminal")
- `latitude`: REAL
- `longitude`: REAL
- `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `updated_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

### RouteStops Table
A junction table to link stops to routes and define their order.
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `route_id`: INTEGER (Foreign Key to `Routes.id`)
- `stop_id`: INTEGER (Foreign Key to `Stops.id`)
- `stop_order`: INTEGER (The sequence of the stop in the route)
- `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

### Schedules Table
Defines the schedule for a bus on a specific route.
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `route_id`: INTEGER (Foreign Key to `Routes.id`)
- `bus_id`: INTEGER (Foreign Key to `Vehicles.id` where `type` is 'bus')
- `departure_time`: DATETIME
- `arrival_time`: DATETIME
- `price_per_seat`: REAL
- `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `updated_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
