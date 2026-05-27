// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
/**
 * Authentication API service
 * Handles all communication with the backend auth endpoints.
 *
 * The ValtrimAPI returns errors in the shape:
 *   { error: { status, code, message, details? } }
 * `ApiError` exposes those fields so the UI can surface them.
 */

import i18n from '../i18n.js';

function normalizeConfigValue(rawValue) {
    const value = String(rawValue ?? '').trim();
    if (!value) return '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1).trim();
    }
    return value;
}

const envApiBase = normalizeConfigValue(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '');
const browserHost = typeof window !== 'undefined' ? window.location.hostname : '';
const isBrowserLocalhost = browserHost === 'localhost' || browserHost === '127.0.0.1';
const pointsToLocalhost = /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(envApiBase);
const safeApiBase = !isBrowserLocalhost && pointsToLocalhost ? '' : envApiBase;
const API_BASE = safeApiBase.replace(/\/$/, '');

export class ApiError extends Error {
    constructor({ message, status, code, details }) {
        super(message || i18n.t('api.auth.requestFailed'));
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

function ensureValidAuthSessionPayload(payload, actionLabel) {
    const hasUser = payload && typeof payload === 'object' && payload.user && typeof payload.user === 'object';
    const hasAccessToken = typeof payload?.accessToken === 'string' && payload.accessToken.trim().length > 0;
    const hasAccessExpiry = typeof payload?.accessTokenExpiresAt === 'string' && payload.accessTokenExpiresAt.trim().length > 0;

    if (hasUser && hasAccessToken && hasAccessExpiry) {
        return payload;
    }

    throw new ApiError({
        message: i18n.t('api.auth.invalidAuthResponse', { action: actionLabel }),
        status: 502,
        code: 'invalid_auth_response',
        details: {
            apiBase: API_BASE || '(same-origin)',
            action: actionLabel,
        },
    });
}

async function request(path, { method = 'GET', body, accessToken, fallbackMessage } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch (err) {
        // Network / CORS failure
        throw new ApiError({
            message: i18n.t('api.auth.networkError'),
            status: 0,
            code: 'network_error',
            details: err?.message,
        });
    }

    let payload = null;
    try {
        payload = await response.json();
    } catch {
        if (response.ok) {
            throw new ApiError({
                message: i18n.t('api.auth.invalidResponseFormat'),
                status: response.status,
                code: 'invalid_response_format',
                details: {
                    path,
                    apiBase: API_BASE || '(same-origin)',
                    contentType: response.headers.get('content-type') || null,
                },
            });
        }
    }

    if (!response.ok) {
        const apiError = payload?.error || {};
        throw new ApiError({
            message: apiError.message || fallbackMessage || i18n.t('api.auth.requestError'),
            status: apiError.status || response.status,
            code: apiError.code,
            details: apiError.details,
        });
    }

    return payload ?? {};
}

class AuthApiService {
    register({ email, fullName, password, deviceName = null }) {
        return request('/api/auth/register', {
            method: 'POST',
            body: { email, fullName, password, deviceName },
            fallbackMessage: i18n.t('api.auth.couldNotCreateAccount'),
        }).then((payload) => ensureValidAuthSessionPayload(payload, i18n.t('api.auth.actions.register')));
    }

    login({ email, password, deviceName = null }) {
        return request('/api/auth/login', {
            method: 'POST',
            body: { email, password, deviceName },
            fallbackMessage: i18n.t('api.auth.couldNotSignIn'),
        }).then((payload) => ensureValidAuthSessionPayload(payload, i18n.t('api.auth.actions.signIn')));
    }
}

export const authApi = new AuthApiService();
