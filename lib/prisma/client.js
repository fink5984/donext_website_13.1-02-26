import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

// קונפיגורציה מותאמת ל-Neon serverless
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

// שימוש ב-singleton pattern למניעת יצירת חיבורים מרובים
export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

// שמירת ה-instance ב-development למניעת hot reload issues
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
} 