import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge';

export default function MainTable({ data }) {
  const navigate = useNavigate();

  return (
    <div className="table-wrapper">
      <div className="table-scroll">
        <table className="orders-table">

          <thead>
            <tr>
              <th>Alert</th>
              <th>Status</th>
              <th>PO #</th>
              <th>Job</th>
              <th>Phase/Lots</th>
              <th>Vendor</th>
              <th>Required Date</th>
              <th>Vendor Ship Date</th>
              <th>Total</th>
              <th>Issues</th>
              <th>Confirmation</th>
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
                <td>{order.job}</td>
                <td>{order.phaseLots}</td>
                <td>{order.vendor}</td>
                <td>{order.requiredDate}</td>
                <td>{order.vendorShipDate}</td>
                <td>{order.total}</td>
                <td>{order.issues}</td>
                <td>
                  <StatusBadge status={order.confirmation} />
                </td>

              </tr>
            ))}

          </tbody>

        </table>
      </div>
    </div>
  );
}
