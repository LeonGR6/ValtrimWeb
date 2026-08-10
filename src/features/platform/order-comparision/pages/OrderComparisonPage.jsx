import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import '../../../../styles/orderComparison.css';
import { canModifyPurchaseOrders } from '../../../../auth/permissions.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { deletePurchaseOrder, fetchPurchaseOrders } from '../../../../services/purchaseOrdersApi';

import StatusTabs from '../components/StatusTabs';
import SearchBar from '../components/SearchBar';
import MainTable from '../components/MainTable';
import UploadVendorModal from '../components/UploadVendorModal';
import { findPoNumber } from '../utils/uploadVendorResponse';

const dateSortKeys = ['requiredDate', 'vendorShipDate', 'ackDate'];
const viewPreferencesStorageKey = 'valtrim-order-comparison-view';
const defaultViewPreferences = {
  activeTab: 'All',
  search: '',
  sortConfig: { key: 'poNumber', direction: 'asc' },
};
const validTabs = new Set([
  'All',
  'Pending',
  'Approved',
  'Needs Review',
  'Backordered',
]);
const validSortKeys = new Set([
  'status',
  'poNumber',
  'vendor',
  'job',
  'phaseLots',
  'requiredDate',
  'vendorShipDate',
  'ackDate',
  'updatedAt',
  'issues',
  'total',
]);

const getInitialViewPreferences = () => {
  if (typeof window === 'undefined') {
    return defaultViewPreferences;
  }

  try {
    const storedPreferences = JSON.parse(
      window.localStorage.getItem(viewPreferencesStorageKey),
    );
    const storedSort = storedPreferences?.sortConfig;

    return {
      activeTab: validTabs.has(storedPreferences?.activeTab)
        ? storedPreferences.activeTab
        : defaultViewPreferences.activeTab,
      search: typeof storedPreferences?.search === 'string'
        ? storedPreferences.search
        : defaultViewPreferences.search,
      sortConfig: validSortKeys.has(storedSort?.key)
        && (storedSort?.direction === 'asc' || storedSort?.direction === 'desc')
        ? storedSort
        : defaultViewPreferences.sortConfig,
    };
  } catch {
    return defaultViewPreferences;
  }
};

const parseDateValue = (value) => {
  if (!value) return 0;

  const raw = String(value).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const usMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);

  const normalizeYear = (yearValue) => {
    const year = Number(yearValue);

    if (!Number.isFinite(year)) return null;
    if (year < 100) return year >= 70 ? 1900 + year : 2000 + year;

    return year;
  };

  const parts = isoMatch
    ? { month: Number(isoMatch[2]), day: Number(isoMatch[3]), year: normalizeYear(isoMatch[1]) }
    : usMatch
      ? { month: Number(usMatch[1]), day: Number(usMatch[2]), year: normalizeYear(usMatch[3]) }
      : null;

  if (!parts?.month || !parts?.day || !parts?.year) return 0;

  return new Date(parts.year, parts.month - 1, parts.day).getTime();
};

const parseMoneyValue = (value) => Number(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0;

const getSortableValue = (order, key) => {
  if (key === 'updatedAt') {
    return Date.parse(order.updatedAtRaw || order.updatedAt) || 0;
  }

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

const getBatchResults = (uploadPayload) => {
  if (Array.isArray(uploadPayload)) {
    return uploadPayload;
  }

  if (Array.isArray(uploadPayload?.results)) {
    return uploadPayload.results;
  }

  return null;
};

export default function OrderComparisonPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManagePurchaseOrders = canModifyPurchaseOrders(user);
  const [viewPreferences, setViewPreferences] = useState(getInitialViewPreferences);
  const { activeTab, search, sortConfig } = viewPreferences;
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deletingPoNumber, setDeletingPoNumber] = useState('');

  const translatedTabs = useMemo(() => [
    { id: 'All', label: t('orderComparison.tabs.all') },
    { id: 'Pending', label: t('orderComparison.tabs.pending') },
    { id: 'Approved', label: t('orderComparison.tabs.approved') },
    { id: 'Needs Review', label: t('orderComparison.tabs.needs') },
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

  useEffect(() => {
    try {
      window.localStorage.setItem(
        viewPreferencesStorageKey,
        JSON.stringify(viewPreferences),
      );
    } catch {
      // Keep the table usable when storage is disabled or unavailable.
    }
  }, [viewPreferences]);

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
    setViewPreferences((currentPreferences) => {
      const currentSort = currentPreferences.sortConfig;

      if (currentSort.key !== key) {
        return {
          ...currentPreferences,
          sortConfig: { key, direction: 'asc' },
        };
      }

      return {
        ...currentPreferences,
        sortConfig: {
          key,
          direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
        },
      };
    });
  };

  const handleActiveTabChange = (activeTabValue) => {
    setViewPreferences((currentPreferences) => ({
      ...currentPreferences,
      activeTab: activeTabValue,
    }));
  };

  const handleSearchChange = (searchValue) => {
    setViewPreferences((currentPreferences) => ({
      ...currentPreferences,
      search: searchValue,
    }));
  };

  const handleUploadSuccess = async (uploadPayload) => {
    setIsUploadModalOpen(false);
    const batchResults = getBatchResults(uploadPayload);

    if (batchResults) {
      const successfulCount = batchResults.filter((result) => result.status === 'success').length;

      await loadOrders();

      if (successfulCount === 0) {
        setLoadError('The batch finished, but no PDFs were saved successfully.');
      }

      return;
    }

    const poNumber = findPoNumber(uploadPayload);

    if (!poNumber) {
      setLoadError('The upload finished, but the workflow response did not include a PO number.');
      await loadOrders();
      return;
    }

    navigate(`/order-comparison/${encodeURIComponent(poNumber)}`, {
      state: {
        uploadedPoNumber: poNumber,
        uploadPayload,
      },
    });
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

      {!canManagePurchaseOrders && (
        <div className="po-read-only-notice" role="status">
          <strong>{t('orderComparison.readOnly.badge')}</strong>
          <span>{t('orderComparison.readOnly.description')}</span>
        </div>
      )}

      <div className="section-header-actions">
        {canManagePurchaseOrders && (
          <button
            className="btn-primary"
            onClick={() => setIsUploadModalOpen(true)}
          >
            <span className="btn-icon">+</span> {t('orderComparison.pdfButton')}
          </button>
        )}
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
        setActiveTab={handleActiveTabChange}
        orders={orders}
        tabsConfig={translatedTabs}
      />

      <SearchBar
        search={search}
        setSearch={handleSearchChange}
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
          onDelete={canManagePurchaseOrders ? handleDeletePurchaseOrder : undefined}
          deletingPoNumber={deletingPoNumber}
        />
      )}

      {canManagePurchaseOrders && isUploadModalOpen && (
        <UploadVendorModal
          onClose={() => setIsUploadModalOpen(false)}
          onUploadSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
