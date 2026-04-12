"use client";
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Custom hook לטיפול ב-loading state בעת ניווט בין דפים
 * 
 * @returns {Object} אובייקט המכיל:
 * - isNavigating: boolean - מצב loading
 * - navigateWithLoading: function - פונקציה לביצוע ניווט עם loading
 */
export function useNavigationLoader() {
    const router = useRouter();
    const [isNavigating, setIsNavigating] = useState(false);

    /**
     * מבצע ניווט עם אינדיקציית loading
     * @param {string} path - הנתיב לניווט
     * @param {Object} options - אופציות נוספות
     * @param {Function} options.onBeforeNavigate - פונקציה שתרוץ לפני הניווט
     */
    const navigateWithLoading = useCallback(async (path, options = {}) => {
        try {
            setIsNavigating(true);

            // אם יש פעולה לביצוע לפני הניווט
            if (options.onBeforeNavigate) {
                await options.onBeforeNavigate();
            }

            // ביצוע הניווט
            router.push(path);
        } catch (error) {
            console.error('Navigation error:', error);
            setIsNavigating(false);
        }
        // לא מאפסים את isNavigating כאן כי הדף עדיין בתהליך טעינה
    }, [router]);

    /**
     * מבצע החלפת דף (replace) עם אינדיקציית loading
     * @param {string} path - הנתיב לניווט
     */
    const replaceWithLoading = useCallback(async (path, options = {}) => {
        try {
            setIsNavigating(true);

            if (options.onBeforeNavigate) {
                await options.onBeforeNavigate();
            }

            router.replace(path);
        } catch (error) {
            console.error('Navigation error:', error);
            setIsNavigating(false);
        }
    }, [router]);

    /**
     * מבצע חזרה אחורה עם אינדיקציית loading
     */
    const backWithLoading = useCallback(() => {
        setIsNavigating(true);
        router.back();
    }, [router]);

    return {
        isNavigating,
        navigateWithLoading,
        replaceWithLoading,
        backWithLoading,
        // מאפשר גישה ישירה ל-router אם צריך
        router
    };
}

