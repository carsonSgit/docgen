# Marketing Information Architecture

## Overview

This document defines the information architecture, visual system, content model, and component inventory for the marketing layer over Document Playground. It serves as the implementation contract for tickets #198–#200.

## Public Routes

The marketing layer introduces a single public route structure:

- `/` — Marketing home page (new)
- `/playground` — Existing Document Playground application (moved from `/`)

The marketing home page serves as the primary entry point; visitors discover the product and access the playground through a clear CTA.

## Section Order and Purpose

The marketing home page presents content in this fixed order:

1. **Hero** — Establish product identity and primary value proposition
2. **Product Workflow** — Show the structured-writing → pagination → Google Docs export flow
3. **Feature Bento** — Highlight Core Editor Slice capabilities in a visual grid
4. **Proof** — Provide credibility through product qualities or user signals
5. **CTA** — Provide clear path into the playground
6. **Footer** — Minimal utility navigation and product context

## Content Vocabulary

All marketing copy must use the canonical product vocabulary from CONTEXT.md. Required terms:

- **Document Playground** (not "workspace," "editor platform," "collaboration tool")
- **Local Document** (not "cloud document," "saved file," "account document")
- **Google Export** (not "sync," "publish," "integration")
- **Core Editor Slice** — structured text, inline formatting, lists, alignment, manual page breaks, automatic pagination
- **Fixed Page Layout** — US Letter with one-inch margins
- **Single-user, local-first, one-document** scope

Prohibited claims:

- Collaboration, accounts, sync, or real-time editing
- Document management or file collections
- HTML conversion or import
- User-configurable page layouts or print settings
- Extended Editor features (tables, images, headers/footers, comments, mentions) unless explicitly supported

## Section Specifications

### Hero

**Purpose**: Establish product identity and communicate the primary value proposition in one glance.

**Content model**:

- Product name: "Document Playground"
- Tagline: Short phrase (6–10 words) emphasizing structured document editing and Google Docs export
- Supporting copy: 1–2 sentences expanding on the value proposition using canonical vocabulary
- Primary CTA: "Try the Playground" → `/playground`
- Optional secondary CTA: "View Documentation" → `/docs` (if documentation is public)
- Visual: Static or subtly animated representation of paginated document

**Component requirements**:

- Responsive layout: stacked on mobile, side-by-side on desktop (text left, visual right)
- Primary CTA: emerald-600 background, white text, hover state with emerald-700
- Secondary CTA (if present): transparent background, emerald-700 text, emerald-200 hover background
- Motion: Fade-in on page load (300ms ease-out), disabled with `prefers-reduced-motion`

### Product Workflow

**Purpose**: Visually demonstrate the three-step flow: structured writing → automatic pagination → Google Docs export.

**Content model**:

- Section heading: "How it works" or similar
- Three workflow cards, each with:
  - Icon or visual indicator
  - Step label (e.g., "1. Write structured content")
  - Brief description (2–3 sentences) using canonical vocabulary
- Visual representation of each step (illustration or product screenshot showing only supported features)

**Component requirements**:

- Three-column layout on desktop, stacked on mobile
- Each card: paper-white background, subtle border (stone-200), rounded corners (0.75rem)
- Hover state: lift effect (translateY(-4px), 200ms ease-out) and shadow enhancement, disabled with `prefers-reduced-motion`
- Motion: Staggered fade-in on scroll (100ms delay between cards, 300ms duration each), disabled with `prefers-reduced-motion`

### Feature Bento

**Purpose**: Highlight Core Editor Slice capabilities in a scannable visual grid.

**Content model**:

- Section heading: "Core capabilities" or similar
- 4–6 feature cards, each representing one Core Editor Slice capability:
  - Structured text and paragraphs
  - Inline formatting (bold, italic, underline)
  - Lists (bulleted and numbered)
  - Text alignment
  - Manual page breaks
  - Automatic pagination
- Each card: feature name, 1-sentence description, icon or micro-visual

**Component requirements**:

- Bento-style grid: asymmetric card sizes for visual interest, responsive reflow on mobile
- Cards: paper-white background, stone-200 border, 0.75rem corners
- Hover state: emerald-50 background tint (opacity 0.5), 200ms ease-out, disabled with `prefers-reduced-motion`
- Motion: Fade-in on scroll (single group animation, 400ms ease-out), disabled with `prefers-reduced-motion`

### Proof

**Purpose**: Provide credibility through product qualities or user signals without implying collaboration or multi-user scope.

**Content model** (choose one or combine):

