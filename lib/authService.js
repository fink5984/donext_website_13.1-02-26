import { loadSession, isTokenValid, parseJwt } from './auth';

export function getToken() {
  const session = loadSession();
  return session?.token || null;
}

export function getRolesFromToken(token) {
  if (!token) return [];
  const payload = parseJwt(token);
  return payload?.roles || [];
}

export function getCurrentRoleFromToken(token) {
  if (!token) return null;
  const payload = parseJwt(token);
  // Try role first, then first role from roles array
  return payload?.role || (payload?.roles?.[0]) || null;
}

export function getRoles() {
  const token = getToken();
  return getRolesFromToken(token);
}

export function getCurrentRole() {
  const token = getToken();
  return getCurrentRoleFromToken(token);
}

// Backward compatibility
export function getRoleFromToken(token) {
  return getCurrentRoleFromToken(token);
}

export function getRole() {
  return getCurrentRole();
}

export function isAuthenticated() {
  const token = getToken();
  return Boolean(token && isTokenValid(token));
}

export function getUserType({ clientId, fundraiserId }) {
  if (clientId != null) return 'manager';
  if (fundraiserId != null) return 'fundraiser';
  return null;
}

export function hasRole(roleName) {
  const roles = getRoles();
  return roles.includes(roleName);
}

export function isAdmin() {
  return hasRole('admin') || getCurrentRole() === 'admin';
}

export function isManager() {
  return hasRole('manager') || getCurrentRole() === 'manager';
}

export function isFundraiser() {
  return hasRole('fundraiser') || getCurrentRole() === 'fundraiser';
}

export function isOperator() {
  return getCurrentRole() === 'operator';
}

export function getRedirectPathByRole(role, { hasCampaigns } = {}) {
  if (role === 'manager' || role === 'admin' || role === 'operator') {
    return hasCampaigns ? '/donors' : '/new';
  }
  if (role === 'fundraiser') return '/myDonors';
  return '/login';
}


