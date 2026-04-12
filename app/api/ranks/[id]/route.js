import { prisma } from '@/lib/prisma/client';
import { NextResponse } from 'next/server';

// PUT /api/ranks/[id]
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, amount, isPremium } = body;

    const updatedRank = await prisma.rank.update({
      where: { id: parseInt(id) },
      data: {
        name,
        amount: amount !== undefined && amount !== null && amount !== '' ? parseFloat(amount) : null,
        isPremium: Boolean(isPremium),
      },
    });

    // Convert Decimal amount to number
    const rankWithNumber = {
      ...updatedRank,
      amount: updatedRank.amount ? Number(updatedRank.amount) : null
    };

    return NextResponse.json(rankWithNumber);
  } catch (error) {
    console.error('Error updating rank:', error);
    return NextResponse.json({ error: 'Failed to update rank' }, { status: 500 });
  }
}

// DELETE /api/ranks/[id]
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    await prisma.rank.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: 'Rank deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete rank' }, { status: 500 });
  }
}
