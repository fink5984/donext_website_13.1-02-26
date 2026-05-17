import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

const BATCH_SIZE = 100; // Process in smaller batches

// זיהוי כפילויות טלפון/שם בתוך הבאטש והגדרת סטטוס אוטומטית
function detectAndSetDuplicateStatus(peopleData) {
    // ספירת טלפונים — לא סופרים אנשים שסומנו כ-"ראשי" (ignoreDuplicatePhone)
    const phoneCount = {};
    peopleData.forEach(p => {
        if (p.ignoreDuplicatePhone) return; // זה האיש הראשי שנבחר — לא לספור
        const phone = p.mainMobile?.replace(/\D/g, '');
        if (phone) {
            phoneCount[phone] = (phoneCount[phone] || 0) + 1;
        }
    });

    // ספירת שמות
    const nameCount = {};
    peopleData.forEach(p => {
        const name = `${(p.firstName || '').trim()} ${(p.lastName || '').trim()}`.trim();
        if (name) {
            nameCount[name] = (nameCount[name] || 0) + 1;
        }
    });

    // הגדרת סטטוס לאנשים שאין להם סטטוס אבל יש להם כפילות
    return peopleData.map(p => {
        if (p.status || p.ignoreDuplicatePhone) return p; // כבר יש סטטוס או סומן כראשי — לא לדרוס

        const phone = p.mainMobile?.replace(/\D/g, '');
        const name = `${(p.firstName || '').trim()} ${(p.lastName || '').trim()}`.trim();

        if (phone && phoneCount[phone] > 1) {
            return { ...p, status: 'duplicated_phone' };
        }
        if (name && nameCount[name] > 1) {
            return { ...p, status: 'duplicated_name' };
        }
        return p;
    });
}

