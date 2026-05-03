const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
    // Check campaigns
    const camps = await p.$queryRawUnsafe("SELECT id FROM campaigns ORDER BY id");
    console.log("Campaigns:", camps.length);
    let bad = [];
    for (const r of camps) {
        try { await p.campaign.findUnique({ where: { id: r.id } }); }
        catch(e) { console.log("BAD campaign id=" + r.id); bad.push(r.id); }
    }
    console.log("Bad campaigns:", bad.length);

    // Check English names
    const enames = await p.$queryRawUnsafe("SELECT id FROM person_english_names ORDER BY id");
    console.log("English names:", enames.length);
    let badE = [];
    for (const r of enames) {
        try { await p.personEnglishName.findUnique({ where: { id: r.id } }); }
        catch(e) { console.log("BAD englishName id=" + r.id); badE.push(r.id); }
    }
    console.log("Bad english names:", badE.length);

    await p.$disconnect();
})().catch(async e => { console.error(e.message); await p.$disconnect(); });
