'use client';
import { useContext, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AppContext } from './AppContext';
import { isFundraiserOnlyPath, isAdminOnlyPath } from '@/lib/accessRules';
import { sessionStore } from '@/stores/SessionStore';
import LoadingOverlay from './LoadingOverlay';

export default function ProtectedRoute({ children, allowedUserTypes = ['manager', 'fundraiser'] }) {
  const { clientId, fundraiserId, isLoading, campaignId, isAuthenticated, userType, isAdmin } = useContext(AppContext);
  const router = useRouter();
  const pathname = usePathname();

  const fundraiserOnly = isFundraiserOnlyPath(pathname);
  const adminOnly = isAdminOnlyPath(pathname);

  // All useEffect hooks at the top - before any early returns
  
  // בדיקת אימות
  useEffect(() => {
    if (!isAuthenticated && pathname !== '/login') {
      sessionStore.logout();
      router.push('/login');
    }
  }, [isAuthenticated, pathname, router]);

  // בדיקת הרשאות לדפי אדמין
  useEffect(() => {
    if (adminOnly && !isAdmin) {
      if (userType === 'manager') {
        router.push(campaignId ? '/donors' : '/new');
      }
      if (userType === 'fundraiser') {
        router.push('/myDonors');
      }
    }
  }, [adminOnly, isAdmin, userType, campaignId, pathname, router]);

  // אם מנהל/אדמין ואין campaignId עדיין → הפנה ליצירת קמפיין חדש
  useEffect(() => {
    if ((userType === 'manager' || isAdmin) && !campaignId && !adminOnly) {
      if (pathname !== '/new') {
        router.push('/new');
      }
    }
  }, [userType, isAdmin, campaignId, adminOnly, pathname, router]);

  // בדיקת הרשאות מתרימים
  useEffect(() => {
    if (userType === 'fundraiser') {
      if (!fundraiserOnly && pathname !== '/myDonors') {
        router.push('/myDonors');
      }
    }
  }, [userType, fundraiserOnly, pathname, router]);

  // בדיקת הרשאות מנהל
  useEffect(() => {
    if (userType === 'manager') {
      if (fundraiserOnly && pathname !== '/donors') {
        router.push('/donors');
      }
    }
  }, [userType, fundraiserOnly, pathname, router]);

  // Conditional rendering checks after all hooks
  if (isLoading) return <LoadingOverlay />;
  if (pathname === '/login') return children;
  
  if (!isAuthenticated) {
    return <LoadingOverlay />;
  }

  // אם לא הועברו הרשאות (מצב ביניים לפני שהקונטקסט נטען)
  if (allowedUserTypes.length === 0) return <LoadingOverlay />;

  if (adminOnly && !isAdmin) {
    return <LoadingOverlay />;
  }

  if ((userType === 'manager' || isAdmin) && !campaignId && !adminOnly && pathname !== '/new') {
    return <LoadingOverlay />;
  }

  if (userType === 'fundraiser' && !fundraiserOnly && pathname !== '/myDonors') {
    return <LoadingOverlay />;
  }

  if (userType === 'manager' && fundraiserOnly && pathname !== '/donors') {
    return <LoadingOverlay />;
  }

  // בדיקה אם המשתמש מורשה לראות את הדף לפי allowedUserTypes
  if (!allowedUserTypes.includes(userType)) {
    if (isAdmin) {
      return children;
    }
    if (userType === 'manager' && !isAdminOnlyPath(pathname)) {
      return children;
    }
    return <LoadingOverlay />;
  }
  
  return children;
}