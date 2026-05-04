import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');

pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

export async function POST(request) {
    try {
        const body = await request.json();
        const { fundraiserIds, campaignId, currencySymbol = '₪' } = body;

        if (!fundraiserIds || !Array.isArray(fundraiserIds) || fundraiserIds.length === 0) {
            return NextResponse.json(
                { success: false, error: { message: 'No fundraiser IDs provided' } },
                { status: 400 }
            );
        }

        console.log('🚀 [PDF Server] מתחיל ייצוא PDF בשרת:', {
            fundraisersCount: fundraiserIds.length,
            campaignId
        });

        const startTime = Date.now();

        // שליפת סוג הקמפיין לחישוב התחייבויות
        const campaign = campaignId ? await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: { donationType: true }
        }) : null;
        const isMonthlyCampaign = campaign?.donationType === 'monthly';

        // שליפת נתונים - רק תורמים פעילים
        const fundraisers = await prisma.fundraiser.findMany({
            where: {
                id: { in: fundraiserIds },
                campaignId: campaignId,
                deleted_at: null
            },
            include: {
                person: {
                    select: {
                        firstName: true,
                        lastName: true,
                        mainMobile: true,
                        city: { select: { name: true } },
                        street: { select: { name: true } },
                        houseNumber: true
                    }
                },
                donors: {
                    where: {
                        active: true
                    },
                    include: {
                        person: {
                            select: {
                                firstName: true,
                                lastName: true,
                                mainMobile: true,
                                city: { select: { name: true } },
                                street: { select: { name: true } },
                                houseNumber: true
                            }
                        },
                        donations: {
                            where: {
                                deleted_at: null
                            },
                            select: {
                                monthlyAmount: true,
                                numberOfPayments: true,
                                paymentMethod: true,
                                isUnlimited: true
                            }
                        }
                    }
                }
            }
        });

        console.log('✅ [PDF Server] נתונים נשלפו:', fundraisers.length);

        // הכנת תוכן ה-PDF
        const content = [];

        for (let i = 0; i < fundraisers.length; i++) {
            const fundraiser = fundraisers[i];
            const donors = fundraiser.donors || [];

            console.log(`📄 [PDF Server] מעבד מתרים ${i + 1}/${fundraisers.length}`);

            // עיבוד נתונים
            const processedDonors = donors.map(donor => {
                const currentDonation = donor.donations.reduce(
                    (sum, d) => d.paymentMethod === 'COMMITMENT' ? sum : sum + Number(d.monthlyAmount || 0) * (d.numberOfPayments || 1),
                    0
                );

                const commitmentTotal = donor.donations.reduce((sum, d) => {
                    if (d.paymentMethod !== 'COMMITMENT') return sum;
                    const monthlyAmount = Number(d.monthlyAmount || 0);
                    if (isMonthlyCampaign || d.isUnlimited) return sum + monthlyAmount;
                    return sum + monthlyAmount * (Number(d.numberOfPayments) || 0);
                }, 0);
                
                // Debug log
                if (i === 0 && donors.indexOf(donor) < 2) {
                    console.log('📱 Donor mainMobile:', donor.person?.mainMobile);
                }

                return {
                    name: `${donor.person?.lastName || ''} ${donor.person?.firstName || ''}`.trim(),
                    main_mobile: donor.person?.mainMobile || '-',
                    address: donor.person?.street && donor.person?.houseNumber
                        ? `${donor.person.street.name} ${donor.person.houseNumber}`
                        : (donor.person?.street?.name || '-'),
                    city: donor.person?.city?.name || '-',
                    expectedDonation: Number(donor.expected || 0),
                    currentDonation,
                    commitmentTotal,
                    trafficLightColor: donor.trafficLightColor || 'gray'
                };
            });

            // חישוב סטטיסטיקות
            const expectedSum = processedDonors.reduce((sum, d) => sum + d.expectedDonation, 0);
            const actualSum = processedDonors.reduce((sum, d) => sum + d.currentDonation, 0);
            const actualDonorsCount = processedDonors.filter(d => d.currentDonation > 0).length;

            const fundraiserName = `${fundraiser.person?.lastName || ''} ${fundraiser.person?.firstName || ''}`.trim();

            // כותרת המתרים
            if (i > 0) {
                content.push({ text: '', pageBreak: 'before' });
            }

            content.push({
                text: fundraiserName,
                style: 'header',
                alignment: 'center',
                margin: [0, 0, 0, 10]
            });

            // סטטיסטיקות
            content.push({
                text: `סה"כ תורמים: ${processedDonors.length} | תורמים פעילים: ${actualDonorsCount}`,
                style: 'subheader',
                alignment: 'center'
            });

            content.push({
                text: `צפי: ${expectedSum.toLocaleString()} ${currencySymbol} | בפועל: ${actualSum.toLocaleString()} ${currencySymbol}`,
                style: 'subheader',
                alignment: 'center',
                margin: [0, 0, 0, 15]
            });

            // טבלת תורמים
            const tableBody = [
                [
                    { text: 'צבע', style: 'tableHeader', alignment: 'right' },
                    { text: 'שם', style: 'tableHeader', alignment: 'right' },
                    { text: 'נייד', style: 'tableHeader', alignment: 'right' },
                    { text: 'עיר', style: 'tableHeader', alignment: 'right' },
                    { text: 'צפי', style: 'tableHeader', alignment: 'right' },
                    { text: 'סך תרומה', style: 'tableHeader', alignment: 'right' },
                    { text: 'התחייבויות', style: 'tableHeader', alignment: 'right' }
                ]
            ];

            processedDonors.forEach(donor => {
                const colorText = 
                    donor.trafficLightColor === 'green' ? 'ירוק' : 
                    donor.trafficLightColor === 'orange' ? 'כתום' :
                    donor.trafficLightColor === 'red' ? 'אדום' : 'אפור';

                tableBody.push([
                    { text: colorText, alignment: 'right' },
                    { text: donor.name, alignment: 'right' },
                    { text: donor.main_mobile, alignment: 'left' },
                    { text: donor.city, alignment: 'right' },
                    { text: `${donor.expectedDonation.toLocaleString()} ${currencySymbol}`, alignment: 'right' },
                    { text: `${donor.currentDonation.toLocaleString()} ${currencySymbol}`, alignment: 'right' },
                    { text: donor.commitmentTotal > 0 ? `${donor.commitmentTotal.toLocaleString()} ${currencySymbol}` : '-', alignment: 'right' }
                ]);
            });

            content.push({
                table: {
                    headerRows: 1,
                    widths: ['auto', '*', '*', 'auto', 'auto', 'auto', 'auto'],
                    body: tableBody
                },
                layout: 'lightHorizontalLines'
            });
        }

        // הגדרות המסמך
        const docDefinition = {
            content: content,
            defaultStyle: {
                fontSize: 10
            },
            styles: {
                header: {
                    fontSize: 20,
                    bold: true
                },
                subheader: {
                    fontSize: 12
                },
                tableHeader: {
                    bold: true,
                    fontSize: 11,
                    fillColor: '#eeeeee'
                }
            },
            pageSize: 'A4',
            pageMargins: [40, 40, 40, 40]
        };

        // יצירת PDF
        const pdfBuffer = await new Promise((resolve, reject) => {
            const pdfDocGenerator = pdfMake.createPdf(docDefinition);
            pdfDocGenerator.getBuffer((buffer) => {
                resolve(buffer);
            });
        });

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`🎉 [PDF Server] PDF נוצר בהצלחה! זמן: ${totalTime}s, גודל: ${(pdfBuffer.length / 1024).toFixed(2)}KB`);

        // החזרת PDF
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="fundraisers-detailed.pdf"',
                'Content-Length': pdfBuffer.length.toString()
            }
        });

    } catch (error) {
        console.error('❌ [PDF Server] שגיאה:', error);
        return NextResponse.json(
            { success: false, error: { message: 'Failed to generate PDF', details: error.message } },
            { status: 500 }
        );
    }
}