export async function POST(request) {
    try {
        const data = await request.json();
        const { clientId, people, campaignId } = data;

        // DEBUG: Log all people with their status
        if (people.length > 0) {
            console.log('=== IMPORT DEBUG ===');
            console.log('Total people:', people.length);
            people.forEach((p, i) => {
                console.log(`Person ${i}: ${p.firstName} ${p.lastName} | phone: ${p.phone} | email: ${p.email} | status: ${p.status}`);
            });
            console.log('=====================');
        }

        // Detect which fields are being used in this import
        const activeFields = detectActiveFields(people);
        
        // Update campaign with active fields (merge with existing)
        if (campaignId && Object.keys(activeFields).length > 0) {
            const campaign = await prisma.campaign.findUnique({
                where: { id: parseInt(campaignId) },
                select: { activeFields: true }
            });
            
            const existingFields = campaign?.activeFields || {};
            const mergedFields = { ...existingFields, ...activeFields };
            
            await prisma.campaign.update({
                where: { id: parseInt(campaignId) },
                data: { activeFields: mergedFields }
            });
        }

        // Create import record
        const importRecord = await prisma.import.create({
            data: {
                campaignId: campaignId ? parseInt(campaignId) : null
            }
        });

        // For large imports, process in chunks
        if (people.length > BATCH_SIZE) {
            return await processBatches(clientId, people, importRecord.id);
        }

        const result = await prisma.$transaction(async (tx) => {
            // Update import record with results
            await tx.import.update({
                where: { id: importRecord.id },
                data: {
                    // You can add more fields here if needed
                }
            });
            const importedPeople = [];
            const errors = [];
            const newPeopleIds = [];

            // 1. Batch check existing people by email
            const emails = people.filter(p => p.email).map(p => typeof p.email === 'string' ? p.email.trim() : p.email);
            const existingPeople = await tx.person.findMany({
                where: {
                    email: { in: emails },
                    clientId: parseInt(clientId),
                    active: { not: false }
                },
                include: { city: true, street: true, country: true }
            });
            const existingEmailMap = new Map(existingPeople.map(p => [p.email, p]));

            // 1b. Batch check existing people by phone (for those not matched by email)
            const phones = people
                .filter(p => {
                    const cleanEmail = typeof p.email === 'string' ? p.email.trim() : p.email;
                    return !existingEmailMap.get(cleanEmail);
                })
                .map(p => (p.phone || p.mainMobile) != null ? String(p.phone || p.mainMobile).trim() : null)
                .filter(Boolean);
            const existingByPhone = phones.length > 0 ? await tx.person.findMany({
                where: {
                    mainMobile: { in: phones },
                    clientId: parseInt(clientId),
                    active: { not: false }
                },
                include: { city: true, street: true, country: true }
            }) : [];
            const existingPhoneMap = new Map(existingByPhone.map(p => [p.mainMobile, p]));

            // 2. Batch get/create cities
            const cityNames = [...new Set(people.filter(p => p.city).map(p => typeof p.city === 'string' ? p.city.trim() : p.city))];
            const existingCities = await tx.city.findMany({
                where: { name: { in: cityNames } }
            });
            const cityMap = new Map(existingCities.map(c => [c.name, c]));

            // Create missing cities
            const missingCities = cityNames.filter(name => !cityMap.has(name));
            if (missingCities.length > 0) {
                const newCities = await tx.city.createMany({
                    data: missingCities.map(name => ({ name })),
                    skipDuplicates: true
                });
                // Re-fetch to get IDs
                const createdCities = await tx.city.findMany({
                    where: { name: { in: missingCities } }
                });
                createdCities.forEach(c => cityMap.set(c.name, c));
            }

            // 3. Batch get/create streets  
            const streetData = people.filter(p => p.street && p.city)
                .map(p => ({
                    name: typeof p.street === 'string' ? p.street.trim() : p.street,
                    cityName: typeof p.city === 'string' ? p.city.trim() : p.city
                }));
            const uniqueStreets = streetData.reduce((acc, { name, cityName }) => {
                const key = `${name}-${cityName}`;
                if (!acc.has(key)) {
                    acc.set(key, { name, cityName, cityId: cityMap.get(cityName)?.id });
                }
                return acc;
            }, new Map());

            const streetNames = [...uniqueStreets.values()]
                .filter(s => s.cityId)
                .map(s => ({ name: s.name, cityId: s.cityId }));

            const existingStreets = streetNames.length > 0 ? await tx.street.findMany({
                where: {
                    OR: streetNames.map(s => ({ name: s.name, cityId: s.cityId }))
                }
            }) : [];

            const streetMap = new Map(existingStreets.map(s => [`${s.name}-${s.cityId}`, s]));

            // Create missing streets
            const missingStreets = streetNames.filter(s => !streetMap.has(`${s.name}-${s.cityId}`));
            if (missingStreets.length > 0) {
                await tx.street.createMany({
                    data: missingStreets,
                    skipDuplicates: true
                });
                // Re-fetch to get IDs
                const createdStreets = await tx.street.findMany({
                    where: {
                        OR: missingStreets.map(s => ({ name: s.name, cityId: s.cityId }))
                    }
                });
                createdStreets.forEach(s => streetMap.set(`${s.name}-${s.cityId}`, s));
            }

            // 4. Batch get/create countries
            const countryNames = [...new Set(people.filter(p => p.country).map(p => typeof p.country === 'string' ? p.country.trim() : p.country))];
            const existingCountries = await tx.country.findMany({
                where: { name: { in: countryNames } }
            });
            const countryMap = new Map(existingCountries.map(c => [c.name, c]));

            // Create missing countries
            const missingCountries = countryNames.filter(name => !countryMap.has(name));
            if (missingCountries.length > 0) {
                await tx.country.createMany({
                    data: missingCountries.map(name => ({ name })),
                    skipDuplicates: true
                });
                // Re-fetch to get IDs
                const createdCountries = await tx.country.findMany({
                    where: { name: { in: missingCountries } }
                });
                createdCountries.forEach(c => countryMap.set(c.name, c));
            }

            // 4.5. Batch get/create states
            const stateData = people.filter(p => p.state && p.country)
                .map(p => ({
                    name: typeof p.state === 'string' ? p.state.trim() : p.state,
                    countryName: typeof p.country === 'string' ? p.country.trim() : p.country
                }));
            const uniqueStates = stateData.reduce((acc, { name, countryName }) => {
                const key = `${name}-${countryName}`;
                if (!acc.has(key)) {
                    acc.set(key, { name, countryName, countryId: countryMap.get(countryName)?.id });
                }
                return acc;
            }, new Map());

            const stateNames = [...uniqueStates.values()]
                .filter(s => s.countryId)
                .map(s => ({ name: s.name, countryId: s.countryId }));

            const existingStates = stateNames.length > 0 ? await tx.state.findMany({
                where: {
                    OR: stateNames.map(s => ({ name: s.name, countryId: s.countryId }))
                }
            }) : [];

            const stateMap = new Map(existingStates.map(s => [`${s.name}-${s.countryId}`, s]));

            // Create missing states
            const missingStates = stateNames.filter(s => !stateMap.has(`${s.name}-${s.countryId}`));
            if (missingStates.length > 0) {
                await tx.state.createMany({
                    data: missingStates,
                    skipDuplicates: true
                });
                // Re-fetch to get IDs
                const createdStates = await tx.state.findMany({
                    where: {
                        OR: missingStates.map(s => ({ name: s.name, countryId: s.countryId }))
                    }
                });
                createdStates.forEach(s => stateMap.set(`${s.name}-${s.countryId}`, s));
            }

            // 4.6. Batch get/create zip codes
            const zipData = people.filter(p => p.zipCode && p.city)
                .map(p => ({
                    code: typeof p.zipCode === 'string' ? p.zipCode.trim() : String(p.zipCode),
                    cityName: typeof p.city === 'string' ? p.city.trim() : p.city
                }));
            const uniqueZips = zipData.reduce((acc, { code, cityName }) => {
                const key = `${code}-${cityName}`;
                if (!acc.has(key)) {
                    acc.set(key, { code, cityName, cityId: cityMap.get(cityName)?.id });
                }
                return acc;
            }, new Map());

            const zipCodes = [...uniqueZips.values()]
                .filter(z => z.cityId)
                .map(z => ({ code: z.code, cityId: z.cityId }));

            const existingZips = zipCodes.length > 0 ? await tx.zipCode.findMany({
                where: {
                    OR: zipCodes.map(z => ({ code: z.code, cityId: z.cityId }))
                }
            }) : [];

            const zipMap = new Map(existingZips.map(z => [`${z.code}-${z.cityId}`, z]));

            // Create missing zip codes
            const missingZips = zipCodes.filter(z => !zipMap.has(`${z.code}-${z.cityId}`));
            if (missingZips.length > 0) {
                await tx.zipCode.createMany({
                    data: missingZips,
                    skipDuplicates: true
                });
                // Re-fetch to get IDs
                const createdZips = await tx.zipCode.findMany({
                    where: {
                        OR: missingZips.map(z => ({ code: z.code, cityId: z.cityId }))
                    }
                });
                createdZips.forEach(z => zipMap.set(`${z.code}-${z.cityId}`, z));
            }

            // 5. Process people (now with all lookup data ready)
            // First, separate existing people from new people
            for (const person of people) {
                const cleanEmail = typeof person.email === 'string' ? person.email.trim() : person.email;
                const cleanPhone = (person.phone || person.mainMobile) != null ? String(person.phone || person.mainMobile).trim() : null;
                const existingPerson = existingEmailMap.get(cleanEmail) || (cleanPhone ? existingPhoneMap.get(cleanPhone) : null);
                if (existingPerson) {
                    newPeopleIds.push(existingPerson.id);
                    importedPeople.push(existingPerson);

                    // עדכון סטטוס ושדות נוספים לאנשים קיימים
                    const incomingStatus = person.status || null;
                    const updateData = {};
                    if (incomingStatus && existingPerson.status !== incomingStatus) {
                        updateData.status = incomingStatus;
                    }
                    // עדכון טלפון אם סופק בייבוא (חשוב לזיהוי כפילויות טלפון)
                    const incomingPhone = (person.phone || person.mainMobile);
                    if (incomingPhone) {
                        updateData.mainMobile = String(incomingPhone).trim();
                    }
                    if (Object.keys(updateData).length > 0) {
                        await tx.person.update({
                            where: { id: existingPerson.id },
                            data: updateData
                        });
                        console.log(`Updated existing person ${existingPerson.id}:`, JSON.stringify(updateData));
                    }
                }
            }

            // Prepare data for new people (those that don't exist)
            let newPeopleData = [];
            const englishNamesData = []; // לשמירת שמות באנגלית
            
            for (const person of people) {
                const cleanEmail = typeof person.email === 'string' ? person.email.trim() : person.email;
                const cleanPhone = (person.phone || person.mainMobile) != null ? String(person.phone || person.mainMobile).trim() : null;
                const cleanCity = typeof person.city === 'string' ? person.city.trim() : person.city;
                const cleanStreet = typeof person.street === 'string' ? person.street.trim() : person.street;
                const cleanCountry = typeof person.country === 'string' ? person.country.trim() : person.country;
                const cleanState = typeof person.state === 'string' ? person.state.trim() : person.state;
                const cleanZipCode = person.zipCode != null ? String(person.zipCode).trim() : null;

                const existingPerson = existingEmailMap.get(cleanEmail) || (cleanPhone ? existingPhoneMap.get(cleanPhone) : null);
                if (!existingPerson) {
                    // Get IDs from maps
                    const city = cityMap.get(cleanCity);
                    const street = cleanStreet && city ?
                        streetMap.get(`${cleanStreet}-${city.id}`) : null;
                    const country = countryMap.get(cleanCountry);
                    const state = cleanState && country ?
                        stateMap.get(`${cleanState}-${country.id}`) : null;
                    const zipCode = cleanZipCode && city ?
                        zipMap.get(`${cleanZipCode}-${city.id}`) : null;

                    // Update city with stateId if needed
                    if (city && state && !city.stateId) {
                        await tx.city.update({
                            where: { id: city.id },
                            data: { stateId: state.id }
                        });
                    }

                    // Update street with zipCodeId if needed
                    if (street && zipCode && !street.zipCodeId) {
                        await tx.street.update({
                            where: { id: street.id },
                            data: { zipCodeId: zipCode.id }
                        });
                    }

                    const personDataEntry = {
                        clientId: parseInt(clientId),
                        firstName: person.firstName != null ? String(person.firstName).trim() : null,
                        lastName: person.lastName != null ? String(person.lastName).trim() : null,
                        phoneLandline: (person.landlinePhone || person.phoneLandline) != null ? String(person.landlinePhone || person.phoneLandline).trim() : null,
                        email: person.email != null ? String(person.email).trim() : null,
                        titleBefore: person.titleBefore != null ? String(person.titleBefore).trim() : null,
                        titleAfter: person.titleAfter != null ? String(person.titleAfter).trim() : null,
                        mainMobile: (person.phone || person.mainMobile) != null ? String(person.phone || person.mainMobile).trim() : null,
                        secondaryMobile: person.secondaryMobile != null ? String(person.secondaryMobile).trim() : null,
                        houseNumber: person.houseNumber != null ? String(person.houseNumber).trim() : null,
                        cityId: city?.id,
                        streetId: street?.id,
                        countryId: country?.id,
                        hasExistingHok: person.hasExistingHok,
                        clientSystemId: person.clientSystemId != null ? String(person.clientSystemId).trim() : null,
                        synagogue: person.synagogue != null ? String(person.synagogue).trim() : null,
                        fatherName: person.fatherName != null ? String(person.fatherName).trim() : null,
                        motherName: person.motherName != null ? String(person.motherName).trim() : null,
                        wifeName: person.wifeName != null ? String(person.wifeName).trim() : null,
                        personalId: person.personalId != null ? String(person.personalId).trim() : null,
                        aptNumber: person.aptNumber != null ? String(person.aptNumber).trim() : null,
                        mailingAddress: person.mailingAddress != null ? String(person.mailingAddress).trim() : null,
                        birthDate: person.birthDate != null ? new Date(person.birthDate) : null,
                        status: person.status || null,
                        ignoreDuplicatePhone: person.ignoreDuplicatePhone || false // דגל זמני — ניקוי לפני שמירה ב-DB
                    };

                    newPeopleData.push(personDataEntry);

                    // שמירת נתוני שמות באנגלית לטיפול מאוחר יותר
                    const hasEnglishName = person.firstNameEn || person.lastNameEn || person.titleBeforeEn || person.titleAfterEn;
                    if (hasEnglishName) {
                        englishNamesData.push({
                            // נשתמש באינדקס במערך לזיהוי האדם מאוחר יותר
                            index: newPeopleData.length - 1,
                            email: personDataEntry.email,
                            mainMobile: personDataEntry.mainMobile,
                            phoneLandline: personDataEntry.phoneLandline,
                            firstName: personDataEntry.firstName,
                            lastName: personDataEntry.lastName,
                            englishName: {
                                titleBefore: person.titleBeforeEn != null ? String(person.titleBeforeEn).trim() : null,
                                firstName: person.firstNameEn != null ? String(person.firstNameEn).trim() : null,
                                lastName: person.lastNameEn != null ? String(person.lastNameEn).trim() : null,
                                titleAfter: person.titleAfterEn != null ? String(person.titleAfterEn).trim() : null,
                            }
                        });
                    }
                }
            }

            // זיהוי כפילויות בצד השרת וסימון סטטוס אוטומטי
            newPeopleData = detectAndSetDuplicateStatus(newPeopleData);
            console.log('=== AFTER DUPLICATE DETECTION ===');
            newPeopleData.forEach((p, i) => {
                console.log(`Person ${i}: ${p.firstName} ${p.lastName} | status: ${p.status}`);
            });
            console.log('=================================');

            // Batch create all new people
            if (newPeopleData.length > 0) {
                try {
                    // Add importId to all new people (strip non-DB fields)
                    const peopleWithImportId = newPeopleData.map(({ ignoreDuplicatePhone, ...person }) => ({
                        ...person,
                        importId: importRecord.id
                    }));

                    await tx.person.createMany({
                        data: peopleWithImportId,
                        skipDuplicates: true
                    });

                    // Fetch the created people with their relations using importId
                    // This is much simpler and more reliable than matching by email/name/phone
                    const createdPeople = await tx.person.findMany({
                        where: {
                            clientId: parseInt(clientId),
                            importId: importRecord.id
                        },
                        include: {
                            city: true,
                            street: true,
                            country: true
                        }
                    });

                    importedPeople.push(...createdPeople);
                    newPeopleIds.push(...createdPeople.map(p => p.id));

                    // יצירת שמות באנגלית לאנשים שנוצרו
                    if (englishNamesData.length > 0) {
                        console.log('English names to create:', englishNamesData.length);
                        console.log('Created people count:', createdPeople.length);
                        
                        const englishNamesToCreate = [];
                        for (const enData of englishNamesData) {
                            // מחפשים התאמה לפי מייל, טלפון נייד, טלפון קווי, או שם מלא
                            const person = createdPeople.find(p => 
                                (enData.email && p.email === enData.email) || 
                                (enData.mainMobile && p.mainMobile === enData.mainMobile) ||
                                (enData.phoneLandline && p.phoneLandline === enData.phoneLandline) ||
                                (enData.firstName && enData.lastName && p.firstName === enData.firstName && p.lastName === enData.lastName)
                            );
                            if (person) {
                                console.log('Found match for person:', person.id, person.firstName, person.lastName);
                                englishNamesToCreate.push({
                                    personId: person.id,
                                    ...enData.englishName
                                });
                            } else {
                                console.log('No match found for:', enData.firstName, enData.lastName);
                            }
                        }

                        if (englishNamesToCreate.length > 0) {
                            await tx.personEnglishName.createMany({
                                data: englishNamesToCreate,
                                skipDuplicates: true
                            });
                        }
                    }
                } catch (error) {
                    // If batch insert fails, try individual inserts with error handling
                    for (const personData of newPeopleData) {
                        try {
                            const newPerson = await tx.person.create({
                                data: personData,
                                include: {
                                    city: true,
                                    street: true,
                                    country: true
                                }
                            });
                            importedPeople.push(newPerson);
                            newPeopleIds.push(newPerson.id);
                        } catch (individualError) {
                            // Find the original person data for error reporting
                            const originalPerson = people.find(p =>
                                p.email === personData.email ||
                                (p.firstName === personData.firstName && p.lastName === personData.lastName)
                            );
                            errors.push({
                                person: originalPerson || personData,
                                error: handlePrismaError(individualError)
                            });
                        }
                    }
                }
            }

            return {
                imported: importedPeople.length,
                newPeopleIds,
                errors: errors.length > 0 ? errors : undefined
            };
        }, {
            timeout: 30000 // 30 seconds timeout for smaller batches
        });

        return NextResponse.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Error importing people:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

// Process large imports in batches to avoid timeout
async function processBatches(clientId, people, importId) {
    const totalBatches = Math.ceil(people.length / BATCH_SIZE);
    let totalImported = 0;
    let allNewPeopleIds = [];
    let allErrors = [];

    for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, people.length);
        const batch = people.slice(start, end);

        try {
            const result = await processSingleBatch(clientId, batch, importId);
            totalImported += result.imported;
            allNewPeopleIds.push(...result.newPeopleIds);
            if (result.errors) {
                allErrors.push(...result.errors);
            }
        } catch (error) {
            console.error(`Error processing batch ${i + 1}:`, error);
            // Continue with other batches, collect error
            allErrors.push({
                batch: i + 1,
                error: handlePrismaError(error)
            });
        }
    }

    return NextResponse.json({
        success: true,
        imported: totalImported,
        newPeopleIds: allNewPeopleIds,
        errors: allErrors.length > 0 ? allErrors : undefined,
        batchesProcessed: totalBatches
    });
}

