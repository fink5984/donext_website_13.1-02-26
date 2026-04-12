"use client"
import { makeAutoObservable, runInAction, computed } from "mobx";
import fetchWithAuth from '../../app/utils/fetchWithAuth';

class RanksStore {
  ranks = [];
  totalRanks = 0;
  loadingRanks = false;
  errorRanks = null;
  filters = {};
  sortConfig = { key: null, direction: null };
  page = 1;
  rowsInPage = 20;

  constructor(rootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {
      rootStore: false,
      ranksAmounts: computed
    });
  }

  // getter למערך סכומי הדרגות בלבד (ממוין מגדול לקטן)
  get ranksAmounts() {
    return this.ranks
      .filter(r => r.amount !== null && r.amount !== undefined && Number(r.amount) > 0)
      .map(r => Number(r.amount))
      .sort((a, b) => b - a);
  }

  // getter לדרגות המלאות (עם כל הפרטים)
  get ranksWithDetails() {
    return this.ranks;
  }

  async fetchRanks() {
    if (!this.rootStore.campaignId) return;

    this.loadingRanks = true;
    try {
      let url = `/api/ranks?campaignId=${this.rootStore.campaignId}`;

      if (this.filters.search) {
        url += `&search=${encodeURIComponent(this.filters.search)}`;
      }

      if (this.sortConfig.key && this.sortConfig.direction) {
        url += `&sort=${this.sortConfig.key}&direction=${this.sortConfig.direction}`;
      }
      
      url += `&limit=${this.rowsInPage}&offset=${(this.page - 1) * this.rowsInPage}`;

      const res = await fetchWithAuth(url);
      const data = await res.json();
      
      runInAction(() => {
        // Ensure amounts are converted to numbers
        this.ranks = data.data.map(rank => ({
          ...rank,
          amount: rank.amount ? Number(rank.amount) : null
        }));
        this.totalRanks = data.total || 0;
        this.loadingRanks = false;
      });
    } catch (e) {
      runInAction(() => {
        this.ranks = [];
        this.errorRanks = e;
        this.loadingRanks = false;
      });
    }
  }

  async addRank(rankData) {
    try {
      const response = await fetchWithAuth('/api/ranks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rankData, campaignId: this.rootStore.campaignId })
      });

      if (response.ok) {
        const newRank = await response.json();
        runInAction(() => {
          // Ensure amount is converted to number
          this.ranks.push({
            ...newRank,
            amount: newRank.amount ? Number(newRank.amount) : null
          });
          this.totalRanks = this.ranks.length;
        });
        return { success: true, data: newRank };
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.error || 'Failed to add rank' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async updateRank(rankId, rankData) {
    try {
      const response = await fetchWithAuth(`/api/ranks/${rankId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rankData)
      });

      if (response.ok) {
        const updatedRank = await response.json();
        runInAction(() => {
          const index = this.ranks.findIndex(rank => rank.id === rankId);
          if (index !== -1) {
            // Ensure amount is converted to number
            this.ranks[index] = {
              ...updatedRank,
              amount: updatedRank.amount ? Number(updatedRank.amount) : null
            };
          }
        });
        return { success: true, data: updatedRank };
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.error || 'Failed to update rank' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async deleteRank(rankId) {
    try {
      const response = await fetchWithAuth(`/api/ranks/${rankId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        runInAction(() => {
          this.ranks = this.ranks.filter(rank => rank.id !== rankId);
          this.totalRanks = this.ranks.length;
        });
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.error || 'Failed to delete rank' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
  
  setFilters(filters) {
    this.filters = filters;
    this.page = 1;
    this.fetchRanks();
  }

  setSortConfig(config) {
    this.sortConfig = config;
    this.fetchRanks();
  }

  setPage(page) {
    this.page = page;
    this.fetchRanks();
  }

  setRowsInPage(rows) {
    this.rowsInPage = rows;
    this.page = 1;
    this.fetchRanks();
  }
}

export default RanksStore;
