import { prisma } from '@/lib/prisma/client';
import { NextResponse } from 'next/server';

// PUT /api/operator-ranks/[id]
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, amount } = body;

    const updatedRank = await prisma.operatorRank.update({
      where: { id: parseInt(id) },
      data: {
        name,
        amount: amount !== undefined && amount !== null && amount !== '' ? parseFloat(amount) : null,
      },
    });

    // Convert Decimal amount to number
    const rankWithNumber = {
      ...updatedRank,
      amount: updatedRank.amount ? Number(updatedRank.amount) : null
    };

    return NextResponse.json(rankWithNumber);
  } catch (error) {
    console.error('Error updating operator rank:', error);
    return NextResponse.json({ error: 'Failed to update operator rank' }, { status: 500 });
  }
}

// DELETE /api/operator-ranks/[id]
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    await prisma.operatorRank.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: 'Operator rank deleted successfully' });
  } catch (error) {
    console.error('Error deleting operator rank:', error);
    return NextResponse.json({ error: 'Failed to delete operator rank' }, { status: 500 });
  }
}
