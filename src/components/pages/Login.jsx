import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import BrandLogo from '../ui/BrandLogo';
import LoadingScreen from '../ui/LoadingScreen.jsx';
import PasswordField from '../ui/PasswordField';
import '../styles/auth.css';

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const { login, requestPasswordReset, isLoading, error, clearError } = useAuth();

    const [formData, setFormData] = useState({ email: '', password: '' });
    const [authMode, setAuthMode] = useState('login');
    const [formError, setFormError] = useState('');
    const [isSendingReset, setIsSendingReset] = useState(false);
    const [notice, setNotice] = useState(location.state?.notice || '');
    const fromPath = location.state?.from?.pathname || '/dashboard';
    const isPasswordResetMode = authMode === 'password-reset';

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setFormError('');
        setNotice('');
        if (error) clearError();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        try {
            await login({ email: formData.email, password: formData.password });
            navigate(fromPath, { replace: true });
        } catch (err) {
            setFormError(err.message);
        }
    };

    const handlePasswordResetSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setNotice('');

        const email = formData.email.trim();
        if (!email) {
            setFormError(t('auth.passwordReset.emailRequired'));
            return;
        }

        setIsSendingReset(true);
        try {
            await requestPasswordReset(email);
            setNotice(t('auth.passwordReset.checkEmail'));
            setAuthMode('login');
        } catch (err) {
            setFormError(err.message);
        } finally {
            setIsSendingReset(false);
        }
    };

    const showPasswordReset = () => {
        setAuthMode('password-reset');
        setFormError('');
        setNotice('');
        if (error) clearError();
    };

    const showLogin = () => {
        setAuthMode('login');
        setFormError('');
        setNotice('');
        if (error) clearError();
    };

    const resolvedLang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
    const isBusy = isLoading || isSendingReset;

    if (isLoading) {
        return (
            <LoadingScreen
                title={t('auth.login.loadingTitle')}
                subtitle={t('auth.login.loadingSubtitle')}
            />
        );
    }

    return (
        <div className="auth-scene">
            <div className="auth-topbar">
                <div className="auth-wordmark" aria-label="Valtrim">
                    <BrandLogo className="auth-wordmark-logo" />
                    <span>Valtrim</span>
                </div>
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
            </div>

            <div className="auth-panel auth-panel--login">
                <div className="auth-brand-icon">
                    <BrandLogo />
                </div>
                <div className="auth-brand-copy">
                    <span>Valtrim</span>
                    <p>{t('auth.login.workspaceSubtitle')}</p>
                </div>

                <div className="auth-heading-group">
                    <h1 className="auth-headline">
                        {isPasswordResetMode ? t('auth.passwordReset.title') : t('auth.login.title')}
                    </h1>
                    {isPasswordResetMode && (
                        <p className="auth-subline">{t('auth.passwordReset.subtitle')}</p>
                    )}
                </div>

                {notice && (
                    <p className="auth-info-msg" role="status">
                        {notice}
                    </p>
                )}

                {(formError || error) && (
                    <div>
                        <p className="auth-error-msg" role="alert">
                            {formError || error}
                        </p>
                    </div>
                )}

                <form
                    className="auth-form"
                    onSubmit={isPasswordResetMode ? handlePasswordResetSubmit : handleSubmit}
                >
                    <label className="auth-field">
                        <span className="auth-field-icon" aria-hidden="true">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M4 6.5h16v11H4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                                <path d="M5 7l7 6 7-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </span>
                        <input
                            className="auth-input"
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder={t('auth.yourEmail')}
                            required
                            disabled={isBusy}
                            autoComplete="email"
                        />
                    </label>

                    {isPasswordResetMode ? (
                        <>
                            <button type="submit" className="auth-btn-primary" disabled={isBusy}>
                                {isSendingReset ? t('auth.passwordReset.sendingLink') : t('auth.passwordReset.sendLink')}
                            </button>

                            <button
                                type="button"
                                className="auth-magic-link auth-link-button"
                                onClick={showLogin}
                                disabled={isBusy}
                            >
                                {t('auth.passwordReset.backToLogin')}
                            </button>
                        </>
                    ) : (
                        <>
                            <PasswordField
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder={t('auth.password')}
                                required
                                disabled={isBusy}
                                autoComplete="current-password"
                            />

                            <button
                                type="button"
                                className="auth-form-link auth-link-button"
                                onClick={showPasswordReset}
                                disabled={isBusy}
                            >
                                {t('auth.login.forgotPassword')}
                            </button>

                            <button type="submit" className="auth-btn-primary" disabled={isBusy}>
                                {isLoading ? t('auth.login.signingIn') : t('auth.login.signIn')}
                            </button>

                        </>
                    )}
                </form>
            </div>
        </div>
    );
}
