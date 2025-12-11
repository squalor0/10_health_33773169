# Shape Runner

Shape Runner is a fitness-focused web application built for the **Dynamic Web Applications** module.

It allows users to:

- Create and save running routes using **Leaflet** maps  
- Automatically snap hand-drawn routes to real roads using **openrouteservice (ORS)**
- Log completed runs with dates, duration, notes and ratings  
- Register, log in and manage routes using session-based authentication
- Use a MySQL-backed persistent database  
- Protect credentials using **dotenv**

---

## Dotenv

The dotenv module is used to keep sensitive information out of the source code.  
A `.env` file is created in the project root, containing variables such as:

- `HEALTH_HOST`  
- `HEALTH_USER`  
- `HEALTH_PASSWORD`  
- `HEALTH_DATABASE`  
- `HEALTH_BASE_PATH`  
- `ORS_API_KEY`  
- `SESSION_SECRET`

In `index.js`, the database connection pool reads these values from `process.env`, ensuring credentials never appear directly in the codebase.

`SESSION_SECRET` is also stored in `.env` so the Express session middleware is correctly secured.

---

## User Accounts and Authentication

Authentication uses bcrypt for password hashing and express-session for login persistence.

- On registration, passwords are hashed before being inserted into the database.
- On login, bcrypt compares the submitted password with the stored hash.
- After logging in, the user receives a session that remains active until logout.
- Several routes are protected using a middleware check to ensure only authenticated users can access them.

---

## Route Creation and openrouteservice Integration

The most significant feature of the app is route generation:

1. The user draws a rough line on an interactive **Leaflet** map.  
2. The set of hand-drawn points is sent to **openrouteservice**.  
3. ORS returns a road-snapped polyline that follows real streets.  
4. The snapped route is displayed back on the map and can be saved.

This integrates an external service using authenticated HTTP requests and geoJSON parsing.

Attribution for ORS and OpenStreetMap appears on every page containing a map, as required by their usage guidelines.

---

## Runs Logging

Users can log completed runs for any of their saved routes.

Each run record includes:

- Date of the run  
- Duration (minutes)  
- Rating  
- Optional notes  

Runs are stored in the `runs` table, linked by foreign keys to both the user and the route.

---

## Data Validation

Basic server-side validation prevents invalid or incomplete data from entering the system.

Examples include:

- Ensuring usernames are unique during registration  
- Validating route names before insertion  
- Ensuring numeric values (duration, distance, scale) are properly formatted  
- Preventing empty fields where required  

Error messages are displayed on the relevant EJS pages when validation fails.

---

## Mapping and Front-End Interaction

Leaflet handles:

- Map rendering  
- User point selection  
- Displaying snapped routes  
- Click-based interaction for route creation  

JavaScript files in `/public/js` manage:

- Drawing points on the map   
- Updating the UI based on ORS results  

---

## API

A small JSON API is included for accessing routes:

### Public Routes
```
/api/routes
```

Returns a list of all publicly shared routes.

### User's Own Routes
```
/api/routes/mine
```

Returns only the routes created by the logged-in user.

### Save Route  
```
POST /routes/save
```

Accepts JSON route data and stores it in the database.

These endpoints return raw JSON and are used internally by the front-end.

---

## Database

The application uses a MySQL database named **health** consisting of three tables:

### `users`
Stores login credentials and basic user metadata.

### `routes`
Stores saved route information including name, shape type, scale, centre point and distance.

### `runs`
Stores logged run entries, each linked to a user and a route.

Database setup is performed using:

- `create_db.sql`  
- `insert_test_data.sql`

---

## Prerequisites

- Node.js  
- MySQL server  
- A configured **health** database  
- A valid openrouteservice API key

---

## Installation

Clone the repository and install dependencies:

```bash
npm install
```

Run the application locally:

```bash
node index.js
```

---
