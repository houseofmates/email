export function SettingsTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'general', label: 'general' },
    { id: 'accounts', label: 'accounts' },
    { id: 'email', label: 'email' },
    { id: 'security', label: 'security' },
    { id: 'notifications', label: 'notifications' },
    { id: 'advanced', label: 'advanced' },
  ];
  return (
    <div className="flex border-b border-pkm-500 overflow-x-auto scrollbar-hide">
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onTabChange(tab.id)}
          className={`px-4 py-3 text-sm lowercase transition-colors whitespace-nowrap ${
            activeTab === tab.id ? 'text-gold border-b-2 border-gold' : 'text-text-info hover:text-text-primary'
          }`}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
