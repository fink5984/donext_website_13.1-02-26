import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Nedarim Plus Callback Endpoint (per-campaign)
 * 
 * This endpoint receives transaction results from Nedarim Plus
 * The callback is called from Nedarim's servers after payment processing
 * 
 * Expected IP: 18.194.219.73 (Nedarim Plus server)
 */

// Nedarim Plus server IP - for verification
const NEDARIM_SERVER_IP = '18.194.219.73';

export async function POST(request, { params }) {
  try {
    const { campaignId: campaignIdParam } = await params;
    const campaignId = parseInt(campaignIdParam);
    
    // Get client IP for verification
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIP = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    
    console.log('Nedarim Plus callback received for campaign:', campaignId);
    console.log('Client IP:', clientIP);
    
    // Parse the callback data
    const formData = await request.formData();
    const callbackData = {};
    
    for (const [key, value] of formData.entries()) {
      callbackData[key] = value;
    }
    
    console.log('Callback data:', callbackData);
    
    // Extract transaction details from callback
    const {
      Status,           // Transaction status
      TransactionId,    // Nedarim transaction ID
      ErrMsg,           // Error message if failed
      Amount,           // Payment amount
      Tashlumim,        // Number of payments
      FirstName,
      LastName,
      Mail,
      Phone,
      Param1,           // Our custom parameter (campaignId:X)
      Param2,
      Groupe
    } = callbackData;
    
    // Verify campaignId matches Param1 if provided
    if (Param1) {
      const extractedCampaignId = Param1.includes(':') 
        ? parseInt(Param1.split(':')[1]) 
        : parseInt(Param1);
      
      if (extractedCampaignId !== campaignId) {
        console.warn('Campaign ID mismatch:', { url: campaignId, param1: extractedCampaignId });
      }
    }
    
    // Check if transaction was successful
    const isSuccess = Status === 'OK' || Status === 'Success';
    
    if (isSuccess) {
      console.log(`✅ Nedarim Plus payment successful for campaign ${campaignId}`);
      console.log(`   Transaction ID: ${TransactionId}`);
      console.log(`   Amount: ${Amount}, Payments: ${Tashlumim}`);
      
      // Here you would typically:
      // 1. Find or create the donor in your database
      // 2. Create a donation record
      // 3. Update campaign statistics
      
      // Example: Create donation record
      // await prisma.donation.create({
      //   data: {
      //     campaignId: campaignId,
      //     amount: parseFloat(Amount),
      //     paymentMethod: 'NEDARIM_PLUS',
      //     transactionId: TransactionId,
      //     status: 'COMPLETED',
      //     // ... other fields
      //   }
      // });
      
    } else {
      console.log(`❌ Nedarim Plus payment failed for campaign ${campaignId}`);
      console.log(`   Error: ${ErrMsg}`);
    }
    
    // Nedarim Plus expects a simple OK response
    return new NextResponse('OK', { status: 200 });
    
  } catch (error) {
    console.error('Error processing Nedarim Plus callback:', error);
    return new NextResponse('Error', { status: 500 });
  }
}

// Also support GET for testing/verification
export async function GET(request, { params }) {
  const { campaignId } = await params;
  return NextResponse.json({
    status: 'active',
    campaign: campaignId,
    message: 'Nedarim Plus callback endpoint is ready'
  });
}
