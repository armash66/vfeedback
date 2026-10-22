# AGENTS.md

## The Product

Every lab and department in our college (Vidyalankar Institute of Technology) has its own QR code or paper form for feedback. Students rarely use them and nothing is in one place. VFeedback replaces all of them with one website and one dashboard.

- **Students**: Open one link (no login, no QR code required), pick a place (lab, canteen, classroom, Wi-Fi, etc.), choose _Rate_ / _Report a problem_ / _Suggest_, answer 2–4 quick questions, receive a word-based reference code (e.g., `spicy-samosa-k7q4mz`), and check status later using that reference code.
- **Staff**: Log in, view reports in a single unified list filtered by department, place, type, and status, update status, and add notes. Department staff see only their assigned department. Super admins see everything across all departments.

## Tech Stack

Do not substitute any parts of the stack without explicit approval:

- **Framework**: React Router 8 in framework mode (SSR)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (conforming to `docs/VOSS.org_design.md`)
- **Database & ORM**: PostgreSQL (Docker locally, Neon in production) managed via Drizzle ORM
- **Testing & Code Quality**: Vitest, Prettier
- **Authentication & Security (upcoming)**: Staff authentication via VOSS vauth (Better Auth), bot protection via Cloudflare Turnstile (optional and off by default for the pilot)

## Hard Constraints

1. **Student Privacy**: Students do not need accounts. Reports are anonymous. No IP address is stored with or linked to a report. Rate-limit rows are removed within an hour, and the device cookie lasts one day. It is not linked to any report.
2. **Access Boundary**: Public users can never read, browse, or list reports. The public status page must only return status information for one exact reference code.
3. **Staff Authorization**: Every staff action must re-verify role and department permissions on the server before reading or mutating data.
4. **UI Design System**: Strictly follow `docs/VOSS.org_design.md`:
   - UI follows voss-labs/vboard docs/UI_UX_SPEC.md at the commit pinned in docs/UI_REFERENCE.md. Use semantic tokens and shadcn base-nova components only, lucide icons, no emoji. Agents must not run any git command that changes state; read-only git is fine.
   - Monochrome primary buttons.
   - Brand orange reserved only for focus rings, selection states, and small accents.
   - Chart series may use the spec's chart palette (neutral axes, orange primary series, readable mono values as defined in Section 9 "Application components not defined by the source — extensions"), and nothing else (buttons, text, borders) may.
   - No shadows on cards, panels, inputs or buttons. Floating layers (menus, selects, sheets, dialogs) may use the shadow from the vboard components.
   - Student-facing controls are at least 44px tall at every width. Staff dashboard controls may use the compact vboard sizes from md up.
   - Full support for light and dark themes using tokens defined in the design spec.
5. **No Secrets in Code**: Read all credentials and secrets (`DATABASE_URL`, `SESSION_SECRET`, etc.) strictly from environment variables. Never hard-code credentials or commit secrets.

## Lessons from review

- Never show raw errors to users.
- Wrap browser storage access in try/catch.
- Read Postgres SQLSTATE through the cause chain.
- Env values may be quoted or contain special characters.
- No hard-coded colours.
- Use a fixed locale and time zone for dates.
- Keep database access lazy so pure tests run without a database.
- Only floating layers may have shadows.
- Student controls are 44px.
- A failed environment check is a warning unless it risks data loss.
