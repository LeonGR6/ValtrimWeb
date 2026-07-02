// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import BrandLogo from '../ui/BrandLogo';
import LoadingScreen from '../ui/LoadingScreen.jsx';
import PasswordField from '../ui/PasswordField';
import '../styles/auth.css';

function getSupabaseUrlError(location) {
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(location.search);

    return hashParams.get('error_description') || searchParams.get('error_description') || '';
}

export default function ResetPassword() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const { session, isLoading, error, clearError, updatePassword, logout } = useAuth();

    const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
    const [formError, setFormError] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const hasRecoverySession = Boolean(session?.access_token);
    const urlError = useMemo(() => getSupabaseUrlError(location), [location]);
    const resolvedLang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
    const isBusy = isLoading || isUpdating;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setFormError('');
        if (error) clearError();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        if (formData.password.length < 8) {
            setFormError(t('auth.passwordReset.passwordTooShort'));
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setFormError(t('auth.passwordReset.passwordMismatch'));
            return;
        }

        setIsUpdating(true);
        try {
            await updatePassword(formData.password);
            await logout();
            navigate('/login', {
                replace: true,
                state: { notice: t('auth.passwordReset.successNotice') },
            });
        } catch (err) {
            setFormError(err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    if (isLoading) {
        return (
            <LoadingScreen
                title={t('auth.passwordReset.loadingTitle')}
                subtitle={t('auth.passwordReset.loadingSubtitle')}
            />
        );
    }

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
                    <h1 className="auth-headline">{t('auth.passwordReset.resetTitle')}</h1>
                    <p className="auth-subline">{t('auth.passwordReset.resetSubtitle')}</p>
                </div>

                {(formError || error || urlError || !hasRecoverySession) && (
                    <div>
                        <p className="auth-error-msg" role="alert">
                            {formError || error || urlError || t('auth.passwordReset.missingSession')}
                        </p>
                    </div>
                )}

                {hasRecoverySession ? (
                    <form className="auth-form" onSubmit={handleSubmit}>
                        <PasswordField
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder={t('auth.passwordReset.newPassword')}
                            required
                            disabled={isBusy}
                            autoComplete="new-password"
                            minLength={8}
                        />
                        <PasswordField
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder={t('auth.passwordReset.confirmPassword')}
                            required
                            disabled={isBusy}
                            autoComplete="new-password"
                            minLength={8}
                        />

                        <button type="submit" className="auth-btn-primary" disabled={isBusy}>
                            {isUpdating ? t('auth.passwordReset.updatingPassword') : t('auth.passwordReset.updatePassword')}
                        </button>
                    </form>
                ) : (
                    <button
                        type="button"
                        className="auth-btn-primary"
                        onClick={() => navigate('/login', { replace: true })}
                    >
                        {t('auth.passwordReset.backToLogin')}
                    </button>
                )}
            </div>
        </div>
    );
}
