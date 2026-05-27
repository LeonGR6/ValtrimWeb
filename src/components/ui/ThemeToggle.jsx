// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import { useTranslation } from 'react-i18next';

export default function ThemeToggle({ theme, onChange }) {
  const { t } = useTranslation();

  return (
    <div className="segmented-control" role="group" aria-label={t('a11y.themeSelector')}>
      <Button appearance="segment" size="sm" active={theme === 'dark'} onClick={() => onChange('dark')}>
        <Icon name="moon" className="button-icon" />
        {t('common.dark')}
      </Button>
      <Button appearance="segment" size="sm" active={theme === 'light'} onClick={() => onChange('light')}>
        <Icon name="sun" className="button-icon" />
        {t('common.light')}
      </Button>
    </div>
  );
}
