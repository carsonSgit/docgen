# 27. Marketing site information architecture

**Date**: 2026-08-14

## Status

Accepted

## Context

The Document Playground is a single-user, local-first document editing environment focused on structured content and Google Docs export. The existing application lives at the root route (`/`) and serves users who already understand the product. To support broader discovery and adoption, we need a marketing layer that explains the product, demonstrates its workflow, and provides a clear entry point into the playground—without changing the playground's scope or boundaries.

The marketing layer must:

- Explain structured document editing, automatic pagination, and one-way Google Docs export
- Use only canonical product vocabulary from CONTEXT.md
- Never imply collaboration, accounts, sync, document management, or Extended Editor features
- Maintain a clear boundary between marketing routes and the playground application
- Use a calm, editorial, premium visual identity with a green Tailwind-style palette (emerald/green with soft sage states)
- Provide subtle, purposeful motion with reduced-motion fallbacks
- Remain independently testable and deployable from the playground

## Decision

We define a comprehensive information architecture in `docs/design/marketing-information-architecture.md` that serves as the implementation contract for tickets #198–#200.

### Route Structure

- `/` — Marketing home page (new)
- `/playground` — Document Playground application (existing App.tsx, moved from `/`)

### Marketing Home Page Structure

Six sections in fixed order:

1. **Hero** — Product identity and value proposition with primary CTA
2. **Product Workflow** — Three-step visual flow (write → paginate → export)
3. **Feature Bento** — Core Editor Slice capabilities in asymmetric grid
4. **Proof** — Credibility through technical qualities or status indicators
5. **CTA** — Focused conversion section with clear playground entry
6. **Footer** — Minimal utility navigation and product context

### Visual System

**Color Palette**:

- Paper/ink foundation: stone-50 body, white surfaces, stone-900 primary text
- Green accents: emerald-600 primary action, emerald-700 hover, emerald-50 backgrounds
- Sage states: green-100 and green-200 for disabled or inactive elements
- Never use purple, violet, or indigo

**Typography**:

- Sans-serif: Inter with system fallbacks
- Type scale: 36–48px hero heading (fluid), 30px section heading, 18px card heading, 16px body, 14px small
- Font weights: 700 hero, 600 headings, 500 buttons, 400 body

**Spacing**: 8px base unit with common values from 4px (0.25rem) to 64px (4rem)

**Motion**:

- Durations: 100ms (instant), 150ms (quick), 200ms (standard), 300ms (comfortable), 400ms (deliberate)
- Timing: `ease-out` for most transitions, `ease-in-out` for bidirectional motion
- Animations: fade-in (300ms), lift on hover (translateY -4px, 200ms), scale on hover (1.02, 150ms), staggered fade-in (100ms delay)
- All transform-based motion disabled with `prefers-reduced-motion: reduce`; opacity transitions preserved but reduced to 100ms

### Component Inventory

Six new marketing-specific components:

1. **MarketingButton** — Primary, secondary, and ghost variants with hover/active states
2. **MarketingCard** — Paper-white surface with optional lift effect
3. **MarketingSection** — Layout container with consistent vertical spacing
4. **WorkflowCard** — Specialized card for three-step workflow
5. **FeatureCard** — Specialized card for bento grid
6. **MarketingLayout** — Root wrapper with header and footer

No playground components are reused in marketing; the boundary is a full page transition.

### File Organization

```
apps/web/src/
├── main.tsx                    # Root with route switching
├── App.tsx                     # Existing playground (unchanged)
├── styles.css                  # Existing playground styles (unchanged)
├── marketing/
│   ├── MarketingPage.tsx       # Marketing home page
│   ├── MarketingLayout.tsx     # Layout wrapper
│   ├── sections/               # Hero, ProductWorkflow, FeatureBento, Proof, CTA, Footer
│   ├── components/             # MarketingButton, MarketingCard, etc.
│   └── marketing.css           # Marketing-specific styles
```

### Boundaries

**Product Claims**:

- Marketing copy must use canonical vocabulary (Document Playground, Local Document, Google Export, Core Editor Slice, Fixed Page Layout, single-user/local-first/one-document)
- Marketing must not imply collaboration, accounts, sync, document management, HTML conversion, Extended Editor features, or user-configurable layouts

**Visual Assets**:

- Product screenshots and illustrations must show only supported Core Editor Slice features
- No collaboration indicators, account UI, document lists, tables (unless in Extended Editor), import functionality, or custom layouts

**Technical**:

- Marketing and playground are separate component trees with no shared state
- Routing implemented with basic path-based rendering in main.tsx
- Marketing uses its own stylesheet; playground styles remain unchanged

### Responsive Behavior

- Mobile (`< 640px`): stacked layouts, full-width components
- Tablet (`640px – 1024px`): transitional layouts, 2-column grids
- Desktop (`≥ 1024px`): side-by-side layouts, 3-column grids

Hero uses fluid typography with `clamp(2.25rem, 4vw, 3rem)`. All layouts reflow gracefully across breakpoints.

### Accessibility

- Semantic HTML: `<main>`, `<section>`, `<header>`, `<footer>`, `<nav>`, heading hierarchy
- WCAG AA color contrast for all text (primary text is AAA)
- Visible focus indicators: 2px emerald-500 ring with 2px offset
- Logical tab order, accessible names for all interactive elements

## Consequences

### Positive

- Marketing and playground remain independently testable and deployable
- Clear vocabulary prevents scope creep into collaboration or Extended Editor features
- Comprehensive visual system ensures consistent implementation across tickets #198–#200
- Motion system with reduced-motion fallbacks provides accessible, purposeful animation
- Component inventory defines reusable primitives for efficient implementation
- File organization maintains clear boundary between marketing and playground

### Negative

- Adds a new `/marketing` directory and lightweight routing to the application
- Marketing-specific components increase the surface area for testing
- Responsive behavior must be tested across three breakpoints
- Motion system requires careful implementation to respect `prefers-reduced-motion`

### Neutral

- The IA document in `docs/design/` serves as the source of truth for tickets #198–#200
- Follow-up tickets must reference this ADR and the IA document for design decisions
- Any changes to visual system or component inventory require updating the IA document

## Alternatives Considered

### Use Existing Playground Components

**Rejected**: The playground's visual identity (Google Docs-inspired, editor-focused) does not match the marketing layer's goals (editorial, calm, premium). Reusing components would blur the boundary and risk introducing marketing concerns into the playground domain.

### Full-Featured UI Library (e.g., shadcn/ui, Radix UI)

**Rejected**: Adds unnecessary dependencies for a small set of marketing components. The visual system is simple enough to implement with custom React components and CSS.

### Heavy Animation and Motion

**Rejected**: The editorial, calm positioning requires subtle, purposeful motion. Heavy animations would compete with document content and violate accessibility guidelines for users with vestibular disorders.

### Purple or Blue Accent Palette

**Rejected**: Issue #196 explicitly requires a green Tailwind-style palette (emerald/green with soft sage states) to differentiate from typical SaaS products and convey the structured, document-focused nature of the product.

### Separate Marketing Application

**Rejected**: Over-engineers the boundary for a single marketing page. A lightweight routing solution within the existing Vite/React application is sufficient for the MVP marketing layer.

## References

- Issue #196: Marketing site layer over Document Playground
- Issue #197: Define marketing site IA, visual system, and component inventory
- `docs/design/marketing-information-architecture.md`: Full IA specification
- `CONTEXT.md`: Canonical product vocabulary
