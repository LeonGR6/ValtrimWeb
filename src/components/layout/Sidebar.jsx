// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import Card from '../ui/Card.jsx';
import Icon from '../ui/Icon.jsx';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext.jsx';

function getInitials(name) {
  if (!name) return 'U';
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || 'U';
}

export default function Sidebar({ brand, navItems = [], children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="shell-sidebar" aria-label={t('navigation.desktop')}>
      {brand}
      <Card className="nav-panel" surface="subtle" density="compact" as="nav" aria-label={t('navigation.section')}>
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            to={item.to}
            end={item.to === '/'}
          >
            {item.icon ? <Icon name={item.icon} className="nav-icon" /> : null}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </Card>
      {children}

      {user ? (
        <Card className="user-panel" surface="subtle" density="compact">
          <NavLink
            to="/profile"
            className={({ isActive }) => `user-panel-link${isActive ? ' active' : ''}`}
            aria-label={t('a11y.viewProfile')}
          >
            <span className="user-avatar" aria-hidden="true">{getInitials(user.fullName)}</span>
            <span className="user-meta">
              <span className="user-name">{user.fullName || t('common.user')}</span>
              <span className="user-email">{user.email}</span>
            </span>
          </NavLink>
          <button
            type="button"
            className="nav-link user-logout"
            onClick={handleLogout}
          >
            <Icon name="logout" className="nav-icon" />
            <span>{t('common.signOut')}</span>
          </button>
        </Card>
      ) : null}
    </aside>
  );
}
