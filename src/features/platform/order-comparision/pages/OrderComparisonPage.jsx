import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import '../../../../styles/orderComparison.css';

import { mockMainTable } from '../mockMainTable';

import StatusTabs from '../components/StatusTabs';
import SearchBar from '../components/SearchBar';
import MainTable from '../components/MainTable';
import UploadVendorModal from '../components/UploadVendorModal';

export default function OrderComparisonPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [orders, setOrders] = useState(mockMainTable);

  const translatedTabs = useMemo(() => [
    { id: 'All', label: t('orderComparison.tabs.all') },
    { id: 'Draft', label: t('orderComparison.tabs.draft') },
    { id: 'Pending Approval', label: t('orderComparison.tabs.pending') },
    { id: 'Approved', label: t('orderComparison.tabs.approved') },
    { id: 'PO Created', label: t('orderComparison.tabs.poCreated') },
    { id: 'Awaiting Confirmation', label: t('orderComparison.tabs.awaiting') },
    { id: 'Needs Review', label: t('orderComparison.tabs.needs') },
    { id: 'Issues', label: t('orderComparison.tabs.issues') },
    { id: 'Backordered', label: t('orderComparison.tabs.backordered') },
    { id: 'Closed', label: t('orderComparison.tabs.closed') },
  ], [t]);

  // // Const ejemplo para mostrar tabla con datos ejemplo en mockMainTable
  // const filteredOrders = useMemo(() => {
  //   return mockMainTable.filter((order) => {
  //     const matchesTab =
  //       activeTab === 'All'
  //         ? true
  //         : order.status === activeTab;

  //     const matchesSearch =
  //       (order.job?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
  //       (order.poNumber ?? "").includes(search);

  //     return matchesTab && matchesSearch;
  //   });
  // }, [activeTab, search]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesTab =
        activeTab === 'All'
          ? true
          : order.status === activeTab;

      const matchesSearch =
        (order.job?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
        (order.poNumber ?? "").includes(search);

      return matchesTab && matchesSearch;
    });
  }, [activeTab, search, orders]); // <-- Añadido "orders" a las dependencias

  // 3. Función encargada de insertar la nueva orden de n8n al principio de la lista
  const handleUploadSuccess = (newOrder) => {
    setOrders((prevOrders) => [newOrder, ...prevOrders]);
    setIsUploadModalOpen(false);
  };



  return (
    <div className="order-page">

      <div className="order-header">
        <div>
          <h1>{t('orderComparison.title')}</h1>
          <p>{t('orderComparison.subtitle')}</p>
        </div>
      </div>

      <div className="section-header-actions">

        <button 
          className="btn-primary"
          onClick={() => setIsUploadModalOpen(true)}
        >
          <span className="btn-icon">+</span> {t('orderComparison.pdfButton')}
        </button>
      </div>

      <StatusTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        orders={orders}
        tabsConfig={translatedTabs}
      />

      <SearchBar
        search={search}
        setSearch={setSearch}
      />

      <MainTable data={filteredOrders} />

      {isUploadModalOpen && (
        <UploadVendorModal 
          onClose={() => setIsUploadModalOpen(false)} 
          onUploadSuccess={handleUploadSuccess}
        />
      )}

    </div>
  );
}