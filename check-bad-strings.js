const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: ["error"] });
(async () => {
    const ids = await prisma.$queryRawUnsafe("SELECT id FROM people WHERE notes IS NOT NULL ORDER BY id");
    console.log("People with notes:", ids.length);
    let bad = [];
    for (const r of ids) {
        try {
            await prisma.person.findUnique({ where: { id: r.id }, select: { id: true, notes: true } });
        } catch(e) {
            console.log("BAD person notes id=" + r.id);
            bad.push(r.id);
        }
    }

    // Now check firstName/lastName  
    const allPeople = await prisma.$queryRawUnsafe("SELECT id FROM people ORDER BY id");
    console.log("Total people:", allPeople.length);
    let badPeople = [];
    for (const r of allPeople) {
        try {
            await prisma.person.findUnique({ where: { id: r.id }, select: { id: true, firstName: true, lastName: true, email: true, mainMobile: true } });
        } catch(e) {
            console.log("BAD person id=" + r.id + " err=" + e.message.substring(0, 50));
            badPeople.push(r.id);
        }
    }
    console.log("Bad people total:", badPeople.length, badPeople);
    await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
