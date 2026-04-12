import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';
import bcrypt from 'bcrypt';

/**
 * GET - שליפת אנשים עם בעיות (status לא ריק)
 * מחזיר אנשים שהם תורמים או מתרימים בקמפיין הנוכחי (לפי mode)
 * מוודא שכפילויות טלפון/שם באמת קיימות באותו קמפיין
 */
export async function GET(request) {
    try {
        const campaignId = getCampaignId(request);
        if (!campaignId) {
            return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
        }

        const parsedCampaignId = parseInt(campaignId);
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode'); // 'fundraisers' or default (donors)
        const isFundraiserMode = mode === 'fundraisers';

        // שליפת תורמים/מתרימים עם אנשים שיש להם status
        const records = isFundraiserMode
            ? await prisma.fundraiser.findMany({
                where: {
                    campaignId: parsedCampaignId,
                    deleted_at: null,
                    person: { status: { not: null } }
                },
                include: {
                    person: { include: { city: true, street: true } }
                }
            })
            : await prisma.donor.findMany({
                where: {
                    campaignId: parsedCampaignId,
                    person: {
                        status: { not: null },
                        // אם יש לאדם גם מתרים באותו קמפיין - הטיפול יהיה דרך שמות לטיפול של מתרימים
                        fundraisers: {
                            none: {
                                campaignId: parsedCampaignId,
                                deleted_at: null
                            }
                        }
                    }
                },
                include: {
                    person: { include: { city: true, street: true } }
                }
            });

        // שליפת כל התורמים/מתרימים בקמפיין לבדיקת כפילויות אמיתיות
        const allCampaignRecords = isFundraiserMode
            ? await prisma.fundraiser.findMany({
                where: { campaignId: parsedCampaignId, deleted_at: null },
                include: {
                    person: {
                        select: { id: true, mainMobile: true, firstName: true, lastName: true }
                    }
                }
            })
            : await prisma.donor.findMany({
                where: { campaignId: parsedCampaignId },
                include: {
                    person: {
                        select: { id: true, mainMobile: true, firstName: true, lastName: true }
                    }
                }
            });

        // יצירת מפות לבדיקת כפילויות
        const phoneCountMap = new Map(); // phone -> count
        const nameCountMap = new Map(); // "firstName|lastName" -> count
        
        allCampaignRecords.forEach(d => {
            const phone = d.person.mainMobile?.replace(/\D/g, '');
            if (phone) {
                phoneCountMap.set(phone, (phoneCountMap.get(phone) || 0) + 1);
            }
            
            const nameKey = `${(d.person.firstName || '').toLowerCase().trim()}|${(d.person.lastName || '').toLowerCase().trim()}`;
            if (nameKey !== '|') {
                nameCountMap.set(nameKey, (nameCountMap.get(nameKey) || 0) + 1);
            }
        });

        // מיפוי התוצאות - רק אם הכפילות אמיתית
        const people = [];
        const statusesToClear = []; // רשימת personIds שצריך לנקות להם status
        
        for (const record of records) {
            const person = record.person;
            let isValidIssue = true;
            
            // בדיקה אם duplicated_phone - האם באמת יש כפילות באותו קמפיין?
            if (person.status === 'duplicated_phone') {
                const phone = person.mainMobile?.replace(/\D/g, '');
                if (!phone || (phoneCountMap.get(phone) || 0) <= 1) {
                    isValidIssue = false;
                    statusesToClear.push(person.id);
                }
            }
            
            // בדיקה אם duplicated_name - האם באמת יש כפילות באותו קמפיין?
            if (person.status === 'duplicated_name') {
                const nameKey = `${(person.firstName || '').toLowerCase().trim()}|${(person.lastName || '').toLowerCase().trim()}`;
                if (nameKey === '|' || (nameCountMap.get(nameKey) || 0) <= 1) {
                    isValidIssue = false;
                    statusesToClear.push(person.id);
                }
            }
            
            if (isValidIssue) {
                people.push({
                    id: person.id,
                    donorId: record.id, // donorId או fundraiserId - לפי ה-mode
                    fundraiserId: isFundraiserMode ? record.id : undefined,
                    firstName: person.firstName || '',
                    lastName: person.lastName || '',
                    phone: person.mainMobile || '',
                    secondaryMobile: person.secondaryMobile || '',
                    landlinePhone: person.phoneLandline || '',
                    email: person.email || '',
                    city: person.city?.name || '',
                    address: person.street?.name || '',
                    houseNumber: person.houseNumber || '',
                    status: person.status,
                    originalIndex: person.id
                });
            }
        }
        
        // ניקוי סטטוסים שאינם רלוונטיים (כפילויות שלא קיימות באותו קמפיין)
        if (statusesToClear.length > 0) {
            await prisma.person.updateMany({
                where: { id: { in: statusesToClear } },
                data: { status: null }
            });
            console.log(`Cleared ${statusesToClear.length} invalid duplicate statuses for campaign ${parsedCampaignId}`);
        }

        // ספירה לפי סוג בעיה
        const summary = {
            total: people.length,
            missingPhones: people.filter(p => p.status === 'missing_phone').length,
            missingEmails: people.filter(p => p.status === 'missing_email').length,
            duplicatedPhones: people.filter(p => p.status === 'duplicated_phone').length,
            duplicatedNames: people.filter(p => p.status === 'duplicated_name').length,
            invalidEmails: people.filter(p => p.status === 'invalid_email').length
        };

        return NextResponse.json({
            success: true,
            data: people,
            summary
        });

    } catch (error) {
        console.error('Error fetching people with issues:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

/**
 * PATCH - עדכון פרטי אדם ו/או הסרת status
 */
export async function PATCH(request) {
    try {
        const body = await request.json();
        const { personId, updates, clearStatus } = body;

        if (!personId) {
            return NextResponse.json({ error: 'Person ID is required' }, { status: 400 });
        }

        const updateData = {};
        
        // עדכון שדות
        if (updates) {
            if (updates.phone !== undefined) updateData.mainMobile = updates.phone;
            if (updates.email !== undefined) updateData.email = updates.email;
            if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
            if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
        }

        // ניקוי status אם נדרש
        if (clearStatus) {
            updateData.status = null;
        }

        const updated = await prisma.person.update({
            where: { id: parseInt(personId) },
            data: updateData,
            include: {
                city: true,
                street: true
            }
        });

        // אם עדכנו מייל ויש מתרים מקושר ללא משתמש - ניצור משתמש
        if (updates?.email && clearStatus) {
            try {
                const fundraiser = await prisma.fundraiser.findFirst({
                    where: {
                        personId: parseInt(personId),
                        deleted_at: null,
                        userId: null
                    }
                });

                if (fundraiser && updated.email) {
                    // בדיקה אם קיים משתמש עם המייל
                    const existingUser = await prisma.user.findUnique({
                        where: { email: updated.email }
                    });

                    if (existingUser) {
                        // קישור המתרים למשתמש קיים
                        await prisma.fundraiser.update({
                            where: { id: fundraiser.id },
                            data: { userId: existingUser.id }
                        });
                        // הוספת תפקיד fundraiser אם חסר
                        if (!existingUser.role.includes('fundraiser')) {
                            await prisma.user.update({
                                where: { id: existingUser.id },
                                data: { role: [...existingUser.role, 'fundraiser'] }
                            });
                        }
                    } else {
                        // יצירת משתמש חדש
                        const defaultPassword = '123456';
                        const salt = await bcrypt.genSalt(10);
                        const hashedPassword = await bcrypt.hash(defaultPassword, salt);

                        const newUser = await prisma.user.create({
                            data: {
                                email: updated.email,
                                password: hashedPassword,
                                role: ['fundraiser'],
                                phone: updated.mainMobile || null
                            }
                        });

                        await prisma.fundraiser.update({
                            where: { id: fundraiser.id },
                            data: { userId: newUser.id }
                        });
                    }
                }
            } catch (userError) {
                console.error('Error creating user for fundraiser:', userError);
                // לא נכשיל את כל הפעולה - האדם כבר עודכן
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                id: updated.id,
                firstName: updated.firstName,
                lastName: updated.lastName,
                phone: updated.mainMobile,
                email: updated.email,
                status: updated.status,
                city: updated.city?.name,
                address: updated.street?.name
            }
        });

    } catch (error) {
        console.error('Error updating person:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

/**
 * DELETE - מחיקת תורם/מתרים (והסרתו מהקמפיין)
 * תומך גם במחיקה בודדת וגם במחיקת אצווה (batch)
 */
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const donorId = searchParams.get('donorId');
        const fundraiserId = searchParams.get('fundraiserId');
        const personId = searchParams.get('personId');
        const donorIds = searchParams.get('donorIds'); // batch deletion
        const fundraiserIds = searchParams.get('fundraiserIds'); // batch deletion fundraisers
        const personIds = searchParams.get('personIds'); // batch status clear

        // Batch deletion of donors
        if (donorIds) {
            const ids = donorIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
            if (ids.length > 0) {
                // מחיקת תרומות קודם (עקב foreign key)
                await prisma.donation.deleteMany({
                    where: { donorId: { in: ids } }
                });
                // מחיקת התורמים
                await prisma.donor.deleteMany({
                    where: { id: { in: ids } }
                });
            }
            return NextResponse.json({ success: true, deletedCount: ids.length });
        }

        // Batch deletion of fundraisers
        if (fundraiserIds) {
            const ids = fundraiserIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
            if (ids.length > 0) {
                // מציאת המתרימים לפני מחיקה כדי לקבל personId ו-campaignId
                const fundraisersToDelete = await prisma.fundraiser.findMany({
                    where: { id: { in: ids } },
                    select: { id: true, personId: true, campaignId: true }
                });

                // מחיקת המתרימים
                await prisma.fundraiser.deleteMany({
                    where: { id: { in: ids } }
                });

                // מחיקת תורמים מקושרים לאותם אנשים באותם קמפיינים
                for (const fr of fundraisersToDelete) {
                    const donor = await prisma.donor.findFirst({
                        where: { personId: fr.personId, campaignId: fr.campaignId }
                    });
                    if (donor) {
                        await prisma.donation.deleteMany({ where: { donorId: donor.id } });
                        await prisma.donor.delete({ where: { id: donor.id } });
                    }
                    // ניקוי status מהאדם
                    await prisma.person.update({
                        where: { id: fr.personId },
                        data: { status: null }
                    });
                }
            }
            return NextResponse.json({ success: true, deletedCount: ids.length });
        }

        // Batch status clear for persons
        if (personIds) {
            const ids = personIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
            if (ids.length > 0) {
                await prisma.person.updateMany({
                    where: { id: { in: ids } },
                    data: { status: null }
                });
            }
            return NextResponse.json({ success: true, updatedCount: ids.length });
        }

        if (!donorId && !fundraiserId && !personId) {
            return NextResponse.json({ error: 'Donor ID, Fundraiser ID or Person ID is required' }, { status: 400 });
        }

        if (fundraiserId) {
            const parsedFundraiserId = parseInt(fundraiserId);
            // מציאת המתרים לפני מחיקה כדי לקבל personId ו-campaignId
            const fundraiserRecord = await prisma.fundraiser.findUnique({
                where: { id: parsedFundraiserId },
                select: { personId: true, campaignId: true }
            });
            // מחיקת מתרים מהקמפיין
            await prisma.fundraiser.delete({
                where: { id: parsedFundraiserId }
            });
            // מחיקת תורם מקושר לאותו אדם באותו קמפיין
            if (fundraiserRecord) {
                const donor = await prisma.donor.findFirst({
                    where: { personId: fundraiserRecord.personId, campaignId: fundraiserRecord.campaignId }
                });
                if (donor) {
                    await prisma.donation.deleteMany({ where: { donorId: donor.id } });
                    await prisma.donor.delete({ where: { id: donor.id } });
                }
                // ניקוי status מהאדם
                await prisma.person.update({
                    where: { id: fundraiserRecord.personId },
                    data: { status: null }
                });
            }
        } else if (donorId) {
            const parsedDonorId = parseInt(donorId);
            // מחיקת תרומות קודם (עקב foreign key)
            await prisma.donation.deleteMany({
                where: { donorId: parsedDonorId }
            });
            // מחיקת תורם מהקמפיין (לא מוחק את האדם עצמו)
            await prisma.donor.delete({
                where: { id: parsedDonorId }
            });
        } else if (personId) {
            // ניקוי status בלבד, לא מוחקים
            await prisma.person.update({
                where: { id: parseInt(personId) },
                data: { status: null }
            });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting donor:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
