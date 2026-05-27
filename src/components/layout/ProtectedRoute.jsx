// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute({ children, requiredRoles = [] }) {
    const { t } = useTranslation();
    const { isAuthenticated, isLoading, user } = useAuth();

    if (isLoading) {
        return (
            <div className="loading-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div>{t('common.loading')}</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (Array.isArray(requiredRoles) && requiredRoles.length > 0) {
        const userRoles = Array.isArray(user?.roles) ? user.roles : [];
        const hasRequiredRole = userRoles.some((role) => requiredRoles.includes(role));
        if (!hasRequiredRole) {
            return <Navigate to="/dashboard" replace />;
        }
    }

    return children;
}
