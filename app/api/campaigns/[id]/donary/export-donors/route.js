import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Export donors in Donary CSV format
 * GET /api/campaigns/[id]/donary/export-donors
 */
export async function GET(request, context) {
    try {
        const params = await context.params;
        const campaignId = parseInt(params.id);

        if (isNaN(campaignId)) {
            return NextResponse.json(
                { error: 'Invalid campaign ID' },
                { status: 400 }
            );
        }

        // Fetch all donors with person data
        const donors = await prisma.donor.findMany({
            where: {
                campaignId: campaignId,
                personId: { not: null } // Only donors with a linked person
            },
            include: {
                person: {
                    include: {
                        city: true,
                        englishName: true
                    }
                }
            },
            orderBy: {
                id: 'asc'
            }
        });

        console.log(`[Donary Export] Campaign ${campaignId}: Found ${donors.length} donors`);

        // Build CSV content
        const headers = [
            'AccountNum', 'Title', 'FirstName', 'LastName', 'HebTitle', 'HebFirstName', 
            'HebLastName', 'HebSufix', 'HouseNum:Home', 'StreetName:Home', 'Apt:Home', 
            'City:Home', 'State:Home', 'Zip:Home', 'Country:Home', 'CountryCode:Home', 
            'Phone:Home', 'CountryCode:Cell', 'Phone:Cell', 'CountryCode:Cell2', 
            'Phone:Cell2', 'CountryCode:Other', 'Phone:Other', 'Email:Email', 
            'Email:Business', 'Father', 'Father In Law', 'FatherAccountNum', 
            'FatherInLawAccountNum', 'AdvancedField: Member Type', 
            'AdvancedField: Member Since', 'AdvancedField: Active', 'Tags', 
            'LocationIDs', 'CareOf:Business', 'HouseNum:Business', 'StreetName:Business', 
            'Apt:Business', 'City:Business', 'State:Business', 'Zip:Business', 
            'Country:Business'
        ];

        const rows = donors.map(donor => {
            const person = donor.person;
            const englishName = person.englishName;
            
            return [
                person.id, // AccountNum - CRITICAL: DoNext person ID
                englishName?.titleBefore || '', // English title
                englishName?.firstName || '', // English first name
                englishName?.lastName || '', // English last name
                person.titleBefore || '', // Hebrew title
                person.firstName || '', // Hebrew first name
                person.lastName || '', // Hebrew last name
                person.titleAfter || '', // Hebrew suffix
                person.houseNumber || '',
                person.street || '',
                person.apartment || '',
                person.city?.name || '',
                '', // State
                person.zipCode || '',
                '', // Country (empty, not Israel)
                '', // Country code for home (empty, not IL)
                person.homePhone || '',
                '', // Country code for cell (empty)
                person.mainMobile || '',
                '', // Country code for cell2 (empty)
                person.additionalPhone || '',
                '', // Country code other
                '', // Phone other
                person.email || '',
                '', // Business email
                '', // Father
                '', // Father in law
                '', // Father account num
                '', // Father in law account num
                '', // Member type
                '', // Member since
                '', // Active
                '', // Tags
                '', // Location IDs
                '', // Business name
                '', // Business house num
                '', // Business street
                '', // Business apt
                '', // Business city
                '', // Business state
                '', // Business zip
                '' // Business country
            ];
        });

        // Convert to CSV
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => {
                // Escape cells containing commas or quotes
                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(','))
        ].join('\n');

        // Add BOM for proper Hebrew encoding in Excel
        const bom = '\uFEFF';
        const responseContent = bom + csvContent;

        return new NextResponse(responseContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="donary-donors-campaign-${campaignId}.csv"`
            }
        });

    } catch (error) {
        console.error('[Donary Export] Error:', error);
        return NextResponse.json(
            { error: 'Failed to export donors', details: error.message },
            { status: 500 }
        );
    }
}
