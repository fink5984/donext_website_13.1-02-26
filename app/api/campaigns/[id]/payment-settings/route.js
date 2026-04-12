import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';

export async function GET(request, context) {
    try {
        const params = await context.params;
        const { id } = params;
        const headerCampaignId = getCampaignId(request);
        const campaignId = !isNaN(headerCampaignId) ? headerCampaignId : parseInt(id);
        
        console.log('GET payment-settings - campaignId:', campaignId, 'type:', typeof campaignId);
        
        if (isNaN(campaignId)) {
            console.log('Invalid campaign ID - header:', headerCampaignId, 'param:', id);
            return NextResponse.json({ message: 'Invalid campaign ID' }, { status: 400 });
        }

        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                paymentMethods: true,
                creditCardProvider: true,
                stripeKeys: true,
                bevelPublicKey: true,
                bevelApiKey: true,
                bevelApiPin: true,
                pledgerTaxId: true,
                pledgerCharityName: true,
                matbiaOrgUserHandle: true,
                matbiaOrgTaxId: true,
                matbiaOrgName: true,
                matbiaOrgEmail: true,
                ojcOrgId: true,
                ojcApiKey: true,
                ojcUsername: true,
                ojcPassword: true,
                donaryEnabled: true,
                donaryApiKey: true,
                donaryOrgGuid: true,
                donaryLastSyncAt: true,
                nedarimPlusMosad: true,
                nedarimPlusApiValid: true,
                nedarimPlusPaymentType: true,
                nedarimPlusHkDay: true
            }
        });

        if (!campaign) {
            console.log('Campaign not found:', campaignId);
            return NextResponse.json({ message: 'Campaign not found', campaignId: campaignId }, { status: 404 });
        }
        
        // Get donor count for this campaign
        const donorCount = await prisma.donor.count({
            where: { campaignId: campaignId }
        });

        return NextResponse.json({
            campaign_id: campaign.id,
            payment_methods: campaign.paymentMethods || {},
            credit_card_provider: campaign.creditCardProvider || '',
            stripe_keys: campaign.stripeKeys || {},
            bevel_public_key: campaign.bevelPublicKey || '',
            bevel_api_key: campaign.bevelApiKey || '',
            bevel_api_pin: campaign.bevelApiPin || '',
            pledger_tax_id: campaign.pledgerTaxId || '',
            pledger_charity_name: campaign.pledgerCharityName || '',
            matbia_org_user_handle: campaign.matbiaOrgUserHandle || '',
            matbia_org_tax_id: campaign.matbiaOrgTaxId || '',
            matbia_org_name: campaign.matbiaOrgName || '',
            matbia_org_email: campaign.matbiaOrgEmail || '',
            ojc_org_id: campaign.ojcOrgId || '',
            ojc_api_key: campaign.ojcApiKey || '',
            ojc_username: campaign.ojcUsername || '',
            ojc_password: campaign.ojcPassword || '',
            donary_enabled: campaign.donaryEnabled || false,
            donary_api_key: campaign.donaryApiKey || '',
            donary_org_guid: campaign.donaryOrgGuid || '',
            donary_last_sync_at: campaign.donaryLastSyncAt || null,
            nedarim_plus_mosad: campaign.nedarimPlusMosad || '',
            nedarim_plus_api_valid: campaign.nedarimPlusApiValid || '',
            nedarim_plus_payment_type: campaign.nedarimPlusPaymentType || 'Ragil',
            nedarim_plus_hk_day: campaign.nedarimPlusHkDay || 1,
            donor_count: donorCount
        });

    } catch (error) {
        console.error('Error fetching payment settings:', error);
        return NextResponse.json(
            { message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}

export async function PUT(request, context) {
    try {
        const params = await context.params;
        const { id } = params;
        const headerCampaignId = getCampaignId(request);
        const campaignId = !isNaN(headerCampaignId) ? headerCampaignId : parseInt(id);
        const body = await request.json();
        const { payment_methods, credit_card_provider, stripe_keys, bevel_public_key, bevel_api_key, bevel_api_pin, pledger_tax_id, pledger_charity_name, pledger_bearer_token, matbia_org_user_handle, matbia_org_tax_id, matbia_org_name, matbia_org_email, ojc_org_id, ojc_api_key, ojc_username, ojc_password, donary_enabled, donary_api_key, donary_org_guid, nedarim_plus_mosad, nedarim_plus_api_valid, nedarim_plus_payment_type, nedarim_plus_hk_day } = body;
        
        if (isNaN(campaignId)) {
            console.log('Invalid campaign ID - header:', headerCampaignId, 'param:', id);
            return NextResponse.json({ message: 'Invalid campaign ID' }, { status: 400 });
        }

        const updateData = {
            paymentMethods: payment_methods
        };
        
        // Add credit card provider if provided
        if (credit_card_provider !== undefined) {
            updateData.creditCardProvider = credit_card_provider;
        }

        // Add Stripe keys if provided
        if (stripe_keys) {
            updateData.stripeKeys = stripe_keys;
        }
        
        // Add Bevel Public Key if provided
        if (bevel_public_key !== undefined) {
            updateData.bevelPublicKey = bevel_public_key;
        }
        
        // Add Bevel API Key if provided
        if (bevel_api_key !== undefined) {
            updateData.bevelApiKey = bevel_api_key;
        }
        
        // Add Bevel API PIN if provided
        if (bevel_api_pin !== undefined) {
            updateData.bevelApiPin = bevel_api_pin;
        }
        
        // Add Pledger settings if provided
        if (pledger_tax_id !== undefined) {
            updateData.pledgerTaxId = pledger_tax_id;
        }
        
        if (pledger_charity_name !== undefined) {
            updateData.pledgerCharityName = pledger_charity_name;
        }
        
        // Add Matbia settings if provided
        if (matbia_org_user_handle !== undefined) {
            updateData.matbiaOrgUserHandle = matbia_org_user_handle;
        }
        
        if (matbia_org_tax_id !== undefined) {
            updateData.matbiaOrgTaxId = matbia_org_tax_id;
        }
        
        if (matbia_org_name !== undefined) {
            updateData.matbiaOrgName = matbia_org_name;
        }
        
        if (matbia_org_email !== undefined) {
            updateData.matbiaOrgEmail = matbia_org_email;
        }
        
        // Add OJC settings if provided
        if (ojc_org_id !== undefined) {
            updateData.ojcOrgId = ojc_org_id;
        }
        
        if (ojc_api_key !== undefined) {
            updateData.ojcApiKey = ojc_api_key;
        }
        
        if (ojc_username !== undefined) {
            updateData.ojcUsername = ojc_username;
        }
        
        if (ojc_password !== undefined) {
            updateData.ojcPassword = ojc_password;
        }
        
        // Add Donary settings if provided
        if (donary_enabled !== undefined) {
            updateData.donaryEnabled = donary_enabled;
        }
        
        if (donary_api_key !== undefined) {
            updateData.donaryApiKey = donary_api_key;
        }
        
        if (donary_org_guid !== undefined) {
            updateData.donaryOrgGuid = donary_org_guid;
        }
        
        // Add Nedarim Plus settings if provided
        if (nedarim_plus_mosad !== undefined) {
            updateData.nedarimPlusMosad = nedarim_plus_mosad;
        }
        
        if (nedarim_plus_api_valid !== undefined) {
            updateData.nedarimPlusApiValid = nedarim_plus_api_valid;
        }
        
        // Add Nedarim Plus payment type if provided (Ragil or HK)
        if (nedarim_plus_payment_type !== undefined) {
            updateData.nedarimPlusPaymentType = nedarim_plus_payment_type;
        }
        
        // Add Nedarim Plus HK day if provided (1-28)
        if (nedarim_plus_hk_day !== undefined) {
            updateData.nedarimPlusHkDay = parseInt(nedarim_plus_hk_day) || 1;
        }

        const updatedCampaign = await prisma.campaign.update({
            where: { id: campaignId },
            data: updateData
        });

        return NextResponse.json({
            message: 'Payment settings updated successfully',
            campaign_id: updatedCampaign.id,
            payment_methods: updatedCampaign.paymentMethods,
            credit_card_provider: updatedCampaign.creditCardProvider,
            stripe_keys: updatedCampaign.stripeKeys,
            bevel_public_key: updatedCampaign.bevelPublicKey,
            bevel_api_key: updatedCampaign.bevelApiKey,
            bevel_api_pin: updatedCampaign.bevelApiPin,
            pledger_tax_id: updatedCampaign.pledgerTaxId,
            pledger_charity_name: updatedCampaign.pledgerCharityName,
            matbia_org_user_handle: updatedCampaign.matbiaOrgUserHandle,
            matbia_org_tax_id: updatedCampaign.matbiaOrgTaxId,
            matbia_org_name: updatedCampaign.matbiaOrgName,
            matbia_org_email: updatedCampaign.matbiaOrgEmail,
            ojc_org_id: updatedCampaign.ojcOrgId,
            ojc_api_key: updatedCampaign.ojcApiKey,
            ojc_username: updatedCampaign.ojcUsername,
            ojc_password: updatedCampaign.ojcPassword,
            donary_enabled: updatedCampaign.donaryEnabled,
            donary_api_key: updatedCampaign.donaryApiKey,
            donary_org_guid: updatedCampaign.donaryOrgGuid,
            nedarim_plus_mosad: updatedCampaign.nedarimPlusMosad,
            nedarim_plus_api_valid: updatedCampaign.nedarimPlusApiValid,
            nedarim_plus_payment_type: updatedCampaign.nedarimPlusPaymentType,
            nedarim_plus_hk_day: updatedCampaign.nedarimPlusHkDay
        });

    } catch (error) {
        console.error('Error updating payment settings:', error);
        return NextResponse.json(
            { message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}
