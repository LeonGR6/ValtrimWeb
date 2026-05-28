export default function StatusBadge({ status }) {
  if (!status) return <span>—</span>;

  const normalizedClass = status.toLowerCase().replace(/\s+/g, '-');

  return (
    <span className={`status-badge status-${normalizedClass}`}>
      {status}
    </span>
  );
}