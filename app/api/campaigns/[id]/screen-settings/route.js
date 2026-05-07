import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { ensureS3UrlsForScreenSettings } from '@/lib/services/screenSettingsFiles';

async function triggerScreenSettingsEvent(campaignId, settings) {
  try {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const appId = process.env.PUSHER_APP_ID;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || 'eu';
    if (!key || !secret || !appId) return;
    const Pusher = (await import('pusher')).default;
    const pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
    await pusher.trigger(`donation-screen.${campaignId}`, 'ScreenSettingsUpdated', { settings });
  } catch (_) { }
}

function coerceBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function coerceInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function coerceDecimal(value) {
  if (value === '' || value === null || value === undefined) return null;
  // Prisma Decimal accepts string
  const num = typeof value === 'number' ? String(value) : String(value);
  return num;
}

function coerceDate(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  } catch (_) {
    return null;
  }
}

const allowedKeys = new Set([
  'goal',
  'amountBigScreen',
  'displayTopPart',
  'displayBottomPart',
  'preloadingNames',
  'byPresence',
  'textOverTotal',
  'textUnderTotal',
  'bgScreen',
  'bgBigDonations',
  'hasGoal',
  'nameVsPhone',
  'topPartBottomTitlesColor',
  'videoText',
  'videoTextFontSize',
  'videoDate',
  'videoRepeat',
  'videoUrl',
  'topTimerText',
  'bottomTimerText',
  'cubeWidth',
  'cubeHeight',
  'cubePadding',
  'borderRadius',
  'fontSizeNameFront',
  'fontSizeNameBack',
  'fontSizeAmountBack',
  'displayRank',
  'fontSizeRank',
  'displayFreeField1',
  'fontSizeFreeField1',
  'frontBoxTextColor',
  'backBoxTextColor',
  'showAmount',
  'bsShowLogo',
  'bsLogoHeight',
  'bsLogoTopMargin',
  'bsNameFontSize',
  'bsNameColor',
  'bsNameTopMargin',
  'bsShowAmount',
  'bsAmountFontSize',
  'bsAmountColor',
  'bsAmountTopMargin',
  'bsShowRank',
  'bsRankFontSize',
  'bsRankColor',
  'bsRankTopMargin',
  'showNamesInDonationScreen',
  'displayDonationButton',
  'donationButtonPosition',
  'donationButtonBackgroundImage',
  'donationButtonUrl',
  'titleBefore',
  'hasShop',
  'minimumCart',
  'chargeMethodId',
  'nedarimMosad',
  'nedarimApiValid',
  'shopPhone',
  'ifHok',
  'ifFundRaiser',
  'showSum',
  'showDonorFundRaiser',
  'mosadWebhook1',
  'mosadWebhook2',
  'mosadWebhook3',
  'skipDonationApproved',
  'supervisorApproval',
  'lowDonationDisplay',
  'displayShtiebel',
  'fontSizeShtiebel',
]);

