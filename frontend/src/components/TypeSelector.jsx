export function TypeSelector({ types, activeType, onSelect }) {
  return <div className="flex gap-2 p-4 overflow-x-auto scrollbar-hide">
    {types.map(t => (
      <button key={t.key} onClick={() => onSelect(t.key)}
        className={`px-4 py-1.5 rounded-full text-xs transition ${activeType === t.key ? 'bg-gold text-pkm-900 font-bold' : 'bg-pkm-700 text-text-info'}`}>
        {t.icon} {t.label}
      </button>
    ))}
  </div>;
}
