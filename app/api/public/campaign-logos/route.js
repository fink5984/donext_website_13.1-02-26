import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Public endpoint - no auth required
// Returns campaign logos for the landing page organizations slider
export async function GET() {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: {
        logo: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        nameEn: true,
        logo: true,
      },
      orderBy: {
        id: 'desc',
      },
    });

    // Filter out campaigns with empty/null logos
    const withLogos = campaigns.filter(c => c.logo && c.logo.length > 10);

    return NextResponse.json({ logos: withLogos });
  } catch (error) {
    console.error('Error fetching campaign logos:', error);
    return NextResponse.json({ logos: [] });
  }
}
