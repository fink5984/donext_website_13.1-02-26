import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/people/[id]
 * עריכת איש קשר — כולל שדות חדשים, שם אנגלי, תגיות ושדות מותאמים
 */
export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const personId = parseInt(id);
        const body = await request.json();

        const {
            firstName, lastName, titleBefore, titleAfter,
            mainMobile, secondaryMobile, phoneLandline, email,
            cityId, streetId, houseNumber, countryId,
            synagogue, fatherName, motherName, grandfatherName,
            birthDate, rating, notes, active, status,
            englishName, tagIds, customFields
        } = body;

        // בניית אובייקט עדכון — רק שדות שנשלחו
        const updateData = {};
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (titleBefore !== undefined) updateData.titleBefore = titleBefore;
        if (titleAfter !== undefined) updateData.titleAfter = titleAfter;
        if (mainMobile !== undefined) updateData.mainMobile = mainMobile;
        if (secondaryMobile !== undefined) updateData.secondaryMobile = secondaryMobile;
        if (phoneLandline !== undefined) updateData.phoneLandline = phoneLandline;
        if (email !== undefined) updateData.email = email;
        if (cityId !== undefined) updateData.cityId = cityId ? parseInt(cityId) : null;
        if (streetId !== undefined) updateData.streetId = streetId ? parseInt(streetId) : null;
        if (houseNumber !== undefined) updateData.houseNumber = houseNumber ? String(houseNumber).trim() : null;
        if (countryId !== undefined) updateData.countryId = countryId ? parseInt(countryId) : null;
        if (synagogue !== undefined) updateData.synagogue = synagogue;
        if (fatherName !== undefined) updateData.fatherName = fatherName;
        if (motherName !== undefined) updateData.motherName = motherName;
        if (grandfatherName !== undefined) updateData.grandfatherName = grandfatherName;
        if (birthDate !== undefined) updateData.birthDate = birthDate ? new Date(birthDate) : null;
        if (rating !== undefined) updateData.rating = rating;
        if (notes !== undefined) updateData.notes = notes;
        if (active !== undefined) updateData.active = active;
        if (status !== undefined) updateData.status = status;

        // שמור את המייל הישן לפני העדכון
        const oldPerson = email !== undefined ? await prisma.person.findUnique({
            where: { id: personId },
            select: { email: true }
        }) : null;

        const updated = await prisma.person.update({
            where: { id: personId },
            data: updateData,
        });

        // סנכרון מייל ב-User אם המייל השתנה (למתרים מקושר)
        if (email !== undefined && oldPerson && email !== oldPerson.email) {
            const fundraiserWithUser = await prisma.fundraiser.findFirst({
                where: { personId, deleted_at: null },
                select: { userId: true }
            });
            if (fundraiserWithUser?.userId) {
                // בדוק שהמייל החדש לא שייך כבר למשתמש אחר
                const conflictUser = email ? await prisma.user.findFirst({
                    where: { email: { equals: email, mode: 'insensitive' } }
                }) : null;
                if (!conflictUser || conflictUser.id === fundraiserWithUser.userId) {
                    await prisma.user.update({
                        where: { id: fundraiserWithUser.userId },
                        data: { email: email || undefined }
                    });
                }
            }
        }

        // עדכון שם אנגלי
        if (englishName) {
            const hasData = englishName.firstName || englishName.lastName || englishName.titleBefore || englishName.titleAfter;
            if (hasData) {
                await prisma.personEnglishName.upsert({
                    where: { personId },
                    update: {
                        firstName: englishName.firstName || null,
                        lastName: englishName.lastName || null,
                        titleBefore: englishName.titleBefore || null,
                        titleAfter: englishName.titleAfter || null,
                    },
                    create: {
                        personId,
                        firstName: englishName.firstName || null,
                        lastName: englishName.lastName || null,
                        titleBefore: englishName.titleBefore || null,
                        titleAfter: englishName.titleAfter || null,
                    },
                });
            }
        }

        // עדכון תגיות — החלפה מלאה
        if (tagIds !== undefined) {
            // מחיקת כל התגיות הקיימות
            await prisma.personTag.deleteMany({ where: { personId } });

            // יצירת תגיות חדשות
            if (tagIds.length > 0) {
                await prisma.personTag.createMany({
                    data: tagIds.map(tagId => ({
                        personId,
                        tagId: parseInt(tagId),
                    })),
                    skipDuplicates: true,
                });
            }
        }

        // עדכון שדות מותאמים אישית
        if (customFields && Array.isArray(customFields)) {
            for (const cf of customFields) {
                if (!cf.fieldDefinitionId) continue;
                await prisma.customFieldValue.upsert({
                    where: {
                        personId_fieldDefinitionId: {
                            personId,
                            fieldDefinitionId: parseInt(cf.fieldDefinitionId),
                        },
                    },
                    update: { value: cf.value ?? null },
                    create: {
                        personId,
                        fieldDefinitionId: parseInt(cf.fieldDefinitionId),
                        value: cf.value ?? null,
                    },
                });
            }
        }

        return NextResponse.json({ personId: updated.id, updated: true });
    } catch (error) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'איש קשר לא נמצא' }, { status: 404 });
        }
        console.error('Error updating person:', error);
        return NextResponse.json({ error: 'Failed to update person' }, { status: 500 });
    }
}

/**
 * DELETE /api/people/[id]
 * אם אין תרומות: מחיקה מלאה עם cascade
 * אם יש תרומות וללא ?force=true: מחזיר { hasDonations: true } עם 409
 * אם יש תרומות עם ?force=true: מחיקה רכה (active: false)
 */
export async function DELETE(request, { params }) {
    try {
        const { id } = await params;
        const personId = parseInt(id);
        const { searchParams } = new URL(request.url);
        const force = searchParams.get('force') === 'true';

        // Check for actual donation records
        const donorWithDonations = await prisma.donor.findFirst({
            where: {
                personId,
                donations: { some: {} }
            },
            select: { id: true }
        });

        if (donorWithDonations && !force) {
            return NextResponse.json({ hasDonations: true }, { status: 409 });
        }

        if (donorWithDonations) {
            // Has donations + force=true → soft delete only
            await prisma.person.update({
                where: { id: personId },
                data: { active: false },
            });
        } else {
            // No donations → hard delete with full cascade
            await prisma.$transaction(async (tx) => {
                const donors = await tx.donor.findMany({
                    where: { personId },
                    select: { id: true }
                });
                const donorIds = donors.map(d => d.id);

                if (donorIds.length > 0) {
                    await tx.donorNote.deleteMany({ where: { donorId: { in: donorIds } } });
                    await tx.questionAnswer.deleteMany({ where: { donorId: { in: donorIds } } });
                    await tx.donor.deleteMany({ where: { id: { in: donorIds } } });
                }
                await tx.fundraiser.deleteMany({ where: { personId } });
                await tx.person.delete({ where: { id: personId } });
            });
        }

        return NextResponse.json({ message: 'איש קשר נמחק בהצלחה' });
    } catch (error) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'איש קשר לא נמצא' }, { status: 404 });
        }
        console.error('Error deleting person:', error);
        return NextResponse.json({ error: 'Failed to delete person' }, { status: 500 });
    }
}
