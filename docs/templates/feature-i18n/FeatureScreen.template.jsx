// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import { useTranslation } from 'react-i18next';

export default function FeatureScreen() {
    const { t } = useTranslation();

    return (
        <section>
            <p>{t('featureName.header.eyebrow')}</p>
            <h2>{t('featureName.header.title')}</h2>
            <p>{t('featureName.header.subtitle')}</p>

            <button type="button">{t('featureName.actions.run')}</button>
        </section>
    );
}