- **Technical proof**: "Google Docs-compatible layout," "Deterministic export," "Browser-based persistence"
- **Status indicators**: "Single-user MVP," "Open-source," "No account required"
- **Usage proof** (if available and accurate): "X documents exported" or similar metric

**Component requirements**:

- Horizontal layout on desktop, stacked on mobile
- Text: stone-600 color, small font size (0.875rem)
- Optional separator: stone-300 vertical divider between proof points
- No motion

### CTA

**Purpose**: Provide a clear, focused path into the playground.

**Content model**:

- Heading: Action-oriented phrase (e.g., "Start exploring structured documents")
- Supporting copy: 1–2 sentences reinforcing single-user, local-first, no-account-required nature
- Primary CTA button: "Try the Playground" → `/playground`

**Component requirements**:

- Centered layout, max-width 600px
- Background: emerald-50 with 1.5rem padding, 1rem rounded corners
- Primary CTA: emerald-600 background, white text, emerald-700 hover, 0.5rem padding vertical, 1.5rem padding horizontal
- Motion: Scale on hover (1.02), 150ms ease-out, disabled with `prefers-reduced-motion`

### Footer

**Purpose**: Provide minimal utility navigation and reinforce product context.

**Content model**:

- Product name: "Document Playground"
- Brief product description: 1 sentence using canonical vocabulary
- Links:
  - Documentation (if public)
  - GitHub repository
  - License information
- Optional: Version number from VERSION file

**Component requirements**:

- Horizontal layout on desktop, stacked on mobile
- Background: stone-100
- Text: stone-600, small font (0.8125rem)
- Links: stone-700, underline on hover
- No motion

## Visual System

### Color Palette

Use a green Tailwind-style palette (emerald/green with soft sage states). Never use purple, violet, or indigo.

**Paper/Ink Foundation**:

- Background (body): `#fafaf9` (stone-50)
- Surface (cards): `#ffffff` (white)
- Primary text: `#1c1917` (stone-900)
- Secondary text: `#57534e` (stone-600)
- Tertiary text: `#78716c` (stone-500)

**Green Accent Palette**:

- Primary action: `#059669` (emerald-600)
- Primary action hover: `#047857` (emerald-700)
- Primary action light: `#10b981` (emerald-500)
- Accent background: `#d1fae5` (emerald-100)
- Accent background soft: `#ecfdf5` (emerald-50)
- Sage state (disabled/inactive): `#dcfce7` (green-100), `#bbf7d0` (green-200)

**Borders and Dividers**:

- Default border: `#e7e5e4` (stone-200)
- Subtle border: `#f5f5f4` (stone-100)
- Divider: `#d6d3d1` (stone-300)

### Typography

**Font Family**:

- Sans-serif: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

**Type Scale**:

- Hero heading: `clamp(2.25rem, 4vw, 3rem)` (36–48px), font-weight 700, line-height 1.1, letter-spacing -0.02em
- Section heading: `1.875rem` (30px), font-weight 600, line-height 1.2, letter-spacing -0.015em
- Card heading: `1.125rem` (18px), font-weight 600, line-height 1.4, letter-spacing -0.01em
- Body text: `1rem` (16px), font-weight 400, line-height 1.6, letter-spacing normal
- Small text: `0.875rem` (14px), font-weight 400, line-height 1.5, letter-spacing normal
- Button text: `1rem` (16px), font-weight 500, line-height 1, letter-spacing -0.01em

### Spacing

Use an 8px base unit. Common spacing values:

- `0.25rem` (4px) — tight inline spacing
- `0.5rem` (8px) — compact vertical rhythm
- `0.75rem` (12px) — card corner radius
- `1rem` (16px) — standard component padding
- `1.5rem` (24px) — comfortable section spacing
- `2rem` (32px) — section vertical margin
- `3rem` (48px) — major section divider
- `4rem` (64px) — hero section vertical padding

### Radii

- Small: `0.375rem` (6px) — buttons, inputs
- Medium: `0.75rem` (12px) — cards, containers
- Large: `1rem` (16px) — prominent surfaces

### Borders

- Default: `1px solid` with stone-200
- Hover: `1px solid` with emerald-300
- Focus ring: `2px solid` with emerald-500, offset `2px`

### Shadows

Use subtle shadows for depth; never heavy drop shadows.

- Card default: `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`
- Card hover: `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`
- Button hover: `0 2px 4px 0 rgb(0 0 0 / 0.08)`

### Motion

Subtle, purposeful animation with reduced-motion fallbacks for all interactive elements.

**Timing Functions**:

