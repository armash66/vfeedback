# UI Reference

## Pinned Source

VFeedback UI design tokens, components, and shell patterns follow `voss-labs/vboard` (`docs/UI_UX_SPEC.md`).

- **Repository**: `voss-labs/vboard`
- **Pinned Commit**: `b0a5015`

## Precedence and Synchronization Rules

1. **Design System Authority**: Where `docs/VOSS.org_design.md` conflicts with `voss-labs/vboard` UI patterns or tokens, `voss-labs/vboard` takes precedence and `docs/VOSS.org_design.md` yields.
2. **Token Synchronization**: Design tokens (`app/app.css`) and shared UI primitives must be re-synced only in a dedicated pull request to prevent regressions across screens.
3. **Components & Styling**:
   - Use semantic tokens and shadcn `base-nova` primitives only.
   - Use Lucide icons (`lucide-react`) for all iconography; no emoji or dingbat characters.
   - No raw colors or hex values in page markup.
