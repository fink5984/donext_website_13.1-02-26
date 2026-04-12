export function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
}

export function isTokenValid(token) {
  const p = token ? parseJwt(token) : null;
  if (!p) return false;
  const now = Date.now() / 1000;
  return !p.exp || p.exp > now;
}

const SESSION_KEY = 'impel:session';

export function loadSession() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

export function saveSession(sess) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

// פונקציה עזר לקבלת campaignId מ-request headers
export function getCampaignId(request) {
  return parseInt(request.headers.get('x-campaign-id'));
}

// פונקציה עזר לקבלת operatorId מ-request headers
export function getOperatorId(request) {
  const val = request.headers.get('x-operator-id');
  return val ? parseInt(val) : null;
}

// פונקציה עזר לקבלת התפקיד מ-request headers
export function getUserRole(request) {
  return request.headers.get('x-user-role') || null;
}

// פונקציה לקבלת נתוני המשתמש הנוכחי מה-token
export function getCurrentUserFromRequest(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const payload = parseJwt(token);
    
    if (!payload || !isTokenValid(token)) {
      return null;
    }
    
    return {
      userId: payload.userId,
      role: payload.role,
      email: payload.email
    };
  } catch (error) {
    console.error('Error getting current user from request:', error);
    return null;
  }
}
