# AGENTS.md

## The Product

Every lab and department in our college (Vidyalankar Institute of Technology) has its own QR code or paper form for feedback. Students rarely use them and nothing is in one place. VFeedback replaces all of them with one website and one dashboard.

- **Students**: Open one link (no login, no QR code required), pick a place (lab, canteen, classroom, Wi-Fi, etc.), choose _Rate_ / _Report a problem_ / _Suggest_, answer 2–4 quick questions, receive a word-based reference code (e.g., `spicy-samosa-42`), and check status later using that reference code.
- **Staff**: Log in, view reports in a single unified list filtered by department, place, type, and status, update status, and add notes. Department staff see only their assigned department. Super admins see everything across all departments.

## Tech Stack

Do not substitute any parts of the stack without explicit approval:

- **Framework**: React Router 8 in framework mode (SSR)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (conforming to `docs/VOSS.org_design.md`)
- **Database & ORM**: PostgreSQL (Docker locally, Neon in production) managed via Drizzle ORM
- **Testing & Code Quality**: Vitest, Prettier
- **Authentication & Security (upcoming)**: Staff authentication via VOSS vauth (Better Auth), bot protection via Cloudflare Turnstile

## Hard Constraints

1. **Student Privacy**: Students do not need accounts. Never collect a student's name, roll number, or IP address.
2. **Access Boundary**: Public users can never read, browse, or list reports. The public status page must only return status information for one exact reference code.
3. **Staff Authorization**: Every staff action must re-verify role and department permissions on the server before reading or mutating data.
4. **UI Design System**: Strictly follow `docs/VOSS.org_design.md`:
   - Monochrome primary buttons.
   - Brand orange reserved only for focus rings, selection states, and small accents.
   - Chart series may use the spec's chart palette (neutral axes, orange primary series, readable mono values as defined in Section 9 "Application components not defined by the source — extensions"), and nothing else (buttons, text, borders) may.
   - Flat surfaces: no box-shadows or gradients.
   - Minimum 44px touch targets.
   - Full support for light and dark themes using tokens defined in the design spec.
5. **No Secrets in Code**: Read all credentials and secrets (`DATABASE_URL`, `SESSION_SECRET`, etc.) strictly from environment variables. Never hard-code credentials or commit secrets.
