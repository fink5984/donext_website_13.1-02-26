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
  operatorId: null,
  clientName: null,
  campaign: null,
  role: null,
  userType: null,
  isAuthenticated: false,
  isAdmin: false,
  isAdminOrManager: false,
  isOperator: false,
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
  const [isHydrated, setIsHydrated] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [clientName, setClientName] = useState(null);

  const clientId = sessionStore.clientId;
  const campaignId = sessionStore.campaignId;
  const fundraiserId = sessionStore.fundraiserId;
  const operatorId = sessionStore.operatorId;
  const token = sessionStore.token;

  const campaign = rootStore.campaign;
  const role = getRoleFromToken(token);
  
  // חישוב userType - אם יש clientId זה מנהל, אם יש fundraiserId זה מתרים
  // אם הוא מפעיל (operator) - יש לו גישה כמו מנהל אבל עם סינון
  // אם אין אף אחד מהם - נסתמך על התפקיד מהטוקן
  let userType = null;
  if (role === 'operator') {
    userType = 'operator';
  } else if (clientId != null) {
    userType = 'manager';
  } else if (fundraiserId != null) {
    userType = 'fundraiser';
  } else if (role === 'fundraiser') {
    userType = 'fundraiser';
  } else if (role === 'manager' || role === 'admin') {
    userType = 'manager';
  } else if (token && isTokenValid(token)) {
    // אם יש token תקין אבל אין role ברור - ברירת מחדל למנהל
    userType = 'manager';
  }
  
  const isAuthenticated = Boolean(token && isTokenValid(token));
  const isAdmin = role === 'admin';
  const isAdminOrManager = role === 'admin' || role === 'manager' || role === 'operator';
  const isOperator = role === 'operator';

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
      if (savedSession.operatorId) sessionStore.setOperatorId(savedSession.operatorId);
    }
    setIsHydrated(true);
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
      operatorId,
      clientName,
      campaign,
      role,
      userType,
      isAuthenticated,
      isAdmin,
      isAdminOrManager,
      isOperator,
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
