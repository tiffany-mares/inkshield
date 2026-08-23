# Image Lightbox (click-to-expand) — Design

**Date:** 2026-08-23
**Status:** Approved scope = minimal ("just the image"); chosen as default while user was away — extend later if wanted.

## Problem

Gallery and profile cards render images as `aspect-square` + `object-cover`,
so non-square images are cropped. Users want to click an image to see the
full, uncropped version.

## Design

One new component, two call sites.

### `src/components/ui/image-lightbox.tsx`

Controlled Radix Dialog (dependency already present; mirrors `ui/dialog.tsx`
conventions):

```tsx
<ImageLightbox src={expandedSrc} onClose={() => setExpandedSrc(null)} />
```

- Open when `src` is non-null.
- Full image centered on the standard `bg-black/80` overlay, `object-contain`,
  capped at ~92vw / 90vh, `border border-border` to match the brutalist style.
- ✕ close button (top-right), Esc and overlay-click close via Radix.
- `sr-only` DialogTitle for screen readers.

### Call sites

- **`routes/gallery.tsx`** — page-level `useState<string | null>` for the
  expanded src; the card image (inside `AnimatedGalleryImage`) becomes a
  `cursor-zoom-in` button that sets it. One lightbox instance per page.
- **`routes/profile.tsx`** — same pattern on the card image. The existing
  absolute-positioned favorite/unlike buttons remain siblings of the new
  image button, so they keep working without opening the lightbox.

Images with an empty `url` (noop presigner) render the plain placeholder and
are not clickable.

## Out of scope (deliberately)

Prev/next navigation, in-lightbox actions (like/favorite/publish), zoom/pan,
download. Add later if asked.

## Error handling

None beyond the existing pages' — the lightbox shows the same already-loaded
presigned URL the card shows; if it fails, the browser's broken-image state
appears and closing still works.

## Testing

Project has no DOM/component test infra (vitest node tests for `lib/` only) —
adding jsdom/testing-library for this feature would be scope creep. Verify
with `npm run lint`, `npm run test`, `npm run build`, plus a manual runtime
check of both pages.
