const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const englishWordings = [
  // Style 1 - Conservative (שמרני)
  {
    questionId: 1,
    language: 'en',
    wording: "Based on your knowledge of them, do they have a connection to what's happening in the community?",
    yesText: "Yes, they're connected with the community",
    maybeText: "Sometimes yes, sometimes no",
    noText: "They're more self-focused"
  },
  {
    questionId: 2,
    language: 'en',
    wording: "Would they be among the 'first ten' to donate, or would they wait for others to donate first?",
    yesText: "They'd be comfortable being among the first",
    maybeText: "Hard to say",
    noText: "They'd probably wait for others to donate first"
  },
  {
    questionId: 3,
    language: 'en',
    wording: "If you talk to them properly, do you think you could convince them to open and launch the campaign?",
    yesText: "Yes, I have influence over them",
    maybeText: "Worth a try",
    noText: "Not much chance"
  },
  {
    questionId: 4,
    language: 'en',
    wording: "Do you think they've contributed similar amounts in the past for a public cause?",
    yesText: "Most likely yes",
    maybeText: "Don't know",
    noText: "I don't think so"
  },
  {
    questionId: 5,
    language: 'en',
    wording: "Do they have a connection to our shared campaign goal?",
    yesText: "Yes, it's very relevant to them",
    maybeText: "Somewhat connected, but not very",
    noText: "Honestly, it's not that important to them"
  },
  {
    questionId: 6,
    language: 'en',
    wording: "How important is it to you to give them the opportunity to contribute to our campaign?",
    yesText: "Very important to me",
    maybeText: "Important",
    noText: "Not important to me"
  },
  {
    questionId: 7,
    language: 'en',
    wording: "Given your relationship, do you think you can influence them to donate?",
    yesText: "Yes, I'm sure I'll succeed",
    maybeText: "Maybe, hopefully",
    noText: "Difficult, I don't have access to them"
  },

  // Style 2 - Classic (קלאסי)
  {
    questionId: 8,
    language: 'en',
    wording: "Are they the type who goes with the public flow?",
    yesText: "Yes, they go with the flow",
    maybeText: "So-so",
    noText: "Not really a follower"
  },
  {
    questionId: 9,
    language: 'en',
    wording: "Could they be among the first donors, or would they only donate after their friends do?",
    yesText: "Actually, that suits them",
    maybeText: "Maybe",
    noText: "No, they won't be among the first"
  },
  {
    questionId: 10,
    language: 'en',
    wording: "Can you convince them to be among the first to donate and launch the campaign?",
    yesText: "I'm sure I can",
    maybeText: "Let's try and see",
    noText: "Waste of everyone's time"
  },
  {
    questionId: 11,
    language: 'en',
    wording: "Do you think they've donated such an amount to any organization before?",
    yesText: "I believe so",
    maybeText: "Can't say",
    noText: "Hard for me to believe"
  },
  {
    questionId: 12,
    language: 'en',
    wording: "How important is reaching our campaign goal to them?",
    yesText: "Very important to them, obviously!",
    maybeText: "So-so",
    noText: "Not that significant to them"
  },
  {
    questionId: 13,
    language: 'en',
    wording: "How important is it to you personally that they donate and take part in our shared goal?",
    yesText: "It's burning in me!",
    maybeText: "It's important to me",
    noText: "Not really important to me"
  },
  {
    questionId: 14,
    language: 'en',
    wording: "Based on your relationship, do you think you can influence them to donate?",
    yesText: "There's no way they won't donate!",
    maybeText: "I believe so",
    noText: "I don't think so"
  },

  // Style 3 - Light (קליל)
  {
    questionId: 15,
    language: 'en',
    wording: "Are they the type who flows with the crowd or do you need to drag them along?",
    yesText: "Yes, they're always in the flow",
    maybeText: "Depends on what and who",
    noText: "Less of a crowd follower"
  },
  {
    questionId: 16,
    language: 'en',
    wording: "Are they among those who donate first, or only after everyone else gets involved?",
    yesText: "Totally could open the fundraiser",
    maybeText: "Can't answer that",
    noText: "I think they'd be among the last..."
  },
  {
    questionId: 17,
    language: 'en',
    wording: "Do you believe with some pressure you could get them to open the campaign?",
    yesText: "Absolutely, count on me!",
    maybeText: "There's a chance, I'll try",
    noText: "Don't see that happening"
  },
  {
    questionId: 18,
    language: 'en',
    wording: "Do you think they've donated a similar amount for such a cause before?",
    yesText: "Yes, they're generous with donations",
    maybeText: "No clue",
    noText: "Them?! No way"
  },
  {
    questionId: 19,
    language: 'en',
    wording: "Between us, do they care if this campaign succeeds?",
    yesText: "What a question? It's burning in them!",
    maybeText: "Regular, nothing special",
    noText: "Honestly, doesn't seem like they care"
  },
  {
    questionId: 20,
    language: 'en',
    wording: "And for you personally, how important is it that they donate and participate?",
    yesText: "Very! We need them with us",
    maybeText: "Would be nice, nothing more",
    noText: "Honestly, doesn't really matter to me"
  },
  {
    questionId: 21,
    language: 'en',
    wording: "Based on your relationship, do you think you can get them to open their wallet?",
    yesText: "Of course! They won't say no to me",
    maybeText: "I hope so",
    noText: "Honestly, not sure at all"
  }
];

async function seedEnglishQuestions() {
  console.log('Starting to seed English question wordings...');
  
  for (const wording of englishWordings) {
    try {
      await prisma.questionWording.create({
        data: wording
      });
      console.log(`Created English wording for question ${wording.questionId}`);
    } catch (error) {
      if (error.code === 'P2002') {
        // Unique constraint violation - update instead
        await prisma.questionWording.updateMany({
          where: {
            questionId: wording.questionId,
            language: 'en'
          },
          data: {
            wording: wording.wording,
            yesText: wording.yesText,
            maybeText: wording.maybeText,
            noText: wording.noText
          }
        });
        console.log(`Updated English wording for question ${wording.questionId}`);
      } else {
        console.error(`Error for question ${wording.questionId}:`, error.message);
      }
    }
  }
  
  console.log('Done seeding English questions!');
  process.exit(0);
}

seedEnglishQuestions().catch(e => {
  console.error(e);
  process.exit(1);
});
