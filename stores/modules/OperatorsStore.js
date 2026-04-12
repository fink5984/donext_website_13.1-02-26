"use client"
import { makeAutoObservable, runInAction } from "mobx";
import fetchWithAuth from '../../app/utils/fetchWithAuth';

class OperatorsStore {
  operators = [];
  totalOperators = 0;
  loadingOperators = false;
  errorOperators = null;
  operatorsCache = null; // { ts, data }
  cacheTTLms = 60 * 1000; // 60 seconds TTL
  fundraisersMap = new Map(); // Maps operator_id to { data, ts }

  constructor(rootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {
      rootStore: false
    });
  }

  async fetchOperators(force = false) {
    if (!this.rootStore.campaignId) return;

    // Try cache first
    if (!force && this.operatorsCache && Date.now() - this.operatorsCache.ts < this.cacheTTLms) {
      runInAction(() => {
        this.operators = this.operatorsCache.data;
        this.totalOperators = this.operatorsCache.data.length;
        this.loadingOperators = false;
      });
      return;
    }

    this.loadingOperators = true;
    try {
      const res = await fetchWithAuth('/api/operators');
      const result = await res.json();

      const mapped = (result.data || []).map(f => ({
        ...f,
        id: f.fundraiser_id,
        donorsCount: parseInt(f.donors_count) || 0,
        assignedFundraisersCount: parseInt(f.assigned_fundraisers_count) || 0,
        expectedSum: parseInt(f.expected_sum) || 0,
        trafficLightCounts: {
          red: parseInt(f.red_count) || 0,
          orange: parseInt(f.orange_count) || 0,
          green: parseInt(f.green_count) || 0,
          gray: parseInt(f.gray_count) || 0,
        }
      }));

      runInAction(() => {
        this.operators = mapped;
        this.totalOperators = mapped.length;
        this.loadingOperators = false;
        this.operatorsCache = { ts: Date.now(), data: mapped };
      });
    } catch (e) {
      runInAction(() => {
        this.operators = [];
        this.errorOperators = e;
        this.loadingOperators = false;
      });
    }
  }

  async toggleOperator(fundraiserId, isOperator) {
    try {
      const res = await fetchWithAuth('/api/operators', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundraiserId, isOperator })
      });
      const result = await res.json();
      if (result.success) {
        this.invalidateCache();
        await this.fetchOperators(true);
      }
      return result;
    } catch (e) {
      console.error('Error toggling operator:', e);
      throw e;
    }
  }

  async toggleOperatorsBatch(fundraiserIds, isOperator) {
    try {
      const res = await fetchWithAuth('/api/operators', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundraiserIds, isOperator })
      });
      const result = await res.json();
      if (result.success) {
        this.invalidateCache();
        await this.fetchOperators(true);
      }
      return result;
    } catch (e) {
      console.error('Error batch toggling operators:', e);
      throw e;
    }
  }

  async fetchFundraisersForOperator(operatorId, forceReload = false) {
    const cached = this.fundraisersMap.get(operatorId);
    if (!forceReload && cached && Date.now() - (cached.ts || 0) < this.cacheTTLms) {
      return cached.data;
    }
    try {
      const res = await fetchWithAuth(`/api/fundraisers?operatorId=${operatorId}`);
      if (!res.ok) throw new Error('Failed to fetch fundraisers for operator');
      const response = await res.json();
      const mapped = (response.data || []).map(f => ({
        id: f.fundraiser_id || f.id,
        fundraiser_id: f.fundraiser_id || f.id,
        person_id: f.person_id || null,
        first_name: f.first_name,
        last_name: f.last_name,
        city: f.city || '',
        main_mobile: f.main_mobile || '',
        expected_sum: f.expected_sum || 0,
        actual_donation_sum: f.actual_donation_sum || 0,
        donors_count: parseInt(f.donors_count) || 0,
        operator_expected: f.operator_expected || null,
      }));
      runInAction(() => {
        this.fundraisersMap.set(operatorId, { data: mapped, ts: Date.now() });
      });
      return mapped;
    } catch (error) {
      runInAction(() => {
        this.fundraisersMap.set(operatorId, { data: [], ts: Date.now() });
      });
      return [];
    }
  }

  getFundraisersForOperator(operatorId) {
    const entry = this.fundraisersMap.get(operatorId);
    return entry ? entry.data : [];
  }

  invalidateCache() {
    this.operatorsCache = null;
  }

  resetStore() {
    this.operators = [];
    this.totalOperators = 0;
    this.loadingOperators = false;
    this.errorOperators = null;
    this.operatorsCache = null;
    this.fundraisersMap = new Map();
  }
}

export default OperatorsStore;
