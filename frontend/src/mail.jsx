import { useCallback, useEffect, useState } from "react"
import Layout from "./layout"
import MailSidebar from "./components/MailSidebar"
import MailList from "./components/MailList"
import MailDetail from "./components/MailDetail"
import ComposeModal from "./components/ComposeModal"
import { ToastProvider } from "./components/Toast"
import { getEmail, emailText, setAuthHeader } from "./services/mail"
import { quoteAsMarkdown } from "./services/markdown"
import { goldBtn, ghostBtn } from "./components/ui"

const TITLES = {
  inbox: "inbox",
  sent: "sent",
  drafts: "drafts",
  spam: "spam",
  trash: "trash",
  favorites: "favorites",
}

function MailInner({ authHeader, onNavigate, onLogout, userEmail }) {
  const [folderKey, setFolderKey] = useState("inbox")
  const [folderId, setFolderId] = useState(null)
  const [folderMap, setFolderMap] = useState({})
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(null) // open email (list item shape)
  const [compose, setCompose] = useState(null) // { initial } or null
  const [refresh, setRefresh] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // feed the auth header into the service layer
  useEffect(() => {
    setAuthHeader(authHeader)
  }, [authHeader])

  const onFolders = useCallback(
    (map) => {
      setFolderMap(map)
      // resolve the initial inbox id once folders load
      if (!folderId && map.inbox) setFolderId(map.inbox)
    },
    [folderId]
  )

  function selectFolder(key, id) {
    setFolderKey(key)
    setFolderId(id)
    setSelected(null)
    setSidebarOpen(false)
  }

  function bump() {
    setRefresh((n) => n + 1)
  }

  // build reply / forward initial values, fetching the full body to quote
  async function openReply(email, forward = false) {
    let full = email
    try {
      full = (await getEmail(email.id)) || email
    } catch { /* fall back to list data */ }
    const sender = full.from?.[0]?.email || ""
    const subj = full.subject || ""
    const quoted = quoteAsMarkdown(emailText(full) || full.preview || "")
    if (forward) {
      setCompose({
        initial: {
          to: "",
          subject: subj.toLowerCase().startsWith("fwd:") ? subj : `fwd: ${subj}`,
          body: `\n\n---\n${quoted}`,
        },
      })
    } else {
      setCompose({
        initial: {
          to: sender,
          subject: subj.toLowerCase().startsWith("re:") ? subj : `re: ${subj}`,
          body: `\n\n${quoted}`,
        },
      })
    }
  }

  return (
    <Layout currentPage="mail" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      {/* toolbar */}
      <div className="flex items-center gap-2 border-b border-pkm-500 px-4 py-3">
        <button onClick={() => setSidebarOpen((v) => !v)} className={`${ghostBtn} md:hidden`} aria-label="folders">
          ☰
        </button>
        <h1 className="text-lg text-gold lowercase tracking-wide">{TITLES[folderKey] || "mail"}</h1>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="search"
            placeholder="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="hidden w-48 rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-1.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-gold lowercase sm:block"
          />
          <button onClick={() => setCompose({ initial: {} })} className={goldBtn}>
            compose
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* sidebar — collapsible on narrow screens */}
        <div className={`w-56 shrink-0 overflow-y-auto border-r border-pkm-500 md:block ${sidebarOpen ? "block" : "hidden"}`}>
          <MailSidebar active={folderKey} onSelect={selectFolder} onFolders={onFolders} />
        </div>

        {/* list */}
        <div className={`min-w-0 flex-1 overflow-y-auto ${selected ? "hidden lg:block" : "block"}`}>
          {/* mobile search */}
          <div className="border-b border-pkm-500 p-3 sm:hidden">
            <input
              type="search"
              placeholder="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-1.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-gold lowercase"
            />
          </div>
          {folderId ? (
            <MailList
              folderKey={folderKey}
              folderId={folderId}
              folderMap={folderMap}
              query={query}
              selectedId={selected?.id}
              onOpen={setSelected}
              onReply={(m) => openReply(m, false)}
              refreshSignal={refresh}
            />
          ) : (
            <div className="flex items-center justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-pkm-500 border-t-gold" />
            </div>
          )}
        </div>

        {/* detail pane */}
        {selected && (
          <div className="w-full overflow-y-auto border-l border-pkm-500 lg:w-[480px] lg:shrink-0">
            <MailDetail
              emailId={selected.id}
              folderKey={folderKey}
              folderMap={folderMap}
              onReply={(m) => openReply(m, false)}
              onForward={(m) => openReply(m, true)}
              onChange={bump}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </div>

      {compose && (
        <ComposeModal
          initial={compose.initial}
          onClose={() => setCompose(null)}
          onSent={bump}
        />
      )}
    </Layout>
  )
}

export default function Mail(props) {
  return (
    <ToastProvider>
      <MailInner {...props} />
    </ToastProvider>
  )
}
