import { useEffect } from 'react';
export function Shortcuts({ onShortcut }) {
  useEffect(() => {
    const h = (e) => { if (e.key === '?') onShortcut('show-help'); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onShortcut]);
  return null;
}
export function ShortcutsHelp({ onClose }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4">
    <div className="bg-pkm-800 p-6 rounded-xl border border-pkm-500">
      <h2 className="text-gold lowercase mb-4 font-bold">keyboard shortcuts</h2>
      <div className="text-sm text-text-info lowercase mb-6">? - show this help</div>
      <button onClick={onClose} className="w-full bg-gold p-2 rounded text-pkm-900 font-bold">close</button>
    </div>
  </div>;
}
