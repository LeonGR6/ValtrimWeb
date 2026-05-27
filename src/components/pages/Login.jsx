// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import BrandLogo from '../ui/BrandLogo';
import PasswordField from '../ui/PasswordField';
import '../styles/auth.css';

export default function Login() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { login, isLoading, error, clearError } = useAuth();

    const [formData, setFormData] = useState({ email: '', password: '' });
    const [formError, setFormError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setFormError('');
        if (error) clearError();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        try {
            await login({ email: formData.email, password: formData.password });
            navigate('/');
        } catch (err) {
            const code = err?.code || '';
            if (code === 'invalid_response_format' || code === 'invalid_auth_response') {
                const apiBase = err?.details?.apiBase || '(same-origin)';
                setFormError(t('auth.login.invalidApiFormat', { apiBase }));
            } else {
                setFormError(err.message);
            }
        }
    };

    const resolvedLang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';

    return (
        <div className="auth-scene">
            <div className="auth-blob auth-blob-1" />
            <div className="auth-blob auth-blob-2" />

            <div className="auth-panel auth-panel--login">
                <div className="auth-lang-switch" role="group" aria-label={t('a11y.languageSelector')}>
                    <button
                        type="button"
                        className={`auth-lang-btn${resolvedLang === 'es' ? ' active' : ''}`}
                        onClick={() => i18n.changeLanguage('es')}
                    >
                        ES
                    </button>
                    <button
                        type="button"
                        className={`auth-lang-btn${resolvedLang === 'en' ? ' active' : ''}`}
                        onClick={() => i18n.changeLanguage('en')}
                    >
                        EN
                    </button>
                </div>

                <div className="auth-brand-icon">
                    <BrandLogo />
                </div>

                <div className="auth-heading-group">
                    <h1 className="auth-headline">{t('auth.login.title')}</h1>
                    <p className="auth-subline">
                        {t('auth.login.firstTime')}{' '}
                        <Link to="/register" className="auth-inline-link">
                            {t('auth.login.signUpFree')}
                        </Link>
                    </p>
                </div>

                {(formError || error) && (
                    <div>
                        <p className="auth-error-msg" role="alert">
                            {formError || error}
                        </p>
                    </div>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <input
                        className="auth-input"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder={t('auth.yourEmail')}
                        required
                        disabled={isLoading}
                        autoComplete="email"
                    />
                    <PasswordField
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder={t('auth.password')}
                        required
                        disabled={isLoading}
                        autoComplete="current-password"
                    />

                    <button type="submit" className="auth-btn-primary" disabled={isLoading}>
                        {isLoading ? t('auth.login.signingIn') : t('auth.login.signIn')}
                    </button>

                    <div className="auth-sep">{t('auth.login.or')}</div>

                    <button type="button" className="auth-btn-sso auth-btn-sso--google">
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path
                                fill="#EA4335"
                                d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.3-1.9 3.1l3 2.3c1.8-1.7 2.8-4.1 2.8-6.9 0-.7-.1-1.4-.2-2.1H12z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 21c2.5 0 4.6-.8 6.2-2.2l-3-2.3c-.8.6-1.9 1-3.2 1-2.5 0-4.5-1.7-5.2-3.9H3.7v2.4C5.3 19.1 8.4 21 12 21z"
                            />
                            <path
                                fill="#4A90E2"
                                d="M6.8 13.6c-.2-.6-.3-1.1-.3-1.7s.1-1.2.3-1.7V7.8H3.7C3.2 8.9 3 10 3 11.9c0 1.8.2 3 .7 4.1l3.1-2.4z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M12 6.3c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.8 3.3 14.7 2.4 12 2.4c-3.6 0-6.7 1.9-8.3 4.8l3.1 2.4c.7-2.2 2.7-3.9 5.2-3.9z"
                            />
                        </svg>
                        {t('auth.login.continueWithGoogle')}
                    </button>
                </form>
            </div>
        </div>
    );
}
