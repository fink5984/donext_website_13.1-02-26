import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Public API endpoint for payment settings
 * No authentication required - returns only public keys needed for payment processing
 */
export async function GET(request, context) {
    try {
        const params = await context.params;
        const { id } = params;
        const campaignId = parseInt(id);
        
        if (isNaN(campaignId)) {
            return NextResponse.json({ 
                success: false,
                message: 'Invalid campaign ID' 
            }, { status: 400 });
        }

        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                paymentMethods: true,
                creditCardProvider: true,
                stripeKeys: true,
                bevelPublicKey: true,
                // Pledger settings
                pledgerTaxId: true,
                pledgerCharityName: true,
                // OJC settings
                ojcOrgId: true,
                // Matbia settings
                matbiaOrgUserHandle: true,
                matbiaOrgTaxId: true,
                matbiaOrgName: true,
                matbiaOrgEmail: true,
                // Nedarim Plus settings (public only - mosad ID)
                nedarimPlusMosad: true,
                nedarimPlusApiValid: true,
                nedarimPlusPaymentType: true,
                nedarimPlusHkDay: true
            }
        });

        if (!campaign) {
            return NextResponse.json({ 
                success: false,
                message: 'Campaign not found'
            }, { status: 404 });
        }

        // Only return public keys, never secret keys
        return NextResponse.json({
            success: true,
            campaign_id: campaign.id,
            credit_card_provider: campaign.creditCardProvider || '',
            stripe_public_key: campaign.stripeKeys?.publicKey || null,
            bevel_public_key: campaign.bevelPublicKey || null,
            payment_methods: campaign.paymentMethods || {},
            // Pledger settings (public)
            pledger_tax_id: campaign.pledgerTaxId || null,
            pledger_charity_name: campaign.pledgerCharityName || null,
            // OJC settings (public - only orgId, not API key)
            ojc_org_id: campaign.ojcOrgId || null,
            // Matbia settings (public)
            matbia_org_user_handle: campaign.matbiaOrgUserHandle || null,
            matbia_org_tax_id: campaign.matbiaOrgTaxId || null,
            matbia_org_name: campaign.matbiaOrgName || null,
            matbia_org_email: campaign.matbiaOrgEmail || null,
            // Nedarim Plus settings (public - mosad ID, payment type, no API key)
            nedarim_plus_mosad: campaign.nedarimPlusMosad || null,
            nedarim_plus_api_valid: campaign.nedarimPlusApiValid || false,
            nedarim_plus_payment_type: campaign.nedarimPlusPaymentType || 'Ragil',
            nedarim_plus_hk_day: campaign.nedarimPlusHkDay || 1
        });

    } catch (error) {
        console.error('Error in public payment-settings API:', error);
        return NextResponse.json({ 
            success: false,
            message: 'Internal server error' 
        }, { status: 500 });
    }
}
