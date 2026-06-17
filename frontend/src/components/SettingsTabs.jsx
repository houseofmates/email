export function SettingsTabs({ activeTab, onTabChange }) {
  const tabs = ['general', 'accounts', 'security'];
  return <div className="flex border-b border-pkm-500">
    {tabs.map(t => (
      <button key={t} onClick={() => onTabChange(t)}
        className={`p-4 lowercase text-sm transition ${activeTab === t ? 'text-gold border-b-2 border-gold font-bold' : 'text-text-info'}`}>
        {t}
      </button>
    ))}
  </div>;
}
