import { NextResponse } from 'next/server';

/**
 * Kesher HK — return bridge.
 *
 * Kesher's hosted page redirects the donor's browser here (inside our iframe)
 * on success (`successurl`) or failure (`failedurl?status=failed`). This route
 * renders a minimal HTML page that relays the outcome to the parent window via
 * postMessage, so KesherHkPayment can resolve/reject the payment promise and
 * keep the same inline UX as the Nedarim Plus / Merkaz Hatzedaka providers.
 *
 * Success params (from Kesher): transactionNumber, ref, total, currency,
 *   obligationRef (standing orders), receiptLink, docNumber, adddata
 * Failure params: transactionNumber, errorCode, errorText, adddata
 */

function buildBridgeHtml(result) {
  // result is serialized into the page and posted to the parent frame.
  const payload = JSON.stringify({ provider: 'KESHER_HK', ...result });
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><title>מעבד תשלום…</title>
<style>body{font-family:system-ui,Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#555}</style>
</head>
<body>
<div>${result.status === 'success' ? 'התשלום התקבל, מסיים…' : 'התשלום לא הושלם'}</div>
<script>
  (function () {
    var msg = ${payload};
    try { if (window.parent && window.parent !== window) { window.parent.postMessage(msg, '*'); } } catch (e) {}
    try { if (window.opener) { window.opener.postMessage(msg, '*'); } } catch (e) {}
  })();
</script>
</body>
</html>`;
}

function extractResult(params) {
  const get = (k) => params.get(k) ?? '';
  const failedFlag = get('status') === 'failed';
  const errorCode = get('errorCode');
  const errorText = get('errorText');
  const status = failedFlag || errorCode || errorText ? 'failed' : 'success';

  return {
    status,
    transactionNumber: get('transactionNumber'),
    ref: get('ref'),
    obligationRef: get('obligationRef'),
    total: get('total'),
    currency: get('currency'),
    receiptLink: get('receiptLink'),
    docNumber: get('docNumber'),
    addData: get('adddata') || get('addactiondata'),
    errorCode,
    errorText,
  };
}

function htmlResponse(result) {
  return new NextResponse(buildBridgeHtml(result), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  return htmlResponse(extractResult(searchParams));
}

export async function POST(request) {
  // Some hosted-page configurations POST form data back instead of redirecting.
  let params;
  try {
    const formData = await request.formData();
    params = new URLSearchParams();
    for (const [key, value] of formData.entries()) params.set(key, String(value));
  } catch {
    params = new URL(request.url).searchParams;
  }
  return htmlResponse(extractResult(params));
}
