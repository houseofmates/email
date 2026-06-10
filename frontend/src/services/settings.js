// app settings store — localStorage backed, no external deps.
//
// a tiny external store wired into react via useSyncExternalStore so any
// component (settings panel, layout theme, default-view router) sees the same
// values and re-renders on change. holds only ui preferences — never
// credentials. credentials live in the vault session / app auth header.

import { useSyncExternalStore } from "react"

const KEY = "app_settings"

export const DEFAULTS = {
  theme: "system",        // "system" | "dark" | "light"
  dateFormat: "iso",      // "iso" | "us" | "eu"
  timeFormat: "24h",      // "24h" | "12h"
  defaultView: "inbox",   // landing page after login
  sidebarCollapsed: false,
  notifyMail: true,
  notifyCalendar: true,
  notifySecurity: true,
  undoSendSeconds: 5,     // 0 disables the undo-send window
  signature: "",          // appended to new compositions
  telemetry: false,       // opt-in only; nothing is collected unless true
  debug: false,           // mirror api request/response to the console
  endpointOverride: "",   // optional reverse-proxy base path
}

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

let state = read()
const listeners = new Set()

function emit() {
  for (const l of listeners) l()
}

export function getSettings() {
  return state
}

export function setSetting(key, value) {
  state = { ...state, [key]: value }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage full / blocked */ }
  emit()
}

export function replaceSettings(next) {
  state = { ...DEFAULTS, ...next }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
  emit()
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// react hook — returns [settings, update]
export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSettings, getSettings)
  return [settings, setSetting]
}
