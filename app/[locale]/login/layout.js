'use client';
import { AppProvider } from '@/app/components/AppContext';

export default function LoginLayout({ children }) {
  return <AppProvider>{children}</AppProvider>;
}
