import { prisma } from '@/lib/prisma/client';
import { NextResponse } from 'next/server';

// GET /api/operator-ranks
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    const ranks = await prisma.operatorRank.findMany({
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
    console.error('Error fetching operator ranks:', error);
    return NextResponse.json({ error: 'Failed to fetch operator ranks' }, { status: 500 });
  }
}

// POST /api/operator-ranks
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, campaignId, amount } = body;

    const newRank = await prisma.operatorRank.create({
      data: {
        name,
        campaignId: parseInt(campaignId),
        amount: amount !== undefined && amount !== null && amount !== '' ? parseFloat(amount) : null,
      },
    });

    // Convert Decimal amount to number
    const rankWithNumber = {
      ...newRank,
      amount: newRank.amount ? Number(newRank.amount) : null
    };

    return NextResponse.json(rankWithNumber, { status: 201 });
  } catch (error) {
    console.error('Error creating operator rank:', error);
    return NextResponse.json({ error: 'Failed to create operator rank' }, { status: 500 });
  }
}
