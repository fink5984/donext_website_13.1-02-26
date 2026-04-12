'use client';
import { useContext, useEffect } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { AppContext } from '@/app/components/AppContext';
import { isFundraiserOnlyPath, isAdminOnlyPath, isAdminAndManagerPath } from '@/lib/accessRules';
import { sessionStore } from '@/stores/SessionStore';
import LoadingOverlay from './LoadingOverlay';

export default function ProtectedRoute({ children, allowedUserTypes = ['manager', 'fundraiser', 'operator'] }) {
  const { clientId, fundraiserId, isLoading, campaignId, isAuthenticated, userType, isAdmin, isOperator } = useContext(AppContext);
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const locale = params?.locale || 'he';

  const fundraiserOnly = isFundraiserOnlyPath(pathname);
  const adminOnly = isAdminOnlyPath(pathname);
  const adminAndManager = isAdminAndManagerPath(pathname);

  // All useEffect hooks at the top - before any early returns
  
  // בדיקת אימות - רק אחרי שה-hydration הסתיים
  useEffect(() => {
    if (isLoading) return; // חכה ל-hydration
    if (!isAuthenticated && !pathname?.includes('/login')) {
      sessionStore.logout();
      // שמירת ה-URL המלא (כולל query params) כדי לחזור אליו אחרי התחברות
      const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname;
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const campaignId = urlParams.get('campaignId');
      let loginUrl = `/${locale}/login`;
      const params = new URLSearchParams();
      if (currentUrl && currentUrl !== `/${locale}/login`) {
        params.set('redirect', currentUrl);
      }
      if (campaignId) {
        params.set('campaignId', campaignId);
      }
      const qs = params.toString();
      router.push(qs ? `${loginUrl}?${qs}` : loginUrl);
    }
  }, [isAuthenticated, pathname, router, locale, isLoading]);

  // בדיקת הרשאות לדפי אדמין
  useEffect(() => {
    if (isLoading) return; // חכה ל-hydration
    if (adminOnly && !isAdmin) {
      if (userType === 'manager' || userType === 'operator') {
        router.push(campaignId ? `/${locale}/donors` : `/${locale}/new`);
      }
      if (userType === 'fundraiser') {
        router.push(`/${locale}/myDonors`);
      }
    }
  }, [adminOnly, isAdmin, userType, campaignId, pathname, router, locale, isLoading]);

  // בדיקת הרשאות לדפים לאדמין ומנהלים (כולל בדיקה שמפעיל לא נכנס לדף מפעילים)
  useEffect(() => {
    if (isLoading) return; // חכה ל-hydration
    if (adminAndManager && userType === 'fundraiser') {
      router.push(`/${locale}/myDonors`);
    }
    // מפעיל לא יכול לגשת לדף מפעילים
    if (adminAndManager && userType === 'operator' && pathname?.includes('/operators')) {
      router.push(`/${locale}/donors`);
    }
  }, [adminAndManager, userType, pathname, router, locale, isLoading]);

  // אם מנהל/אדמין/מפעיל ואין campaignId עדיין → הפנה ליצירת קמפיין חדש
  useEffect(() => {
    if (isLoading) return; // חכה ל-hydration
    if ((userType === 'manager' || userType === 'operator' || isAdmin) && !campaignId && !adminOnly && !adminAndManager) {
      if (!pathname?.includes('/new')) {
        router.push(`/${locale}/new`);
      }
    }
  }, [userType, isAdmin, campaignId, adminOnly, pathname, router, locale, isLoading]);

  // בדיקת הרשאות מתרימים
  useEffect(() => {
    if (isLoading) return; // חכה ל-hydration
    if (userType === 'fundraiser') {
      if (!fundraiserOnly && !pathname?.includes('/myDonors')) {
        router.push(`/${locale}/myDonors`);
      }
    }
  }, [userType, fundraiserOnly, pathname, router, locale, isLoading]);

  // בדיקת הרשאות מנהל
  useEffect(() => {
    if (isLoading) return; // חכה ל-hydration
    if (userType === 'manager') {
      if (fundraiserOnly && !pathname?.includes('/donors')) {
        router.push(`/${locale}/donors`);
      }
    }
  }, [userType, fundraiserOnly, pathname, router, locale, isLoading]);

  // Conditional rendering checks after all hooks
  if (isLoading) return <LoadingOverlay />;
  if (pathname?.includes('/login')) return children;
  
  if (!isAuthenticated) {
    return <LoadingOverlay />;
  }

  // אם userType עדיין לא נקבע - חכה
  if (!userType) {
    return <LoadingOverlay />;
  }

  // אם לא הועברו הרשאות (מצב ביניים לפני שהקונטקסט נטען)
  if (allowedUserTypes.length === 0) return <LoadingOverlay />;

  if (adminOnly && !isAdmin) {
    return <LoadingOverlay />;
  }

  if (adminAndManager && userType === 'fundraiser') {
    return <LoadingOverlay />;
  }

  // מנהל/מפעיל/אדמין בלי קמפיין נבחר - הפנה ליצירת קמפיין (אלא אם כבר שם)
  if ((userType === 'manager' || userType === 'operator' || isAdmin) && !campaignId && !adminOnly && !adminAndManager && !pathname?.includes('/new')) {
    return <LoadingOverlay />;
  }

  // מפעיל בדף מפעילים - הפנה ל-donors
  if (userType === 'operator' && pathname?.includes('/operators')) {
    return <LoadingOverlay />;
  }

  // מתרים שלא בדף שלו - הפנה ל-myDonors
  if (userType === 'fundraiser' && !fundraiserOnly && !pathname?.includes('/myDonors')) {
    return <LoadingOverlay />;
  }

  // מנהל בדף של מתרימים - הפנה ל-donors
  if (userType === 'manager' && fundraiserOnly && !pathname?.includes('/donors')) {
    return <LoadingOverlay />;
  }

  // בדיקה אם המשתמש מורשה לראות את הדף לפי allowedUserTypes
  if (!allowedUserTypes.includes(userType)) {
    if (isAdmin) {
      return children;
    }
    if ((userType === 'manager' || userType === 'operator') && !isAdminOnlyPath(pathname)) {
      return children;
    }
    return <LoadingOverlay />;
  }
  
  return children;
}