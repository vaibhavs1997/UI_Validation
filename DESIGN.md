# VisionQA design language

## Current direction

The dominant UI direction is a purple liquid/glass workspace: pale lavender-white surfaces, translucent cards, rounded controls, soft gradients, and a deep purple navigation rail. Auth and dashboard styling are implemented primarily in `apps/web/src/app/globals.css` with utility classes in page components.

## Tokens and typography

There is no centralized token file or Tailwind theme configuration. The recurring values in the current CSS are:

- Primary accent: `#ad08d1`; darker accent: `#9200b7`; highlight: `#d044e9`.
- Main text: `#32133f` / `#542064`.
- Supporting text: `#76527f` / `#9b72a5`.
- Background: `#fffaff`, with lavender gradients and translucent white layers.
- Error text/surface: approximately `#a72f3d` on `#fff5f6`.
- Body typography is Arial; headings use heavy weight and tight letter spacing.

Because values are currently repeated rather than tokenized, reuse the dominant values above and avoid introducing a second accent palette without an explicit design decision.

## Components and patterns

- Auth surfaces use frosted panels, `liquid-control` inputs, `liquid-primary` buttons, rounded corners, purple labels, and inline validation/error messages.
- Dashboard surfaces use a dark purple sidebar, active navigation highlight, translucent header, rounded project/environment selectors, account popover, cards, and primary gradient CTAs.
- Cards generally use 14–18px radii, a thin translucent purple border, a soft purple shadow, and optional `backdrop-filter: blur(...)`.
- Buttons use a visible gradient or translucent outlined treatment, bold text, hover feedback, and `cursor: pointer`; disabled controls reduce opacity and use `not-allowed`.
- Empty, loading, and error states are explicit. Do not replace them with blank space or generic browser errors.
- Navigation uses grouped sections, active-route styling, responsive drawer behavior, and text glyph icons. Existing `packages/ui` exports names but does not yet provide a full component implementation.

## Responsive and accessibility conventions

- Dashboard layout collapses to a mobile drawer at approximately 720px and reduces grid columns at approximately 900px.
- Controls use labels, `aria-label`, `aria-expanded`, `aria-selected`, `role="alert"`, and `aria-busy` where applicable.
- Preserve visible focus behavior and keyboard dismissal for custom menus.
- Use real buttons for actions and links for navigation. Keep disabled states semantically disabled.

## Inconsistencies

- The codebase mixes Tailwind utility classes with a large global CSS sheet.
- Some older placeholder pages still use simpler utility-only styling while the dashboard/auth surfaces use the liquid-glass treatment.
- The current icon system uses text glyphs rather than a dedicated icon library.
- Colors are repeated as literals; there is not yet a formal design-token layer.

## Avoid

- Browser-default blue dropdown menus where a custom themed control is required.
- Flat black/white dashboard surfaces that remove the established purple glass hierarchy.
- Sharp, square controls or unrounded cards that conflict with the current rounded language.
- Generic error text when a safe, actionable message can be shown.
- Introducing new fonts, icon packages, or a parallel theme system without checking the existing CSS and shared package boundaries.
