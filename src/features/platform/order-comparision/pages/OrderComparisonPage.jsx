import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import '../../../../styles/orderComparison.css';
import { deletePurchaseOrder, fetchPurchaseOrders } from '../../../../services/purchaseOrdersApi';

import StatusTabs from '../components/StatusTabs';
import SearchBar from '../components/SearchBar';
import MainTable from '../components/MainTable';
import UploadVendorModal from '../components/UploadVendorModal';

const dateSortKeys = ['requiredDate', 'vendorShipDate', 'vendorOrderDate'];

const parseDateValue = (value) => {
  if (!value) return 0;

  const [month, day, year] = String(value).split('-').map(Number);

  if (!month || !day || !year) return 0;

  return new Date(year, month - 1, day).getTime();
};

const parseMoneyValue = (value) => Number(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0;

const getSortableValue = (order, key) => {
  if (dateSortKeys.includes(key)) {
    return parseDateValue(order[key]);
  }

  if (key === 'total') {
    return parseMoneyValue(order.total);
  }

  if (key === 'issues') {
    return Number(order.issues) || 0;
  }

  return String(order[key] ?? '').toLowerCase();
};

export default function OrderComparisonPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'poNumber', direction: 'asc' });
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deletingPoNumber, setDeletingPoNumber] = useState('');

  const translatedTabs = useMemo(() => [
    { id: 'All', label: t('orderComparison.tabs.all') },
    { id: 'Draft', label: t('orderComparison.tabs.draft') },
    { id: 'Pending', label: t('orderComparison.tabs.pending') },
    { id: 'Approved', label: t('orderComparison.tabs.approved') },
    { id: 'Awaiting Confirmation', label: t('orderComparison.tabs.awaiting') },
    { id: 'Needs Review', label: t('orderComparison.tabs.needs') },
    { id: 'Issues', label: t('orderComparison.tabs.issues') },
    { id: 'Backordered', label: t('orderComparison.tabs.backordered') },
  ], [t]);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const purchaseOrders = await fetchPurchaseOrders();
      setOrders(purchaseOrders);
    } catch (error) {
      console.error('Error loading purchase orders:', error);
      setLoadError(error.message || 'Could not load purchase orders.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadOrders);
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const visibleOrders = orders.filter((order) => {
      const matchesTab = activeTab === 'All' ? true : order.status === activeTab;
      const normalizedSearch = search.toLowerCase();
      const matchesSearch =
        (order.job?.toLowerCase() ?? '').includes(normalizedSearch) ||
        (order.poNumber ?? '').includes(search) ||
        (order.vendor?.toLowerCase() ?? '').includes(normalizedSearch);

      return matchesTab && matchesSearch;
    });

    return [...visibleOrders].sort((firstOrder, secondOrder) => {
      const firstValue = getSortableValue(firstOrder, sortConfig.key);
      const secondValue = getSortableValue(secondOrder, sortConfig.key);

      if (typeof firstValue === 'number' && typeof secondValue === 'number') {
        if (firstValue < secondValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (firstValue > secondValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }

      const comparison = String(firstValue).localeCompare(String(secondValue), undefined, {
        numeric: true,
        sensitivity: 'base',
      });

      if (comparison !== 0) {
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      return 0;
    });
  }, [activeTab, search, orders, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((currentSort) => {
      if (currentSort.key !== key) {
        return { key, direction: 'asc' };
      }

      return {
        key,
        direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
      };
    });
  };

  const handleUploadSuccess = async () => {
    setIsUploadModalOpen(false);
    await loadOrders();
  };

  const handleDeletePurchaseOrder = async (order) => {
    const poNumber = order?.poNumber;

    if (!poNumber) {
      return;
    }

    const confirmed = window.confirm(`Delete PO #${poNumber}? This will remove the order and its stored PDF.`);

    if (!confirmed) {
      return;
    }

    setDeletingPoNumber(poNumber);
    setLoadError('');

    try {
      await deletePurchaseOrder(poNumber);
      setOrders((currentOrders) => currentOrders.filter((currentOrder) => currentOrder.poNumber !== poNumber));
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      setLoadError(error.message || `Could not delete PO #${poNumber}.`);
    } finally {
      setDeletingPoNumber('');
    }
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
        <button
          className="btn-secondary order-refresh-btn"
          disabled={isLoading}
          type="button"
          onClick={loadOrders}
        >
          Refresh
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

      {loadError && (
        <div className="order-state order-state--error">
          {loadError}
        </div>
      )}

      {isLoading ? (
        <div className="order-state">Loading purchase orders...</div>
      ) : (
        <MainTable
          data={filteredOrders}
          sortConfig={sortConfig}
          onSort={handleSort}
          onDelete={handleDeletePurchaseOrder}
          deletingPoNumber={deletingPoNumber}
        />
      )}

      {isUploadModalOpen && (
        <UploadVendorModal
          onClose={() => setIsUploadModalOpen(false)}
          onUploadSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
