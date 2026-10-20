# vfeedback

Unified anonymous student feedback and issue reporting system for Vidyalankar Institute of Technology (VIT). Replaces fragmented QR codes and paper forms across college labs, classrooms, and services with a single fast website and dashboard.

## Quick Start

### Prerequisites

- Node.js (version pinned in `.nvmrc`)
- Docker Desktop (or local PostgreSQL 16)

```bash
# 1. Use the expected Node.js version
nvm use

# 2. Install dependencies
npm ci

# 3. Initialize environment configuration
npm run setup

# 4. Start local PostgreSQL database container
npm run db:up

# 5. Apply migrations and seed data
npm run db:migrate
npm run db:seed

# 6. Start the local development server
npm run dev
```

The application will be running at `http://localhost:5173`.

> [!NOTE]
> If you already have a local PostgreSQL service running on port 5432, edit `.env` to set `POSTGRES_PORT=5433` and re-run `npm run setup` before starting `npm run db:up`. This avoids port collisions.

---

## Scripts

| Command                | Description                                                                   |
| :--------------------- | :---------------------------------------------------------------------------- |
| `npm run dev`          | Starts the React Router SSR development server with HMR.                      |
| `npm run build`        | Builds the production bundle (client assets and server build).                |
| `npm run start`        | Runs the production React Router server from `./build/server`.                |
| `npm run typecheck`    | Generates React Router route types and runs TypeScript type checking (`tsc`). |
| `npm run format`       | Formats the codebase using Prettier.                                          |
| `npm run format:check` | Verifies that all files conform to Prettier formatting.                       |
| `npm run setup`        | Configures `.env` with secure generated secrets and database URLs.            |
| `npm run setup:check`  | Validates that required environment variables are set and configured.         |
| `npm run db:up`        | Boots the PostgreSQL 16 Docker container and waits for healthy status.        |
| `npm run db:down`      | Stops and tears down the PostgreSQL Docker container.                         |
| `npm run db:generate`  | Generates new SQL migration files using Drizzle Kit.                          |
| `npm run db:migrate`   | Applies pending SQL migrations to the database.                               |
| `npm run db:seed`      | Seeds initial places and department test fixtures.                            |
| `npm test`             | Executes the Vitest test suite (pure unit & database integration tests).      |

---

## Folder Structure

```text
.
├── .github/
│   └── workflows/ci.yml    # Continuous integration pipeline (quality & database jobs)
├── app/
│   ├── components/         # Base UI primitives (buttons, inputs, cards, dialogs)
│   ├── db/                 # Drizzle client and PostgreSQL schema definitions
│   ├── lib/                # Pure input validation, report server helpers, rate limiting
│   ├── routes/             # React Router SSR route modules:
│   │   ├── home.tsx        # Place selection & action picker
│   │   ├── report.tsx      # Multi-step feedback form with Turnstile & rate limiting
│   │   ├── done.tsx        # Submission success screen & reference code display
│   │   ├── status.tsx      # Public status check page
│   │   └── healthz.ts      # Health check endpoint (200 / 503)
│   ├── app.css             # Tailwind CSS v4 design tokens and theme variables
│   ├── root.tsx            # HTML root layout, header, footer, and theme toggle
│   └── routes.ts           # React Router route manifest
├── drizzle/                # Generated SQL migration files and schema snapshots
├── scripts/                # Setup, migration, and database seed scripts
├── tests/                  # Vitest pure unit and database integration test suites
└── docs/                   # UI reference and VOSS design specifications
```

---

## UI Reference

The interface conforms strictly to `docs/VOSS.org_design.md` and the design specifications from [`voss-labs/vboard`](https://github.com/voss-labs/vboard) (`docs/UI_UX_SPEC.md` pinned at commit `b0a5015` in `docs/UI_REFERENCE.md`):

- **Component Primitives**: Uses semantic tokens and base-nova components built on top of Tailwind CSS v4.
- **Iconography**: Icons are strictly from `lucide-react`. No emoji or dingbats in interface copy.
- **Color Discipline**: Monochrome primary buttons. Brand orange is reserved exclusively for focus rings, selected state highlights, and subtle accents.
- **No Card Shadows**: Flat bordered panels and cards with 0px box shadows. Floating overlays (sheets, dropdowns) use defined elevation tokens.
- **Touch Ergonomics**: Student interactive controls are at least 44px tall at all viewport breakpoints.
- **Theme Support**: Seamless light and dark mode toggling using CSS custom properties with local storage persistence and zero hydration flashing.

---

## Architecture Notes

### 1. Bot & Spam Protection

- **Turnstile (Optional)**: Cloudflare Turnstile bot verification is optional and off by default for the pilot. To enable it, configure `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in `.env`. When active, it uses explicit widget rendering with interaction-only appearance, disables submission until a token is received, resets on failed submissions, and never forwards visitor IP addresses to Cloudflare.
- **Honeypot**: A visually hidden `website` field traps automated bots without affecting screen readers or keyboard navigation.
- **Fill-Time Signed Token**: An HMAC-signed timestamp token in the form rejects submissions completed faster than 3 seconds (< 3s) or older than 24 hours (> 24h).

### 2. Rate Limiting for Shared Campus Networks

Students frequently share a small number of public IP addresses on campus Wi-Fi:

- **Per Network**: 120 reports per 10 minutes and 600 status lookups per 10 minutes based on an HMAC-SHA256 hash of the client IP and current UTC date.
- **Per Device**: An `HttpOnly`, `SameSite=Lax` cookie (`vf_device`) set for 1 day limits submissions to 5 reports per 10 minutes per device. Keys are hashed via HMAC before storage. If the cookie is missing, only the per-network limit applies.
- **Automatic Pruning**: Stale rate-limit windows older than 1 hour are pruned opportunistically (~1 in 100 requests).
- **Deployment Note**: Read client addresses only from a proxy you control. If the app is exposed directly, a client can fake the forwarded-for header.

### 3. Idempotency (`submission_id`)

To protect against accidental double-clicks and repeated network submissions:

- The feedback form loader issues a unique `submission_id` (UUID) placed in a hidden input.
- `createReport` checks for existing submissions with that `submission_id` before inserting.
- Concurrent duplicate submissions are caught by PostgreSQL unique constraints (`isUniqueViolation`) and cleanly resolve to the existing report's reference code without creating duplicate rows.

### 4. Human-Readable Reference Codes

Feedback reports are assigned friendly, word-based reference codes (e.g. `amber-biryani-4x7p2q`):

- Composed of a curated adjective, food/campus noun, and 6-character Crockford base32 suffix.
- Generated using Web Crypto `crypto.getRandomValues()` with uniform rejection sampling (no `Math.random`).
- Validated with strict regex patterns before any database queries.

### 5. Privacy Boundary

Student privacy is an absolute constraint:

- Students never register or log in.
- Reports are completely anonymous.
- No student names, roll numbers, or IP addresses are stored with or linked to reports.
- A random device cookie, stored only as a hash, limits repeated submissions for one day. It is not linked to any report.
- Public users cannot browse or enumerate reports; the `/status` route only returns information for one exact reference code.
