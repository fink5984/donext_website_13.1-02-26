import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Nedarim Plus / Merkaz Hatzedaka Callback Endpoint (per-campaign) v2
 * 
 * Nedarim Plus sends JSON (application/json), not form data.
 * Expected IP: 18.194.219.73 (Nedarim Plus server)
 */

export async function POST(request, { params }) {
  try {
    const { campaignId: campaignIdParam } = await params;
    const campaignId = parseInt(campaignIdParam);

    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIP = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

    console.log('Nedarim Plus callback received for campaign:', campaignId);
    console.log('Client IP:', clientIP);

    // Nedarim Plus sends JSON — parse accordingly, with fallback to formData/text
    let callbackData = {};
    const contentType = request.headers.get('content-type') || '';
    try {
      if (contentType.includes('application/json')) {
        callbackData = await request.json();
      } else if (contentType.includes('form')) {
        const formData = await request.formData();
        for (const [key, value] of formData.entries()) {
          callbackData[key] = value;
        }
      } else {
        const text = await request.text();
        try {
          callbackData = JSON.parse(text);
        } catch {
          console.log('Callback raw text:', text);
        }
      }
    } catch (parseError) {
      console.error('Error parsing callback data:', parseError);
    }

    console.log('Callback data:', callbackData);

    // Nedarim Plus / Merkaz Hatzedaka callback fields.
    // Field names vary by transaction type and platform version — handle all known variants.
    const {
      Status,
      // Transaction ID: HK uses 'ID', Ragil uses 'TransactionId', older versions use 'Id'/'NedarimId'
      ID, TransactionId, Id, NedarimId,
      // Donor name: some versions send FirstName+LastName, others ClientName or FullName
      FirstName, LastName, ClientName, FullName,
      Phone,
      Mail, Email,
      Amount,
      // Installments: Nedarim sends 'Tashlumim', some older integrations 'Tashloumim', HK uses 'Month'
      Tashlumim, Tashloumim, Month,
      TransactionType,
      Param1,
      Param2,
      Comments,
    } = callbackData;

    const isSuccess = Status === 'OK' || Status === 'Success';

    if (!isSuccess) {
      console.log('Nedarim callback - payment not successful, status:', Status);
      return new NextResponse('OK', { status: 200 });
    }

    // Determine which payment provider sent this callback via Param2
    // NedarimPlusPayment.js sends 'provider:NEDARIM_PLUS'
    // MerkazHatzedakaPayment.js sends 'provider:MERKAZ_HATZEDAKA'
    let resolvedPaymentMethod = 'NEDARIM_PLUS'; // safe default
    if (Param2 && Param2.includes('provider:MERKAZ_HATZEDAKA')) {
      resolvedPaymentMethod = 'MERKAZ_HATZEDAKA';
    } else if (Param2 && Param2.includes('provider:NEDARIM_PLUS')) {
      resolvedPaymentMethod = 'NEDARIM_PLUS';
    }

    // Resolve transaction ID across all known field name variants
    const rawTransactionId = ID || TransactionId || Id || NedarimId;

    // Resolve donor contact fields
    const resolvedPhone = Phone || '';
    const resolvedMail = Mail || Email || '';

    console.log(`✅ Nedarim callback successful for campaign ${campaignId} (${resolvedPaymentMethod})`);
    console.log(`   Transaction ID: ${rawTransactionId}, Amount: ${Amount}, Month/Tashlumim: ${Tashlumim ?? Tashloumim ?? Month}`);  

    const nedarimId = rawTransactionId ? parseInt(rawTransactionId) : null;

    // Check if donation already exists for this Nedarim transaction
    if (nedarimId) {
      const existingDonation = await prisma.donation.findFirst({
        where: {
          externalDonationId: nedarimId,
          donor: { campaignId },
        },
      });
      if (existingDonation) {
        console.log('Donation already exists for Nedarim transaction:', nedarimId);
        return new NextResponse('OK', { status: 200 });
      }
    }

    // Try to find the donor by phone first; if no match, fall back to email.
    const phoneDigits = resolvedPhone.replace(/\D/g, '');
    const normalizedMail = resolvedMail.trim().toLowerCase();
    let donorId = null;

    if (phoneDigits.length >= 9) {
      const donor = await prisma.donor.findFirst({
        where: {
          campaignId,
          person: {
            mainMobile: { endsWith: phoneDigits.slice(-9) },
          },
        },
      });
      if (donor) donorId = donor.id;
    }

    if (!donorId && normalizedMail) {
      const donor = await prisma.donor.findFirst({
        where: {
          campaignId,
          person: {
            email: { equals: normalizedMail, mode: 'insensitive' },
          },
        },
      });
      if (donor) donorId = donor.id;
    }

    if (!donorId) {
      console.log('Donor not found by phone or email:', resolvedPhone, resolvedMail, '— donation will be created by frontend');
      return new NextResponse('OK', { status: 200 });
    }

    // Create the donation record
    const resolvedTashlumim = Tashlumim ?? Tashloumim ?? Month;
    const numberOfPayments = resolvedTashlumim ? parseInt(resolvedTashlumim) : 1;
    const isUnlimited = !resolvedTashlumim || resolvedTashlumim === '0';

    await prisma.donation.create({
      data: {
        donorId,
        monthlyAmount: parseFloat(Amount),
        numberOfPayments: isUnlimited ? null : numberOfPayments,
        isUnlimited,
        hasPaymentMethod: true,
        paymentMethod: resolvedPaymentMethod,
        externalDonationId: nedarimId,
        note: Comments || null,
        createdInSystem: 'LANDING_PAGE',
      },
    });

    console.log(`✅ Donation created from callback for donor ${donorId} via ${resolvedPaymentMethod}`);

  } catch (error) {
    console.error('Error processing Nedarim Plus callback:', error);
  }

  // Always return OK so Nedarim Plus stops retrying
  return new NextResponse('OK', { status: 200 });
}

export async function GET(request, { params }) {
  const { campaignId } = await params;
  return NextResponse.json({
    status: 'active',
    campaign: campaignId,
    message: 'Nedarim Plus callback endpoint is ready',
  });
}
