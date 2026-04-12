"use client";
import { makeAutoObservable, reaction } from "mobx";
import { loadSession, saveSession, clearSession, isTokenValid, parseJwt } from "@/lib/auth";
import rootStore from "@/stores/RootStore";

export function createSessionStore() {
  return new SessionStore();
}

export class SessionStore {
  token = null;
  clientId = null;
  campaignId = null;
  fundraiserId = null;
  operatorId = null;

  constructor() {
    makeAutoObservable(this);
    if (typeof window !== 'undefined') {
      const s = loadSession();
      if (s && isTokenValid(s.token)) {
        this.token = s.token;
        this.clientId = s.clientId ?? null;
        this.campaignId = s.campaignId ?? null;
        this.fundraiserId = s.fundraiserId ?? null;
        this.operatorId = s.operatorId ?? null;
      } else {
        clearSession();
      }
      reaction(
        () => ({ token: this.token, clientId: this.clientId, campaignId: this.campaignId, fundraiserId: this.fundraiserId, operatorId: this.operatorId }),
        (s) => saveSession(s)
      );

      // Sync RootStore when session identifiers change
      reaction(
        () => ({ clientId: this.clientId, campaignId: this.campaignId }),
        ({ clientId, campaignId }) => {
          rootStore.setClientId(clientId ?? null);
          rootStore.setCampaignId(campaignId ?? null);
        },
        { fireImmediately: true }
      );
    }
  }

  setToken(token) {
    this.token = token;
    const p = parseJwt(token);
    // תעדוף camelCase אם קיים, אח"כ snake_case לתאימות לאחור
    if (p?.clientId != null) this.clientId = Number(p.clientId);
    else if (p?.client_id != null) this.clientId = Number(p.client_id);
    if (p?.campaignId != null) this.campaignId = Number(p.campaignId);
    else if (p?.campaign_id != null) this.campaignId = Number(p.campaign_id);
    if (p?.fundraiserId != null) this.fundraiserId = Number(p.fundraiserId);
    else if (p?.fundraiser_id != null) this.fundraiserId = Number(p.fundraiser_id);
    if (p?.operatorId != null) this.operatorId = Number(p.operatorId);
    else if (p?.operator_id != null) this.operatorId = Number(p.operator_id);
  }

  setClientId(id) { this.clientId = id ?? null; }
  setCampaignId(id) { this.campaignId = id ?? null; }
  setFundraiserId(id) { this.fundraiserId = id ?? null; }
  setOperatorId(id) { this.operatorId = id ?? null; }

  logout() {
    this.token = null; this.clientId = null; this.campaignId = null; this.fundraiserId = null; this.operatorId = null;
    clearSession();
  }
}

// Singleton session store instance for app-wide usage
export const sessionStore = new SessionStore();