// Optimized single batch processing  
async function processSingleBatch(clientId, people, importId) {
    return await prisma.$transaction(async (tx) => {
        const importedPeople = [];
        const errors = [];
        const newPeopleIds = [];

        // 1. Batch check existing people by email - optimize query
        const emails = people.filter(p => p.email).map(p => typeof p.email === 'string' ? p.email.trim() : p.email);
        const existingPeople = emails.length > 0 ? await tx.person.findMany({
            where: {
                email: { in: emails },
                clientId: parseInt(clientId),
                active: { not: false }
            },
            select: { id: true, email: true } // Only select needed fields
        }) : [];
        const existingEmailMap = new Map(existingPeople.map(p => [p.email, p]));

        // 1b. Batch check existing people by phone (for those not matched by email)
        const phones = people
            .filter(p => {
                const cleanEmail = typeof p.email === 'string' ? p.email.trim() : p.email;
                return !existingEmailMap.get(cleanEmail);
            })
            .map(p => (p.phone || p.mainMobile) != null ? String(p.phone || p.mainMobile).trim() : null)
            .filter(Boolean);
        const existingByPhone = phones.length > 0 ? await tx.person.findMany({
            where: {
                mainMobile: { in: phones },
                clientId: parseInt(clientId),
                active: { not: false }
            },
            select: { id: true, email: true, mainMobile: true }
        }) : [];
        const existingPhoneMap = new Map(existingByPhone.map(p => [p.mainMobile, p]));

        // 2. Pre-create all reference data in parallel
        const [cityMap, countryMap] = await Promise.all([
            createCitiesMap(tx, people),
            createCountriesMap(tx, people)
        ]);
        
        // Create streets map (depends on cityMap)
        const streetMap = await createStreetsMap(tx, people, cityMap);

        // 3. Separate existing from new people
        for (const person of people) {
            const cleanEmail = typeof person.email === 'string' ? person.email.trim() : person.email;
            const cleanPhone = (person.phone || person.mainMobile) != null ? String(person.phone || person.mainMobile).trim() : null;
            const existingPerson = existingEmailMap.get(cleanEmail) || (cleanPhone ? existingPhoneMap.get(cleanPhone) : null);
            if (existingPerson) {
                newPeopleIds.push(existingPerson.id);
                importedPeople.push({ id: existingPerson.id });

                // עדכון סטטוס ושדות נוספים לאנשים קיימים
                const incomingStatus = person.status || null;
                const updateData = {};
                if (incomingStatus && existingPerson.status !== incomingStatus) {
                    updateData.status = incomingStatus;
                }
                // עדכון טלפון אם סופק בייבוא (חשוב לזיהוי כפילויות טלפון)
                const incomingPhone = (person.phone || person.mainMobile);
                if (incomingPhone) {
                    updateData.mainMobile = String(incomingPhone).trim();
                }
                if (Object.keys(updateData).length > 0) {
                    await tx.person.update({
                        where: { id: existingPerson.id },
                        data: updateData
                    });
                    console.log(`Updated existing person ${existingPerson.id}:`, JSON.stringify(updateData));
                }
            }
        }

        // 4. Prepare new people data and English names (optimized)
        let newPeopleData = [];
        const englishNamesData = []; // לשמירת שמות באנגלית
        
        const newPeople = people.filter(person => {
            const cleanEmail = typeof person.email === 'string' ? person.email.trim() : person.email;
            const cleanPhone = (person.phone || person.mainMobile) != null ? String(person.phone || person.mainMobile).trim() : null;
            return !existingEmailMap.get(cleanEmail) && !(cleanPhone && existingPhoneMap.get(cleanPhone));
        });
        
        for (const person of newPeople) {
            const cleanCity = typeof person.city === 'string' ? person.city.trim() : person.city;
            const cleanCountry = typeof person.country === 'string' ? person.country.trim() : person.country;
            const cleanStreet = typeof person.street === 'string' ? person.street.trim() : person.street;

            const city = cityMap.get(cleanCity);
            const country = countryMap.get(cleanCountry);
            const street = cleanStreet && city ? streetMap.get(`${cleanStreet}-${city.id}`) : null;

            const personDataEntry = {
                clientId: parseInt(clientId),
                firstName: person.firstName != null ? String(person.firstName).trim() : null,
                lastName: person.lastName != null ? String(person.lastName).trim() : null,
                phoneLandline: (person.landlinePhone || person.phoneLandline) != null ? String(person.landlinePhone || person.phoneLandline).trim() : null,
                email: person.email != null ? String(person.email).trim() : null,
                titleBefore: person.titleBefore != null ? String(person.titleBefore).trim() : null,
                titleAfter: person.titleAfter != null ? String(person.titleAfter).trim() : null,
                mainMobile: (person.phone || person.mainMobile) != null ? String(person.phone || person.mainMobile).trim() : null,
                secondaryMobile: person.secondaryMobile != null ? String(person.secondaryMobile).trim() : null,
                houseNumber: person.houseNumber != null ? String(person.houseNumber).trim() : null,
                cityId: city?.id,
                streetId: street?.id || null,
                countryId: country?.id,
                hasExistingHok: person.hasExistingHok,
                clientSystemId: person.clientSystemId != null ? String(person.clientSystemId).trim() : null,
                synagogue: person.synagogue != null ? String(person.synagogue).trim() : null,
                status: person.status || null // הוספת סטטוס הבעיות
            };
            
            newPeopleData.push(personDataEntry);
            
            // שמירת נתוני שמות באנגלית לטיפול מאוחר יותר
            const hasEnglishName = person.firstNameEn || person.lastNameEn || person.titleBeforeEn || person.titleAfterEn;
            if (hasEnglishName) {
                englishNamesData.push({
                    index: newPeopleData.length - 1,
                    email: personDataEntry.email,
                    mainMobile: personDataEntry.mainMobile,
                    phoneLandline: personDataEntry.phoneLandline,
                    firstName: personDataEntry.firstName,
                    lastName: personDataEntry.lastName,
                    englishName: {
                        titleBefore: person.titleBeforeEn != null ? String(person.titleBeforeEn).trim() : null,
                        firstName: person.firstNameEn != null ? String(person.firstNameEn).trim() : null,
                        lastName: person.lastNameEn != null ? String(person.lastNameEn).trim() : null,
                        titleAfter: person.titleAfterEn != null ? String(person.titleAfterEn).trim() : null,
                    }
                });
            }
        }

        // זיהוי כפילויות בצד השרת וסימון סטטוס אוטומטי
        newPeopleData = detectAndSetDuplicateStatus(newPeopleData);

        // 5. Batch create new people
        if (newPeopleData.length > 0) {
            try {
                // Get the max ID before creating new people (to identify newly created ones)
                const maxIdBefore = await tx.person.aggregate({
                    where: { clientId: parseInt(clientId) },
                    _max: { id: true }
                });
                const lastIdBefore = maxIdBefore._max.id || 0;

                // Add importId to all new people (strip non-DB fields)
                const peopleWithImportId = newPeopleData.map(({ ignoreDuplicatePhone, ...person }) => ({
                    ...person,
                    importId: importId
                }));

                await tx.person.createMany({
                    data: peopleWithImportId,
                    skipDuplicates: true
                });

                // Get created people - those with ID greater than the max before AND matching this importId
                const createdPeople = await tx.person.findMany({
                    where: {
                        clientId: parseInt(clientId),
                        importId: importId,
                        id: { gt: lastIdBefore }
                    },
                    select: { 
                        id: true, 
                        email: true, 
                        mainMobile: true, 
                        phoneLandline: true, 
                        firstName: true, 
                        lastName: true 
                    }
                });

                newPeopleIds.push(...createdPeople.map(p => p.id));
                importedPeople.push(...createdPeople);
                
                // יצירת שמות באנגלית לאנשים שנוצרו
                if (englishNamesData.length > 0) {
                    const englishNamesToCreate = [];
                    for (const enData of englishNamesData) {
                        // מחפשים התאמה לפי מייל, טלפון נייד, טלפון קווי, או שם מלא
                        const person = createdPeople.find(p => 
                            (enData.email && p.email === enData.email) || 
                            (enData.mainMobile && p.mainMobile === enData.mainMobile) ||
                            (enData.phoneLandline && p.phoneLandline === enData.phoneLandline) ||
                            (enData.firstName && enData.lastName && p.firstName === enData.firstName && p.lastName === enData.lastName)
                        );
                        if (person) {
                            englishNamesToCreate.push({
                                personId: person.id,
                                ...enData.englishName
                            });
                        }
                    }

                    if (englishNamesToCreate.length > 0) {
                        await tx.personEnglishName.createMany({
                            data: englishNamesToCreate,
                            skipDuplicates: true
                        });
                    }
                }
            } catch (error) {
                console.error('Batch insert failed:', error);
                errors.push({
                    batch: true,
                    error: handlePrismaError(error)
                });
            }
        }

        return {
            imported: importedPeople.length,
            newPeopleIds,
            errors: errors.length > 0 ? errors : undefined
        };
    }, {
        timeout: 15000 // 15 seconds per batch
    });
}

