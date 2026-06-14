import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Kesher HK — create hosted payment-page session.
 *
 * Kesher HK is a hosted-page provider: unlike the Nedarim Plus / Merkaz Hatzedaka
 * iframe (postMessage) model, the donor is sent to a hosted page (loaded in an
 * iframe) and returned via successurl/failedurl.
 *
 * This route reads the campaign's Kesher config, maps the donation shape to
 * Kesher's `credittype`, and returns a ready payment-page URL for the client to
 * load. Parameters are passed as a plain query string; the encrypted GetLinkToken
 * is an optional security layer (it only hides/locks the params) and is not used.
 *
 * credittype: 1=single charge, 2=installments, 3=recurring, 4=standing order (HK), 6=Bit
 */

// The real hosted payment page lives at ultra.kesherhk.info/external/paymentPage/{pageId}
// (api.kesherhk.co.il/endpoint/* is the developer documentation site, not the live API).
const KESHER_PAYMENT_PAGE_BASE = 'https://ultra.kesherhk.info/external/paymentPage';
// Kesher's hosted page has no open-ended recurring mode (empty/omitted numpayment
// renders as a single payment), so an "unlimited" monthly commitment is charged
// as a long fixed-term standing order.
const KESHER_UNLIMITED_MONTHS = 999;

/**
 * Translate the donation shape into Kesher fields, mirroring the logic used by
 * MerkazHatzedakaPayment.calculatePaymentDetails but expressed as credittype.
 */
function calculateKesherPayment({ amount, numberOfPayments, isMonthlyCampaign, paymentType }) {
  const creditTypeMulti = paymentType === 'HK' ? 4 : 2;

  // Single payment (exactly one; null means unlimited, handled below)
  if (numberOfPayments != null && numberOfPayments <= 1) {
    return { creditType: 1, total: amount, numPayment: 1 };
  }
  // Unlimited → long fixed-term standing order (still stored as unlimited in our DB).
  const months = numberOfPayments == null ? KESHER_UNLIMITED_MONTHS : numberOfPayments;
  // Multiple payments (installments credittype=2 or standing order credittype=4):
  // Kesher DIVIDES the `total` it receives by numpayment to get the per-charge
  // amount, so `total` must be the grand total.
  //   - monthly campaign: `amount` is the per-month amount → grand total = amount × months
  //   - project campaign: `amount` is already the grand total
  const total = isMonthlyCampaign ? amount * months : amount;
  return { creditType: creditTypeMulti, total, numPayment: months };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      campaignId,
      amount,
      donorName = '',
      donorFirstName = '',
      donorLastName = '',
      donorEmail = '',
      donorPhone = '',
      numberOfPayments,
      isMonthlyCampaign = false,
      source = 'BACKOFFICE',
      returnOrigin,
    } = body;

    const campaignIdNum = parseInt(campaignId);
    if (isNaN(campaignIdNum)) {
      return NextResponse.json({ success: false, message: 'Invalid campaign ID' }, { status: 400 });
    }

    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid amount' }, { status: 400 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignIdNum },
      select: {
        kesherHkPageId: true,
        kesherHkPaymentType: true,
        kesherHkCurrency: true,
      },
    });

    if (!campaign || !campaign.kesherHkPageId) {
      return NextResponse.json(
        { success: false, message: 'Kesher HK is not configured for this campaign' },
        { status: 400 }
      );
    }

    const currency = campaign.kesherHkCurrency || 1;
    const { creditType, total, numPayment } = calculateKesherPayment({
      amount: numericAmount,
      numberOfPayments: numberOfPayments === undefined ? null : numberOfPayments,
      isMonthlyCampaign,
      paymentType: campaign.kesherHkPaymentType || 'Ragil',
    });

    // Prefer the donor's first/last name exactly as stored; only fall back to
    // splitting the combined name when the separate fields are not provided
    // (splitting mis-attributes multi-word first or last names).
    const nameParts = (donorName || '').trim().split(/\s+/);
    const firstName = (donorFirstName || '').trim() || nameParts[0] || '';
    const lastName = (donorLastName || '').trim() || nameParts.slice(1).join(' ') || '';

    // The browser-supplied origin is the reliable public URL. Behind a reverse
    // proxy new URL(request.url).origin can resolve to http://localhost:3000,
    // which would point Kesher's success/failed redirects at the wrong host.
    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    const origin = returnOrigin
      || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin);
    const returnBase = `${origin}/api/payments/kesher-hk/return`;
    // addactiondata round-trips back to us on success/failure so the bridge can
    // attribute the transaction to the right campaign / provider / source.
    const addActionData = `campaignId:${campaignIdNum}|provider:KESHER_HK|source:${source}`;

    // The hosted page is GET-only (POST returns 405), so build a query-string URL.
    const query = new URLSearchParams({
      total: String(total),
      currency: String(currency),
      credittype: String(creditType),
      firstname: firstName,
      lastname: lastName,
      tel: (donorPhone || '').replace(/[^0-9]/g, ''),
      mail: donorEmail || '',
      successurl: returnBase,
      failedurl: `${returnBase}?status=failed`,
      addactiondata: addActionData,
    });

    // Always include numpayment; for unlimited it is sent empty (numpayment=).
    query.set('numpayment', numPayment == null ? '' : String(numPayment));

    const paymentUrl = `${KESHER_PAYMENT_PAGE_BASE}/${campaign.kesherHkPageId}?${query.toString()}`;
    console.log('Kesher HK payment URL →', paymentUrl);

    return NextResponse.json({ success: true, paymentUrl });
  } catch (error) {
    console.error('Error creating Kesher HK session:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}
