// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../components/ui/Card.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';

export default function PlatformHome() {
  const { t } = useTranslation();
  const modules = useMemo(
    () => [
      {
        id: 'takeoff',
        title: t('platformHome.modules.takeoff.title'),
        description: t('platformHome.modules.takeoff.description'),
        to: '/takeoff',
        status: t('platformHome.modules.takeoff.status'),
      },
      {
        id: 'material-extraction',
        title: t('platformHome.modules.materialExtraction.title'),
        description: t('platformHome.modules.materialExtraction.description'),
        to: '/material-extraction',
        status: t('platformHome.modules.materialExtraction.status'),
      },
      {
        id: 'order-comparison',
        title: t('platformHome.modules.orderComparison.title'),
        description: t('platformHome.modules.orderComparison.description'),
        to: '/order-comparison',
        status: t('platformHome.modules.orderComparison.status'),
      },
    ],
    [t],
  );

  return (
    <div className="content-stack">
      <Card surface="default">
        <SectionHeader
          eyebrow={t('platformHome.eyebrow')}
          title={t('platformHome.title')}
          aside={<span className="inline-note">{t('platformHome.aside')}</span>}
        />
        <p className="support-copy">
          {t('platformHome.description')}
        </p>
      </Card>

      <div className="module-grid">
        {modules.map((module) => (
          <Card key={module.id} className="module-card" surface="subtle">
            <div className="module-head">
              <h3>{module.title}</h3>
              <span className="inline-note">{module.status}</span>
            </div>
            <p>{module.description}</p>
            <Link className="module-link" to={module.to}>
              {t('platformHome.openModule')}
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
