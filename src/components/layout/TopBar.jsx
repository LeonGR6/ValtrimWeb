// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function TopBar({ breadcrumbItems = [], eyebrow, title, description, actions }) {
  const { t } = useTranslation();
  const breadcrumbClasses = [
    'topbar-breadcrumb',
    breadcrumbItems.length > 2 ? 'topbar-breadcrumb-compact' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header className="shell-topbar">
      <div>
        {breadcrumbItems.length ? (
          <nav className={breadcrumbClasses} aria-label={t('a11y.currentLocation')}>
            {breadcrumbItems.map((item, index) => (
              <span key={`${item.label}-${index}`} className="crumb-wrap">
                {item.to ? (
                  <Link to={item.to} className="topbar-crumb topbar-crumb-link">
                    {item.label}
                  </Link>
                ) : (
                  <span className="topbar-crumb topbar-crumb-current">{item.label}</span>
                )}
                {index < breadcrumbItems.length - 1 ? <span className="topbar-crumb-sep">/</span> : null}
              </span>
            ))}
          </nav>
        ) : null}
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="topbar-title">{title}</h2>
        {description ? <p className="support-copy">{description}</p> : null}
      </div>
      {actions ? <div className="topbar-actions">{actions}</div> : null}
    </header>
  );
}
