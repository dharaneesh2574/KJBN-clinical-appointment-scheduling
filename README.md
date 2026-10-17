# KJBN Clinical Appointment Scheduling

Initial application scaffold for clinical appointment scheduling.

- `frontend/`: React, TypeScript, and Vite.
- `backend/`: NestJS and TypeScript.

## Local development

Install Node.js compatible with both apps and npm. Run each app in its own terminal.

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
npm ci
npm run start:dev
```

The backend listens on port `3000` by default, or the `PORT` environment variable.

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

## Repository conventions

Commit source files, configuration, `package.json`, and `package-lock.json` for each app.
Dependencies, generated builds, coverage, caches, logs, and local environment files
are ignored. Use sanitized `.env.example`, `.env.sample`, or `.env.template` files
to document any future environment variables without committing secrets.
