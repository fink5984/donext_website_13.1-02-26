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

        const updated = await prisma.person.update({
            where: { id: personId },
            data: updateData,
        });

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
 * מחיקה רכה של איש קשר (active: false)
 */
export async function DELETE(request, { params }) {
    try {
        const { id } = await params;

        await prisma.person.update({
            where: { id: parseInt(id) },
            data: { active: false },
        });

        return NextResponse.json({ message: 'איש קשר הוסתר בהצלחה' });
    } catch (error) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'איש קשר לא נמצא' }, { status: 404 });
        }
        console.error('Error deactivating person:', error);
        return NextResponse.json({ error: 'Failed to deactivate person' }, { status: 500 });
    }
}