// Helper functions for creating reference data maps
async function createCitiesMap(tx, people) {
    const cityNames = [...new Set(people.filter(p => p.city).map(p => typeof p.city === 'string' ? p.city.trim() : p.city))];
    if (cityNames.length === 0) return new Map();

    const existingCities = await tx.city.findMany({
        where: { name: { in: cityNames } },
        select: { id: true, name: true }
    });
    const cityMap = new Map(existingCities.map(c => [c.name, c]));

    const missingCities = cityNames.filter(name => !cityMap.has(name));
    if (missingCities.length > 0) {
        await tx.city.createMany({
            data: missingCities.map(name => ({ name })),
            skipDuplicates: true
        });

        const createdCities = await tx.city.findMany({
            where: { name: { in: missingCities } },
            select: { id: true, name: true }
        });
        createdCities.forEach(c => cityMap.set(c.name, c));
    }

    return cityMap;
}

async function createCountriesMap(tx, people) {
    const countryNames = [...new Set(people.filter(p => p.country).map(p => typeof p.country === 'string' ? p.country.trim() : p.country))];
    if (countryNames.length === 0) return new Map();

    const existingCountries = await tx.country.findMany({
        where: { name: { in: countryNames } },
        select: { id: true, name: true }
    });
    const countryMap = new Map(existingCountries.map(c => [c.name, c]));

    const missingCountries = countryNames.filter(name => !countryMap.has(name));
    if (missingCountries.length > 0) {
        await tx.country.createMany({
            data: missingCountries.map(name => ({ name })),
            skipDuplicates: true
        });

        const createdCountries = await tx.country.findMany({
            where: { name: { in: missingCountries } },
            select: { id: true, name: true }
        });
        createdCountries.forEach(c => countryMap.set(c.name, c));
    }

    return countryMap;
}

