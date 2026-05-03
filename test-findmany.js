const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
    try {
        const full=await p.donor.findMany({
            where:{campaignId:168},
            include:{
                person:{include:{city:true,street:true,englishName:true}},
                campaign:true,
                fundraiser:{include:{person:true}},
                donations:{where:{deleted_at:null},select:{id:true,note:true}},
                donorNotes:{select:{id:true,note:true}}
            },
            take:200, skip:0
        });
        console.log('OK, count=',full.length);
    } catch(e) {
        console.log('ERROR:',e.message.substring(0,100));
    }
    await p.$disconnect();
})();
