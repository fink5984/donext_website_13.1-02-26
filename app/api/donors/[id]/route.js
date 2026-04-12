import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError, buildPrismaInclude } from '@/lib/prisma/utils';

export async function GET(request, { params }) {
    try {
        const resolvedParams = await params;
        const donor = await prisma.donor.findUnique({
            where: { id: parseInt(resolvedParams.id) },
            include: {
                person: {
                    include: {
                        city: {
                            include: {
                                state: true
                            }
                        },
                        street: {
                            include: {
                                zipCode: true
                            }
                        },
                        country: true,
                        englishName: true
                    }
                },
                campaign: true,
                fundraiser: {
                    where: { deleted_at: null },
                    include: {
                        person: true
                    }
                }
            }
        });

        if (!donor) {
            return NextResponse.json({ error: 'Donor not found' }, { status: 404 });
        }

        // בדיקה אם הוא מתרים
        let isFundraiser = false;
        if (donor.campaignId) {
            const fundraisers = await prisma.fundraiser.findMany({
                where: { 
                    campaignId: donor.campaignId,
                    deleted_at: null
                },
                select: { personId: true }
            });
            const fundraiserPersonIds = new Set(fundraisers.map(f => f.personId));
            isFundraiser = fundraiserPersonIds.has(donor.personId);
        }

        return NextResponse.json(mapDonorToFrontend(donor, { isFundraiser }));
    } catch (error) {
        console.error('Error fetching donor:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    try {
        const { id } = await params; // Next.js 15
        const data = await request.json();
        const {
            active, fundraiser_id, expected, amount, invitationSent, arrivalConfirmed, actuallyArrived, // donors
            firstName, lastName, mainMobile, phone, email, cityId, streetId, houseNumber, synagogue, // people
            titleBefore, titleAfter, countryId, // additional person fields
            englishName // { titleBefore, firstName, lastName, titleAfter }
        } = data;

        // שלוף את person_id של התורם
        const donor = await prisma.donor.findUnique({
            where: { id: parseInt(id) },
            select: { personId: true }
        });
        if (!donor) {
            return NextResponse.json({ error: 'Donor not found' }, { status: 404 });
        }

        // עדכן donor
        let updatedDonor = null;
        const donorUpdates = {};
        if (active !== undefined) donorUpdates.active = active;
        if (fundraiser_id !== undefined) donorUpdates.fundraiserId = fundraiser_id ? parseInt(fundraiser_id) : null;
        if (expected !== undefined) donorUpdates.expected = expected ? parseFloat(expected) : null;
        if (amount !== undefined) donorUpdates.amount = amount ? parseFloat(amount) : null;
        if (invitationSent !== undefined) donorUpdates.invitationSent = invitationSent;
        if (arrivalConfirmed !== undefined) donorUpdates.arrivalConfirmed = arrivalConfirmed;
        if (actuallyArrived !== undefined) donorUpdates.actuallyArrived = actuallyArrived;
        // אם מעדכנים expected, לעדכן גם lastForecastByFundraiserId
        if (expected !== undefined) {
            const donorFull = await prisma.donor.findUnique({ 
                where: { id: parseInt(id) }, 
                include: {
                    fundraiser: {
                        where: { deleted_at: null }
                    }
                }
            });
            if (donorFull && donorFull.fundraiserId !== null && donorFull.fundraiserId !== undefined && donorFull.fundraiser) {
                donorUpdates.lastForecastByFundraiserId = donorFull.fundraiserId;
            }
        }

        if (Object.keys(donorUpdates).length > 0) {
            updatedDonor = await prisma.donor.update({
                where: { id: parseInt(id) },
                data: donorUpdates
            });
        }

        // עדכן person
        let updatedPerson = null;
        const personUpdates = {};
        if (firstName !== undefined) personUpdates.firstName = firstName;
        if (lastName !== undefined) personUpdates.lastName = lastName;
        if (titleBefore !== undefined) personUpdates.titleBefore = titleBefore;
        if (titleAfter !== undefined) personUpdates.titleAfter = titleAfter;
        if (mainMobile !== undefined) personUpdates.mainMobile = mainMobile;
        if (phone !== undefined) personUpdates.phoneLandline = phone;
        if (email !== undefined) personUpdates.email = email;
        if (cityId !== undefined) personUpdates.cityId = cityId ? parseInt(cityId) : null;
        if (streetId !== undefined) personUpdates.streetId = streetId ? parseInt(streetId) : null;
        if (countryId !== undefined) personUpdates.countryId = countryId ? parseInt(countryId) : null;
        if (houseNumber !== undefined) personUpdates.houseNumber = houseNumber != null ? String(houseNumber).trim() : null;
        if (synagogue !== undefined) personUpdates.synagogue = synagogue;
        if (Object.keys(personUpdates).length > 0) {
            updatedPerson = await prisma.person.update({
                where: { id: donor.personId },
                data: personUpdates
            });
        }

        // עדכן או צור שם באנגלית
        if (englishName !== undefined) {
            const hasEnglishData = englishName && (englishName.firstName || englishName.lastName || englishName.titleBefore || englishName.titleAfter);
            
            // בדוק אם כבר קיים רשומה
            const existingEnglishName = await prisma.personEnglishName.findUnique({
                where: { personId: donor.personId }
            });

            if (hasEnglishData) {
                if (existingEnglishName) {
                    // עדכן
                    await prisma.personEnglishName.update({
                        where: { personId: donor.personId },
                        data: {
                            titleBefore: englishName.titleBefore || null,
                            firstName: englishName.firstName || null,
                            lastName: englishName.lastName || null,
                            titleAfter: englishName.titleAfter || null
                        }
                    });
                } else {
                    // צור חדש
                    await prisma.personEnglishName.create({
                        data: {
                            personId: donor.personId,
                            titleBefore: englishName.titleBefore || null,
                            firstName: englishName.firstName || null,
                            lastName: englishName.lastName || null,
                            titleAfter: englishName.titleAfter || null
                        }
                    });
                }
            } else if (existingEnglishName) {
                // מחק אם כל השדות ריקים
                await prisma.personEnglishName.delete({
                    where: { personId: donor.personId }
                });
            }
        }

        return NextResponse.json({
            donor: updatedDonor ? mapDonorToFrontend(updatedDonor) : null,
            person: updatedPerson ? mapPersonToFrontend(updatedPerson) : null
        });
    } catch (error) {
        console.error('Error updating donor:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const { id } = await params; // Next.js 15
        
        // מחק קודם את התרומות
        await prisma.donation.deleteMany({
            where: { donorId: parseInt(id) }
        });
        
        // עכשיו אפשר למחוק את התורם
        await prisma.donor.delete({
            where: { id: parseInt(id) }
        });
        
        return NextResponse.json({ message: 'Donor deleted successfully' });
    } catch (error) {
        console.error('Error deleting donor:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function mapDonorToFrontend(donor, extra = {}) {
    return {
        id: donor.id,
        person_id: donor.personId,
        synagogue: donor.person?.synagogue,
        campaign_id: donor.campaignId,
        assigned_fundraiser_id: donor.fundraiserId,
        expected: donor.expected,
        active: donor.active,
        traffic_light_color: donor.trafficLightColor,
        invitationSent: donor.invitationSent,
        arrivalConfirmed: donor.arrivalConfirmed,
        first_name: donor.person?.firstName,
        last_name: donor.person?.lastName,
        title_before: donor.person?.titleBefore,
        title_after: donor.person?.titleAfter,
        main_mobile: donor.person?.mainMobile,
        phone_landline: donor.person?.phoneLandline,
        email: donor.person?.email,
        house_number: donor.person?.houseNumber,
        street_name: donor.person?.street?.name,
        street_id: donor.person?.streetId,
        zip_code: donor.person?.street?.zipCode?.code,
        city_name: donor.person?.city?.name,
        city_id: donor.person?.cityId,
        state_name: donor.person?.city?.state?.name,
        state_id: donor.person?.city?.stateId,
        country_name: donor.person?.country?.name,
        country_id: donor.person?.countryId,
        english_name: donor.person?.englishName ? {
            title_before: donor.person.englishName.titleBefore,
            first_name: donor.person.englishName.firstName,
            last_name: donor.person.englishName.lastName,
            title_after: donor.person.englishName.titleAfter
        } : null,
        fundraiser_first_name: donor.fundraiser?.person?.firstName,
        fundraiser_last_name: donor.fundraiser?.person?.lastName,
        ...extra
    };
}

function mapPersonToFrontend(person) {
    return {
        id: person.id,
        first_name: person.firstName,
        last_name: person.lastName,
        phone_landline: person.phoneLandline,
        email: person.email,
        main_mobile: person.mainMobile,
        city_id: person.cityId,
        street_id: person.streetId,
        house_number: person.houseNumber,
        client_id: person.clientId,
        synagogue: person.synagogue
    };
} 