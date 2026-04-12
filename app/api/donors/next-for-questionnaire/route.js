import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';

/**
 * GET /api/donors/next-for-questionnaire
 * קבלת התורם הבא שצריך למלא עליו שאלון
 * 
 * @query {string} phone - מספר טלפון של המתרים
 * @query {number} campaignId - מספר הקמפיין
 * 
 * @returns {Object} פרטי התורם הבא או null אם אין תורמים
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const campaignId = searchParams.get('campaignId');

    // וולידציה
    if (!phone || !campaignId) {
      return NextResponse.json(
        { 
          error: 'Missing required parameters',
          details: 'phone and campaignId are required'
        },
        { status: 400 }
      );
    }

    // ניקוי מספר טלפון (הסרת רווחים ותווים מיוחדים)
    let cleanPhone = phone.replace(/[\s\-()]/g, '');
    
    // טיפול בפורמט בינלאומי +972/972
    if (cleanPhone.startsWith('+972')) {
      cleanPhone = '0' + cleanPhone.substring(4);
    } else if (cleanPhone.startsWith('972')) {
      cleanPhone = '0' + cleanPhone.substring(3);
    }

    // חיפוש המתרים לפי טלפון וקמפיין
    const fundraiser = await prisma.fundraiser.findFirst({
      where: {
        campaignId: parseInt(campaignId),
        person: {
          is: {
            OR: [
              { mainMobile: cleanPhone },
              { secondaryMobile: cleanPhone }
            ]
          }
        }
      },
      include: {
        person: true,
        campaign: {
          include: {
            questionnaireStyle: true
          }
        }
      }
    });

    if (!fundraiser) {
      return NextResponse.json(
        { 
          error: 'Fundraiser not found',
          details: `No fundraiser found with phone ${phone} in campaign ${campaignId}`
        },
        { status: 404 }
      );
    }

    // חיפוש כל התורמים של המתרים הזה בקמפיין הזה
    const donors = await prisma.donor.findMany({
      where: {
        fundraiserId: fundraiser.id,
        campaignId: parseInt(campaignId),
        active: true
      },
      include: {
        person: true,
        questionAnswers: {
          include: {
            wording: {
              include: {
                question: true
              }
            }
          }
        }
      },
      orderBy: {
        id: 'asc' // לפי סדר הוספה
      }
    });

    if (donors.length === 0) {
      return NextResponse.json(
        { 
          message: 'No donors found',
          fundraiser: {
            id: fundraiser.id,
            name: `${fundraiser.person.firstName || ''} ${fundraiser.person.lastName || ''}`.trim() || 'ללא שם',
            phone: fundraiser.person.mainMobile || fundraiser.person.secondaryMobile
          },
          nextDonor: null
        },
        { status: 200 }
      );
    }

    // מציאת התורם הראשון שעדיין לא ענה על השאלון
    // תורם נחשב שענה אם יש לו תשובות בשאלון או אם lastQuestionnaireByFundraiserId מוגדר
    const nextDonor = donors.find(donor => {
      // בדיקה 1: אם יש לו תשובות
      const hasAnswers = donor.questionAnswers && donor.questionAnswers.length > 0;
      
      // בדיקה 2: אם lastQuestionnaireByFundraiserId מוגדר
      const hasQuestionnaireRecord = donor.lastQuestionnaireByFundraiserId !== null;
      
      // התורם לא ענה אם שני התנאים לא מתקיימים
      return !hasAnswers && !hasQuestionnaireRecord;
    });

    if (!nextDonor) {
      return NextResponse.json(
        { 
          message: 'All donors have answered the questionnaire',
          fundraiser: {
            id: fundraiser.id,
            name: `${fundraiser.person.firstName || ''} ${fundraiser.person.lastName || ''}`.trim() || 'ללא שם',
            phone: fundraiser.person.mainMobile || fundraiser.person.secondaryMobile
          },
          stats: {
            totalDonors: donors.length,
            answeredQuestionnaire: donors.length,
            remainingDonors: 0
          },
          nextDonor: null
        },
        { status: 200 }
      );
    }

    // חישוב סטטיסטיקה
    const answeredCount = donors.filter(d => 
      (d.questionAnswers && d.questionAnswers.length > 0) || 
      d.lastQuestionnaireByFundraiserId !== null
    ).length;

    return NextResponse.json({
      fundraiser: {
        id: fundraiser.id,
        name: `${fundraiser.person.firstName || ''} ${fundraiser.person.lastName || ''}`.trim() || 'ללא שם',
        phone: fundraiser.person.mainMobile || fundraiser.person.secondaryMobile,
        campaignId: fundraiser.campaignId,
        campaignName: fundraiser.campaign.name
      },
      stats: {
        totalDonors: donors.length,
        answeredQuestionnaire: answeredCount,
        remainingDonors: donors.length - answeredCount
      },
      nextDonor: {
        id: nextDonor.id,
        donorId: nextDonor.id,
        personId: nextDonor.personId,
        name: `${nextDonor.person.firstName || ''} ${nextDonor.person.lastName || ''}`.trim() || 'ללא שם',
        phone: nextDonor.person.mainMobile || nextDonor.person.secondaryMobile,
        email: nextDonor.person.email,
        city: nextDonor.person.city,
        address: nextDonor.person.address,
        trafficLightColor: nextDonor.trafficLightColor,
        expected: nextDonor.expected ? parseFloat(nextDonor.expected) : null,
        lastForecastByFundraiserId: nextDonor.lastForecastByFundraiserId,
        lastQuestionnaireByFundraiserId: nextDonor.lastQuestionnaireByFundraiserId
      },
      questionnaireStyle: fundraiser.campaign.questionnaireStyle ? {
        id: fundraiser.campaign.questionnaireStyle.id,
        name: fundraiser.campaign.questionnaireStyle.name
      } : null
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching next donor for questionnaire:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
