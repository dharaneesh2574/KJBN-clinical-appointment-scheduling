# KJBN Clinical Appointment Scheduling

Initial application scaffold for clinical appointment scheduling.

- `frontend/`: React, TypeScript, and Vite.
- `backend/`: NestJS, TypeScript, and Prisma ORM 7 with PostgreSQL.

Both apps belong to the single Git repository at this project root. The root
`.gitignore` applies to both apps.

## Local development

Use Node.js 22.12+ (22.x) or Node.js 24+ and npm. Run each app in its own terminal.

### Frontend

```sh
cd frontend
npm ci
npm run dev
```

Vite prints the frontend URL in the terminal.

### Backend

```sh
cd backend
cp .env.example .env
npm ci
```

Set `DATABASE_URL` in `backend/.env` to a running PostgreSQL database, then run
`npm run start:dev` from `backend/`. The application checks its database connection
at startup and closes it on shutdown.

The backend listens on port `3000` by default, or the `PORT` environment variable.

### Prisma

Run these commands from `backend/`:

```sh
npm run prisma:validate
npm run prisma:generate
npm run prisma:studio
```

Client generation also runs automatically after `npm ci` and before backend builds.
Generated code stays out of Git. Generation and builds do not need database credentials.

The schema in `backend/prisma/schema.prisma` is ready for application models. After
adding models, create and apply a development migration and regenerate the client:

```sh
npm run prisma:migrate -- --name init
npm run prisma:generate
```

Commit the schema and generated SQL migrations. Apply committed migrations in
deployment with `npm run prisma:deploy`. Database commands need `DATABASE_URL`;
the example URL contains placeholders that must be replaced. No tables or
migrations are included in this initial ORM configuration.

Import `PrismaModule` into backend feature modules and inject `PrismaService` into
their providers to query the database. Install development dependencies in the
build stage so the Prisma CLI is available for generation and migrations.

## Validation

From `frontend/`:

```sh
npm run lint
npm run build
```

From `backend/`:

```sh
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

The tests mock the database provider; they do not require or verify a live PostgreSQL server.

## Repository conventions

Commit source files, configuration, `package.json`, and `package-lock.json` for each app.
Dependencies, generated builds, coverage, caches, logs, and local environment files
are ignored. Use sanitized `.env.example`, `.env.sample`, or `.env.template` files
to document any future environment variables without committing secrets.
