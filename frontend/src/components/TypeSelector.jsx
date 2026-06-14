export function TypeSelector({ types, activeType, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto p-4 scrollbar-hide">
      {types.map(t => (
        <button key={t.key} onClick={() => onSelect(t.key)}
          className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs transition ${
            activeType === t.key ? 'bg-gold text-pkm-900' : 'bg-pkm-700 text-text-info hover:bg-pkm-600'
          }`}>
          <span>{t.icon}</span>
          <span className="lowercase">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
