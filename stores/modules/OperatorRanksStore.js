"use client"
import { makeAutoObservable, runInAction } from "mobx";
import fetchWithAuth from '../../app/utils/fetchWithAuth';

class OperatorRanksStore {
  ranks = [];
  totalRanks = 0;
  loadingRanks = false;
  errorRanks = null;

  constructor(rootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {
      rootStore: false,
    });
  }

  async fetchRanks() {
    if (!this.rootStore.campaignId) return;

    this.loadingRanks = true;
    try {
      const url = `/api/operator-ranks?campaignId=${this.rootStore.campaignId}`;

      const res = await fetchWithAuth(url);
      const data = await res.json();
      
      runInAction(() => {
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
      const response = await fetchWithAuth('/api/operator-ranks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rankData, campaignId: this.rootStore.campaignId })
      });

      if (response.ok) {
        const newRank = await response.json();
        runInAction(() => {
          this.ranks.push({
            ...newRank,
            amount: newRank.amount ? Number(newRank.amount) : null
          });
          this.totalRanks = this.ranks.length;
        });
        return { success: true, data: newRank };
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.error || 'Failed to add operator rank' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async updateRank(rankId, rankData) {
    try {
      const response = await fetchWithAuth(`/api/operator-ranks/${rankId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rankData)
      });

      if (response.ok) {
        const updatedRank = await response.json();
        runInAction(() => {
          const index = this.ranks.findIndex(rank => rank.id === rankId);
          if (index !== -1) {
            this.ranks[index] = {
              ...updatedRank,
              amount: updatedRank.amount ? Number(updatedRank.amount) : null
            };
          }
        });
        return { success: true, data: updatedRank };
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.error || 'Failed to update operator rank' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async deleteRank(rankId) {
    try {
      const response = await fetchWithAuth(`/api/operator-ranks/${rankId}`, {
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
        return { success: false, message: errorData.error || 'Failed to delete operator rank' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

export default OperatorRanksStore;
