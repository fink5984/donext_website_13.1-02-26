import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

/**
 * מסיר תווי שליטה לא חוקיים ממחרוזת לפני שמירה ל-DB.
 * תווים אלו (null bytes, control chars) גורמים לשגיאת Prisma:
 * "Failed to convert rust String into napi string"
 */
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  // הסרת null bytes ותווי שליטה (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F)
  // שמירה על: 0x09=Tab, 0x0A=LF, 0x0D=CR
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * מנקה רקורסיבית את כל ערכי המחרוזת באובייקט הנתונים לפני כתיבה ל-DB
 */
function sanitizeData(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeData(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// קונפיגורציה מותאמת ל-Neon serverless
const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  // Middleware שמנקה תווים לא חוקיים לפני כל כתיבה ל-DB
  return client.$extends({
    query: {
      $allModels: {
        async create({ args, query }) {
          if (args.data) args.data = sanitizeData(args.data);
          return query(args);
        },
        async createMany({ args, query }) {
          if (args.data) args.data = sanitizeData(args.data);
          return query(args);
        },
        async update({ args, query }) {
          if (args.data) args.data = sanitizeData(args.data);
          return query(args);
        },
        async updateMany({ args, query }) {
          if (args.data) args.data = sanitizeData(args.data);
          return query(args);
        },
        async upsert({ args, query }) {
          if (args.create) args.create = sanitizeData(args.create);
          if (args.update) args.update = sanitizeData(args.update);
          return query(args);
        },
      },
    },
  });
}

// שימוש ב-singleton pattern למניעת יצירת חיבורים מרובים
export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

// שמירת ה-instance ב-development למניעת hot reload issues
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
} 