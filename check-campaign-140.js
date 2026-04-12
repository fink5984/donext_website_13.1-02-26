const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // מצא את הקמפיין כדי לדעת כמה שאלות יש
    const campaign = await prisma.campaign.findUnique({
        where: { id: 140 },
        select: { 
            id: true,
            questionnaireStyleId: true,
            questionnaireStyle: {
                select: {
                    questions: {
                        select: { id: true }
                    }
                }
            }
        }
    });
    
    const totalQuestionsInStyle = campaign?.questionnaireStyle?.questions?.length || 0;
    console.log('Campaign 140 questionnaire style ID:', campaign?.questionnaireStyleId);
    console.log('Total questions in style:', totalQuestionsInStyle);

    // מצא את התורמים של המתרים גרינבוים (fundraiserId: 2147) בקמפיין 140
    const donors = await prisma.donor.findMany({
        where: {
            campaignId: 140,
            fundraiserId: 2147,
            active: true
        },
        select: {
            id: true,
            lastQuestionnaireByFundraiserId: true,
            lastForecastByFundraiserId: true,
            trafficLightColor: true,
            person: {
                select: {
                    firstName: true,
                    lastName: true
                }
            },
            questionAnswers: {
                select: {
                    id: true,
                    donorId: true,
                    wording: {
                        select: {
                            questionId: true
                        }
                    }
                }
            }
        }
    });

    console.log('\nTotal donors found:', donors.length);
    
    // ספירת צבעים
    const colorCounts = { green: 0, orange: 0, red: 0, gray: 0, null: 0 };
    donors.forEach(d => {
        const color = d.trafficLightColor || 'null';
        colorCounts[color] = (colorCounts[color] || 0) + 1;
    });
    
    console.log('\n--- Color Distribution ---');
    console.log(colorCounts);
    
    // בדיקה כמה שאלות נענו לכל תורם
    console.log('\n--- Answers per donor ---');
    const questionsAnswered = new Set();
    donors.forEach(d => {
        const uniqueQuestions = new Set(d.questionAnswers?.map(qa => qa.wording?.questionId) || []);
        uniqueQuestions.forEach(q => questionsAnswered.add(q));
        console.log(`- ${d.person?.firstName} ${d.person?.lastName}: ${uniqueQuestions.size} questions answered (color: ${d.trafficLightColor})`);
    });
    
    console.log('\n--- Unique questions answered across all donors ---');
    console.log('Questions:', [...questionsAnswered].sort());
    console.log('Total:', questionsAnswered.size, 'of', totalQuestionsInStyle, 'questions');

    // בדיקה - כמה תורמים ענו על כל השאלות
    const withAllAnswers = donors.filter(d => {
        const uniqueQuestions = new Set(d.questionAnswers?.map(qa => qa.wording?.questionId) || []);
        return uniqueQuestions.size >= totalQuestionsInStyle;
    });

    console.log('\n--- Summary ---');
    console.log('Total donors:', donors.length);
    console.log('Donors with all questions answered:', withAllAnswers.length);
    console.log('Donors without color (null or gray):', donors.filter(d => !d.trafficLightColor || d.trafficLightColor === 'gray').length);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
