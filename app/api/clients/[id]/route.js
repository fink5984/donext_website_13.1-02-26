import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

function mapClientToSnakeCase(client) {
    return {
        id: client.id,
        name: client.name,
        organization_name: client.organizationName,
        amuta_number: client.amutaNumber,
        subscription_plan: client.subscriptionPlan,
        first_name: client.firstName,
        last_name: client.lastName,
        phone_landline: client.phoneLandline,
        email: client.email,
        title_before: client.titleBefore,
        title_after: client.titleAfter,
        main_mobile: client.mainMobile,
        secondary_mobile: client.secondaryMobile,
        street_id: client.streetId,
        house_number: client.houseNumber,
        city_id: client.cityId
    };
}

export async function GET(request, { params }) {
    try {
        const resolvedParams = await params;
        if (!resolvedParams.id) {
            return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
        }

        const client = await prisma.client.findUnique({
            where: { id: parseInt(resolvedParams.id) }
        });

        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        return NextResponse.json(mapClientToSnakeCase(client));
    } catch (error) {
        console.error('Error fetching client:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    try {
        const { id } = await params; // Next.js 15
        const data = await request.json();
        const clientId = parseInt(id);

        const updatedClient = await prisma.client.update({
            where: { id: clientId },
            data: {
                name: data.name,
                organizationName: data.organizationName,
                amutaNumber: data.amutaNumber,
                subscriptionPlan: data.subscriptionPlan,
                firstName: data.firstName,
                lastName: data.lastName,
                phoneLandline: data.phoneLandline,
                email: data.email,
                titleBefore: data.titleBefore,
                titleAfter: data.titleAfter,
                mainMobile: data.mainMobile,
                secondaryMobile: data.secondaryMobile,
                streetId: data.streetId ? parseInt(data.streetId) : null,
                houseNumber: data.houseNumber != null ? String(data.houseNumber).trim() : null,
                cityId: data.cityId ? parseInt(data.cityId) : null
            },
            include: {
                city: true,
                street: true
            }
        });

        return NextResponse.json(updatedClient);
    } catch (error) {
        console.error('Error updating client:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const { id } = await params; // Next.js 15
        await prisma.client.delete({
            where: { id: parseInt(id) }
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Error deleting client:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
} 