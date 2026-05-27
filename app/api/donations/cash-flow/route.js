import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('clientId');

        if (!clientId) {
            return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
        }

        const donations = await prisma.donation.findMany({
            where: {
                deleted_at: null,
                hasPaymentMethod: true,
                donor: {
                    active: true,
                    person: {
                        clientId: parseInt(clientId),
                    },
                },
            },
            select: {
                id: true,
                monthlyAmount: true,
                numberOfPayments: true,
                isUnlimited: true,
                hasPaymentMethod: true,
                paymentMethod: true,
                bevelPaymentsLeft: true,
                created_at: true,
                donor: {
                    select: {
                        id: true,
                        person: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                        campaign: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
        });

        const data = donations.map(d => ({
            id: d.id,
            monthlyAmount: Number(d.monthlyAmount) || 0,
            numberOfPayments: d.numberOfPayments,
            isUnlimited: d.isUnlimited,
            hasPaymentMethod: d.hasPaymentMethod,
            paymentMethod: d.paymentMethod,
            bevelPaymentsLeft: d.bevelPaymentsLeft,
            createdAt: d.created_at,
            donor: {
                id: d.donor?.id,
                firstName: d.donor?.person?.firstName || '',
                lastName: d.donor?.person?.lastName || '',
                campaignId: d.donor?.campaign?.id,
                campaignName: d.donor?.campaign?.name,
            },
        }));

        return NextResponse.json({
            success: true,
            data: { donations: data, total: data.length },
            error: null,
        });
    } catch (error) {
        console.error('Cash flow API error:', error);
        return NextResponse.json({
            success: false,
            data: null,
            error: { message: 'שגיאה בטעינת תזרים מזומנים', code: 'SERVER_ERROR' },
        }, { status: 500 });
    }
}
