import { useCallback, useRef, useState } from "react"

// undo/redo history for a single editable value (textarea/input).
//
// set() updates the present immediately; a snapshot of the *pre-edit* value is
// pushed to the undo stack at the start of each editing burst (coalesced within
// `debounce` ms) so undo reverts a burst of typing rather than one keystroke.
// pass debounce: 0 to snapshot every change (used in tests).
export function useHistory(initial, { debounce = 500 } = {}) {
  const [hist, setHist] = useState({ past: [], present: initial, future: [] })
  const lastPush = useRef(0)

  const set = useCallback((next) => {
    setHist((h) => {
      const resolved = typeof next === "function" ? next(h.present) : next
      if (resolved === h.present) return h
      const t = Date.now()
      const startBurst = debounce === 0 || t - lastPush.current >= debounce
      lastPush.current = t
      return startBurst
        ? { past: [...h.past, h.present], present: resolved, future: [] }
        : { ...h, present: resolved }
    })
  }, [debounce])

  const undo = useCallback(() => {
    lastPush.current = 0 // next edit starts a fresh burst
    setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h))
  }, [])

  const redo = useCallback(() => {
    lastPush.current = 0
    setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h))
  }, [])

  // replace the value without recording history (e.g. external reset)
  const reset = useCallback((v) => { lastPush.current = 0; setHist({ past: [], present: v, future: [] }) }, [])

  // keydown handler for editor fields: cmd/ctrl+z undo, +shift (or ctrl+y) redo
  const onKeyDown = useCallback((e) => {
    const mod = e.metaKey || e.ctrlKey
    if (!mod) return
    const k = (e.key || "").toLowerCase()
    if (k === "z" && !e.shiftKey) { e.preventDefault(); undo() }
    else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo() }
  }, [undo, redo])

  return { value: hist.present, set, undo, redo, reset, onKeyDown, canUndo: hist.past.length > 0, canRedo: hist.future.length > 0 }
}
