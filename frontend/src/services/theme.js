// theme application — maps the stored theme preference onto a data-theme
// attribute on <html>. dark is canonical (matches the default css tokens);
// light overrides the same --color-* variables (see index.css). "system"
// follows the os via prefers-color-scheme.

import { getSettings } from "./settings"

export function resolveTheme(theme) {
  if (theme === "light" || theme === "dark") return theme
  // system
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
  }
  return "dark"
}

export function applyTheme(theme = getSettings().theme) {
  if (typeof document === "undefined") return
  document.documentElement.dataset.theme = resolveTheme(theme)
}

// apply immediately at import time so there's no flash before react mounts
applyTheme()
