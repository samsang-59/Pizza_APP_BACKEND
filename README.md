# 🍕 Pizza App Backend

A Node.js + Express + MongoDB REST API backend for a pizza ordering application, built around the **MVC (Model–View–Controller)** architectural pattern (View is replaced by JSON API responses, as is standard for a backend-only service).

> **Project status:** Early-stage / actively under development. The full request pipeline (Route → Controller → Service → Repository → Model → DB) is wired up end-to-end for the **User** resource (registration). Additional resources (Pizza, Order, Cart) and features (auth, validation middleware) are still to come. See [Current Structure](#-current-structure) below for exactly what exists today vs. what's coming.

---

## Tech Stack

| Layer            | Technology                          |
|-------------------|--------------------------------------|
| Runtime            | Node.js                             |
| Web Framework      | [Express](https://expressjs.com/) v5 |
| Database           | [MongoDB](https://www.mongodb.com/) via [Mongoose](https://mongoosejs.com/) |
| Config Management  | [dotenv](https://www.npmjs.com/package/dotenv) |
| Password Hashing   | [bcrypt](https://www.npmjs.com/package/bcrypt) |
| Dev Tooling        | [nodemon](https://www.npmjs.com/package/nodemon) |

---

## Architecture (MVC + Service/Repository)

The backend follows the MVC pattern adapted for REST APIs, with an added Service and Repository layer to keep business logic and database access cleanly separated:

- **Model / Schema** — Mongoose schemas that define the shape of data (Users, Pizzas, Orders, etc.) and are the layer that actually talks to MongoDB.
- **Repository** — Data-access layer that wraps all database queries (find, create, update, delete) using the Models. Services never query Mongoose directly — they go through the repository.
- **Service** — Business logic layer. Talks to the repository to fetch/persist data, applies business rules, and hands the result back to the controller.
- **Controller** — Sits between routes and services: validates input, calls the appropriate service, and shapes the HTTP response.
- **Route** — Express routers that map HTTP endpoints (`GET /pizzas`, `POST /orders`, ...) to their controller functions.
- **View** — Replaced by JSON responses, since this is an API-only backend (no server-rendered templates).

```mermaid
flowchart LR
    Client["Client\n(Postman / Frontend App)"] -->|HTTP Request| Routes

    subgraph API["Express Application"]
        Routes["Routes\n(src/routes)"] --> Controllers["Controllers\n(src/controllers)"]
        Controllers --> Services["Services\n(src/service)\nbusiness logic"]
        Services --> Repositories["Repositories\n(src/repositories)\ndata access layer"]
        Repositories --> Models["Models / Schemas\n(src/schema)"]
    end

    Models -->|Mongoose ODM| DB[("MongoDB Atlas")]
    Repositories -->|reads / writes via Models| DB
    Config["Config\n(src/config)\nenv, DB connection, server setup"] -.->|configures| API
    Config -.->|connects| DB

    Controllers -->|JSON Response| Client
```

**Request flow:** `Client → Route → Controller → Service → Repository → Model (Schema) → MongoDB`, and the response travels back the same path as JSON.

---

## Current Structure

This is what actually exists in the repository right now:

```
PIZZA_APP_BACKEND/
├── src/
│   ├── index.js                    # App entry point — wires up middleware, mounts routes, starts the server, connects to DB
│   ├── config/
│   │   ├── serverConfig.js         # Reads PORT and DB_URL from environment variables
│   │   └── dbConfig.js             # Establishes the Mongoose connection to MongoDB
│   ├── routes/
│   │   └── userRoute.js            # Maps /user endpoints to their controller functions
│   ├── controllers/
│   │   └── userController.js       # Handles the HTTP request/response for user endpoints
│   ├── service/
│   │   └── userService.js          # Business logic for users (e.g. duplicate-user checks on registration)
│   ├── repositories/
│   │   └── userRepository.js       # Data-access layer — all Mongoose queries for the User model live here
│   └── schema/
│       └── userSchema.js           # Mongoose schema/model for User (name, email, mobile, password)
├── .env.example                     # Template for required environment variables
├── .gitignore
├── package.json
└── README.md
```

### What each piece does (in plain language)

- **`src/index.js`** — The starting point of the app. It creates the Express server, tells it to understand JSON and form data sent by clients, mounts the `/user` routes, and starts listening for requests on the configured port. It also triggers the database connection when the server boots up.
- **`src/config/serverConfig.js`** — Centralizes environment-based settings (like which port to run on and the database URL) so the rest of the app never reads `process.env` directly.
- **`src/config/dbConfig.js`** — Handles connecting to the MongoDB database using Mongoose, and logs whether that connection succeeded or failed.
- **`src/routes/userRoute.js`** — Defines the `/user` endpoints (currently `POST /user` to register) and points each one at its controller function.
- **`src/controllers/userController.js`** — Receives the HTTP request, hands it off to the service layer, and formats a consistent JSON response (`{ success, message, data, error }`) whether the operation succeeds or fails.
- **`src/service/userService.js`** — Contains the actual business rule for registration: check whether a user with the same email/mobile number already exists before creating a new one. Talks only to the repository, never to Mongoose directly.
- **`src/repositories/userRepository.js`** — The only place that runs Mongoose queries (`findOne`, `create`) against the `User` model. Keeps database access isolated from business logic.
- **`src/schema/userSchema.js`** — The Mongoose schema/model for `User`: first name, last name, mobile number, email, and password, with validation (required fields, length limits, uniqueness, email format). A `pre('save')` hook hashes the password with bcrypt before it's written to the database, so plaintext passwords are never stored.

### Coming next

- Additional resources: Pizza, Order, Cart, Category (schema → repository → service → controller → route for each)
- `src/middlewares/` — Auth guards, centralized error handling, request validation
- Authentication (JWT-based login/signup)
- Order management and cart flow

---

## API Endpoints

| Method | Endpoint | Description | Body |
|--------|----------|--------------|------|
| `POST` | `/user`  | Register a new user | `{ "firstName", "lastName", "email", "mobileNumber", "password" }` |

All responses follow the same shape:

```json
{
  "success": true,
  "message": "Successfully created user",
  "data": { "...": "..." },
  "error": {}
}
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- A [MongoDB](https://www.mongodb.com/atlas) database (local or Atlas)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/samsang-59/Pizza_APP_BACKEND.git
cd Pizza_APP_BACKEND

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# then fill in your own values in .env
```

### Environment Variables

Create a `.env` file in the project root (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `PORT` | Port the Express server listens on |
| `DB_URL` | MongoDB connection string |

> `.env` is git-ignored — never commit real credentials.

### Running the app

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

The server will start on `http://localhost:<PORT>` and log a message once it successfully connects to MongoDB.

---

## Contributing

This project is a personal learning/portfolio build. Suggestions and feedback are welcome via issues or pull requests.

## License

Licensed under the [ISC License](LICENSE).
