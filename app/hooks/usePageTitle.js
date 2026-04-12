import { useEffect } from 'react';

/**
 * Hook לעדכון כותרת הדף בכרטיסיית הדפדפן
 * @param {string} title - הכותרת שתוצג בכרטיסייה
 */
export function usePageTitle(title) {
  useEffect(() => {
    if (title) {
      document.title = title;
    }
    
    // החזר לכותרת ברירת מחדל בעת ניקוי
    return () => {
      document.title = 'Donext';
    };
  }, [title]);
}

