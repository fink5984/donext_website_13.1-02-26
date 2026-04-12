import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';

/**
 * POST /api/donors/questionnaire
 * שמירת תשובות לשאלון של תורם
 * 
 * @body {Object} request
 * @body {number} fundraiserId - מספר המתרים
 * @body {number} donorId - מספר התורם
 * @body {number} campaignId - מספר הקמפיין
 * @body {number} [questionId] - מספר השאלה (לתשובה בודדת)
 * @body {number} [answer] - התשובה (1=כן, 2=אולי, 3=לא) (לתשובה בודדת)
 * @body {Array<{questionId: number, answer: number}>} [answers] - מערך תשובות (לריבוי תשובות)
 * 
 * @returns {Object} תשובה עם הנתונים שנשמרו
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { fundraiserId, donorId, campaignId, questionId, answer, answers } = body;

    // וולידציה - שדות חובה
    if (!fundraiserId || !donorId || !campaignId) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: 'fundraiserId, donorId, and campaignId are required',
          received: { fundraiserId, donorId, campaignId }
        },
        { status: 400 }
      );
    }

    // בדיקה שיש תשובה בודדת או מערך תשובות
    if (!questionId && !answers) {
      return NextResponse.json(
        { 
          error: 'Missing answer data',
          details: 'Either provide questionId and answer, or provide answers array'
        },
        { status: 400 }
      );
    }

    // אם יש תשובה בודדת - צריך גם את מספר התשובה
    if (questionId && answer === undefined) {
      return NextResponse.json(
        { 
          error: 'Missing answer',
          details: 'When providing questionId, answer is required (1=YES, 2=MAYBE, 3=NO)'
        },
        { status: 400 }
      );
    }

    // בדיקה שהקמפיין קיים
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseInt(campaignId) }
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found', campaignId },
        { status: 404 }
      );
    }

    // בדיקה שהמתרים קיים
    const fundraiser = await prisma.fundraiser.findUnique({
      where: { id: parseInt(fundraiserId) }
    });

    if (!fundraiser) {
      return NextResponse.json(
        { error: 'Fundraiser not found', fundraiserId },
        { status: 404 }
      );
    }

    // בדיקה שהתורם קיים
    const donor = await prisma.donor.findUnique({
      where: { id: parseInt(donorId) }
    });

    if (!donor) {
      return NextResponse.json(
        { error: 'Donor not found', donorId },
        { status: 404 }
      );
    }

    // המרת התשובה למספר (1, 2, 3)
    const answerMapping = {
      1: 'YES',
      2: 'MAYBE',
      3: 'NO'
    };

    // פונקציה לשמירת תשובה בודדת
    const saveAnswer = async (qId, answerValue) => {
      // בדיקה שהשאלה קיימת
      const question = await prisma.questionnaireQuestion.findUnique({
        where: { id: parseInt(qId) },
        include: {
          wordings: {
            orderBy: { updated_at: 'desc' },
            take: 1
          }
        }
      });

      if (!question || question.wordings.length === 0) {
        throw new Error(`Question not found or has no wordings: ${qId}`);
      }

      const latestWording = question.wordings[0];
      const answerChoice = answerMapping[parseInt(answerValue)];

      if (!answerChoice) {
        throw new Error(`Invalid answer value: ${answerValue}. Must be 1, 2, or 3`);
      }

      // שמירת התשובה (upsert - עדכון אם קיים, יצירה אם לא)
      return await prisma.questionAnswer.upsert({
        where: {
          donorId_wordingId: {
            donorId: parseInt(donorId),
            wordingId: latestWording.id
          }
        },
        update: {
          choice: answerChoice,
          updated_at: new Date()
        },
        create: {
          donorId: parseInt(donorId),
          wordingId: latestWording.id,
          choice: answerChoice
        },
        include: {
          wording: {
            include: {
              question: true
            }
          }
        }
      });
    };

    let results;

    // אם יש תשובה בודדת
    if (questionId) {
      try {
        const savedAnswer = await saveAnswer(questionId, answer);
        results = {
          fundraiserId: parseInt(fundraiserId),
          donorId: parseInt(donorId),
          campaignId: parseInt(campaignId),
          saved: [{
            questionId: savedAnswer.wording.question.id,
            questionText: savedAnswer.wording.question.text,
            answer: Object.keys(answerMapping).find(key => answerMapping[key] === savedAnswer.choice),
            answerText: savedAnswer.choice,
            wordingId: savedAnswer.wordingId
          }]
        };
      } catch (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    } 
    // אם יש מערך תשובות
    else if (answers && Array.isArray(answers)) {
      const savedAnswers = [];
      const errors = [];

      for (const answerItem of answers) {
        try {
          const savedAnswer = await saveAnswer(answerItem.questionId, answerItem.answer);
          savedAnswers.push({
            questionId: savedAnswer.wording.question.id,
            questionText: savedAnswer.wording.question.text,
            answer: Object.keys(answerMapping).find(key => answerMapping[key] === savedAnswer.choice),
            answerText: savedAnswer.choice,
            wordingId: savedAnswer.wordingId
          });
        } catch (error) {
          errors.push({
            questionId: answerItem.questionId,
            error: error.message
          });
        }
      }

      results = {
        fundraiserId: parseInt(fundraiserId),
        donorId: parseInt(donorId),
        campaignId: parseInt(campaignId),
        saved: savedAnswers,
        errors: errors.length > 0 ? errors : undefined
      };
    }

    // עדכון lastQuestionnaireByFundraiserId על התורם
    await prisma.donor.update({
      where: { id: parseInt(donorId) },
      data: {
        lastQuestionnaireByFundraiserId: parseInt(fundraiserId)
      }
    });

    // חישוב צבע רמזור לתורם - קריאה ישירה לקוד
    try {
      // שליפת התשובות של התורם
      const donorAnswers = await prisma.questionAnswer.findMany({
        where: {
          donorId: parseInt(donorId)
        },
        include: {
          wording: {
            include: {
              question: {
                include: {
                  categories: {
                    include: {
                      category: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (donorAnswers.length > 0) {
        // שליפת משקלי הקטגוריות
        const categories = await prisma.questionCategory.findMany();
        const categoryWeights = {};
        categories.forEach(cat => {
          categoryWeights[cat.name] = parseFloat(cat.weight) || 0;
        });

        // חישוב ציון
        let S_total = 0;
        let W_max = 0;

        donorAnswers.forEach(answer => {
          // המרת תשובה לערך מספרי
          let rValue;
          switch(answer.choice) {
            case 'YES':
              rValue = 1;
              break;
            case 'MAYBE':
              rValue = 0.5;
              break;
            case 'NO':
              rValue = 0;
              break;
            default:
              rValue = 0;
          }

          // חישוב משקל שאלה
          const questionCategories = answer.wording.question.categories.map(qc => qc.category.name);
          const questionWeight = questionCategories.reduce((sum, catName) => {
            return sum + (categoryWeights[catName] || 0);
          }, 0);

          S_total += rValue * questionWeight;
          W_max += questionWeight;
        });

        // נרמול וקביעת צבע
        const normalizedScore = W_max > 0 ? S_total / W_max : 0;
        let color = 'red';
        if (normalizedScore >= 0.75) color = 'green';
        else if (normalizedScore >= 0.30) color = 'orange';

        // עדכון צבע רמזור
        await prisma.donor.update({
          where: { id: parseInt(donorId) },
          data: {
            trafficLightColor: color
          }
        });

        console.log(`Traffic light calculated for donor ${donorId}: ${color} (score: ${normalizedScore})`);
      }
    } catch (calcError) {
      console.error('Error calculating traffic light:', calcError);
      // לא נכשל את כל הבקשה בגלל שגיאה בחישוב רמזור
    }

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('Error saving questionnaire answers:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/donors/questionnaire
 * קבלת תשובות לשאלון של תורם
 * 
 * @query {number} fundraiserId - מספר המתרים
 * @query {number} donorId - מספר התורם
 * @query {number} campaignId - מספר הקמפיין
 * @query {number} [questionId] - מספר שאלה ספציפית (אופציונלי)
 * 
 * @returns {Object} תשובות השאלון
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fundraiserId = searchParams.get('fundraiserId');
    const donorId = searchParams.get('donorId');
    const campaignId = searchParams.get('campaignId');
    const questionId = searchParams.get('questionId');

    // וולידציה
    if (!fundraiserId || !donorId || !campaignId) {
      return NextResponse.json(
        { 
          error: 'Missing required parameters',
          details: 'fundraiserId, donorId, and campaignId are required'
        },
        { status: 400 }
      );
    }

    // בדיקה שהקמפיין קיים
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseInt(campaignId) }
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found', campaignId },
        { status: 404 }
      );
    }

    // שליפת התורם עם התשובות שלו
    const donor = await prisma.donor.findUnique({
      where: { id: parseInt(donorId) },
      include: {
        person: {
          include: {
            questionAnswers: {
              include: {
                wording: {
                  include: {
                    question: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!donor) {
      return NextResponse.json(
        { error: 'Donor not found', donorId },
        { status: 404 }
      );
    }

    // המרת התשובות לפורמט פשוט
    const answerMapping = {
      'YES': 1,
      'MAYBE': 2,
      'NO': 3
    };

    let answers = donor.person.questionAnswers.map(qa => ({
      questionId: qa.wording.question.id,
      questionText: qa.wording.question.text,
      answer: answerMapping[qa.choice],
      answerText: qa.choice,
      wordingId: qa.wordingId
    }));

    // אם ביקשו שאלה ספציפית
    if (questionId) {
      answers = answers.filter(a => a.questionId === parseInt(questionId));
    }

    return NextResponse.json({
      fundraiserId: parseInt(fundraiserId),
      donorId: parseInt(donorId),
      campaignId: parseInt(campaignId),
      donorName: donor.person.name,
      lastQuestionnaireByFundraiserId: donor.lastQuestionnaireByFundraiserId,
      answers
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching questionnaire answers:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/donors/questionnaire
 * מחיקת תשובות לשאלון של תורם
 * 
 * @body {Object} request
 * @body {number} fundraiserId - מספר המתרים
 * @body {number} donorId - מספר התורם
 * @body {number} campaignId - מספר הקמפיין
 * @body {number} [questionId] - מספר שאלה ספציפית למחיקה (אופציונלי)
 * 
 * @returns {Object} מידע על המחיקה
 */
