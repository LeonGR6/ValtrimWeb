export const PURCHASE_ORDER_VIEWER_ROLE = 'viewer';

const normalizeRole = (role) => String(role ?? '').trim().toLowerCase();

export function normalizeAppRoles(appMetadata = {}) {
  const rawRoles = appMetadata?.roles ?? appMetadata?.role;
  const roles = Array.isArray(rawRoles) ? rawRoles : [rawRoles];

  return [...new Set(roles.map(normalizeRole).filter(Boolean))];
}

export function isPurchaseOrderReadOnlyUser(user) {
  const roles = Array.isArray(user?.roles)
    ? user.roles.map(normalizeRole).filter(Boolean)
    : normalizeAppRoles(user?.app_metadata ?? user?.raw?.app_metadata);

  return roles.includes(PURCHASE_ORDER_VIEWER_ROLE);
}

export function canModifyPurchaseOrders(user) {
  return Boolean(user) && !isPurchaseOrderReadOnlyUser(user);
}

export function getDefaultAuthenticatedPath(user) {
  return isPurchaseOrderReadOnlyUser(user) ? '/order-comparison' : '/dashboard';
}
