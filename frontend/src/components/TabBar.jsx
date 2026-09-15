import { useEffect, useRef, useState } from 'react';

// Renders the usual pill-row tab bar on wider screens. Below the mobile
// breakpoint that row overflows once there are more than ~3 tabs (each pill
// is fixed-width and the row doesn't wrap), so on mobile this instead shows
// a single dropdown trigger — same interaction pattern as UserMenu.
export default function TabBar({ tabs, activeTab, onChange }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const current = tabs.find((t) => t.key === activeTab) || tabs[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="tab-bar">
      <div className="tabs tabs-desktop">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.icon} {tab.label} {tab.count != null && <span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="tabs-mobile-select" ref={menuRef}>
        <button className="tabs-mobile-trigger" onClick={() => setOpen((o) => !o)}>
          <span>
            {current.icon} {current.label} {current.count != null && <span className="tab-count">{current.count}</span>}
          </span>
          <span className="tabs-mobile-chevron">{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div className="tabs-mobile-dropdown">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`tabs-mobile-item ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => {
                  onChange(tab.key);
                  setOpen(false);
                }}
              >
                {tab.icon} {tab.label} {tab.count != null && <span className="tab-count">{tab.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
