import { useNavigate } from 'react-router-dom';
import Icon from '../../../../components/ui/Icon.jsx';
import StatusBadge from './StatusBadge';

const sortableColumns = {
  status: 'Status',
  poNumber: 'PO #',
  vendor: 'Vendor',
  job: 'Job',
  phaseLots: 'Phase/Lots',
  requiredDate: 'Required Date',
  vendorShipDate: 'Vendor Ship Date',
  ackDate: 'Ack Date',
  issues: 'Issues',
  total: 'Total',
};

function SortableHeader({ columnKey, sortConfig, onSort }) {
  const isActive = sortConfig?.key === columnKey;
  const directionLabel = sortConfig?.direction === 'asc' ? 'ascending' : 'descending';

  return (
    <button
      type="button"
      className={`table-sort-button${isActive ? ' active' : ''}`}
      aria-label={`Sort by ${sortableColumns[columnKey]}${isActive ? `, currently ${directionLabel}` : ''}`}
      onClick={() => onSort(columnKey)}
    >
      <span>{sortableColumns[columnKey]}</span>
      <span className="table-sort-indicator" aria-hidden="true">
        {isActive ? (sortConfig.direction === 'asc' ? '^' : 'v') : '-'}
      </span>
    </button>
  );
}

export default function MainTable({ data, sortConfig, onSort, onDelete, deletingPoNumber }) {
  const navigate = useNavigate();

  return (
    <div className="table-wrapper">
      <div className="table-scroll">
        <table className="orders-table">

          <thead>
            <tr>
              <th>Alert</th>
              <th><SortableHeader columnKey="status" sortConfig={sortConfig} onSort={onSort} /></th>
              <th><SortableHeader columnKey="poNumber" sortConfig={sortConfig} onSort={onSort} /></th>
              <th><SortableHeader columnKey="vendor" sortConfig={sortConfig} onSort={onSort} /></th>
              <th><SortableHeader columnKey="job" sortConfig={sortConfig} onSort={onSort} /></th>
              <th><SortableHeader columnKey="phaseLots" sortConfig={sortConfig} onSort={onSort} /></th>
              <th><SortableHeader columnKey="requiredDate" sortConfig={sortConfig} onSort={onSort} /></th>
              <th><SortableHeader columnKey="vendorShipDate" sortConfig={sortConfig} onSort={onSort} /></th>
              <th><SortableHeader columnKey="ackDate" sortConfig={sortConfig} onSort={onSort} /></th>
              <th><SortableHeader columnKey="issues" sortConfig={sortConfig} onSort={onSort} /></th>
              <th><SortableHeader columnKey="total" sortConfig={sortConfig} onSort={onSort} /></th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>

            {data.map((order) => (
              <tr key={order.id}>

                <td>{order.alert}</td>
                <td>
                  <StatusBadge status={order.status} />
                </td>
                <td>
                  <button
                    type="button"
                    className="po-link-btn"
                    onClick={() => navigate(`/order-comparison/${order.poNumber}`, {
                      state: { order },
                    })}
                  >
                    {order.poNumber}
                  </button>
                </td>
                <td>{order.vendor}</td>
                <td>{order.job}</td>
                <td>{order.phaseLots}</td>
                <td>{order.requiredDate}</td>
                <td>{order.vendorShipDate}</td>
                <td>{order.ackDate}</td>
                <td>{order.issues}</td>
                <td>{order.total}</td>
                <td>
                  <button
                    type="button"
                    className="order-delete-btn"
                    disabled={deletingPoNumber === order.poNumber}
                    title={`Delete PO #${order.poNumber}`}
                    aria-label={`Delete PO #${order.poNumber}`}
                    onClick={() => onDelete?.(order)}
                  >
                    <Icon name="trash" className="order-delete-icon" />
                  </button>
                </td>

              </tr>
            ))}

          </tbody>

        </table>
      </div>
    </div>
  );
}
