export default function StatusTabs({
  activeTab,
  setActiveTab,
  orders,
  tabsConfig,
}) {
  return (
    <div className="tabs-container">
      {tabsConfig.map((tab) => {
        const count =
          tab.id === 'All'
            ? orders?.length || 0
            : (orders || []).filter((o) => o.status === tab.id).length;

        return (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}

            <span className="tab-count">
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}