export async function DELETE(request) {
  try {
    const body = await request.json();
    const { fundraiserId, donorId, campaignId, questionId } = body;

    // וולידציה
    if (!fundraiserId || !donorId || !campaignId) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: 'fundraiserId, donorId, and campaignId are required'
        },
        { status: 400 }
      );
    }

    // בדיקה שהקמפיין קיים
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseInt(campaignId) }
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found', campaignId },
        { status: 404 }
      );
    }

    // בדיקה שהתורם קיים
    const donor = await prisma.donor.findUnique({
      where: { id: parseInt(donorId) },
      include: {
        person: true
      }
    });

    if (!donor) {
      return NextResponse.json(
        { error: 'Donor not found', donorId },
        { status: 404 }
      );
    }

    let deletedCount;

    // אם יש מספר שאלה ספציפי - מחק רק אותה
    if (questionId) {
      // מצא את ה-wording של השאלה
      const question = await prisma.questionnaireQuestion.findUnique({
        where: { id: parseInt(questionId) },
        include: {
          wordings: {
            orderBy: { updated_at: 'desc' },
            take: 1
          }
        }
      });

      if (!question || question.wordings.length === 0) {
        return NextResponse.json(
          { error: 'Question not found or has no wordings', questionId },
          { status: 404 }
        );
      }

      const result = await prisma.questionAnswer.deleteMany({
        where: {
          donorId: parseInt(donorId),
          wordingId: question.wordings[0].id
        }
      });

      deletedCount = result.count;
    } 
    // אחרת מחק את כל התשובות של התורם
    else {
      const result = await prisma.questionAnswer.deleteMany({
        where: {
          donorId: parseInt(donorId)
        }
      });

      deletedCount = result.count;
    }

    return NextResponse.json({
      fundraiserId: parseInt(fundraiserId),
      donorId: parseInt(donorId),
      campaignId: parseInt(campaignId),
      deletedCount,
      message: questionId 
        ? `Deleted answer for question ${questionId}` 
        : 'Deleted all questionnaire answers'
    }, { status: 200 });

  } catch (error) {
    console.error('Error deleting questionnaire answers:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
