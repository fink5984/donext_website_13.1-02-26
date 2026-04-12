import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Public endpoint - no auth required
// Returns aggregated stats for the landing page
export async function GET() {
  try {
    // Count active organizations (clients)
    const clientsCount = await prisma.client.count();
    
    // Count total campaigns
    const campaignsCount = await prisma.campaign.count();
    
    // Count total donations
    const donationsCount = await prisma.donation.count();
    
    // Sum total amount raised (monthlyAmount is the donation amount field)
    const totalRaised = await prisma.donation.aggregate({
      _sum: {
        monthlyAmount: true,
      },
    });
    
    // Format the raised amount
    const raisedAmount = Number(totalRaised._sum.monthlyAmount) || 0;
    let raisedFormatted;
    if (raisedAmount >= 1000000) {
      raisedFormatted = `₪${(raisedAmount / 1000000).toFixed(1)}M`;
    } else if (raisedAmount >= 1000) {
      raisedFormatted = `₪${Math.round(raisedAmount / 1000)}K`;
    } else {
      raisedFormatted = `₪${raisedAmount}`;
    }

    return NextResponse.json({
      success: true,
      stats: {
        organizations: clientsCount,
        campaigns: campaignsCount,
        donations: donationsCount,
        raised: raisedFormatted,
        raisedRaw: raisedAmount,
      },
    });
  } catch (error) {
    console.error('Error fetching public stats:', error);
    return NextResponse.json({
      success: false,
      stats: {
        organizations: 0,
        campaigns: 0,
        donations: 0,
        raised: '₪0',
        raisedRaw: 0,
      },
    });
  }
}
