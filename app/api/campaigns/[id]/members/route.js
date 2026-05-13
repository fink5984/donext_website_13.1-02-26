import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const campaignId = parseInt(id);
        const { searchParams } = new URL(request.url);
        const fundraiserIdParam = searchParams.get('fundraiserId');
        const filterFundraiserId = fundraiserIdParam ? parseInt(fundraiserIdParam) : null;

        if (!campaignId) {
            return NextResponse.json({ success: false, error: 'Campaign ID required' }, { status: 400 });
        }

        // Fetch fundraisers with their person info
        const fundraisers = await prisma.fundraiser.findMany({
            where: {
                campaignId,
                deleted_at: null
            },
            select: {
                id: true,
                userId: true,
                assignedOperatorId: true,
                person: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                }
            }
        });

        // Fetch campaign client (manager) with their user
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        firstName: true,
                        lastName: true,
                        userId: true,
                        user: {
                            select: {
                                id: true,
                                name: true,
                                role: true
                            }
                        }
                    }
                }
            }
        });

        const members = [];

        // Add campaign manager (client) 
        if (campaign?.client) {
            const client = campaign.client;
            const managerName = client.firstName && client.lastName
                ? `${client.firstName} ${client.lastName}`
                : client.name;
            members.push({
                userId: client.userId,
                name: managerName,
                role: 'manager',
                roleLabel: 'מנהל'
            });
        }

        // If filtering for a specific fundraiser — return only manager + that fundraiser + their operator
        if (filterFundraiserId) {
            const targetFr = fundraisers.find(fr => fr.id === filterFundraiserId);
            if (targetFr) {
                const targetName = targetFr.person
                    ? `${targetFr.person.firstName || ''} ${targetFr.person.lastName || ''}`.trim()
                    : (targetFr.user?.name || `מתרים #${targetFr.id}`);
                members.push({
                    userId: targetFr.userId,
                    fundraiserId: targetFr.id,
                    name: targetName || `מתרים #${targetFr.id}`,
                    role: 'fundraiser',
                    roleLabel: 'מתרים'
                });

                // Add assigned operator if exists
                if (targetFr.assignedOperatorId) {
                    const operatorFr = fundraisers.find(fr => fr.id === targetFr.assignedOperatorId);
                    if (operatorFr) {
                        const opName = operatorFr.person
                            ? `${operatorFr.person.firstName || ''} ${operatorFr.person.lastName || ''}`.trim()
                            : (operatorFr.user?.name || `מפעיל #${operatorFr.id}`);
                        members.push({
                            userId: operatorFr.userId,
                            fundraiserId: operatorFr.id,
                            name: opName || `מפעיל #${operatorFr.id}`,
                            role: 'operator',
                            roleLabel: 'מפעיל'
                        });
                    }
                }
            }
            return NextResponse.json({ success: true, data: members });
        }

        // Add fundraisers
        for (const fr of fundraisers) {
            const name = fr.person
                ? `${fr.person.firstName || ''} ${fr.person.lastName || ''}`.trim()
                : (fr.user?.name || `מתרים #${fr.id}`);
            members.push({
                userId: fr.userId,
                fundraiserId: fr.id,
                name: name || `מתרים #${fr.id}`,
                role: 'fundraiser',
                roleLabel: 'מתרים'
            });
        }

        return NextResponse.json({
            success: true,
            data: members
        });

    } catch (error) {
        console.error('Error fetching campaign members:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
