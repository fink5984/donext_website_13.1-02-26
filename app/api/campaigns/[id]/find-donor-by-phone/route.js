import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Get last 9 digits of phone number
function getLast9Digits(phone) {
    if (!phone) return null;
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    // Get last 9 digits
    return digits.slice(-9);
}

export async function GET(request, { params }) {
    try {
        const { id: campaignId } = await params;
        const { searchParams } = new URL(request.url);
        const phone = searchParams.get('phone');

        if (!phone) {
            return NextResponse.json({ success: false, error: 'Phone is required' }, { status: 400 });
        }

        const searchPhoneLast9 = getLast9Digits(phone);
        
        if (!searchPhoneLast9 || searchPhoneLast9.length < 9) {
            return NextResponse.json({ success: true, donor: null });
        }

        // Find all donors in the campaign
        const campaignDonors = await prisma.donor.findMany({
            where: {
                campaignId: parseInt(campaignId)
            },
            include: {
                person: true,
                donations: {
                    where: {
                        deleted_at: null
                    },
                    select: {
                        id: true,
                        monthlyAmount: true,
                        numberOfPayments: true,
                        isUnlimited: true,
                        dedication: true,
                        donateApproval: true,
                        created_at: true
                    }
                },
                fundraiser: {
                    include: {
                        person: {
                            select: {
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                }
            }
        });

        // Find donor with matching last 9 digits of phone
        let matchingDonor = null;
        
        for (const cd of campaignDonors) {
            const person = cd.person;
            if (!person) continue;

            // Check all phone fields - mainMobile, secondaryMobile, phoneLandline
            const phones = [person.mainMobile, person.secondaryMobile, person.phoneLandline].filter(Boolean);
            
            for (const donorPhone of phones) {
                const donorPhoneLast9 = getLast9Digits(donorPhone);
                if (donorPhoneLast9 === searchPhoneLast9) {
                    // Calculate total donation amounts
                    const totalAmount = cd.donations.reduce((sum, donation) => {
                        const monthlyAmount = Number(donation.monthlyAmount) || 0;
                        const payments = donation.numberOfPayments || 1;
                        return sum + (monthlyAmount * payments);
                    }, 0);

                    const monthlyAmount = cd.donations.reduce((sum, donation) => {
                        const amount = Number(donation.monthlyAmount) || 0;
                        const payments = donation.numberOfPayments || 1;
                        if (payments > 1) {
                            return sum + amount;
                        }
                        return sum;
                    }, 0);

                    matchingDonor = {
                        id: cd.id,
                        person_id: person.id,
                        firstName: person.firstName,
                        lastName: person.lastName,
                        first_name: person.firstName,
                        last_name: person.lastName,
                        fullName: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
                        full_name: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
                        phone: person.mainMobile,
                        email: person.email,
                        fundraiserId: cd.fundraiserId,
                        fundraiserName: cd.fundraiser?.person ? 
                            `${cd.fundraiser.person.firstName} ${cd.fundraiser.person.lastName}` : null,
                        donations: cd.donations.map(donation => ({
                            id: donation.id,
                            monthlyAmount: Number(donation.monthlyAmount) || 0,
                            numberOfPayments: donation.numberOfPayments || 1,
                            totalAmount: (Number(donation.monthlyAmount) || 0) * (donation.numberOfPayments || 1),
                            isUnlimited: donation.isUnlimited,
                            dedication: donation.dedication,
                            donateApproval: donation.donateApproval,
                            created_at: donation.created_at
                        })),
                        donationsCount: cd.donations.length,
                        totalAmount: totalAmount,
                        monthlyAmount: monthlyAmount
                    };
                    break;
                }
            }
            
            if (matchingDonor) break;
        }

        return NextResponse.json({ 
            success: true, 
            donor: matchingDonor 
        });

    } catch (error) {
        console.error('Error finding donor by phone:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
