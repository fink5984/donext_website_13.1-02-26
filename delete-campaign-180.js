const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const campaignId = 180;

  console.log(`=== מחיקת קמפיין ${campaignId} מה-DB ===\n`);

  // בדיקה שהקמפיין קיים
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    console.log(`קמפיין ${campaignId} לא נמצא.`);
    return;
  }
  console.log(`נמצא קמפיין: ${campaign.name}`);

  // --- תורמים ---
  const donors = await prisma.donor.findMany({
    where: { campaignId },
    select: { id: true },
  });
  const donorIds = donors.map((d) => d.id);
  console.log(`\nמספר תורמים: ${donorIds.length}`);

  if (donorIds.length > 0) {
    // תרומות
    const donations = await prisma.donation.findMany({
      where: { donorId: { in: donorIds } },
      select: { id: true },
    });
    const donationIds = donations.map((d) => d.id);
    console.log(`מספר תרומות: ${donationIds.length}`);

    if (donationIds.length > 0) {
      // הערות תרומות
      const deletedDonationNotes = await prisma.donationNote.deleteMany({
        where: { donationId: { in: donationIds } },
      });
      console.log(`נמחקו ${deletedDonationNotes.count} הערות תרומות`);

      // מחיקת תרומות
      const deletedDonations = await prisma.donation.deleteMany({
        where: { donorId: { in: donorIds } },
      });
      console.log(`נמחקו ${deletedDonations.count} תרומות`);
    }

    // תשובות לשאלות
    const deletedQA = await prisma.questionAnswer.deleteMany({
      where: { donorId: { in: donorIds } },
    });
    console.log(`נמחקו ${deletedQA.count} תשובות לשאלות`);

    // הערות תורמים
    const deletedDonorNotes = await prisma.donorNote.deleteMany({
      where: { donorId: { in: donorIds } },
    });
    console.log(`נמחקו ${deletedDonorNotes.count} הערות תורמים`);

    // תורמים
    const deletedDonors = await prisma.donor.deleteMany({ where: { campaignId } });
    console.log(`נמחקו ${deletedDonors.count} תורמים`);
  }

  // --- מגייסים ---
  const fundraisers = await prisma.fundraiser.findMany({
    where: { campaignId },
    select: { id: true },
  });
  const fundraiserIds = fundraisers.map((f) => f.id);
  console.log(`\nמספר מגייסים: ${fundraiserIds.length}`);

  if (fundraiserIds.length > 0) {
    // Emoji reactions
    const deletedEmoji = await prisma.emojiReaction.deleteMany({
      where: {
        OR: [
          { fromId: { in: fundraiserIds } },
          { toId: { in: fundraiserIds } },
        ],
      },
    });
    console.log(`נמחקו ${deletedEmoji.count} emoji reactions`);

    const deletedFundraisers = await prisma.fundraiser.deleteMany({ where: { campaignId } });
    console.log(`נמחקו ${deletedFundraisers.count} מגייסים`);
  }

  // --- דירוגים ---
  const deletedRanks = await prisma.rank.deleteMany({ where: { campaignId } });
  console.log(`\nנמחקו ${deletedRanks.count} דירוגים`);

  const deletedOperatorRanks = await prisma.operatorRank.deleteMany({ where: { campaignId } });
  console.log(`נמחקו ${deletedOperatorRanks.count} דירוגי אופרטור`);

  // --- היסטוריית כניסות ---
  const deletedLoginHistory = await prisma.loginHistory.deleteMany({ where: { campaignId } });
  console.log(`נמחקו ${deletedLoginHistory.count} רשומות היסטוריית כניסות`);

  // --- הגדרות מסך ציבורי ---
  try {
    const deletedPublicScreen = await prisma.publicScreenSettings.deleteMany({ where: { campaignId } });
    console.log(`נמחקו ${deletedPublicScreen.count} הגדרות מסך ציבורי`);
  } catch (e) {
    console.log('אין הגדרות מסך ציבורי או שגיאה:', e.message);
  }

  // --- הגדרות מסך קמפיין ---
  try {
    const deletedScreenSettings = await prisma.campaignScreenSetting.deleteMany({ where: { campaignId } });
    console.log(`נמחקו ${deletedScreenSettings.count} הגדרות מסך קמפיין`);
  } catch (e) {
    console.log('אין הגדרות מסך קמפיין או שגיאה:', e.message);
  }

  // --- מחיקת הקמפיין עצמו ---
  await prisma.campaign.delete({ where: { id: campaignId } });
  console.log(`\n✅ קמפיין ${campaignId} (${campaign.name}) נמחק בהצלחה!`);
}

run()
  .catch((e) => {
    console.error('שגיאה:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
