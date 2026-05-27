// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import Card from '../../components/ui/Card.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import { useTranslation } from 'react-i18next';

export default function ModulePlaceholder({ eyebrow, title, description }) {
  const { t } = useTranslation();

  return (
    <Card surface="subtle">
      <SectionHeader eyebrow={eyebrow} title={title} aside={<span className="inline-note">{t('modulePlaceholder.comingSoon')}</span>} />
      <p className="support-copy">{description}</p>
      <div className="status-card">
        {t('modulePlaceholder.description')}
      </div>
    </Card>
  );
}
