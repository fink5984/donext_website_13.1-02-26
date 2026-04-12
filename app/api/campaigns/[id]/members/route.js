import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const campaignId = parseInt(id);

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