function sanitizePayload(body) {
  const result = {};
  for (const [key, raw] of Object.entries(body || {})) {
    if (!allowedKeys.has(key)) continue;
    let value = raw;
    if (value === '') value = null;
    switch (key) {
      // booleans
      case 'displayTopPart':
      case 'displayBottomPart':
      case 'preloadingNames':
      case 'byPresence':
      case 'hasGoal':
      case 'displayRank':
      case 'displayFreeField1':
      case 'showAmount':
      case 'bsShowLogo':
      case 'bsShowAmount':
      case 'bsShowRank':
      case 'showNamesInDonationScreen':
      case 'displayDonationButton':
      case 'hasShop':
      case 'nedarimApiValid':
      case 'ifHok':
      case 'ifFundRaiser':
      case 'showSum':
      case 'showDonorFundRaiser':
      case 'skipDonationApproved':
      case 'supervisorApproval':
      case 'displayShtiebel':
        result[key] = coerceBoolean(value);
        break;
      // ints
      case 'amountBigScreen':
      case 'nameVsPhone':
      case 'videoTextFontSize':
      case 'videoRepeat':
      case 'cubeWidth':
      case 'cubeHeight':
      case 'cubePadding':
      case 'borderRadius':
      case 'fontSizeNameFront':
      case 'fontSizeNameBack':
      case 'fontSizeAmountBack':
      case 'fontSizeRank':
      case 'fontSizeFreeField1':
      case 'bsLogoHeight':
      case 'bsLogoTopMargin':
      case 'bsNameFontSize':
      case 'bsNameTopMargin':
      case 'bsAmountFontSize':
      case 'bsAmountTopMargin':
      case 'bsRankFontSize':
      case 'bsRankTopMargin':
      case 'minimumCart':
      case 'chargeMethodId':
      case 'mosadWebhook1':
      case 'mosadWebhook2':
      case 'mosadWebhook3':
      case 'fontSizeShtiebel':
        result[key] = coerceInt(value);
        break;
      // decimals
      case 'goal':
        result[key] = coerceDecimal(value);
        break;
      // dates
      case 'videoDate':
        result[key] = coerceDate(value);
        break;
      case 'lowDonationDisplay':
        // validate enum value
        if (value && ['HIDE', 'SHOW_WITHOUT_APPROVAL', 'SHOW_WITH_APPROVAL'].includes(value)) {
          result[key] = value;
        }
        break;
      default:
        result[key] = value;
    }
  }
  return result;
}

// GET - Fetch screen settings for a campaign
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const screenSettings = await prisma.campaignScreenSetting.findUnique({
      where: { campaignId: parseInt(id) },
      include: { campaign: true }
    });

    if (!screenSettings) {
      return NextResponse.json({ message: 'Screen settings not found' }, { status: 404 });
    }

    return NextResponse.json(screenSettings);
  } catch (error) {
    console.error('Error fetching screen settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create screen settings for a campaign
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    let data = sanitizePayload(body);
    data = await ensureS3UrlsForScreenSettings(data, parseInt(id));

    // Check if settings already exist
    const existingSettings = await prisma.campaignScreenSetting.findUnique({
      where: { campaignId: parseInt(id) }
    });

    if (existingSettings) {
      return NextResponse.json({ message: 'Screen settings already exist for this campaign' }, { status: 400 });
    }

    const screenSettings = await prisma.campaignScreenSetting.create({
      data: {
        campaignId: parseInt(id),
        ...data
      },
      include: { campaign: true }
    });

    // Emit realtime event to update any open donation screens
    try { await triggerScreenSettingsEvent(parseInt(id), screenSettings); } catch (_) { }

    return NextResponse.json(screenSettings, { status: 201 });
  } catch (error) {
    console.error('Error creating screen settings:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error', meta: error?.meta || null }, { status: 500 });
  }
}

// PUT - Update screen settings for a campaign
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    let data = sanitizePayload(body);
    data = await ensureS3UrlsForScreenSettings(data, parseInt(id));

    const screenSettings = await prisma.campaignScreenSetting.upsert({
      where: { campaignId: parseInt(id) },
      update: data,
      create: {
        campaignId: parseInt(id),
        ...data
      },
      include: { campaign: true }
    });

    // Emit realtime event to update any open donation screens
    try { await triggerScreenSettingsEvent(parseInt(id), screenSettings); } catch (_) { }

    return NextResponse.json(screenSettings);
  } catch (error) {
    console.error('Error updating screen settings:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error', meta: error?.meta || null }, { status: 500 });
  }
}

// DELETE - Delete screen settings for a campaign
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    await prisma.campaignScreenSetting.delete({
      where: { campaignId: parseInt(id) }
    });

    return NextResponse.json({ message: 'Screen settings deleted successfully' });
  } catch (error) {
    console.error('Error deleting screen settings:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error', meta: error?.meta || null }, { status: 500 });
  }
}
