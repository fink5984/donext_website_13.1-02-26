import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Nedarim Plus callback IP address for verification
const NEDARIM_PLUS_IP = '18.194.219.73';

export async function POST(request) {
    try {
        // Get the IP address from request
        const forwardedFor = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const clientIp = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

        console.log('Nedarim Plus callback received from IP:', clientIp);

        // In production, verify the IP address
        // if (process.env.NODE_ENV === 'production' && clientIp !== NEDARIM_PLUS_IP) {
        //     console.warn('Callback from unauthorized IP:', clientIp);
        //     return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
        // }

        const body = await request.json();
        console.log('Nedarim Plus callback data:', body);

        // Extract transaction details from callback
        const {
            TransactionId,
            Id,
            Status,
            Amount,
            Mosad,
            FirstName,
            LastName,
            Phone,
            Mail,
            PaymentType,
            Tashlumim,
            Param1,
            Param2,
            ErrorMessage,
            AuthCode
        } = body;

        // Parse campaign ID from Param1 if available
        let campaignId = null;
        if (Param1 && Param1.includes('campaignId:')) {
            const match = Param1.match(/campaignId:(\d+)/);
            if (match) {
                campaignId = parseInt(match[1], 10);
            }
        }

        // Log the callback for debugging
        console.log('Parsed callback data:', {
            transactionId: TransactionId || Id,
            status: Status,
            amount: Amount,
            mosad: Mosad,
            campaignId,
            donorName: `${FirstName || ''} ${LastName || ''}`.trim(),
            paymentType: PaymentType,
            tashlumim: Tashlumim
        });

        // If this is an error response, log it
        if (Status !== 'OK' && Status !== 'Success') {
            console.error('Nedarim Plus transaction failed:', ErrorMessage);
            return NextResponse.json({ 
                success: false, 
                message: 'Transaction failed',
                error: ErrorMessage
            });
        }

        // Here you could update the donation status in the database
        // if you have a way to match it (e.g., via Param1 or Param2)

        // Return success response to Nedarim Plus
        return NextResponse.json({ 
            success: true, 
            message: 'Callback received',
            transactionId: TransactionId || Id
        });

    } catch (error) {
        console.error('Error processing Nedarim Plus callback:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}

// Also support GET for testing
export async function GET(request) {
    return NextResponse.json({ 
        status: 'OK',
        message: 'Nedarim Plus callback endpoint is active'
    });
}
