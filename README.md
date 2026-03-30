# Perf Lens MVP

Perf Lens is a full-stack static analysis tool that scans frontend project codebases (ZIP or GitHub URL) and returns actionable performance insights.

## Tech Stack

- Frontend: React + TypeScript + Redux Toolkit + Tailwind CSS
- API Server: Node.js + Express + TypeScript
- Worker: BullMQ + Redis (async analysis jobs)
- Database: PostgreSQL
- Parser: `@babel/parser` + `@babel/traverse`
- File Storage (MVP): Local filesystem

## Project Structure

- `client` - React dashboard (Upload + Report)
- `server` - Upload/report API and queue producer
- `worker` - Queue consumer and static analysis engine

## Core Flow

1. User uploads ZIP on `/` page
2. `POST /api/upload` stores file and creates a report record (`queued`)
3. Job is pushed to BullMQ (`analysis-jobs`)
4. Worker extracts ZIP, parses JS/TS files, computes issues + suggestions
5. Worker updates Postgres report (`completed` or `failed`)
6. UI polls `GET /api/report/:id` and renders insights

## Detection Rules (MVP)

- Large imports
  - Flags full imports from heavy libs (`lodash`, `moment`, `ramda`, `date-fns`)
- File size analysis
  - Computes all JS/TS file sizes and highlights top 10 largest files
- Component complexity
- Flags large component-like functions over 200 lines
  - Flags deeply nested JSX trees (depth >= 7)
- Re-render risk (basic)
  - Flags inline function expressions in JSX attributes
  - Flags component files without detected `React.memo`/`memo` usage

## Suggestions Engine

Generates suggestion text from issue categories, such as:

- Use `lodash-es` or direct function imports
- Split large/deeply nested components
- Avoid inline arrow functions in JSX
- Consider `React.memo` for stable presentational components

## API

All analysis endpoints are authenticated. Use login/signup first and pass `Authorization: Bearer <token>`.

### `POST /api/auth/signup`

Request:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "secure-password"
}
```

### `POST /api/auth/login`

Request:

```json
{
  "email": "jane@example.com",
  "password": "secure-password"
}
```

Response (`signup` and `login`):

```json
{
  "token": "jwt-token",
  "user": {
    "id": "uuid",
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
}
```

### `POST /api/upload`

Upload a ZIP file as `multipart/form-data` with field name `projectZip`.

Example:

```bash
curl -X POST http://localhost:4000/api/upload \
  -F "projectZip=@/absolute/path/to/project.zip"
```

Response:

```json
{
  "reportId": "uuid",
  "status": "queued",
  "message": "Project uploaded. Analysis started."
}
```

### `GET /api/report/:id`

Returns status and analysis report.

Statuses: `queued`, `processing`, `completed`, `failed`.

### `GET /api/reports`

Returns report history for the authenticated user.

### `GET /api/auth/profile`

Returns the logged-in user's account profile, including compliance metadata.

Profile response now includes a subscription block (`free`/`individual`/`team`) with monthly report usage.

### `PATCH /api/auth/profile`

Updates user name + compliance profile metadata.

Request body:

```json
{
  "name": "Jane Doe",
  "profile": {
    "companyName": "Acme Inc",
    "jobTitle": "Engineering Manager",
    "country": "India",
    "timezone": "Asia/Kolkata",
    "dataClassification": "confidential",
    "primaryUseCase": "CI performance checks",
    "complianceFrameworks": ["SOC 2", "GDPR"],
    "securityContactEmail": "security@acme.com",
    "codeOwnershipConfirmed": true,
    "marketingUpdatesOptIn": false
  }
}
```

### `POST /api/analyze-repo`

Queue analysis from a GitHub repository URL.

Request body:

```json
{
  "repoUrl": "https://github.com/owner/repo"
}
```

Notes:

- Supports valid public GitHub repository URLs.
- Worker performs a shallow clone (`--depth 1`) for analysis.

### `POST /api/billing/checkout-session`

Creates a Stripe Checkout session for individual plans.

Request body:

```json
{
  "plan": "individual-monthly"
}
```

Supported plan values:

- `individual-monthly`
- `individual-quarterly`
- `individual-annual`

### `POST /api/billing/portal-session`

Creates a Stripe Customer Portal session for active paid users.

### `POST /api/billing/team-request`

Submits a Team Custom plan request.

Request body:

```json
{
  "workEmail": "team-admin@company.com",
  "companyName": "Acme Inc",
  "seatCount": 25,
  "notes": "Need procurement + SSO discussion."
}
```

### `POST /api/billing/webhook`

Stripe webhook endpoint (no auth). Configure this in your Stripe dashboard and set `STRIPE_WEBHOOK_SECRET`.

## Freemium + Paid Plans

- Free: up to 5 report requests per monthly cycle.
- Individual: paid subscription via Stripe (monthly/quarterly/annual) with higher usage (currently unlimited cap in app logic).
- Team: custom plan request workflow.
- Usage enforcement occurs when creating a new analysis request (`/upload` and `/analyze-repo`).
- If free limit is reached, API returns `402` with an upgrade message.

## Local Setup

## 1) Prerequisites

- Node.js 20+
- PostgreSQL running locally (or `DATABASE_URL` in env)
- Redis running locally

## 2) Install dependencies

```bash
npm install
```

## 3) Configure environment

Create `server/.env`:

```bash
cp server/.env.example server/.env
```

Create `client/.env`:

```bash
cp client/.env.example client/.env
```

## 4) Start everything

```bash
npm run dev
```

This starts:

- Server: `http://localhost:4000`
- Worker: background queue processor
- Client: `http://localhost:5173`

## 5) Build all apps

```bash
npm run build
```

## Report Shape (high-level)

- `summary`
  - `totalFiles`
  - `totalIssues`
  - `performanceScore` (0-100)
- `detectedFrameworks`
  - Ordered framework list inferred from dependencies, config files, and source patterns
- `bundleInsights`
  - `largeImportCount`
  - `largeFileCount`
  - `complexityHotspots`
  - `rerenderRiskCount`
- `largestFiles`
- `issues`
- `suggestions`

## Notes

- Upload size limit is controlled by `UPLOAD_MAX_MB` (default `200`).
- Temporary extracted files are deleted by the worker after processing.
- Supported source includes `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`, and script sections inside `.vue`, `.svelte`, `.astro`.
