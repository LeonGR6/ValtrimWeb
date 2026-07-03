import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import LoadingScreen from '../ui/LoadingScreen.jsx';

export default function ProtectedRoute({ children, requiredRoles = [] }) {
    const { t } = useTranslation();
    const location = useLocation();
    const { isAuthenticated, isLoading, user } = useAuth();

    if (isLoading) {
        return (
            <LoadingScreen
                compact
                title={t('common.loadingTitle')}
                subtitle={t('common.loadingSubtitle')}
            />
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
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
