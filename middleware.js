import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

// Create next-intl middleware
const intlMiddleware = createMiddleware(routing);

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Skip middleware completely for storage uploads (to allow large files)
  if (pathname === '/api/storage') {
    return NextResponse.next();
  }

  // Handle API routes with authentication (existing logic)
  if (pathname.startsWith('/api')) {
    // רשימת endpoints שלא צריכים authentication בכלל
    const publicEndpoints = [
      '/api/login',
      '/api/donations/nedarim',
      '/api/donext-api',
      '/api/donations/webhook-pixelart',
      '/api/donors/next-for-questionnaire',
      '/api/webhooks/donary',
      // Payment endpoints for public donations
      '/api/payments/bevel',
      '/api/payments/pledger',
      '/api/payments/matbia',
      '/api/payments/ojc',
      '/api/stripe/create-payment-intent',
      '/api/purim-landing',
      '/api/contact',
      '/api/public/campaign-logos',
      '/api/public/stats',
      '/api/cron/daily-tasks'
    ];

    // Nedarim Plus callback endpoint (called by Nedarim servers, no auth)
    if (pathname.match(/^\/api\/payments\/nedarim-plus\/callback(\/\d+)?$/)) {
      return NextResponse.next();
    }

    // בדיקה אם זה public-stats endpoint (מאפשר גישה ציבורית לנתוני קמפיין)
    if (pathname.match(/^\/api\/campaigns\/\d+\/public-stats$/)) {
      return NextResponse.next();
    }

    // בדיקה אם זה public-donation endpoint (מאפשר תרומות ציבוריות)
    if (pathname.match(/^\/api\/campaigns\/\d+\/public-donation$/)) {
      return NextResponse.next();
    }

    // בדיקה אם זה payment-settings-public endpoint (מאפשר גישה ציבורית להגדרות תשלום)
    if (pathname.match(/^\/api\/campaigns\/\d+\/payment-settings-public$/)) {
      return NextResponse.next();
    }

    // בדיקה אם זה find-donor-by-phone endpoint (מאפשר חיפוש תורם לפי טלפון במסך ציבורי)
    if (pathname.match(/^\/api\/campaigns\/\d+\/find-donor-by-phone$/)) {
      return NextResponse.next();
    }

    // GET-only endpoints נדרשים על ידי מסכי תצוגה ציבוריים (donation-screen / donation-screen-rank)
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const qsCampaignId = url.searchParams.get('campaignId');

      // /api/campaigns/{id} ו-/api/campaigns/{id}/screen-settings
      if (
        pathname.match(/^\/api\/campaigns\/\d+$/) ||
        pathname.match(/^\/api\/campaigns\/\d+\/screen-settings$/)
      ) {
        return NextResponse.next();
      }

      // endpoints שמקבלים campaignId כ-query param
      if (qsCampaignId) {
        if (
          pathname === '/api/ranks' ||
          pathname === '/api/fundraising/donors' ||
          pathname === '/api/fundraising/donors/summary' ||
          pathname === '/api/donors/synagogues'
        ) {
          return NextResponse.next();
        }
      }
    }

    // רשימת endpoints שצריכים authentication אבל לא צריכים campaignId
    const endpointsWithoutCampaignId = [
      '/api/clients',
      '/api/campaigns',
      '/api/emoji-reactions',
      '/api/cities',
      '/api/streets',
      '/api/upload',
      '/api/people',           // contacts page — uses clientId, not campaignId
      '/api/contacts-settings', // contacts column settings — uses clientId
      '/api/custom-fields',    // contacts page custom fields — uses clientId
      '/api/tags',             // contacts page tags — uses clientId
      '/api/admin',            // admin routes do their own JWT auth internally
      '/api/donors/export-pdf-server', // PDF export — used from contacts page (no campaignId in token)
      '/api/donations/cash-flow',      // cash-flow forecast — used from contacts page (per client, not campaign)
    ];

    // בדיקה אם זה endpoint ציבורי
    if (publicEndpoints.some(endpoint => pathname.startsWith(endpoint))) {
      return NextResponse.next();
    }

    // בדיקת API Key (אופציה 1: x-api-key header)
    const apiKey = request.headers.get('x-api-key');
    if (apiKey) {
      // בדיקה מול המפתח הקבוע במערכת
      if (apiKey === process.env.API_KEY) {
        // API Key תקף - המשך ללא בדיקות נוספות
        return NextResponse.next();
      } else {
        return new NextResponse(JSON.stringify({ error: 'Invalid API key' }), { status: 401 });
      }
    }

    // אם אין API Key, בדוק JWT Token (הזרימה הקיימת)
    const authHeader = request.headers.get('authorization');
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return new NextResponse(JSON.stringify({ error: 'No token provided' }), { status: 401 });
    }

    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);

      // בדיקה אם ה-endpoint צריך campaignId
      const needsCampaignId = !endpointsWithoutCampaignId.some(endpoint => pathname.startsWith(endpoint));

      if (needsCampaignId) {
        // חילוץ campaignId מה-token
        const campaignId = payload.campaignId;
        if (!campaignId) {
          return new NextResponse(JSON.stringify({ error: 'No campaign ID in token' }), { status: 401 });
        }

        // הוספת campaignId לכותרות הבקשה
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-campaign-id', campaignId.toString());

        // הוספת operatorId לכותרות אם המשתמש הוא מפעיל
        if (payload.operatorId) {
          requestHeaders.set('x-operator-id', payload.operatorId.toString());
        }

        // הוספת role לכותרות
        if (payload.role) {
          requestHeaders.set('x-user-role', payload.role);
        }

        return NextResponse.next({
          request: {
            headers: requestHeaders,
          }
        });
      }

      // אם לא צריך campaignId, פשוט תמשיך
      return NextResponse.next();

    } catch (err) {
      return new NextResponse(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401 });
    }
  }

  // Handle public-screen routes - detect country by IP for automatic language selection
  if (pathname.includes('/public-screen/')) {
    // Check if user already has a locale preference cookie
    const localeCookie = request.cookies.get('NEXT_LOCALE')?.value;
    
    // If no cookie set, detect by IP country
    if (!localeCookie) {
      // Vercel provides geo info automatically, or use x-vercel-ip-country header
      const country = request.geo?.country || request.headers.get('x-vercel-ip-country') || 'IL';
      
      // Check if current path already has locale
      const pathParts = pathname.split('/');
      const firstPart = pathParts[1]; // e.g., 'he', 'en', or 'public-screen'
      
      // Check if path already has a locale prefix
      const hasLocale = firstPart === 'he' || firstPart === 'en';
      
      // If no locale in path, redirect to correct locale based on country
      if (!hasLocale) {
        const targetLocale = country === 'IL' ? 'he' : 'en';
        const url = request.nextUrl.clone();
        url.pathname = `/${targetLocale}${pathname}`;
        return NextResponse.redirect(url);
      }
      
      // If not from Israel and currently on Hebrew, redirect to English
      if (country !== 'IL' && firstPart === 'he') {
        const newPath = pathname.replace('/he/', '/en/');
        const url = request.nextUrl.clone();
        url.pathname = newPath;
        return NextResponse.redirect(url);
      }
      
      // If from Israel and currently on English (without explicit preference), redirect to Hebrew
      if (country === 'IL' && firstPart === 'en') {
        const newPath = pathname.replace('/en/', '/he/');
        const url = request.nextUrl.clone();
        url.pathname = newPath;
        return NextResponse.redirect(url);
      }
    }
  }

  // Handle page routes with locale detection (new logic)
  // Apply next-intl middleware for all non-API routes
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match all requests except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}; 