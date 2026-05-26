# Frontend Styling

## Tailwind CSS v4

- Use `@tailwindcss/vite`. No `tailwind.config.js` is required.
- Dark mode uses `@custom-variant dark (&:where(.dark, .dark *))`.
- Leaflet DivIcon styles live in `src/index.css` under `@layer components` because they are injected as HTML strings.

## Prettier

- `prettier-plugin-tailwindcss` sorts Tailwind classes.
- `eslint-config-prettier` avoids ESLint / Prettier conflicts.
- Configuration lives in `prettier.config.mjs`.

## ESLint

- Uses `typescript-eslint` `recommendedTypeChecked` rules.
- `projectService` reads both `tsconfig.app.json` and `tsconfig.node.json`.

## shadcn/ui

- shadcn/ui is the base component library.
- Components live in `src/components/ui/` and are managed by the shadcn CLI.
- `cn()` lives in `src/lib/utils.ts`.
- Use the `@/` path alias as expected by shadcn conventions.
- Map overlay buttons such as `MapOverlayButton` and `MapToggleButton` do not use shadcn Button because their positioning and styling are special.
- shadcn Dialog default z-index has been changed from `z-50` to `z-2000`; see [map-architecture.md](./map-architecture.md#z-index-hierarchy).

## Dialog / ScrollFadeEdge notes

- `ScrollFadeEdge` is an overlay, not scroll content. Changing content `pt` / `mt` does not move the fade itself.
- Override fade density from the caller via `className` such as `via-background/*`.
- Change position / overlap in `ScrollFadeEdge` itself (`top-0`, `h-*`, `-mb-*`) when needed.
- Children with the same or higher local z-index can appear above the fade. Avoid decorative z-index on child components.
- Safari can show about 1px translucent bleed at `DialogHeader` / scroll container sibling boundaries.
- Current `TripInspectionDialog` workaround uses `DialogHeader` with `border-border z-10 -mb-px shrink-0 border-b-2` and keeps the scroll container as `relative min-h-0 flex-1 overflow-y-auto`.
- `border-b` was not stable for this Safari workaround; `border-b-2` remains visible after the 1px overlap.
