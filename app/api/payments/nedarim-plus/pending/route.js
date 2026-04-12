import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { pendingTransactions } from '@/lib/services/nedarimPendingStore';

// GET - Check if a transaction was completed
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionRef = searchParams.get('ref');
    
    if (!transactionRef) {
      return NextResponse.json({ error: 'Missing ref parameter' }, { status: 400 });
    }
    
    // Check if we have a completed transaction for this reference
    const transaction = pendingTransactions.get(transactionRef);
    
    if (!transaction) {
      return NextResponse.json({ 
        status: 'pending',
        message: 'Transaction not yet confirmed' 
      });
    }
    
    if (transaction.status === 'completed') {
      // Clean up after returning
      pendingTransactions.delete(transactionRef);
      return NextResponse.json({ 
        status: 'completed',
        transactionId: transaction.transactionId,
        confirmation: transaction.confirmation,
        amount: transaction.amount
      });
    }
    
    if (transaction.status === 'error') {
      pendingTransactions.delete(transactionRef);
      return NextResponse.json({ 
        status: 'error',
        message: transaction.message 
      });
    }
    
    return NextResponse.json({ status: 'pending' });
    
  } catch (error) {
    console.error('Error checking pending transaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Register a new pending transaction (called by frontend before sending to iframe)
export async function POST(request) {
  try {
    const body = await request.json();
    const { transactionRef, campaignId, amount, donorInfo } = body;
    
    if (!transactionRef || !campaignId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Store the pending transaction with 10 minute expiration
    pendingTransactions.set(transactionRef, {
      status: 'pending',
      campaignId,
      amount,
      donorInfo,
      createdAt: Date.now()
    });
    
    // Set up cleanup after 10 minutes
    setTimeout(() => {
      pendingTransactions.delete(transactionRef);
    }, 10 * 60 * 1000);
    
    return NextResponse.json({ 
      success: true,
      message: 'Transaction registered' 
    });
    
  } catch (error) {
    console.error('Error registering pending transaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
