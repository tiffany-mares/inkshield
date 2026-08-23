"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

/**
 * Full-image lightbox for gallery/profile cards, which crop to a square with
 * object-cover. Controlled: open whenever `src` is set. Esc and overlay-click
 * close come from Radix.
 *
 * Deliberately no animate-in/animate-out classes: tw-animate-css's enter/exit
 * keyframes are not emitted under this project's `source(none)` Tailwind
 * setup, so an exit animation never fires animationend and Radix keeps the
 * closed dialog (and its click-blocking overlay) mounted forever.
 */
export function ImageLightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  return (
    <DialogPrimitive.Root open={src !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] focus:outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Expanded image</DialogPrimitive.Title>
          {src !== null && (
            <img
              src={src}
              alt="Expanded view"
              className="max-w-[92vw] max-h-[90vh] object-contain border border-border bg-ink"
            />
          )}
          <DialogPrimitive.Close className="absolute -top-3 -right-3 px-2 py-1 font-mono text-lg leading-none border border-border bg-background text-muted-foreground hover:border-magenta hover:text-magenta transition-colors cursor-pointer">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
