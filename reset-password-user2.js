const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function resetPassword() {
  try {
    const newPassword = '123456'; // הסיסמה החדשה
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const user = await prisma.user.update({
      where: { id: 2 },
      data: { password: hashedPassword }
    });
    
    console.log('✅ הסיסמה אופסה בהצלחה!');
    console.log(`📧 מייל: ${user.email}`);
    console.log(`🔑 סיסמה חדשה: ${newPassword}`);
    
  } catch (error) {
    console.error('❌ שגיאה:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
