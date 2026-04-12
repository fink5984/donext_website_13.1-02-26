"use client"
import { createContext, useContext, useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import rootStore from "@/stores/RootStore";
import { isTokenValid, loadSession } from "@/lib/auth";
import { getRoleFromToken } from "@/lib/authService";
import { sessionStore } from "@/stores/SessionStore";
import fetchWithAuth from "@/app/utils/fetchWithAuth";

export const AppContext = createContext({
  clientId: null,
  campaignId: null,
  fundraiserId: null,
  clientName: null,
  campaign: null,
  role: null,
  userType: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: true,
  setClientId: () => {},
  setCampaignId: () => {},
  setFundraiserId: () => {},
  stores: rootStore,
  donationsStore: rootStore.donationsStore,
  globalLoading: false,
  setGlobalLoading: () => {}
});

export const AppProvider = observer(function AppProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [clientName, setClientName] = useState(null);

  const clientId = sessionStore.clientId;
  const campaignId = sessionStore.campaignId;
  const fundraiserId = sessionStore.fundraiserId;
  const token = sessionStore.token;

  const campaign = rootStore.campaign;
  const role = getRoleFromToken(token);
  const userType = clientId != null
    ? 'manager'
    : (fundraiserId != null
        ? 'fundraiser'
        : (role === 'fundraiser' ? 'fundraiser' : (role ? 'manager' : null)));
  const isAuthenticated = Boolean(token && isTokenValid(token));
  const isAdmin = role === 'admin';

  // Hydration effect - ensure sessionStore is synced with localStorage
  useEffect(() => {
    // בדיקה אם יש session ב-localStorage שעדיין לא נטען ל-sessionStore
    const savedSession = loadSession();
    if (savedSession && isTokenValid(savedSession.token) && !sessionStore.token) {
      // sync sessionStore with localStorage
      sessionStore.setToken(savedSession.token);
      if (savedSession.clientId) sessionStore.setClientId(savedSession.clientId);
      if (savedSession.campaignId) sessionStore.setCampaignId(savedSession.campaignId);
      if (savedSession.fundraiserId) sessionStore.setFundraiserId(savedSession.fundraiserId);
    }
    setIsLoading(false);
  }, []);

  // Fetch and cache client name when clientId changes
  useEffect(() => {
    let cancelled = false;
    async function loadClientName() {
      if (!clientId) {
        if (!cancelled) setClientName(null);
        return;
      }
      try {
        const res = await fetchWithAuth(`/api/clients/${clientId}`);
        if (!res?.ok) {
          if (!cancelled) setClientName(null);
          return;
        }
        const data = await res.json();
        const name = data?.name || data?.organization_name || 'מנהל';
        if (!cancelled) setClientName(name);
      } catch (e) {
        if (!cancelled) setClientName(null);
      }
    }
    loadClientName();
    return () => { cancelled = true; };
  }, [clientId]);

  const setClientId = (id) => {
    sessionStore.setClientId(id ?? null);
  };

  const setCampaignId = (id) => {
    sessionStore.setCampaignId(id ?? null);
  };

  const setFundraiserId = (id) => {
    sessionStore.setFundraiserId(id ?? null);
  };

  return (
    <AppContext.Provider value={{
      clientId,
      campaignId,
      fundraiserId,
      clientName,
      campaign,
      role,
      userType,
      isAuthenticated,
      isAdmin,
      setClientId,
      setCampaignId,
      setFundraiserId,
      stores: rootStore,
      donationsStore: rootStore.donationsStore,
      isLoading,
      globalLoading,
      setGlobalLoading
    }}>
      {children}
    </AppContext.Provider>
  );
});

export function useAppContext() {
  return useContext(AppContext);
}