- `ease-out` — default for most transitions
- `ease-in-out` — smooth bidirectional motion (e.g., modals)

**Durations**:

- Instant: `100ms` — micro-interactions (button press feedback)
- Quick: `150ms` — hover state changes
- Standard: `200ms` — default transition
- Comfortable: `300ms` — fade-ins, page load animations
- Deliberate: `400ms` — group animations, multi-step transitions

**Reduced-Motion Behavior**:

All animations and transitions must respect `prefers-reduced-motion: reduce`. When reduced motion is requested:

- Disable translateY, scale, and transform-based motion
- Preserve opacity transitions (fade-in/out) but reduce duration to 100ms
- Remove staggered animations; show all elements immediately
- Keep color and background transitions

**Animation Inventory**:

- **Fade-in**: `opacity 0 → 1`, 300ms ease-out, disabled with `prefers-reduced-motion`
- **Lift (hover)**: `translateY(0) → translateY(-4px)`, 200ms ease-out, disabled with `prefers-reduced-motion`
- **Scale (hover)**: `scale(1) → scale(1.02)`, 150ms ease-out, disabled with `prefers-reduced-motion`
- **Staggered fade-in**: Sequential fade-in with 100ms delay between items, disabled with `prefers-reduced-motion`
- **Color transition**: `background-color`, `border-color`, `color` changes, 150ms ease-out, always enabled

## Component Inventory

### Reusable Primitives

These marketing-specific components will be created:

1. **MarketingButton**
   - Variants: primary (emerald), secondary (outline), ghost (text-only)
   - States: default, hover, active, disabled
   - Props: `variant`, `href`, `onClick`, `children`, `aria-label`

2. **MarketingCard**
   - Visual: paper-white background, stone-200 border, 0.75rem corners
   - Hover state: optional lift effect
   - Props: `children`, `hoverable`, `className`

3. **MarketingSection**
   - Layout container with consistent vertical spacing
   - Props: `children`, `heading`, `background` (stone-50 or white), `id`

4. **WorkflowCard**
   - Specialized card for Product Workflow section
   - Props: `stepNumber`, `label`, `description`, `icon`, `visual`

5. **FeatureCard**
   - Specialized card for Feature Bento section
   - Props: `name`, `description`, `icon`, `size` (for bento grid positioning)

6. **MarketingLayout**
   - Root layout wrapper with header and footer
   - Props: `children`

### Reusable from Existing Playground

None of the existing playground UI components should be reused in marketing. The playground remains a separate, intact application behind the `/playground` route.

## Boundaries

### Marketing ↔ Playground Boundary

**Clear separation**:

- Marketing routes (`/`) render marketing layout and components
- Playground route (`/playground`) renders existing App.tsx and playground components
- No shared state between marketing and playground
- Marketing links to `/playground` via standard anchor tags; playground is a full page transition

**Routing implementation**:

- Add a lightweight routing solution (e.g., basic path-based rendering in main.tsx)
- Marketing and playground are separate component trees
- No shared context providers between marketing and playground

**File organization**:

```
apps/web/src/
├── main.tsx                    # Root with route switching
├── App.tsx                     # Existing playground (unchanged)
├── styles.css                  # Existing playground styles (unchanged)
├── marketing/
│   ├── MarketingPage.tsx       # Marketing home page
│   ├── MarketingLayout.tsx     # Layout wrapper
│   ├── sections/
│   │   ├── Hero.tsx
│   │   ├── ProductWorkflow.tsx
│   │   ├── FeatureBento.tsx
│   │   ├── Proof.tsx
│   │   ├── CTA.tsx
│   │   └── Footer.tsx
│   ├── components/
│   │   ├── MarketingButton.tsx
│   │   ├── MarketingCard.tsx
│   │   ├── MarketingSection.tsx
│   │   ├── WorkflowCard.tsx
│   │   └── FeatureCard.tsx
│   └── marketing.css           # Marketing-specific styles
├── export.ts                   # Existing (unchanged)
└── page-content.ts             # Existing (unchanged)
```

### Product Claims Boundary

Marketing copy must not imply:

- Collaboration, real-time editing, or multi-user capabilities
- Account creation, user authentication, or cloud storage
- Sync, publish, or bidirectional Google Docs integration
- Document management, file collections, or project organization
- HTML import/export or content conversion beyond native Google Docs export
- Extended Editor features (tables, images in MVP, complex formatting) unless explicitly supported in Core Editor Slice
- User-configurable page layouts, custom margins, or print settings

Marketing copy may claim:

