// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/authApi';
import i18n from '../i18n.js';

const AuthContext = createContext(null);

const STORAGE_KEYS = {
    ACCESS_TOKEN: 'auth:access_token',
    USER: 'auth:user',
    ACCESS_TOKEN_EXPIRES: 'auth:access_token_expires',
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const clearAuth = useCallback(() => {
        setUser(null);
        setAccessToken(null);
        setError(null);

        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN_EXPIRES);
    }, []);

    const saveAuthData = useCallback((userData, newAccessToken, expiresAt) => {
        setUser(userData);
        setAccessToken(newAccessToken);

        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN_EXPIRES, expiresAt);
    }, []);

    // Initialize from localStorage on mount
    useEffect(() => {
        const initAuth = async () => {
            try {
                const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
                const storedAccessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
                const storedExpires = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN_EXPIRES);

                if (storedAccessToken && storedUser) {
                    // Check if token is expired
                    const expiresAt = new Date(storedExpires);
                    if (expiresAt > new Date()) {
                        setAccessToken(storedAccessToken);
                        setUser(JSON.parse(storedUser));
                    } else {
                        // Clear auth
                        clearAuth();
                    }
                }
            } catch (err) {
                console.error('Failed to initialize auth:', err);
                clearAuth();
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, [clearAuth]);

    const register = async (registerData) => {
        setError(null);
        setIsLoading(true);
        try {
            const response = await authApi.register(registerData);
            saveAuthData(
                response.user,
                response.accessToken,
                response.accessTokenExpiresAt
            );
            return response;
        } catch (err) {
            const errorMsg = err.message || i18n.t('api.auth.registrationFailed');
            setError(errorMsg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (loginData) => {
        setError(null);
        setIsLoading(true);
        try {
            const response = await authApi.login(loginData);
            saveAuthData(
                response.user,
                response.accessToken,
                response.accessTokenExpiresAt
            );
            return response;
        } catch (err) {
            const errorMsg = err.message || i18n.t('api.auth.loginFailed');
            setError(errorMsg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        setError(null);
        clearAuth();
    };

    const value = {
        user,
        accessToken,
        isLoading,
        error,
        isAuthenticated: !!accessToken && !!user,
        register,
        login,
        logout,
        clearError: () => setError(null),
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
