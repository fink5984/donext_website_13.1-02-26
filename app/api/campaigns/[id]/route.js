import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError, buildPrismaInclude } from '@/lib/prisma/utils';

function mapCampaignToSnakeCase(campaign) {
    return {
        id: campaign.id,
        client_id: campaign.clientId,
        name: campaign.name,
        name_en: campaign.nameEn,
        logo: campaign.logo,
        is_single_day: campaign.isSingleDay,
        start_date: campaign.startDate,
        end_date: campaign.endDate,
        donation_type: campaign.donationType,
        target_amount: campaign.targetAmount,
        category_id: campaign.categoryId,
        require_payment_method: campaign.requirePaymentMethod,
        currency: campaign.currency,
        questionnaire_style_id: campaign.questionnaireStyleId,
        questionnaire_style: campaign.questionnaireStyle,
        defaultHokMonths: campaign.defaultHokMonths,
        showInvitationColumn: campaign.showInvitationColumn,
        activeFields: campaign.activeFields,
        publicScreenEnabled: campaign.publicScreenSettings?.isEnabled || false,
        campaign_type: campaign.campaignType,
        has_operators: campaign.hasOperators,
        is_event: campaign.isEvent
    };
}

export async function GET(request, { params }) {
    try {
        const include = buildPrismaInclude([
            'client',
            'category',
            'fundraisers',
            'donors',
            'questionnaireStyle',
            'publicScreenSettings'
        ]);

        const resolvedParams = await params;
        const campaignId = parseInt(resolvedParams.id);
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include
        });

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        return NextResponse.json(mapCampaignToSnakeCase(campaign));
    } catch (error) {
        console.error('Error fetching campaign:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    try {
        const { id } = await params; // Next.js 15
        const data = await request.json();
        const campaignId = parseInt(id);

        // בניית אובייקט העדכון באופן דינמי - רק שדות שהתקבלו יעודכנו
        const updateData = {};

        if (Object.prototype.hasOwnProperty.call(data, 'name')) {
            updateData.name = data.name;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'nameEn')) {
            updateData.nameEn = data.nameEn;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'logo')) {
            updateData.logo = data.logo;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'isSingleDay')) {
            updateData.isSingleDay = data.isSingleDay;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'startDate')) {
            updateData.startDate = data.startDate ? new Date(data.startDate) : null;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'endDate')) {
            updateData.endDate = data.endDate ? new Date(data.endDate) : null;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'donationType')) {
            updateData.donationType = data.donationType;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'targetAmount')) {
            updateData.targetAmount = data.targetAmount ? parseFloat(data.targetAmount) : null;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'categoryId')) {
            updateData.categoryId = data.categoryId ? parseInt(data.categoryId) : null;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'requirePaymentMethod')) {
            updateData.requirePaymentMethod = data.requirePaymentMethod;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'currency')) {
            updateData.currency = data.currency || null;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'questionnaireStyleId') || Object.prototype.hasOwnProperty.call(data, 'questionnaire_style_id')) {
            updateData.questionnaireStyleId = data.questionnaireStyleId ?? data.questionnaire_style_id ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'defaultHokMonths')) {
            updateData.defaultHokMonths = data.defaultHokMonths ? parseInt(data.defaultHokMonths) : null;
        }

        const updatedCampaign = await prisma.campaign.update({
            where: { id: campaignId },
            data: updateData,
            include: {
                client: true,
                category: true,
                questionnaireStyle: true
            }
        });

        return NextResponse.json(updatedCampaign);
    } catch (error) {
        console.error('Error updating campaign:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function PATCH(request, { params }) {
    try {
        const { id } = await params;
        const data = await request.json();
        const campaignId = parseInt(id);

        // בניית אובייקט העדכון באופן דינמי - רק שדות שהתקבלו יעודכנו
        const updateData = {};

        if (Object.prototype.hasOwnProperty.call(data, 'logo')) {
            updateData.logo = data.logo;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'name')) {
            updateData.name = data.name;
        }

        const updatedCampaign = await prisma.campaign.update({
            where: { id: campaignId },
            data: updateData,
            include: {
                client: true,
                category: true
            }
        });

        return NextResponse.json(updatedCampaign);
    } catch (error) {
        console.error('Error updating campaign:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const { id } = await params; // Next.js 15
        await prisma.campaign.delete({
            where: { id: parseInt(id) }
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Error deleting campaign:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
} 