- Single-user, local-first document editing
- Structured text with inline formatting (bold, italic, underline)
- Lists (bulleted and numbered)
- Text alignment (left, center, right, justify)
- Manual page breaks and automatic pagination
- Fixed US Letter page layout with one-inch margins
- One-way Google Docs export creating new documents
- Browser-based persistence (no account required)
- Google Docs-compatible layout and deterministic export

### Visual Asset Boundary

Product screenshots and illustrations must show only supported Core Editor Slice features. Prohibited visuals:

- Multiple users or collaboration indicators
- Account UI, login screens, or user profiles
- Document lists, file managers, or project dashboards
- Tables, complex images, headers/footers (unless in Extended Editor scope)
- Import functionality or bidirectional sync indicators
- Custom page layouts or print preview modes

## Responsive Behavior

### Breakpoints

Use container-query-friendly breakpoints:

- Mobile: `< 640px` (stacked layouts, full-width components)
- Tablet: `640px – 1024px` (transitional layouts, 2-column grids)
- Desktop: `≥ 1024px` (side-by-side layouts, 3-column grids, spacious margins)

### Responsive Patterns

1. **Hero**:
   - Mobile: stacked (visual on top, text below)
   - Desktop: side-by-side (text left, visual right, 50/50 split)

2. **Product Workflow**:
   - Mobile: stacked cards, full width
   - Tablet: 2-column grid (3rd card spans full width)
   - Desktop: 3-column grid

3. **Feature Bento**:
   - Mobile: stacked cards, uniform size
   - Tablet: 2-column grid with some cards spanning 2 columns
   - Desktop: bento grid (3 columns with asymmetric card sizes)

4. **Proof, CTA, Footer**:
   - Mobile: stacked
   - Desktop: horizontal layout with appropriate spacing

### Responsive Typography

- Hero heading: `clamp(2.25rem, 4vw, 3rem)` — fluid scaling between 36px and 48px
- Section heading: fixed at `1.875rem` on all breakpoints
- Body text: fixed at `1rem` on all breakpoints
- Reduce letter-spacing on mobile for improved readability

### Responsive Spacing

- Reduce section vertical padding on mobile: 2rem instead of 4rem for hero
- Reduce horizontal page margins on mobile: 1rem instead of 2rem
- Maintain comfortable tap target sizes (min 44px height for buttons)

## Accessibility

### Semantic HTML

- Use `<main>`, `<section>`, `<header>`, `<footer>` for structural markup
- Use `<h1>` for hero heading, `<h2>` for section headings, `<h3>` for card headings
- Use `<nav>` for footer navigation
- Use `<article>` for workflow and feature cards where semantically appropriate

### ARIA

- `aria-label` for sections where heading is visual-only
- `aria-current="page"` for active navigation links (if navigation is added)
- Ensure all interactive elements have accessible names

### Focus Management

- Visible focus indicators (2px emerald-500 ring, 2px offset)
- Logical tab order following visual hierarchy
- Skip-to-content link for keyboard users (if navigation is added)

### Color Contrast

All text must meet WCAG AA standards:

- Primary text (stone-900) on white: 16.10:1 (AAA)
- Secondary text (stone-600) on white: 8.59:1 (AAA)
- Primary button text (white) on emerald-600: 4.54:1 (AA)
- Link text (emerald-700) on white: 6.35:1 (AA)

## Implementation Notes

### Technology Constraints

- Use existing stack: React, TypeScript, Vite, Bun
- No additional framework dependencies (no React Router, no UI libraries)
- Inline CSS Modules or extend existing styles.css for marketing styles
- Use CSS custom properties for theme tokens
- Implement routing with basic conditional rendering in main.tsx

### Performance Requirements

- Marketing page should load and render in under 2 seconds on 3G connection
- All images optimized (WebP format, appropriate dimensions)
- No layout shift (reserve space for images with explicit width/height)
- Lazy-load non-critical sections (below-the-fold content)

### Testing Requirements

- Visual regression tests for each marketing section (Playwright)
- Accessibility tests for color contrast, focus management, semantic HTML
- Responsive behavior tests at mobile, tablet, and desktop breakpoints
- Reduced-motion tests to verify animations are disabled appropriately
- Verify `/` and `/playground` routes load correctly and independently

## Follow-up Tickets

This IA document supports the following implementation tickets:

- **#198**: Add marketing shell, navigation, hero, and product-preview entry point
- **#199**: Add workflow/features/proof sections using deterministic product visuals
- **#200**: Add conversion/footer, responsive behavior, accessibility, and performance verification

Each ticket should reference this document as the source of truth for design decisions and implementation details.
