import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';

/**
 * GET - קבלת הגדרות נוספות של קמפיין
 */
export async function GET(request, { params }) {
    try {
        const resolvedParams = await params;
        const campaignId = parseInt(resolvedParams.id);

        // חיפוש הגדרות במודל החדש
        let settings = await prisma.publicScreenSettings.findUnique({
            where: { campaignId: campaignId }
        });

        // אם אין הגדרות, נחזיר ערכים ריקים
        if (!settings) {
            return NextResponse.json({
                publicScreenRanks: [],
                publicScreenAbout: '',
                publicScreenPhone: '',
                publicScreenEmail: '',
                publicScreenBanners: [],
                isEnabled: false,
                showDonationDetails: true,
                monthsCalculation: 1,
                donationsCalculation: 1,
            });
        }

        return NextResponse.json({
            publicScreenRanks: settings.ranks || [],
            publicScreenAbout: settings.aboutText || '',
            publicScreenPhone: settings.phone || '',
            publicScreenEmail: settings.email || '',
            publicScreenBanners: settings.banners || [],
            publicScreenStartDate: settings.startDate || null,
            publicScreenEndDate: settings.endDate || null,
            publicScreenRanksBackgroundColor: settings.ranksBackgroundColor || '#b45309',
            isEnabled: settings.isEnabled ?? false,
            showDonationDetails: settings.showDonationDetails ?? true,
            promoVideoUrl: settings.promoVideoUrl || null,
            monthsCalculation: settings.monthsCalculation ?? 1,
            donationsCalculation: settings.donationsCalculation ?? 1,
        });
    } catch (error) {
        console.error('Error fetching additional settings:', error);
        return NextResponse.json(
            { error: 'שגיאה בטעינת ההגדרות' },
            { status: 500 }
        );
    }
}

/**
 * PUT - עדכון הגדרות נוספות של קמפיין
 */
export async function PUT(request, { params }) {
    try {
        const resolvedParams = await params;
        const campaignId = parseInt(resolvedParams.id);
        const body = await request.json();

        const { publicScreenRanks, publicScreenAbout, publicScreenPhone, publicScreenEmail, publicScreenBanners, publicScreenStartDate, publicScreenEndDate, publicScreenRanksBackgroundColor, isEnabled, showDonationDetails, promoVideoUrl, monthsCalculation, donationsCalculation } = body;

        const toPositiveInt = (val) => Number.isFinite(Number(val)) && Number(val) > 0
            ? Math.floor(Number(val))
            : 1;
        const monthsCalc = toPositiveInt(monthsCalculation);
        const donationsCalc = toPositiveInt(donationsCalculation);

        // בדיקת קיום הקמפיין
        const existingCampaign = await prisma.campaign.findUnique({
            where: { id: campaignId }
        });

        if (!existingCampaign) {
            return NextResponse.json(
                { error: 'קמפיין לא נמצא' },
                { status: 404 }
            );
        }

        // יצירה או עדכון ההגדרות במודל החדש
        const updatedSettings = await prisma.publicScreenSettings.upsert({
            where: { campaignId: campaignId },
            create: {
                campaignId: campaignId,
                ranks: publicScreenRanks || [],
                aboutText: publicScreenAbout || null,
                phone: publicScreenPhone || null,
                email: publicScreenEmail || null,
                banners: publicScreenBanners || [],
                startDate: publicScreenStartDate ? new Date(publicScreenStartDate) : null,
                endDate: publicScreenEndDate ? new Date(publicScreenEndDate) : null,
                ranksBackgroundColor: publicScreenRanksBackgroundColor || '#b45309',
                isEnabled: isEnabled ?? false,
                showDonationDetails: showDonationDetails ?? true,
                promoVideoUrl: promoVideoUrl || null,
                monthsCalculation: monthsCalc,
                donationsCalculation: donationsCalc,
            },
            update: {
                ranks: publicScreenRanks || [],
                aboutText: publicScreenAbout || null,
                phone: publicScreenPhone || null,
                email: publicScreenEmail || null,
                banners: publicScreenBanners || [],
                startDate: publicScreenStartDate ? new Date(publicScreenStartDate) : null,
                endDate: publicScreenEndDate ? new Date(publicScreenEndDate) : null,
                ranksBackgroundColor: publicScreenRanksBackgroundColor || '#b45309',
                isEnabled: isEnabled ?? false,
                showDonationDetails: showDonationDetails ?? true,
                promoVideoUrl: promoVideoUrl || null,
                monthsCalculation: monthsCalc,
                donationsCalculation: donationsCalc,
            }
        });

        return NextResponse.json({
            success: true,
            message: 'ההגדרות עודכנו בהצלחה',
            data: {
                publicScreenRanks: updatedSettings.ranks,
                publicScreenAbout: updatedSettings.aboutText,
                publicScreenPhone: updatedSettings.phone,
                publicScreenEmail: updatedSettings.email,
                publicScreenBanners: updatedSettings.banners,
            }
        });
    } catch (error) {
        console.error('Error updating additional settings:', error);
        return NextResponse.json(
            { error: 'שגיאה בעדכון ההגדרות' },
            { status: 500 }
        );
    }
}
