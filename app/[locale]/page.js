'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { loadSession, isTokenValid } from '@/lib/auth';
import { getRoleFromToken, getRedirectPathByRole } from '@/lib/authService';
import LandingPage from './landing/page';

export default function Home() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale || 'he';
  const [status, setStatus] = useState('checking'); // checking | landing | redirecting

  useEffect(() => {
    const session = loadSession();
    const token = session?.token;

    if (token && isTokenValid(token)) {
      const role = getRoleFromToken(token);
      const hasCampaigns = Boolean(session?.campaignId);
      const next = getRedirectPathByRole(role, { hasCampaigns });
      setStatus('redirecting');
      router.push(`/${locale}${next}`);
    } else {
      setStatus('landing');
    }
  }, [router, locale]);

  if (status === 'checking' || status === 'redirecting') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'var(--font-ping), sans-serif'
      }}>
        <div>טוען...</div>
      </div>
    );
  }

  return <LandingPage />;
}
