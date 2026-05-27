// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target, source) {
    if (!isPlainObject(target)) return source;
    if (!isPlainObject(source)) return source;

    const output = { ...target };
    for (const [key, value] of Object.entries(source)) {
        if (isPlainObject(value) && isPlainObject(output[key])) {
            output[key] = deepMerge(output[key], value);
        } else {
            output[key] = value;
        }
    }
    return output;
}

const localeModules = import.meta.glob('./locales/*/*.json', { eager: true });
const resources = Object.entries(localeModules).reduce((acc, [modulePath, moduleValue]) => {
    const match = modulePath.match(/\.\/locales\/([^/]+)\/[^/]+\.json$/);
    if (!match) return acc;

    const lang = match[1];
    const payload = moduleValue.default || moduleValue;
    const existing = acc[lang]?.translation || {};

    acc[lang] = {
        translation: deepMerge(existing, payload),
    };

    return acc;
}, {});

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'es',
        supportedLngs: ['es', 'en'],
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
            lookupLocalStorage: 'valtrim-language',
        },
    });

export default i18n;
