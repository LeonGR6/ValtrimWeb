// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import Icon from '../ui/Icon.jsx';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function BottomNav({ items }) {
  const { t } = useTranslation();

  return (
    <nav
      className="mobile-nav"
      aria-label={t('navigation.mobile')}
      style={{ '--mobile-nav-count': items.length }}
    >
      {items.map((item) => (
        <NavLink
          key={item.id}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}
        >
          {item.icon ? <Icon name={item.icon} className="nav-icon" /> : null}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
