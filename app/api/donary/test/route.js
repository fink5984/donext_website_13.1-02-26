import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';
import { testConnection } from '@/lib/services/donaryService';

/**
 * Donary Test Connection API
 * 
 * Tests the connection to Donary with provided credentials
 * 
 * POST /api/donary/test
 */

export async function POST(request) {
    try {
        const body = await request.json();
        const { apiKey, orgGuid } = body;
        
        if (!apiKey || !orgGuid) {
            return NextResponse.json(
                { success: false, message: 'API Key and Org GUID are required' },
                { status: 400 }
            );
        }
        
        console.log('[Donary Test] Testing connection...');
        
        const isConnected = await testConnection({
            apiKey,
            orgGuid,
            useSandbox: false // Set to true for sandbox testing
        });
        
        if (isConnected) {
            return NextResponse.json({
                success: true,
                message: 'Connection successful'
            });
        } else {
            return NextResponse.json({
                success: false,
                message: 'Connection failed - check your API Key and Org GUID'
            });
        }
        
    } catch (error) {
        console.error('[Donary Test] Error:', error);
        return NextResponse.json(
            { success: false, message: 'Connection test failed', error: error.message },
            { status: 500 }
        );
    }
}
