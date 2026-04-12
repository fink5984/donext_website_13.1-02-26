import { prisma } from '@/lib/prisma/client';
import { NextResponse } from 'next/server';

// GET /api/ranks
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    const ranks = await prisma.rank.findMany({
      where: {
        campaignId: parseInt(campaignId),
      },
    });

    // Convert Decimal amounts to numbers
    const ranksWithNumbers = ranks.map(rank => ({
      ...rank,
      amount: rank.amount ? Number(rank.amount) : null
    }));

    return NextResponse.json({ data: ranksWithNumbers, total: ranksWithNumbers.length });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch ranks' }, { status: 500 });
  }
}

// POST /api/ranks
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, campaignId, amount, isPremium } = body;

    const newRank = await prisma.rank.create({
      data: {
        name,
        campaignId: parseInt(campaignId),
        amount: amount !== undefined && amount !== null && amount !== '' ? parseFloat(amount) : null,
        isPremium: Boolean(isPremium),
      },
    });

    // Convert Decimal amount to number
    const rankWithNumber = {
      ...newRank,
      amount: newRank.amount ? Number(newRank.amount) : null
    };

    return NextResponse.json(rankWithNumber, { status: 201 });
  } catch (error) {
    console.error('Error creating rank:', error);
    return NextResponse.json({ error: 'Failed to create rank' }, { status: 500 });
  }
}
