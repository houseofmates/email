import { createContext, useCallback, useContext, useRef, useState } from "react"

// lightweight toast system. supports plain messages and an action (used for the
// undo flows after delete / send). styling reuses the modal card classes.

const ToastContext = createContext(null)

/** useToast() -> { show({ message, kind, actionLabel, onAction, duration }) } */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>")
  return ctx
}

let _seq = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  const show = useCallback(
    ({ message, kind = "info", actionLabel, onAction, duration = 5000 }) => {
      const id = ++_seq
      setToasts((list) => [...list, { id, message, kind, actionLabel, onAction }])
      timers.current[id] = setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-[420px] items-center justify-between gap-3 rounded-lg border border-pkm-500 bg-pkm-800 px-4 py-3 text-sm text-text-primary shadow-xl animate-slide-up lowercase"
          >
            <span className={t.kind === "err" ? "text-danger" : t.kind === "ok" ? "text-gold" : "text-text-primary"}>
              {t.message}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              {t.actionLabel && (
                <button
                  onClick={() => {
                    t.onAction?.()
                    dismiss(t.id)
                  }}
                  className="rounded-md bg-gold px-2 py-1 text-xs font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase"
                >
                  {t.actionLabel}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                className="text-xs text-text-info transition hover:text-sky lowercase"
              >
                close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
