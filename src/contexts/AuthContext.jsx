/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n.js';
import { assertSupabaseConfig } from '../services/supabaseClient.js';

const AuthContext = createContext(null);

function normalizeRoles(user) {
    const rawRoles = user?.app_metadata?.roles ?? user?.app_metadata?.role ?? user?.user_metadata?.roles;
    const roles = Array.isArray(rawRoles) ? rawRoles : [rawRoles].filter(Boolean);

    return roles.map((role) => String(role).toLowerCase());
}

function normalizeSupabaseUser(user) {
    if (!user) return null;

    const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.fullName ||
        user.user_metadata?.name ||
        user.email ||
        '';

    return {
        id: user.id,
        email: user.email,
        fullName,
        roles: normalizeRoles(user),
        raw: user,
    };
}

function getAuthErrorMessage(err, fallbackKey) {
    return err?.message || i18n.t(fallbackKey);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const applySession = useCallback((nextSession) => {
        setSession(nextSession);
        setUser(normalizeSupabaseUser(nextSession?.user));
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function initAuth() {
            try {
                const client = assertSupabaseConfig();
                const { data, error: sessionError } = await client.auth.getSession();

                if (sessionError) throw sessionError;
                if (isMounted) applySession(data.session);
            } catch (err) {
                console.error('Failed to initialize auth:', err);
                if (isMounted) {
                    applySession(null);
                    setError(getAuthErrorMessage(err, 'api.auth.sessionFailed'));
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        initAuth();

        let subscription;
        try {
            const client = assertSupabaseConfig();
            const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
                applySession(nextSession);
                setIsLoading(false);
            });
            subscription = data.subscription;
        } catch {
            subscription = null;
        }

        return () => {
            isMounted = false;
            subscription?.unsubscribe();
        };
    }, [applySession]);

    const login = useCallback(async ({ email, password }) => {
        setError(null);
        setIsLoading(true);

        try {
            const client = assertSupabaseConfig();
            const { data, error: loginError } = await client.auth.signInWithPassword({
                email,
                password,
            });

            if (loginError) throw loginError;
            applySession(data.session);

            return {
                user: normalizeSupabaseUser(data.user),
                session: data.session,
            };
        } catch (err) {
            const errorMsg = getAuthErrorMessage(err, 'api.auth.loginFailed');
            setError(errorMsg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [applySession]);

    const loginWithGoogle = useCallback(async () => {
        setError(null);

        try {
            const client = assertSupabaseConfig();
            const { data, error: oauthError } = await client.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/dashboard`,
                },
            });

            if (oauthError) throw oauthError;
            return data;
        } catch (err) {
            const errorMsg = getAuthErrorMessage(err, 'api.auth.loginFailed');
            setError(errorMsg);
            throw err;
        }
    }, []);

    const logout = useCallback(async () => {
        setError(null);
        const client = assertSupabaseConfig();
        const { error: logoutError } = await client.auth.signOut();

        if (logoutError) {
            setError(logoutError.message);
            throw logoutError;
        }

        applySession(null);
    }, [applySession]);

    const value = useMemo(() => ({
        user,
        session,
        accessToken: session?.access_token || null,
        isLoading,
        error,
        isAuthenticated: Boolean(session?.access_token && user),
        login,
        loginWithGoogle,
        logout,
        clearError: () => setError(null),
    }), [error, isLoading, login, loginWithGoogle, logout, session, user]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
