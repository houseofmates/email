import { useEffect } from 'react';
export function Shortcuts({ onShortcut }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case 'j': onShortcut('navigate-down'); break;
        case 'k': onShortcut('navigate-up'); break;
        case 'c': onShortcut('compose'); break;
        case '#': onShortcut('delete'); break;
        case 'u': onShortcut('refresh'); break;
        case '?': onShortcut('show-help'); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onShortcut]);
  return null;
}
export function ShortcutsHelp({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4">
      <div className="w-full max-w-md rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in">
        <h2 className="mb-4 text-base text-gold lowercase tracking-wide">keyboard shortcuts</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm lowercase">
          <div className="flex justify-between"><span>navigate down</span><kbd className="text-sky">j</kbd></div>
          <div className="flex justify-between"><span>navigate up</span><kbd className="text-sky">k</kbd></div>
          <div className="flex justify-between"><span>compose</span><kbd className="text-sky">c</kbd></div>
          <div className="flex justify-between"><span>delete</span><kbd className="text-sky">#</kbd></div>
          <div className="flex justify-between"><span>refresh</span><kbd className="text-sky">u</kbd></div>
          <div className="flex justify-between"><span>this help</span><kbd className="text-sky">?</kbd></div>
        </div>
        <button onClick={onClose} className="mt-6 w-full rounded-lg bg-pkm-700 py-2 text-sm lowercase">close</button>
      </div>
    </div>
  );
}