async function createStreetsMap(tx, people, cityMap) {
    // Collect unique street + city combinations
    const streetData = people.filter(p => p.street && p.city)
        .map(p => ({
            name: typeof p.street === 'string' ? p.street.trim() : p.street,
            cityName: typeof p.city === 'string' ? p.city.trim() : p.city
        }));
    
    const uniqueStreets = streetData.reduce((acc, { name, cityName }) => {
        const city = cityMap.get(cityName);
        if (city) {
            const key = `${name}-${city.id}`;
            if (!acc.has(key)) {
                acc.set(key, { name, cityId: city.id });
            }
        }
        return acc;
    }, new Map());
    
    if (uniqueStreets.size === 0) return new Map();
    
    const streetValues = [...uniqueStreets.values()];
    
    // Find existing streets
    const existingStreets = await tx.street.findMany({
        where: {
            OR: streetValues.map(s => ({ name: s.name, cityId: s.cityId }))
        },
        select: { id: true, name: true, cityId: true }
    });
    
    const streetMap = new Map(existingStreets.map(s => [`${s.name}-${s.cityId}`, s]));
    
    // Create missing streets
    const missingStreets = streetValues.filter(s => !streetMap.has(`${s.name}-${s.cityId}`));
    if (missingStreets.length > 0) {
        await tx.street.createMany({
            data: missingStreets,
            skipDuplicates: true
        });
        
        const createdStreets = await tx.street.findMany({
            where: {
                OR: missingStreets.map(s => ({ name: s.name, cityId: s.cityId }))
            },
            select: { id: true, name: true, cityId: true }
        });
        createdStreets.forEach(s => streetMap.set(`${s.name}-${s.cityId}`, s));
    }
    
    return streetMap;
}

// Detect which optional fields are being used in the import
function detectActiveFields(people) {
    const fields = {};
    
    // Check for title fields
    if (people.some(p => p.titleBefore)) fields.titleBefore = true;
    if (people.some(p => p.titleAfter)) fields.titleAfter = true;
    
    // Check for English name fields
    if (people.some(p => p.titleBeforeEn || p.firstNameEn || p.lastNameEn || p.titleAfterEn)) {
        fields.englishName = true;
    }
    
    // Check for location fields
    if (people.some(p => p.country)) fields.country = true;
    if (people.some(p => p.state)) fields.state = true;
    if (people.some(p => p.zipCode)) fields.zipCode = true;
    
    // Check for other optional fields
    if (people.some(p => p.synagogue)) fields.synagogue = true;
    
    return fields;
}
