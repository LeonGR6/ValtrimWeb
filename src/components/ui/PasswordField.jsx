// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function PasswordField({ className = 'auth-input', ...inputProps }) {
    const [visible, setVisible] = useState(false);
    const { t } = useTranslation();

    return (
        <div className="auth-password-wrap">
            <span className="auth-password-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M7 10V8a5 5 0 0110 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M6 10h12v10H6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                    <path d="M12 14v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            </span>
            <input
                {...inputProps}
                className={className}
                type={visible ? 'text' : 'password'}
            />
            <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? t('a11y.hidePassword') : t('a11y.showPassword')}
                aria-pressed={visible}
                tabIndex={-1}
            >
                {visible ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        <path d="M10.58 10.58a2 2 0 002.83 2.83" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        <path d="M16.68 16.68A9.77 9.77 0 0112 18c-5 0-9-6-9-6a17.5 17.5 0 014.06-4.68M9.9 5.24A9.94 9.94 0 0112 5c5 0 9 6 9 6a17.6 17.6 0 01-2.16 2.94" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                )}
            </button>
        </div>
    );
}
