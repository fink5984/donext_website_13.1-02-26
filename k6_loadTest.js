import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js';

const BASE_URL = __ENV.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const PASSWORD = __ENV.LOGIN_PASSWORD || '123456';
const CONCURRENT_USERS = Number(__ENV.CONCURRENT_USERS || 100);

// קריאה חד-פעמית של רשימת מיילים מקובץ (שורה לכל מייל)
const EMAILS = new SharedArray('emails', () => {
  try {
    const raw = open('./emails.txt');
    return raw
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  } catch (e) {
    return [];
  }
});

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<800'],
    checks: ['rate>0.99'],
  },
  scenarios: {
    loginTest: {
      executor: 'per-vu-iterations',
      vus: CONCURRENT_USERS,
      iterations: 1,
      maxDuration: '5m',
      exec: 'loginScenario',
    },
  },
};

function getEmailForVu(vuNumber) {
  if (EMAILS.length > 0) {
    return EMAILS[(vuNumber - 1) % EMAILS.length];
  }
  const padded = String(vuNumber).padStart(2, '0');
  return `user${padded}@example.com`;
}

export function loginScenario() {
  const email = getEmailForVu(__VU);
  const payload = JSON.stringify({ email, password: PASSWORD });
  const params = { headers: { 'Content-Type': 'application/json' } };

  const res = http.post(`${BASE_URL}/api/login`, payload, params);
  check(res, {
    'status 200 or 401': r => [200, 401].includes(r.status),
  });
  sleep(1);
}

export function handleSummary(data) {
  const avg = data.metrics && data.metrics.http_req_duration && data.metrics.http_req_duration.values
    ? data.metrics.http_req_duration.values.avg
    : 0;
  const line = `ממוצע זמן תגובה (ms): ${Number(avg || 0).toFixed(2)}\n`;
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }) + `\n${line}`,
  };
}