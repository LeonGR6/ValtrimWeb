// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
﻿import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import BrandLogo from '../ui/BrandLogo';
import PasswordField from '../ui/PasswordField';
import '../styles/auth.css';

export default function Register() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { register, isLoading, error, clearError } = useAuth();

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
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

        if (formData.password !== formData.confirmPassword) {
            setFormError(t('auth.register.passwordMismatch'));
            return;
        }
        if (formData.password.length < 8) {
            setFormError(t('auth.register.passwordTooShort'));
            return;
        }

        try {
            await register({
                fullName: formData.fullName,
                email: formData.email,
                password: formData.password,
            });
            navigate('/');
        } catch (err) {
            setFormError(err.message);
        }
    };

    return (
        <div className="auth-scene">
            <div className="auth-blob auth-blob-1" />
            <div className="auth-blob auth-blob-2" />

            <div className="auth-panel">
                <div className="auth-brand-icon">
                    <BrandLogo />
                </div>

                <div className="auth-heading-group">
                    <h1 className="auth-headline">{t('auth.register.title')}</h1>
                    <p className="auth-subline">
                        {t('auth.register.alreadyHave')}{' '}
                        <Link to="/login" className="auth-inline-link">
                            {t('auth.register.signIn')}
                        </Link>
                    </p>
                </div>

                {(formError || error) && (
                    <p className="auth-error-msg" role="alert">
                        {formError || error}
                    </p>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <input
                        className="auth-input"
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        placeholder={t('auth.register.fullName')}
                        required
                        disabled={isLoading}
                        autoComplete="name"
                    />
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
                        placeholder={t('auth.register.passwordMin')}
                        required
                        disabled={isLoading}
                        autoComplete="new-password"
                    />
                    <PasswordField
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder={t('auth.register.confirmPassword')}
                        required
                        disabled={isLoading}
                        autoComplete="new-password"
                    />

                    <button type="submit" className="auth-btn-primary" disabled={isLoading}>
                        {isLoading ? t('auth.register.creatingAccount') : t('auth.register.createAccount')}
                    </button>
                </form>
            </div>
        </div>
    );
}
