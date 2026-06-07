// shared style helpers for the mail ui, matching the vault/inbox classes.

/** text input styling (same as the vault inputClass). */
export function inputClass(err) {
  return `w-full rounded-lg border bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:ring-1 lowercase ${
    err
      ? "border-danger focus:border-danger focus:ring-danger"
      : "border-pkm-500 focus:border-gold focus:ring-gold"
  }`
}

// primary (gold) action button — matches the compose/send buttons elsewhere
export const goldBtn =
  "rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 lowercase"

// secondary outline button
export const ghostBtn =
  "rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase"

// danger outline button
export const dangerBtn =
  "rounded-md border border-danger-border px-2 py-1 text-xs text-danger transition hover:bg-danger-dim active:scale-[0.98] lowercase"

// modal backdrop (compose) — matches the requested backdrop style
export const modalBackdrop =
  "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-pkm-900/80 p-4 pt-12"
