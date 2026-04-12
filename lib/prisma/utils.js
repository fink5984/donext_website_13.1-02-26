/**
 * מחזיר אובייקט עם פרמטרים לחיפוש לפי Prisma
 * @param {Object} filters - אובייקט עם הפילטרים
 * @returns {Object} אובייקט Prisma where
 */
export function buildPrismaWhere(filters) {
    const where = {};
    
    if (filters.search) {
        where.OR = [
            { firstName: { contains: filters.search, mode: 'insensitive' } },
            { lastName: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } }
        ];
    }
    
    if (filters.cityId) {
        where.cityId = parseInt(filters.cityId);
    }
    
    if (filters.active !== undefined) {
        where.active = filters.active;
    }
    
    return where;
}

/**
 * מחזיר אובייקט עם הגדרות Include של Prisma
 * @param {string[]} relations - מערך של שמות הrelations שרוצים לכלול
 * @returns {Object} אובייקט Prisma include
 */
export function buildPrismaInclude(relations) {
    const include = {};
    
    for (const relation of relations) {
        include[relation] = true;
    }
    
    return include;
}

/**
 * המרת שגיאת Prisma להודעת שגיאה ידידותית למשתמש
 * @param {Error} error - אובייקט השגיאה מ-Prisma
 * @returns {string} הודעת שגיאה מותאמת
 */
export function handlePrismaError(error) {
    if (error.code === 'P2002') {
        return 'ערך זה כבר קיים במערכת';
    }
    if (error.code === 'P2025') {
        return 'הרשומה המבוקשת לא נמצאה';
    }
    if (error.code === 'P2003') {
        return 'הפעולה נכשלה בגלל הפרת מפתח זר';
    }
    
    return 'אירעה שגיאה בלתי צפויה';
} 