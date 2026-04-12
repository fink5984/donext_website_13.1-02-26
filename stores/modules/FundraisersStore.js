"use client"
import { makeAutoObservable, runInAction } from "mobx";
import fetchWithAuth from '../../app/utils/fetchWithAuth';

class FundraisersStore {
  fundraisers = [];
  totalFundraisers = 0;
  loadingFundraisers = false;
  errorFundraisers = null;
  filters = {};
  sortConfig = { key: 'name', direction: 'asc' };
  page = 1;
  rowsInPage = 20;
  donorsMap = new Map(); // Maps fundraiser_id to donors array
  fundraisersSummary = null;
  fetchDebounceTimer = null;
  // Track in-flight requests so newer ones cancel older ones
  currentFetchId = 0;
  inFlightController = null;
  
  // New properties
  navigationIds = []; // IDs for navigation (previous/next)
  // Caching
  fundraisersCache = new Map(); // key -> { ts, data, total }
  fundraisersSummaryCache = new Map(); // key -> { ts, data }
  cacheTTLms = 60 * 1000; // 60 seconds TTL
  // Currently selected/used fundraiser object
  currentFundraiser = null;

  constructor(rootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {
      rootStore: false
    });
  }

  // Build fundraisers API URL with current filters/sort; includeAll skips pagination
  buildFundraisersUrl({ includeAll = false } = {}) {
    if (!this.rootStore.campaignId) return null;
    let url = `/api/fundraisers?`;

    // Filters
    const simpleFilters = ['search', 'firstName', 'lastName', 'name', 'city', 'street', 'houseNumber', 'mobile', 'phone', 'email', 'trafficScore'];
    simpleFilters.forEach(filter => {
      if (this.filters[filter]) url += `&${filter}=${encodeURIComponent(this.filters[filter])}`;
    });
    
    if (this.filters.donorsCountRange) {
        url += `&donorsCountRangeMin=${this.filters.donorsCountRange.min}&donorsCountRangeMin=${this.filters.donorsCountRange.max}`;
      }
    if (this.filters.expectedRange) {
      url += `&expectedRangeMin=${this.filters.expectedRange.min}&expectedRangeMax=${this.filters.expectedRange.max}`;
    }
    if (this.filters.actualRange) {
      url += `&actualRangeMin=${this.filters.actualRange.min}&actualRangeMax=${this.filters.actualRange.max}`;
    }

    // Sorting
    if (this.sortConfig.key && this.sortConfig.direction) {
      const keyMap = {
        name: 'name',
        city: 'city',
        donors_count: 'donors_count',
        assignedDonors: 'donors_count',
        expected_sum: 'expected_sum',
        expectedDonation: 'expected_sum',
        actual_donation_sum: 'actual_donation_sum',
        actual_donors_count: 'actual_donors_count',
        status: 'status_questionnaire',
        status_questionnaire: 'status_questionnaire',
        invitation: 'invitation',
      };
      const sortField = keyMap[this.sortConfig.key];
      if (sortField) {
        url += `&sortField=${sortField}&sortDirection=${this.sortConfig.direction}`;
      }
    }

    // Pagination
    if (!includeAll) {
      url += `&limit=${this.rowsInPage}&offset=${(this.page - 1) * this.rowsInPage}`;
    }

    return url;
  }

  // Fetch all fundraisers without pagination for export (ignores filters)
  async fetchAllFundraisersForExport() {
    if (!this.rootStore.campaignId) return [];
    // Build a clean URL without filters or pagination
    const url = `/api/fundraisers`;
    const res = await fetchWithAuth(url);
    const data = await res.json();
    const mapped = (data.data || []).map(f => ({
      ...f,
      id: f.fundraiser_id,
      donorsCount: parseInt(f.donors_count) || 0,
      expectedSum: parseInt(f.expected_sum) || 0,
      status_questionnaire: f.status_questionnaire || 'לא נשלח',
      status_forecast: f.status_forecast || 'לא נשלח',
      trafficLightCounts: {
        red: parseInt(f.red_count) || 0,
        orange: parseInt(f.orange_count) || 0,
        green: parseInt(f.green_count) || 0,
        gray: parseInt(f.gray_count) || 0,
        blue: parseInt(f.blue_count) || 0
      }
    }));
    return mapped;
  }

  // Debounced version of fetchFundraisers for search and filters
  debouncedFetchFundraisers({ delay = 300 } = {}) {
    if (this.fetchDebounceTimer) {
      clearTimeout(this.fetchDebounceTimer);
    }
    
    this.fetchDebounceTimer = setTimeout(() => {
      this.fetchFundraisers();
      this.fetchDebounceTimer = null;
    }, delay);
  }

  // Clear debounce timer when needed
  clearDebounce() {
    if (this.fetchDebounceTimer) {
      clearTimeout(this.fetchDebounceTimer);
      this.fetchDebounceTimer = null;
    }
  }

  async fetchFundraisers(includeAll = false) {
    if (!this.rootStore.campaignId) return;
    
    // Try cache first
    const cacheKey = this.buildFundraisersCacheKey({ includeAll });
    const cached = this.fundraisersCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.cacheTTLms) {
      runInAction(() => {
        this.fundraisers = cached.data;
        this.totalFundraisers = cached.total;
        this.loadingFundraisers = false;
      });
      return;
    }

    // Cancel any in-flight request (older than this one)
    try {
      if (this.inFlightController) {
        this.inFlightController.abort();
      }
    } catch (_) {}

    const fetchId = ++this.currentFetchId;
    const controller = new AbortController();
    this.inFlightController = controller;
    this.loadingFundraisers = true;
    try {
      const url = this.buildFundraisersUrl({ includeAll });
      const res = await fetchWithAuth(url, { signal: controller.signal });
      const data = await res.json();

      const mapped = (data.data || []).map(f => ({
          ...f,
          id: f.fundraiser_id,
          donorsCount: parseInt(f.donors_count) || 0,
          expectedSum: parseInt(f.expected_sum) || 0,
          status_questionnaire: f.status_questionnaire || 'לא נשלח',
          status_forecast: f.status_forecast || 'לא נשלח',
          invitation_sent_count: parseInt(f.invitation_sent_count) || 0,
          arrival_confirmed_count: parseInt(f.arrival_confirmed_count) || 0,
          trafficLightCounts: {
            red: parseInt(f.red_count) || 0,
            orange: parseInt(f.orange_count) || 0,
            green: parseInt(f.green_count) || 0,
            gray: parseInt(f.gray_count) || 0,
            blue: parseInt(f.blue_count) || 0
          }
        }));
      if (fetchId === this.currentFetchId) {
        runInAction(() => {
          this.fundraisers = mapped;
          this.totalFundraisers = data.total || 0;
          this.loadingFundraisers = false;
        });
        this.fundraisersCache.set(cacheKey, { ts: Date.now(), data: mapped, total: data.total || 0 });
      }
    } catch (e) {
      const isAbortError = typeof e?.name === 'string' && e.name === 'AbortError';
      if (!isAbortError && fetchId === this.currentFetchId) {
        runInAction(() => {
          this.fundraisers = [];
          this.errorFundraisers = e;
          this.loadingFundraisers = false;
        });
      }
    } finally {
      if (fetchId === this.currentFetchId) {
        this.inFlightController = null;
      }
    }
  }

  async fetchDonorsForFundraiser(fundraiserId, forceReload = false) {
    const cached = this.donorsMap.get(fundraiserId);
    if (!forceReload && cached && Date.now() - (cached.ts || 0) < this.cacheTTLms) {
      return this.getDonorsForFundraiser(fundraiserId);
    }

    try {
      // הוסף includeInactive=false כדי לקבל רק תורמים פעילים
      const res = await fetchWithAuth(`/api/donors?fundraiserId=${fundraiserId}&includeInactive=false`);
      if (!res.ok) throw new Error('Failed to fetch donors');
      const response = await res.json();
      
      let mappedDonors;
      runInAction(() => {
        mappedDonors = response.data.map(donor => ({
          donorId: donor.id,
          personId: donor.person_id,
          first_name: donor.first_name,
          last_name: donor.last_name,
          english_first_name: donor.english_first_name || '',
          english_last_name: donor.english_last_name || '',
          expectedDonation: donor.expected || 0,
          previousDonation: 0,
          currentDonation: donor.amount || 0,
          trafficLightColor: donor.traffic_light_color || 'gray',
          address: [donor.street_name, donor.houseNumber].filter(Boolean).join(' ') || '',
          city: donor.city_name || '',
          mobile: donor.main_mobile || '',
          phone: donor.phone_landline || '',
          email: donor.email || '',
          isActive: donor.active,
          isFundraiser: donor.isFundraiser || false,
          lastQuestionnaireByFundraiserId: donor.lastQuestionnaireByFundraiserId,
          lastForecastByFundraiserId: donor.lastForecastByFundraiserId,
          invitationSent: donor.invitationSent || false,
          arrivalConfirmed: donor.arrivalConfirmed || false,
          actuallyArrived: donor.actuallyArrived || false
        }));
        this.donorsMap.set(fundraiserId, { data: mappedDonors, total: response.total, ts: Date.now() });
      });
      return mappedDonors;
    } catch (error) {
      runInAction(() => {
        this.donorsMap.set(fundraiserId, { data: [], total: 0, ts: Date.now() });
      });
      return [];
    }
  }

  async fetchFundraisersSummary() {
    if (!this.rootStore.campaignId) return;
    try {
      const cacheKey = `summary:${this.rootStore.campaignId}`;
      const cached = this.fundraisersSummaryCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < this.cacheTTLms) {
        runInAction(() => { this.fundraisersSummary = cached.data; });
        return;
      }
      const res = await fetchWithAuth(`/api/fundraisers/summary?campaignId=${this.rootStore.campaignId}`);
      const data = await res.json();
      runInAction(() => {
        this.fundraisersSummary = data;
      });
      this.fundraisersSummaryCache.set(cacheKey, { ts: Date.now(), data });
    } catch (e) {
      runInAction(() => {
        this.fundraisersSummary = null;
        this.errorFundraisers = e;
      });
    }
  }

  // New method: Fetch navigation IDs for fundraisers
  async fetchNavigationIds() {
    if (!this.rootStore.campaignId) {
      return;
    }
    
    try {
      const url = `/api/fundraisers?idsOnly=true`;
      const res = await fetchWithAuth(url);
      const ids = await res.json();
      
      runInAction(() => {
        this.navigationIds = ids;
      });
    } catch (e) {
      runInAction(() => {
        this.navigationIds = [];
      });
    }
  }

  // New method: Get navigation index for current person
  getNavigationIndex(personId) {
    return this.navigationIds.findIndex(id => id === personId);
  }

  // New method: Get next person ID
  getNextPersonId(currentPersonId) {
    const index = this.getNavigationIndex(currentPersonId);
    if (index >= 0 && index < this.navigationIds.length - 1) {
      return this.navigationIds[index + 1];
    }
    return null;
  }

  // New method: Get previous person ID
  getPreviousPersonId(currentPersonId) {
    const index = this.getNavigationIndex(currentPersonId);
    if (index > 0) {
      return this.navigationIds[index - 1];
    }
    return null;
  }

  // Enhanced method: Get donors for fundraiser with better mapping
  getDonorsForFundraiser(fundraiserId) {
    const donorsData = this.donorsMap.get(fundraiserId);
    if (!donorsData) return [];
    
    return donorsData.data.map(donor => ({
      ...donor,
      originalIndex: donor.donorId,
      firstName: donor.first_name,
      lastName: donor.last_name,
      phone: donor.mobile || donor.phone,
      expectedDonation: donor.expectedDonation || 0,
      isActive: donor.isActive, // השתמש בערך האמיתי מה-API
      traffic_light_color: donor.trafficLightColor,
      fundraiserId: fundraiserId,
      lastQuestionnaireByFundraiserId: donor.lastQuestionnaireByFundraiserId,
      lastForecastByFundraiserId: donor.lastForecastByFundraiserId,
      invitationSent: donor.invitationSent || false,
      arrivalConfirmed: donor.arrivalConfirmed || false,
      actuallyArrived: donor.actuallyArrived || false
    }));
  }

  setFundraisers(fundraisers) {
    this.fundraisers = fundraisers;
  }

  setTotalFundraisers(total) {
    this.totalFundraisers = total;
  }

  setFilters(filters) {
    this.filters = filters;
    this.page = 1; // Reset to first page when filtering
    this.invalidateFundraisersCache();
  }

  setSortConfig(config) {
    this.sortConfig = config;
    this.invalidateFundraisersCache();
  }

  setPage(page) {
    this.page = page;
  }

  setRowsInPage(rows) {
    this.rowsInPage = rows;
    this.page = 1; // Reset to first page when changing rows per page
    this.invalidateFundraisersCache();
  }

  // Build cache key for fundraisers list
  buildFundraisersCacheKey({ includeAll }) {
    const keyObj = {
      campaignId: this.rootStore.campaignId,
      includeAll: !!includeAll,
      filters: this.filters,
      sort: this.sortConfig,
      page: this.page,
      rowsInPage: this.rowsInPage
    };
    return `fundraisers:${JSON.stringify(keyObj)}`;
  }

  // Invalidate fundraisers cache
  invalidateFundraisersCache() {
    this.fundraisersCache.clear();
    // this.fundraisersSummaryCache.clear(); // enable if summary should refresh too
  }

  // Legacy methods for backward compatibility
  async deleteSelectedFundraisers(selectedIds) {
    // For each fundraiser, delete it and clear donors
    for (const fundraiserId of selectedIds) {
      await this.deleteFundraiser(fundraiserId);
    }
  }

  // Enhanced method: Delete donor with local update + server call
  async deleteDonor(fundraiserId, donorId) {
    try {
      // 1. עדכון מקומי מיידי
      this.updateDonorRemovalLocally(donorId, fundraiserId);
      
      // 2. קריאה לשרת
      if (this.rootStore && this.rootStore.donorsStore) {
        const result = await this.rootStore.donorsStore.cancelDonorAssignment(donorId);
        if (result.success) {
          // 3. רענון מהשרת כדי לוודא סינכרון - רק לרשימת התורמים הפנימית
          await this.fetchDonorsForFundraiser(fundraiserId, true);
          this.fundraisersSummary.total_donors = Math.max(0, this.fundraisersSummary.total_donors - 1); 
          this.invalidateFundraisersCache(); // Invalidate cache for next time
          return { success: true };
        } else {
          // אם נכשל - נחזיר למצב הקודם
          this.revertDonorRemovalLocally(donorId, fundraiserId);
          return { success: false, message: result.message };
        }
      }
      return { success: false, message: 'סטור התורמים לא זמין' };
    } catch (error) {
      // אם נכשל - נחזיר למצב הקודם
      this.revertDonorRemovalLocally(donorId, fundraiserId);
      console.error('Error deleting donor:', error);
      return { success: false, message: 'שגיאה במחיקת תורם' };
    }
  }

  async deleteSelectedDonors(donorIds, fundraiserId) {
    try {
      // Unassign only the specified donors, then refresh the donors list for the fundraiser and the main fundraisers list
      if (this.rootStore && this.rootStore.donorsStore) {
        let successCount = 0;
        for (const donorId of donorIds) {
          const result = await this.rootStore.donorsStore.cancelDonorAssignment(donorId);
          if (result && result.success) {
            successCount++;
          }
        }
        
        if (fundraiserId) {
          await this.fetchDonorsForFundraiser(fundraiserId, true);
        }
        this.fundraisersSummary.total_donors = Math.max(0, this.fundraisersSummary.total_donors - donorIds.length);
        await this.fetchFundraisers();
        
        return { success: true, successCount, totalCount: donorIds.length };
      }
      return { success: false, message: 'סטור התורמים לא זמין' };
    } catch (error) {
      console.error('Error deleting selected donors:', error);
      return { success: false, message: 'שגיאה במחיקת תורמים נבחרים' };
    }
  }

  // Method גנרי לעדכון סטטוס מגייסים
  async updateStatus(fundraiserId, statusUpdates) {
    try {
      
      const response = await fetchWithAuth('/api/fundraisers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fundraiserId,
          statusUpdates
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      const result = await response.json(); 
      // עדכון המצב המקומי בסטור אם יש לנו את המגייס בזיכרון
      runInAction(() => {
        const fundraiserIndex = this.fundraisers.findIndex(f => f.fundraiser_id === parseInt(fundraiserId));
        if (fundraiserIndex !== -1) {
          // עדכון הסטטוסים המקומיים
          if (statusUpdates.status_questionnaire) {
            this.fundraisers[fundraiserIndex].status_questionnaire = statusUpdates.status_questionnaire;
          }
          if (statusUpdates.status_forecast) {
            this.fundraisers[fundraiserIndex].status_forecast = statusUpdates.status_forecast;
          }
        }
      });

      return result;

    } catch (error) {
      console.error('Error updating fundraiser status:', error);
      runInAction(() => {
        this.errorFundraisers = error.message;
      });
      throw error;
    }
  }

  sortFundraisers(key, direction) {
    // Legacy method - now handled by setSortConfig and fetchFundraisers
    this.setSortConfig({ key, direction });
    this.fetchFundraisers();
  }

  // Helper method: Update donor assignment locally
  updateDonorAssignmentLocally({ donorId, oldFundraiserId, newFundraiserId, donorData }) {
    runInAction(() => {
        const updatedFundraisers = this.fundraisers.map(f => {
            let needsUpdate = false;
            const updatedF = { ...f };

            if (f.id === oldFundraiserId) {
                const prevCount = Math.max(Number(f.donorsCount || 0), Number(f.donors_count || 0));
                const nextCount = Math.max(0, prevCount - 1);
                updatedF.donorsCount = nextCount;
                updatedF.donors_count = nextCount;
                needsUpdate = true;
            }

            if (f.id === newFundraiserId) {
                const prevCount = Math.max(Number(f.donorsCount || 0), Number(f.donors_count || 0));
                const nextCount = prevCount + 1;
                updatedF.donorsCount = nextCount;
                updatedF.donors_count = nextCount;
                needsUpdate = true;
            }

            return needsUpdate ? updatedF : f;
        });
        this.fundraisers = updatedFundraisers;

        // עדכון donorsMap
        if (oldFundraiserId && this.donorsMap.has(oldFundraiserId)) {
            const donors = this.donorsMap.get(oldFundraiserId).data;
            const donorIndex = donors.findIndex(d => d.donorId === donorId);
            if (donorIndex > -1) {
                donors.splice(donorIndex, 1);
            }
        }
        if (newFundraiserId) {
            if (!this.donorsMap.has(newFundraiserId)) {
                this.donorsMap.set(newFundraiserId, { data: [], total: 0, ts: Date.now() });
            }
            // We might not have the full donor data here, so we might need to fetch it or pass it in.
            // For now, let's assume we can add a placeholder or what we have.
            const donors = this.donorsMap.get(newFundraiserId).data;
            if (donorData && !donors.some(d => d.donorId === donorId)) {
                donors.push({ ...donorData, donorId: donorId, fundraiserId: newFundraiserId });
            }
        }
    });
  }

  // Helper method: Update local store without fetching
  updateLocalStoreAfterOperation() {
    // Clear cache to ensure fresh data on next fetch
    this.invalidateFundraisersCache();
  }

  // Helper: map API fundraiser to store shape (same as in fetchFundraisers)
  mapApiFundraiserToStore(apiFundraiser) {
    const mapped = {
      ...apiFundraiser,
      id: apiFundraiser.fundraiser_id,
      // גם camelCase לשימוש בקומפוננטות מסוימות
      firstName: apiFundraiser.first_name,
      lastName: apiFundraiser.last_name,
      donorsCount: parseInt(apiFundraiser.donors_count) || 0,
      expectedSum: parseInt(apiFundraiser.expected_sum) || 0,
      status_questionnaire: apiFundraiser.status_questionnaire || 'לא נשלח',
      status_forecast: apiFundraiser.status_forecast || 'לא נשלח',
      trafficLightCounts: {
        red: parseInt(apiFundraiser.red_count) || 0,
        orange: parseInt(apiFundraiser.orange_count) || 0,
        green: parseInt(apiFundraiser.green_count) || 0,
        gray: parseInt(apiFundraiser.gray_count) || 0,
        blue: parseInt(apiFundraiser.blue_count) || 0
      }
    };
    return mapped;
  }

  // Insert a single fundraiser (by id) without refetching all
  async fetchAndInsertFundraiserById(fundraiserId) {
    if (!this.rootStore.campaignId || !fundraiserId) return;
    try {
      const res = await fetchWithAuth(`/api/fundraisers?fundraiserId=${fundraiserId}`);
      if (!res.ok) return;
      const payload = await res.json();
      const apiFund = (payload?.data || [])[0];
      if (!apiFund) return;
      const mapped = this.mapApiFundraiserToStore(apiFund);
      runInAction(() => {
        this.fundraisers = [mapped, ...this.fundraisers];
        this.totalFundraisers = (this.totalFundraisers || 0) + 1;
      });
      this.updateLocalStoreAfterOperation();
    } catch (_) {
      // ignore
    }
  }

  // Remove a fundraiser locally without full refetch
  removeFundraiserLocally(fundraiserId) {
    if (!fundraiserId) return;
    runInAction(() => {
      const idx = this.fundraisers.findIndex(f => f.id === fundraiserId || f.fundraiser_id === fundraiserId);
      if (idx !== -1) {
        this.fundraisers.splice(idx, 1);
        this.totalFundraisers = Math.max(0, (this.totalFundraisers || 0) - 1);
      }
      this.donorsMap.delete(fundraiserId);
    });
    this.updateLocalStoreAfterOperation();
  }

  // Helper method: Update specific fundraiser data locally
  updateFundraiserLocally(fundraiserId, updates) {
    const index = this.fundraisers.findIndex(f => f.fundraiser_id === parseInt(fundraiserId));
    if (index !== -1) {
      runInAction(() => {
        this.fundraisers[index] = { ...this.fundraisers[index], ...updates };
      });
    }
  }

  // Helper method: Update donor removal locally
  updateDonorRemovalLocally(donorId, fundraiserId) {
    runInAction(() => {
      // הסרת התורם מהמתרים
      if (this.donorsMap.has(fundraiserId)) {
        const donorsData = this.donorsMap.get(fundraiserId);
        const donorIndex = donorsData.data.findIndex(d => d.donorId === donorId);
        if (donorIndex !== -1) {
          donorsData.data.splice(donorIndex, 1);
          donorsData.total = Math.max(0, donorsData.total - 1);
        }
      }
      
      // עדכון סטטיסטיקות המתרים
      const fundraiserIndex = this.fundraisers.findIndex(f => f.id === fundraiserId);
      if (fundraiserIndex !== -1) {
        this.fundraisers[fundraiserIndex].donorsCount = Math.max(0, this.fundraisers[fundraiserIndex].donorsCount - 1);
      }
    });
  }

  // Helper method: Revert donor removal locally
  revertDonorRemovalLocally(donorId, fundraiserId) {
    runInAction(() => {
      // החזרת התורם למתרים (אם יש לנו את הנתונים)
      // זה דורש מידע נוסף על התורם - נצטרך לטעון מחדש
      if (fundraiserId) {
        this.fetchDonorsForFundraiser(fundraiserId, true);
      }
    });
  }

  // New method: Add new fundraiser and update local store
  async addFundraiser(personId, activeDonor) {
    try {
      const response = await fetchWithAuth('/api/fundraisers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, activeDonor })
      });

      if (response.ok) {
        const newFundraiserPayload = await response.json();
        const mappedFundraiser = this.mapApiFundraiserToStore(newFundraiserPayload.data);     
        // Add to local store - replace array reference for MobX reactivity
        runInAction(() => {
          this.fundraisers = [mappedFundraiser, ...this.fundraisers];
          this.totalFundraisers += 1;
        });
        // Update summary locally
        this._updateSummaryAfterAddition(mappedFundraiser);
        
        // Clear cache for next fetch
        this.updateLocalStoreAfterOperation();
        // Invalidate donors cache so isFundraiser flag is fresh on next donors fetch
        if (this.rootStore?.donorsStore) {
          this.rootStore.donorsStore.invalidateDonorsCache();
        }
        return { success: true, data: mappedFundraiser };
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.error || 'שגיאה בהוספת מתרים' };
      }
    } catch (error) {
      console.error('Error adding fundraiser:', error);
      return { success: false, message: 'שגיאה בהוספת מתרים' };
    }
  }

  async deleteFundraiser(fundraiser, clearDonors = false) {
    if (!fundraiser) return { success: false, message: 'Fundraiser not provided' };
    const fundraiserId = fundraiser.fundraiser_id || fundraiser.id;

    // Optimistic update
    const originalFundraisers = [...this.fundraisers];
    const originalTotal = this.totalFundraisers;

    this.removeFundraiserLocally(fundraiserId);

    try {
      const response = await fetchWithAuth('/api/fundraisers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fundraiserId: fundraiserId,
          clearDonors: clearDonors,
        })
      });

      if (response.ok) {
        // Update summary locally
        this._updateSummaryAfterDeletion(fundraiser);
        
        // אם הדף הנוכחי נשאר ריק ויש עוד רשומות, טען מחדש
        if (this.fundraisers.length === 0 && this.totalFundraisers > 0) {
          // אם אנחנו לא בדף הראשון, חזור לדף הקודם
          if (this.page > 1) {
            runInAction(() => {
              this.page = this.page - 1;
            });
          }
          // טען את הנתונים מחדש
          await this.fetchFundraisers();
        }
        
        return { success: true };
      } else {
        // Revert optimistic update
        runInAction(() => {
          this.fundraisers = originalFundraisers;
          this.totalFundraisers = originalTotal;
        });
        const errorData = await response.json();
        return { success: false, message: errorData.error || 'שגיאה במחיקת מתרים' };
      }
    } catch (error) {
      console.error('Error deleting fundraiser:', error);
      // Revert optimistic update
      runInAction(() => {
        this.fundraisers = originalFundraisers;
        this.totalFundraisers = originalTotal;
      });
      return { success: false, message: 'שגיאה במחיקת מתרים' };
    }
  }

  // New method: Update fundraiser and refresh stores
  async updateFundraiser(fundraiserId, updateData) {
    try {
      const response = await fetchWithAuth('/api/fundraisers', {
        method: 'PUT',
        body: JSON.stringify({ fundraiserId, ...updateData })
      });

      if (response.ok) {
        // Refresh all stores
        await this.refreshStoresAfterDonorOperation();
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.error || 'שגיאה בעדכון מתרים' };
      }
    } catch (error) {
      console.error('Error updating fundraiser:', error);
      return { success: false, message: 'שגיאה בעדכון מתרים' };
    }
  }

  // שליפת מתרים בודד לפי מזהה בהחזרת שדות נוחים לשימוש
  getFundraiser(fundraiserId) {
    if (!fundraiserId) return null;
    const id = parseInt(fundraiserId);

    // נסה להביא מהרשימה המקומית תחילה
    const local = this.fundraisers.find(f => f.id === id || f.fundraiser_id === id);
    if (local) {
      const normalizedLocal = {
        ...local,
        firstName: local.firstName || local.first_name,
        lastName: local.lastName || local.last_name
      };
      this.currentFundraiser = normalizedLocal;
      return normalizedLocal;
    }

    // אם אין קמפיין, אין לנו אפשרות לקרוא לשרת
    if (!this.rootStore?.campaignId) {
      this.currentFundraiser = null;
      return null;
    }

    // שליפה מהשרת ברקע (fire-and-forget) ועדכון הסטור כשהתשובה מגיעה
    (async () => {
      try {
        const res = await fetchWithAuth(`/api/fundraisers?fundraiserId=${id}`);
        if (!res.ok) return;
        const payload = await res.json();
        const apiFund = (payload?.data || [])[0];
        if (!apiFund) return;
        const mapped = this.mapApiFundraiserToStore(apiFund);
        runInAction(() => {
          this.currentFundraiser = mapped;
          const idx = this.fundraisers.findIndex(f => f.id === id || f.fundraiser_id === id);
          if (idx === -1) {
            this.fundraisers.push(mapped);
          } else {
            this.fundraisers[idx] = mapped;
          }
        });
      } catch (_) {
        // התעלמות משגיאות בשליפה נקודתית
      }
    })();

    this.currentFundraiser = null;
    return null;
  }

  // Helper method to update summary after a fundraiser is deleted
  _updateSummaryAfterDeletion(deletedFundraiser) {
    if (this.fundraisersSummary) {
      runInAction(() => {
        const summary = this.fundraisersSummary;
        // 1) Fundraisers count
        summary.total_fundraisers = Math.max(0, (summary.total_fundraisers || 0) - 1);
        // 2) Total expected sum
        const removedExpected = Number(deletedFundraiser?.expected_sum || 0);
        summary.total_expected_sum = Math.max(0, Number(summary.total_expected_sum || 0) - removedExpected);
        // 3) Questionnaire status
        const status = deletedFundraiser?.status_questionnaire;
        if (status === 'הסתיים_בהצלחה') {
          summary.completed_questionnaire_count = Math.max(0, (summary.completed_questionnaire_count || 0) - 1);
        }
        if (status === 'לא נשלח') {
          summary.not_sent_questionnaire_count = Math.max(0, (summary.not_sent_questionnaire_count || 0) - 1);
        }
        // 4) Traffic light distribution
        const donors = Array.isArray(deletedFundraiser?.donors) ? deletedFundraiser.donors : [];
        let red = 0, orange = 0, green = 0, gray = 0;
        donors.forEach(d => {
          const c = d.traffic_light_color || d.trafficLightColor || '';
          if (c === 'red') red++;
          else if (c === 'orange') orange++;
          else if (c === 'green') green++;
          else gray++;
        });
        summary.red_count = Math.max(0, (summary.red_count || 0) - red);
        summary.orange_count = Math.max(0, (summary.orange_count || 0) - orange);
        summary.green_count = Math.max(0, (summary.green_count || 0) - green);
        summary.gray_count = Math.max(0, (summary.gray_count || 0) - gray);
        summary.blue_count = (summary.blue_count || 0) + donors.length;
      });
    }
  }
  
  _updateSummaryAfterAddition(newFundraiser) {
    if (this.fundraisersSummary && newFundraiser) {
      runInAction(() => {
        const summary = this.fundraisersSummary;
        // 1) Fundraisers count
        summary.total_fundraisers = (summary.total_fundraisers || 0) + 1;
        
        // 2) Total expected sum
        const addedExpected = Number(newFundraiser?.expected_sum || 0);
        summary.total_expected_sum = (Number(summary.total_expected_sum || 0) + addedExpected);
        
        // 3) Questionnaire status
        const status = newFundraiser?.status_questionnaire;
        if (status === 'הסתיים_בהצלחה') {
          summary.completed_questionnaire_count = (summary.completed_questionnaire_count || 0) + 1;
        } else if (status === 'לא נשלח') {
          summary.not_sent_questionnaire_count = (summary.not_sent_questionnaire_count || 0) + 1;
        }
      });
    }
  }
  
  // עדכון מקומי מהיר של המתרים כאשר נוספת תרומה
  updateFundraiserAfterDonation(fundraiserId, newExpectedAmount) {
    runInAction(() => {
      // עדכון המתרים הרלוונטי
      const fundraiserIndex = this.fundraisers.findIndex(f => f.id === fundraiserId);
      if (fundraiserIndex !== -1) {
        // הוספה לצפי של המתרים
        const currentExpected = Number(this.fundraisers[fundraiserIndex].expected_sum || 0);
        this.fundraisers[fundraiserIndex].expected_sum = String(currentExpected + newExpectedAmount);
      }
      
      // עדכון התקציר של המתרימים אם יש לנו
      if (this.fundraisersSummary) {
        const currentTotalExpected = Number(this.fundraisersSummary.total_expected || 0);
        this.fundraisersSummary.total_expected = String(currentTotalExpected + newExpectedAmount);
      }
    });
  }

  // עדכון סטטיסטיקות מתרימים בעת שינוי שיוך תורם
  updateFundraiserStatsForDonorAssignment(donor, oldFundraiserId, newFundraiserId) {
    if (oldFundraiserId === newFundraiserId) return;

    runInAction(() => {
      const expectedAmount = donor.expectedDonation || 0;
      const trafficColor = donor.traffic_light_color;

      // Decrement from old fundraiser
      if (oldFundraiserId) {
        const oldF = this.fundraisers.find(f => f.fundraiser_id === oldFundraiserId);
        if (oldF) {
          oldF.donors_count = String(Math.max(0, Number(oldF.donors_count || 0) - 1));
          oldF.expected_sum = String(Math.max(0, Number(oldF.expected_sum || 0) - expectedAmount));
          if (trafficColor) {
            const colorKey = `${trafficColor}_count`;
            if (oldF[colorKey] !== undefined) {
              oldF[colorKey] = String(Math.max(0, Number(oldF[colorKey] || 0) - 1));
            }
          }
        }
      }

      // Increment new fundraiser
      if (newFundraiserId) {
        const newF = this.fundraisers.find(f => f.fundraiser_id === newFundraiserId);
        if (newF) {
          newF.donors_count = String(Number(newF.donors_count || 0) + 1);
          newF.expected_sum = String(Number(newF.expected_sum || 0) + expectedAmount);
          if (trafficColor) {
            const colorKey = `${trafficColor}_count`;
            if (newF[colorKey] !== undefined) {
              newF[colorKey] = String(Number(newF[colorKey] || 0) + 1);
            } else {
              newF[colorKey] = '1';
            }
          }
        }
      }
    });
  }

  // עדכון הסטור כאשר נמחק תורם משויך
  updateStoreAfterDonorDeletion(donorId, fundraiserId, trafficLightColor, expectedAmount = 0) {
    runInAction(() => {
      // עדכון המתרים הרלוונטי
      const fundraiserIndex = this.fundraisers.findIndex(f => f.id === fundraiserId);
      if (fundraiserIndex !== -1) {
        // הפחתה ממספר התורמים המשויכים
        const currentCount = Number(this.fundraisers[fundraiserIndex].donors_count || 0);
        this.fundraisers[fundraiserIndex].donors_count = String(Math.max(0, currentCount - 1));
        
        // הפחתה מהצפי של המתרים
        if (expectedAmount > 0) {
          const currentExpected = Number(this.fundraisers[fundraiserIndex].expected_sum || 0);
          this.fundraisers[fundraiserIndex].expected_sum = String(Math.max(0, currentExpected - expectedAmount));
        }
        
        // עדכון ספירת צבעי רמזור אם יש לנו את הנתונים
        if (trafficLightColor) {
          const colorKey = `${trafficLightColor}_count`;
          if (this.fundraisers[fundraiserIndex][colorKey] !== undefined) {
            const currentColorCount = Number(this.fundraisers[fundraiserIndex][colorKey] || 0);
            this.fundraisers[fundraiserIndex][colorKey] = String(Math.max(0, currentColorCount - 1));
          }
        }
      }
      
      // עדכון donorsMap אם יש לנו את המתרים הזה
      if (this.donorsMap.has(fundraiserId)) {
        const donorsData = this.donorsMap.get(fundraiserId);
        const donorIndex = donorsData.data.findIndex(d => d.donorId === donorId);
        if (donorIndex !== -1) {
          donorsData.data.splice(donorIndex, 1);
          donorsData.total = Math.max(0, donorsData.total - 1);
        }
      }
    });
  }

  // Clear cache to force fresh data fetch
  clearCache() {
    this.fundraisersCache.clear();
    this.fundraisersSummaryCache.clear();
    this.donorsMap.clear();
  }

  // פונקציה לאיפוס הסטור
  reset() {
    runInAction(() => {
      this.fundraisers = [];
      this.totalFundraisers = 0;
      this.loadingFundraisers = false;
      this.errorFundraisers = null;
      this.filters = {};
      this.sortConfig = { key: 'name', direction: 'asc' };
      this.page = 1;
      this.rowsInPage = 20;
      this.donorsMap = new Map();
      this.fundraisersSummary = null;
      this.fetchDebounceTimer = null;
      this.currentFetchId = 0;
      this.inFlightController = null;
      this.navigationIds = [];
      this.fundraisersCache = new Map();
      this.fundraisersSummaryCache = new Map();
      this.currentFundraiser = null;
    });
  }
}

export default FundraisersStore;