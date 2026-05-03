/**
 * Binary search to find the specific donor in campaign 168 causing Prisma error
 * "Failed to convert rust String into napi string"
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ log: ['error'] });

function getBasicInclude() {
  return {
    person: {
      include: {
        city: true,
        street: true,
        englishName: true,
      }
    },
    campaign: true,
    fundraiser: { include: { person: true } },
    donations: {
      where: { deleted_at: null },
      select: {
        id: true, monthlyAmount: true, numberOfPayments: true,
        isUnlimited: true, paymentMethod: true, donateApproval: true,
        note: true, followUpDate: true, created_at: true, updated_at: true
      }
    },
    donorNotes: {
      orderBy: { created_at: 'desc' },
      select: {
        id: true, note: true, followUpDate: true, noteCompleted: true,
        noteCompletedAt: true, assignedToName: true, created_at: true
      }
    },
  };
}

async function tryFetch(donorIds) {
  try {
    await prisma.donor.findMany({
      where: { id: { in: donorIds } },
      include: getBasicInclude(),
    });
    return true;
  } catch (e) {
    if (e.message && e.message.includes('rust')) return false;
    throw e;
  }
}

async function main() {
  // Get all donor IDs for campaign 168
  const allDonors = await prisma.donor.findMany({
    where: { campaignId: 168 },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  const ids = allDonors.map(d => d.id);
  console.log(`Total donors in campaign 168: ${ids.length}`);

  // Binary search to find the bad batch
  let lo = 0, hi = ids.length;
  const badIds = [];

  // First try first half vs second half
  const mid = Math.floor(ids.length / 2);
  const firstHalf = ids.slice(0, mid);
  const secondHalf = ids.slice(mid);

  console.log(`Testing first half (${firstHalf.length} donors)...`);
  const firstOk = await tryFetch(firstHalf);
  console.log(`First half: ${firstOk ? 'OK' : 'FAIL'}`);

  console.log(`Testing second half (${secondHalf.length} donors)...`);
  const secondOk = await tryFetch(secondHalf);
  console.log(`Second half: ${secondOk ? 'OK' : 'FAIL'}`);

  // Drill down into the bad half(ves)
  async function findBad(donorSubset, depth = 0) {
    if (donorSubset.length === 0) return;
    if (donorSubset.length === 1) {
      console.log(`\n🚨 BAD DONOR FOUND: id=${donorSubset[0]}`);
      // Print donor details
      try {
        const d = await prisma.donor.findUnique({
          where: { id: donorSubset[0] },
          include: { person: true },
        });
        console.log('Person id:', d?.personId);
        console.log('First name:', d?.person?.firstName);
        console.log('Last name:', d?.person?.lastName);
      } catch (e2) {
        console.log('Could not print details:', e2.message.split('\n')[0]);
      }
      badIds.push(donorSubset[0]);
      return;
    }

    const ok = await tryFetch(donorSubset);
    if (ok) return; // no bad donor in this subset

    const m = Math.floor(donorSubset.length / 2);
    console.log(`[depth ${depth}] Testing subset of ${donorSubset.length} donors...`);
    await findBad(donorSubset.slice(0, m), depth + 1);
    await findBad(donorSubset.slice(m), depth + 1);
  }

  if (!firstOk) await findBad(firstHalf);
  if (!secondOk) await findBad(secondHalf);

  if (badIds.length === 0) {
    console.log('\n⚠️  No bad donors found in binary search. Issue may be size-related (too many at once).');
  } else {
    console.log(`\n✅ Found ${badIds.length} bad donor(s): ${badIds.join(', ')}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Error:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
