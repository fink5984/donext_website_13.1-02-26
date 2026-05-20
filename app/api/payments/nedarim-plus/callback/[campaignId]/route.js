import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Nedarim Plus / Merkaz Hatzedaka Callback Endpoint (per-campaign)
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

    // Nedarim Plus JSON fields
    const {
      Status,
      ID,               // Nedarim transaction ID
      ClientName,       // Full name (not FirstName/LastName)
      Phone,
      Mail,
      Amount,
      Tashloumim,       // Number of payments (field name from Nedarim)
      TransactionType,
      Param1,
      Comments,
    } = callbackData;

    const isSuccess = Status === 'OK' || Status === 'Success';

    if (!isSuccess) {
      console.log('Nedarim Plus callback - payment not successful, status:', Status);
      return new NextResponse('OK', { status: 200 });
    }

    console.log(`✅ Nedarim Plus payment successful for campaign ${campaignId}`);
    console.log(`   Transaction ID: ${ID}, Amount: ${Amount}, Months: ${Tashloumim}`);

    const nedarimId = ID ? parseInt(ID) : null;

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

    // Try to find the donor by phone in this campaign
    const phoneDigits = (Phone || '').replace(/\D/g, '');
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

    if (!donorId) {
      console.log('Donor not found by phone:', Phone, '— donation will be created by frontend');
      return new NextResponse('OK', { status: 200 });
    }

    // Create the donation record
    const numberOfPayments = Tashloumim ? parseInt(Tashloumim) : 1;
    const isUnlimited = !Tashloumim || Tashloumim === '0';

    await prisma.donation.create({
      data: {
        donorId,
        monthlyAmount: parseFloat(Amount),
        numberOfPayments: isUnlimited ? null : numberOfPayments,
        isUnlimited,
        hasPaymentMethod: true,
        paymentMethod: 'MERKAZ_HATZEDAKA',
        externalDonationId: nedarimId,
        note: Comments || null,
        createdInSystem: 'LANDING_PAGE',
      },
    });

    console.log('✅ Donation created from callback for donor:', donorId);

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
