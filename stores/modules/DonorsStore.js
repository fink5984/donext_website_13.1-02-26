"use client"
import { makeAutoObservable, runInAction } from "mobx";
import fetchWithAuth from '../../app/utils/fetchWithAuth';

class DonorsStore {
  donors = [];
  totalDonors = 0;
  donorsSummary = null;
  loadingDonors = false;
  errorDonors = null;
  filters = {};
  sortConfig = { key: null, direction: null };
  page = 1;
  rowsInPage = 20;
  fetchDebounceTimer = null;
  summaryDebounceTimer = null; // Timer for debouncing summary fetch
  usePagination = true; // האם להשתמש ב-pagination (true = עם עימוד, false = שלוף הכל)
  showInactive = true; // ברירת מחדל: להציג תורמים לא פעילים (רק בדפים ספציפיים משנים ל-false)
  // Track in-flight requests so newer ones cancel older ones
  currentFetchId = 0;
  inFlightController = null;
  
  // New properties for assignment functionality
  assignableDonors = []; // All donors available for assignment
  navigationIds = []; // IDs for navigation (previous/next)
  selectedDonors = []; // Selected donors for assignment
  loadingAssignableDonors = false;
  navigationMode = null; // 'all' | 'fundraiser'
  navigationFundraiserId = null;
  
  // Synagogue filtering
  synagogues = [];
  loadingSynagogues = false;
  selectedSynagogue = null;
  // Caching
  donorsCache = new Map(); // key -> { ts, data, total }
  donorsSummaryCache = new Map(); // key -> { ts, data }
  cacheTTLms = 60 * 1000; // 60 seconds TTL

  constructor(rootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {
      rootStore: false
    });
  }


  // Build donors API URL according to current filters/sort/pagination
  buildDonorsUrl({ noLimit = false, includeInactive = null, overrideFilters = null } = {}) {
    const filters = overrideFilters !== null ? overrideFilters : this.filters;
    // אם includeInactive לא נשלח בפרמטר, השתמש בערך מה-store
    const shouldIncludeInactive = includeInactive !== null ? includeInactive : this.showInactive;
    console.log('🔧 buildDonorsUrl:', { showInactive: this.showInactive, includeInactive, shouldIncludeInactive });
    // תמיד שולחים את הפרמטר במפורש
    let url = `/api/donors?includeInactive=${shouldIncludeInactive}`;

    // General search
    if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;

    // Specific filters
    const simpleFilters = ['fundraiserId', 'firstName', 'lastName', 'city', 'street', 'houseNumber', 'mobile', 'phone', 'email', 'targetFundraiserId'];
    simpleFilters.forEach(filter => {
      if (filters[filter]) url += `&${filter}=${encodeURIComponent(filters[filter])}`;
    });
    
    // Synagogue filter - supports array for multi-select
    if (filters.synagogue) {
      if (Array.isArray(filters.synagogue) && filters.synagogue.length > 0) {
        url += `&synagogue=${encodeURIComponent(JSON.stringify(filters.synagogue))}`;
      } else if (typeof filters.synagogue === 'string' && filters.synagogue) {
        url += `&synagogue=${encodeURIComponent(filters.synagogue)}`;
      }
    }
    
    // Active status filter - רק אם יש ערך מפורש
    if (filters.activeStatus !== undefined && filters.activeStatus !== null && filters.activeStatus !== '') {
      url += `&activeStatus=${filters.activeStatus}`;
    }
    
    if (filters.expectedRange) {
      url += `&expectedMin=${filters.expectedRange.min}&expectedMax=${filters.expectedRange.max}`;
    }
    if (filters.actualRange) {
      url += `&actualMin=${filters.actualRange.min}&actualMax=${filters.actualRange.max}`;
    }
    if (filters.trafficScore) {
      url += `&trafficLight=${filters.trafficScore}`;
    }
    if (filters.trafficColors && Array.isArray(filters.trafficColors) && filters.trafficColors.length > 0) {
      url += `&trafficColors=${encodeURIComponent(JSON.stringify(filters.trafficColors))}`;
    }
    if (filters.tagIds && Array.isArray(filters.tagIds) && filters.tagIds.length > 0) {
      url += `&tagIds=${encodeURIComponent(JSON.stringify(filters.tagIds))}`;
    }
    if (filters.noTag) {
      url += `&noTag=1`;
    }
    if (filters.titlesBefore && Array.isArray(filters.titlesBefore) && filters.titlesBefore.length > 0) {
      url += `&titlesBefore=${encodeURIComponent(JSON.stringify(filters.titlesBefore))}`;
    }
    if (filters.titlesAfter && Array.isArray(filters.titlesAfter) && filters.titlesAfter.length > 0) {
      url += `&titlesAfter=${encodeURIComponent(JSON.stringify(filters.titlesAfter))}`;
    }
    if (filters.fundraiserNames && Array.isArray(filters.fundraiserNames) && filters.fundraiserNames.length > 0) {
      url += `&fundraiserNames=${encodeURIComponent(JSON.stringify(filters.fundraiserNames))}`;
    }
    // Sorting
    if (this.sortConfig.key && this.sortConfig.direction) {
      url += `&sortField=${this.sortConfig.key}&sortDir=${this.sortConfig.direction}`;
    }
    // Pagination
    if (!noLimit) {
      url += `&limit=${this.rowsInPage}&offset=${(this.page - 1) * this.rowsInPage}`;
    } else {
      // כש-noLimit=true, שולחים limit=0 כאינדיקציה שרוצים הכל
      url += `&limit=0`;
    }

    return url;
  }

  // Map API donor object to client shape
  mapDonorFromApi(d) {
    return {
      ...d,
      firstName: d.first_name,
      lastName: d.last_name,
      city: d.city_name,
      address: [d.street_name, d.houseNumber].filter(Boolean).join(' ') || d.address || '',
      mobile: d.main_mobile || '',
      phone: d.phone_landline || '',
      landline: d.phone_landline || '',
      email: d.email || '',
      traffic_light_color: d.traffic_light_color || 'gray',
      expectedDonation: d.expected || 0,
      actualDonation: d.amount || 0,
      commitmentTotal: d.commitmentTotal || 0,
      isActive: d.active !== null ? d.active : true,
      synagogue: d.synagogue || '',
      invitationSent: d.invitationSent || false,
      arrivalConfirmed: d.arrivalConfirmed || false,
      actuallyArrived: d.actuallyArrived || false,
      lastQuestionnaireByFundraiserId: d.lastQuestionnaireByFundraiserId,
      lastForecastByFundraiserId: d.lastForecastByFundraiserId,
      // English name fields
      english_first_name: d.english_first_name || '',
      english_last_name: d.english_last_name || '',
      english_title_before: d.english_title_before || '',
      english_title_after: d.english_title_after || '',
      // Donor notes
      donorNotes: d.donorNotes || []
    };
  }

  // Fetch all donors without pagination for export, respecting current filters/sort
  async fetchAllDonorsForExport() {
    // ייצוא אמור לכלול את הערך הנוכחי של showInactive
    const baseUrl = this.buildDonorsUrl({ noLimit: true, includeInactive: this.showInactive });
    const url = baseUrl ? `${baseUrl}&forExport=1` : null;
    if (!url) return [];
    const res = await fetchWithAuth(url);
    if (!res || !res.ok) {
      // Try to read text for debugging, but do not throw JSON parse
      try { await res.text(); } catch (_) {}
      return [];
    }
    let data;
    try {
      data = await res.json();
    } catch (_) {
      // Server might have returned HTML error page (500), safeguard
      return [];
    }
    const mappedDonors = (data?.data || []).map(d => this.mapDonorFromApi(d));
    return mappedDonors;
  }

  // Debounced version of fetchDonors for search and filters
  debouncedFetchDonors({ noLimit = false, delay = 300 } = {}) {
    if (this.fetchDebounceTimer) {
      clearTimeout(this.fetchDebounceTimer);
    }
    
    this.fetchDebounceTimer = setTimeout(() => {
      this.fetchDonors({ noLimit });
      this.fetchDebounceTimer = null;
    }, delay);
  }

  // Clear cache when donations change
  clearDonorsCache() {
    this.donorsCache.clear();
    this.donorsSummaryCache.clear();
  }

  // Clear debounce timer when needed
  clearDebounce() {
    if (this.fetchDebounceTimer) {
      clearTimeout(this.fetchDebounceTimer);
      this.fetchDebounceTimer = null;
    }
  }

  async fetchDonors({ noLimit = false, overrideFilters = null, includeInactive = null } = {}) {
    // Try cache first
    const cacheKey = this.buildDonorsCacheKey({ noLimit, overrideFilters, includeInactive });
    const cached = this.donorsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.cacheTTLms) {
      runInAction(() => {
        this.donors = cached.data;
        this.totalDonors = cached.total;
        this.loadingDonors = false;
      });
      return;
    }

    // Cancel any in-flight request (older than this one)
    try {
      if (this.inFlightController) {
        this.inFlightController.abort();
      }
    } catch (_) {}

    // Create a controller for the new request and bump the fetch id
    const fetchId = ++this.currentFetchId;
    const controller = new AbortController();
    this.inFlightController = controller;
    this.loadingDonors = true;
    try {
      const url = this.buildDonorsUrl({ noLimit, overrideFilters, includeInactive });
      const res = await fetchWithAuth(url, { signal: controller.signal });
      const data = await res.json();
      const mappedDonors = (data.data || []).map(d => this.mapDonorFromApi(d));

        // Apply only if this is the latest request
        if (fetchId === this.currentFetchId) {
            runInAction(() => {
                this.donors = mappedDonors;
                this.totalDonors = data.total || 0;
                this.loadingDonors = false;
                // עדכון מהיר של total_actual עבור כרטיסי ההתקדמות
                // const sumActual = mappedDonors.reduce((sum, d) => sum + (Number(d.actualDonation) || 0), 0);
                // if (this.donorsSummary) {
                //   this.donorsSummary = {
                //     ...this.donorsSummary,
                //     total_actual: String(sumActual)
                //   };
                // }
            });
            // Update cache only for latest
            this.donorsCache.set(cacheKey, { ts: Date.now(), data: mappedDonors, total: data.total || 0 });
        }
    } catch (e) {
      // Ignore abort errors silently; they are expected when a newer request starts
      const isAbortError = typeof e?.name === 'string' && e.name === 'AbortError';
      if (!isAbortError && fetchId === this.currentFetchId) {
        runInAction(() => {
          this.donors = [];
          this.errorDonors = e;
          this.loadingDonors = false;
        });
      }
    }
    finally {
      // Clear controller only if we're still the latest request
      if (fetchId === this.currentFetchId) {
        this.inFlightController = null;
      }
    }
  }

  async fetchAssignableDonors() {
    this.loadingAssignableDonors = true;
    try {
        // Use current filters (e.g. synagogue) but no pagination limit
        const url = this.buildDonorsUrl({ noLimit: true });
        console.log('🏛️ fetchAssignableDonors URL:', url);
        console.log('🏛️ Current filters:', JSON.stringify(this.filters));
        const res = await fetchWithAuth(url);
        const data = await res.json();
        const mappedDonors = (data.data || []).map(d => this.mapDonorFromApi(d));
        runInAction(() => {
            this.assignableDonors = mappedDonors;
        });
    } catch (e) {
        console.error("Failed to fetch assignable donors", e);
        runInAction(() => {
            this.assignableDonors = [];
        });
    } finally {
        runInAction(() => {
            this.loadingAssignableDonors = false;
        });
    }
  }

  // Fetch all donors without any filters - used for assigned donors section in DonorAssignment modal
  async fetchAllDonorsUnfiltered() {
    try {
        const url = this.buildDonorsUrl({ noLimit: true, overrideFilters: {} });
        const res = await fetchWithAuth(url);
        const data = await res.json();
        return (data.data || []).map(d => this.mapDonorFromApi(d));
    } catch (e) {
        console.error("Failed to fetch all donors unfiltered", e);
        return [];
    }
  }

  async fetchDonorsSummary() {
    if (!this.rootStore.campaignId) return;
    
    try {
      // Build URL with all current filters (same as buildDonorsUrl but pointing to summary endpoint)
      const donorsUrl = this.buildDonorsUrl({ noLimit: true });
      const url = donorsUrl.replace('/api/donors?', '/api/donors/summary?');
      
      // Build cache key that includes filters
      const filtersKey = JSON.stringify(this.filters);
      const cacheKey = `summary:${this.rootStore.campaignId}:${filtersKey}`;
      const cached = this.donorsSummaryCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < this.cacheTTLms) {
        runInAction(() => {
          this.donorsSummary = cached.data;
        });
        return;
      }

      const res = await fetchWithAuth(url);
      const data = await res.json();
      runInAction(() => {
        this.donorsSummary = data;
      });
      this.donorsSummaryCache.set(cacheKey, { ts: Date.now(), data });
    } catch (e) {
      runInAction(() => {
        this.donorsSummary = null;
        this.errorDonors = e;
      });
    }
  }

  // ניקוי קאש ורענון מיידי (לשימוש כשתרומה מתווספת דרך API חיצוני)
  invalidateCacheAndRefresh() {
    runInAction(() => {
      this.donorsCache.clear();
      this.donorsSummaryCache.clear();
    });
    this.fetchDonors();
    this.fetchDonorsSummary();
  }

  // New method: Fetch synagogues for the campaign
  async fetchSynagogues() {
    this.loadingSynagogues = true;
    try {
      const res = await fetchWithAuth(`/api/donors/synagogues`);
      const data = await res.json();
      
      runInAction(() => {
        this.synagogues = data.data || [];
        this.loadingSynagogues = false;
      });
    } catch (e) {
      runInAction(() => {
        this.synagogues = [];
        this.loadingSynagogues = false;
      });
    }
  }

  setNavigationMode(mode, fundraiserId = null) {
    this.navigationMode = mode;
    this.navigationFundraiserId = fundraiserId;
  }

  // New method: Fetch navigation IDs
  async fetchNavigationIds(fundraiserId = null) {
    // Use navigationMode if set
    if (this.navigationMode === 'fundraiser' && this.navigationFundraiserId) {
      fundraiserId = this.navigationFundraiserId;
    }
    if (fundraiserId) {
      // Use only donors assigned to this fundraiser
      const donors = this.getDonorsForFundraiser(fundraiserId);
      runInAction(() => {
        this.navigationIds = donors.map(d => d.personId || d.person_id);
      });
      return;
    }
    try {
      const url = `/api/donors?idsOnly=true`;
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

  // New method: Assign donor to fundraiser
  async assignDonorToFundraiser(donorId, fundraiserId) {
    try {
      // בדיקה אם התורם כבר מוקצה לאותו מתרים
      const donor = this.donors.find(d => d.id === donorId);
      if (donor && donor.assigned_fundraiser_id === fundraiserId) {
        return { success: false, message: 'התורם כבר מוקצה למתרים זה' };
      }

      const oldFundraiserId = donor ? donor.assigned_fundraiser_id : null;

      const response = await fetchWithAuth('/api/donors/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorId,
          fundraiserId,
        })
      });
      
      if (response.ok) {
        // עדכון מלא של המצב המקומי
        runInAction(() => {
          // עדכון assignableDonors - חשוב ליצור עותק חדש של המערך
          const donorIndex = this.assignableDonors.findIndex(d => d.id === donorId);
          if (donorIndex > -1) {
            this.assignableDonors[donorIndex].assigned_fundraiser_id = fundraiserId;
            // יצירת עותק חדש של המערך כדי ש-MobX יזהה שינוי
            this.assignableDonors = [...this.assignableDonors];
          }
          
          // עדכון הרשימה הראשית של התורמים
          const mainDonorIndex = this.donors.findIndex(d => d.id === donorId);
          if (mainDonorIndex > -1) {
            this.donors[mainDonorIndex].assigned_fundraiser_id = fundraiserId;
            this.donors = [...this.donors];
          }

          // עדכון סיכום
          if (this.donorsSummary) {
            const wasAssigned = !!oldFundraiserId;
            const isAssigned = !!fundraiserId;

            if (!wasAssigned && isAssigned) {
              this.donorsSummary.assigned_count = String(Number(this.donorsSummary.assigned_count || 0) + 1);
            } else if (wasAssigned && !isAssigned) {
              this.donorsSummary.assigned_count = String(Math.max(0, Number(this.donorsSummary.assigned_count || 0) - 1));
            }
            this.donorsSummary = { ...this.donorsSummary };
          }
        });
        
        // עדכון הסטור של המתרימים אם קיים
        if (this.rootStore.fundraisersStore) {
          try {
            this.rootStore.fundraisersStore.updateDonorAssignmentLocally({
              donorId,
              oldFundraiserId,
              newFundraiserId: fundraiserId,
              donorData: donor,
            });
          } catch (e) {
            console.error('Error updating fundraiser stats:', e);
          }
        }
        
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.error || 'שגיאה בהקצאת התורם' };
      }
    } catch (e) {
      console.error('Error assigning donor:', e);
      return { success: false, message: 'שגיאה בהקצאת התורם' };
    }
  }

  // New method: Toggle donor assignment
  async toggleDonorAssignment(donorId, fundraiserId) {
    const donor = this.assignableDonors.find(d => d.id === donorId);
    if (!donor) return;

    const newFundraiserId = donor.assigned_fundraiser_id === fundraiserId ? null : fundraiserId;
    const result = await this.assignDonorToFundraiser(donor.id, newFundraiserId);
    
    if (!result.success) {
      // אפשר להוסיף כאן הצגת הודעת שגיאה למשתמש
      console.warn('Assignment failed:', result.message);
    }
    
    return result;
  }

  // New method: Cancel donor assignment
  async cancelDonorAssignment(donorId) {
    return await this.assignDonorToFundraiser(donorId, null);
  }

  // New method: Get donors assigned to specific fundraiser
  getDonorsForFundraiser(fundraiserId) {
    
    const result = this.assignableDonors.filter(
      donor => donor.assigned_fundraiser_id === fundraiserId && donor.isActive
    );
    
    return result;
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

  setDonors(donors) {
    this.donors = donors;
  }

  setTotalDonors(total) {
    this.totalDonors = total;
  }

  setFilters(filters) {
    this.filters = filters;
    this.page = 1;
    this.invalidateDonorsCache();
    // Also refresh summary when filters change
    this.donorsSummaryCache.clear();
    this.debouncedFetchDonors();
    // Debounce summary fetch to avoid too many requests
    if (this.summaryDebounceTimer) {
      clearTimeout(this.summaryDebounceTimer);
    }
    this.summaryDebounceTimer = setTimeout(() => {
      this.fetchDonorsSummary();
    }, 300);
  }

  setSortConfig(config) {
    this.sortConfig = config;
    this.invalidateDonorsCache();
  }

  setPage(page) {
    this.page = page;
  }

  setRowsInPage(rows) {
    this.rowsInPage = rows;
    this.page = 1;
    this.invalidateDonorsCache();
  }

  // Build cache key for donors list
  buildDonorsCacheKey({ noLimit, overrideFilters = null, includeInactive = null }) {
    const shouldIncludeInactive = includeInactive !== null ? includeInactive : this.showInactive;
    const keyObj = {
      campaignId: this.rootStore.campaignId,
      includeInactive: shouldIncludeInactive,
      filters: overrideFilters !== null ? overrideFilters : this.filters,
      sort: this.sortConfig,
      page: this.page,
      rowsInPage: this.rowsInPage,
      noLimit: !!noLimit
    };
    return `donors:${JSON.stringify(keyObj)}`;
  }

  // Invalidate donors caches (e.g., after mutations)
  invalidateDonorsCache() {
    this.donorsCache.clear();
    // this.donorsSummaryCache.clear(); // enable if summary should refresh too
  }

  // עדכון הסטור המקומי בלי קריאה לשרת
  updateDonorActiveStatus(donorId, isActive) {
    runInAction(() => {
      // עדכון התורם ברשימה
      const donorIndex = this.donors.findIndex(d => Number(d.id) === Number(donorId));
      if (donorIndex !== -1) {
        const donor = this.donors[donorIndex];
        const wasActive = donor.isActive;
        donor.isActive = isActive;

        // עדכון הסטור המקומי
        if (this.donorsSummary) {
          if (isActive && !wasActive) {
            // הפעלת תורם
            this.donorsSummary.active_count = String(Number(this.donorsSummary.active_count || 0) + 1);
            this.donorsSummary.inactive_count = String(Math.max(0, Number(this.donorsSummary.inactive_count || 0) - 1));
            
            // אם התורם היה משויך למתרים - הוספה למשויכים
            if (donor.assigned_fundraiser_id) {
              this.donorsSummary.assigned_count = String(Number(this.donorsSummary.assigned_count || 0) + 1);
            }
            
            // הוספה לספירת צבע הרמזור
            if (donor.traffic_light_color && this.donorsSummary[`${donor.traffic_light_color}_count`] !== undefined) {
              const currentColorCount = Number(this.donorsSummary[`${donor.traffic_light_color}_count`] || 0);
              this.donorsSummary[`${donor.traffic_light_color}_count`] = String(currentColorCount + 1);
            }
          } else if (!isActive && wasActive) {
            // ביטול הפעלת תורם
            this.donorsSummary.active_count = String(Math.max(0, Number(this.donorsSummary.active_count || 0) - 1));
            this.donorsSummary.inactive_count = String(Number(this.donorsSummary.inactive_count || 0) + 1);
            
            // אם התורם היה משויך למתרים - הפחתה ממשויכים
            if (donor.assigned_fundraiser_id) {
              this.donorsSummary.assigned_count = String(Math.max(0, Number(this.donorsSummary.assigned_count || 0) - 1));
            }
            
            // הפחתה מספירת צבע הרמזור
            if (donor.traffic_light_color && this.donorsSummary[`${donor.traffic_light_color}_count`] !== undefined) {
              const currentColorCount = Number(this.donorsSummary[`${donor.traffic_light_color}_count`] || 0);
              this.donorsSummary[`${donor.traffic_light_color}_count`] = String(Math.max(0, currentColorCount - 1));
            }
          }
        }
      }
      
      // נקה את ה-cache של דף התרומות כדי שהרשימה האטרקטיבית תתעדכן
      this.rootStore.donationsStore.invalidateSummaryCache();
    });
  }

  // עדכון הסטור אחרי מחיקת תורם
  removeDonorFromStore(donorId) {
    runInAction(() => {
      // הסרת התורם מהרשימה
      const donorIndex = this.donors.findIndex(d => d.id === donorId);
      if (donorIndex !== -1) {
        const donor = this.donors[donorIndex];
        this.donors.splice(donorIndex, 1);
        
        // עדכון הסטור המקומי
        if (this.donorsSummary) {
          if (donor.isActive) {
            this.donorsSummary.active_count = String(Math.max(0, Number(this.donorsSummary.active_count || 0) - 1));
          } else {
            this.donorsSummary.inactive_count = String(Math.max(0, Number(this.donorsSummary.inactive_count || 0) - 1));
          }
          this.donorsSummary.total_count = String(Math.max(0, Number(this.donorsSummary.total_count || 0) - 1));
          
          // אם התורם היה משויך למתרים - הפחתה ממשויכים
          if (donor.assigned_fundraiser_id) {
            this.donorsSummary.assigned_count = String(Math.max(0, Number(this.donorsSummary.assigned_count || 0) - 1));
          }
          
          // אם התורם היה עם צפי - הפחתה מהצפי הכללי
          if (donor.expectedDonation && donor.expectedDonation > 0) {
            const currentExpected = Number(this.donorsSummary.total_expected || 0);
            this.donorsSummary.total_expected = String(Math.max(0, currentExpected - donor.expectedDonation));
          }
          
          // עדכון צבעי הרמזור - הפחתה מהצבע הרלוונטי
          if (donor.traffic_light_color && this.donorsSummary[`${donor.traffic_light_color}_count`] !== undefined) {
            const currentColorCount = Number(this.donorsSummary[`${donor.traffic_light_color}_count`] || 0);
            this.donorsSummary[`${donor.traffic_light_color}_count`] = String(Math.max(0, currentColorCount - 1));
          }
          
          // עדכון מספר התורמים שתרמו וסך התרומות
          this.updateDonorsSummaryAfterDeletion(donor);
        }
        
        // עדכון הסטור של המתרימים אם יש לנו גישה אליו
        if (this.rootStore && this.rootStore.fundraisersStore && donor.assigned_fundraiser_id) {
          // קריאה לפונקציה החדשה בסטור של המתרימים
          this.rootStore.fundraisersStore.updateFundraiserStatsForDonorAssignment(donor, donor.assigned_fundraiser_id, null);
        }
      }
    });
  }

  // פונקציה חדשה לעדכון מספר התורמים שתרמו וסך התרומות
  updateDonorsSummaryAfterDeletion(deletedDonor) {
    // חישוב מחדש של מספר התורמים שתרמו
    const activeDonorsWithDonations = this.donors.filter(donor => 
      donor.isActive && donor.actualDonation > 0
    );
    
    // עדכון מספר התורמים שתרמו
    if (this.donorsSummary.donor_count !== undefined) {
      this.donorsSummary.donor_count = String(activeDonorsWithDonations.length);
    }
    
    // עדכון סך התרומות
    if (this.donorsSummary.total_donations !== undefined) {
      const totalDonations = activeDonorsWithDonations.reduce((sum, donor) => 
        sum + (donor.actualDonation || 0), 0
      );
      this.donorsSummary.total_donations = String(totalDonations);
    }
    
    // עדכון סך התרומות בפועל (total_actual)
    if (this.donorsSummary.total_actual !== undefined) {
      const totalActual = this.donors.reduce((sum, donor) => 
        sum + (donor.actualDonation || 0), 0
      );
      this.donorsSummary.total_actual = String(totalActual);
    }
  }

  // פונקציה לעדכון הסטור אחרי שינוי סטטוס
  updateDonorsSummaryAfterStatusChange() {
    // חישוב מחדש של מספר התורמים שתרמו
    const activeDonorsWithDonations = this.donors.filter(donor => 
      donor.isActive && donor.actualDonation > 0
    );
    
    // עדכון מספר התורמים שתרמו
    if (this.donorsSummary.donor_count !== undefined) {
      this.donorsSummary.donor_count = String(activeDonorsWithDonations.length);
    }
    
    // עדכון סך התרומות
    if (this.donorsSummary.total_donations !== undefined) {
      const totalDonations = activeDonorsWithDonations.reduce((sum, donor) => 
        sum + (donor.actualDonation || 0), 0
      );
      this.donorsSummary.total_donations = String(totalDonations);
    }
    
    // עדכון סך התרומות בפועל (total_actual)
    if (this.donorsSummary.total_actual !== undefined) {
      const totalActual = this.donors.reduce((sum, donor) => 
        sum + (donor.actualDonation || 0), 0
      );
      this.donorsSummary.total_actual = String(totalActual);
    }
  }

  // פונקציה לעדכון הסטור אחרי מחיקה מרובה של תורמים
  updateDonorsSummaryAfterMultipleDeletion() {
    // חישוב מחדש של מספר התורמים שתרמו
    const activeDonorsWithDonations = this.donors.filter(donor => 
      donor.isActive && donor.actualDonation > 0
    );
    
    // עדכון מספר התורמים שתרמו
    if (this.donorsSummary.donor_count !== undefined) {
      this.donorsSummary.donor_count = String(activeDonorsWithDonations.length);
    }
    
    // עדכון סך התרומות
    if (this.donorsSummary.total_donations !== undefined) {
      const totalDonations = activeDonorsWithDonations.reduce((sum, donor) => 
        sum + (donor.actualDonation || 0), 0
      );
      this.donorsSummary.total_donations = String(totalDonations);
    }
    
    // עדכון סך התרומות בפועל (total_actual)
    if (this.donorsSummary.total_actual !== undefined) {
      const totalActual = this.donors.reduce((sum, donor) => 
        sum + (donor.actualDonation || 0), 0
      );
      this.donorsSummary.total_actual = String(totalActual);
    }
  }

  // פונקציה לעדכון סטטוס תורם (פעיל/לא פעיל)
  updateDonorStatus(donorId, newStatus) {
    runInAction(() => {
      const donor = this.donors.find(d => d.id === donorId);
      if (donor) {
        const wasActive = donor.active;
        donor.active = newStatus;
        
        // עדכון הסטור
        if (this.donorsSummary) {
          if (wasActive && !newStatus) {
            // הפך מפעיל ללא פעיל
            this.donorsSummary.active_count = String(Math.max(0, Number(this.donorsSummary.active_count || 0) - 1));
            this.donorsSummary.inactive_count = String(Number(this.donorsSummary.inactive_count || 0) + 1);
          } else if (!wasActive && newStatus) {
            // הפך מלא פעיל לפעיל
            this.donorsSummary.inactive_count = String(Math.max(0, Number(this.donorsSummary.inactive_count || 0) - 1));
            this.donorsSummary.active_count = String(Number(this.donorsSummary.active_count || 0) + 1);
          }
          
          // עדכון מספר התורמים שתרמו וסך התרומות
          this.updateDonorsSummaryAfterStatusChange();
        }
      }
      
      // נקה את ה-cache של דף התרומות כדי שהרשימה האטרקטיבית תתעדכן
      this.rootStore.donationsStore.invalidateSummaryCache();
    });
  }

  // עדכון הסטור אחרי מחיקת תורמים מרובים
  removeMultipleDonorsFromStore(donorIds) {
    runInAction(() => {
      // קבלת כל התורמים שנמחקו
      const deletedDonors = this.donors.filter(d => donorIds.includes(d.id));
      
      // הסרת התורמים מהרשימה
      this.donors = this.donors.filter(d => !donorIds.includes(d.id));
      
      // עדכון totalDonors
      this.totalDonors = Math.max(0, this.totalDonors - deletedDonors.length);
      
      // עדכון הסטור המקומי
      if (this.donorsSummary) {
        let activeRemoved = 0;
        let inactiveRemoved = 0;
        let assignedRemoved = 0;
        
        deletedDonors.forEach(donor => {
          if (donor.isActive) {
            activeRemoved++;
          } else {
            inactiveRemoved++;
          }
          
          if (donor.assigned_fundraiser_id) {
            assignedRemoved++;
          }
        });
        
        this.donorsSummary.active_count = String(Math.max(0, Number(this.donorsSummary.active_count || 0) - activeRemoved));
        this.donorsSummary.inactive_count = String(Math.max(0, Number(this.donorsSummary.inactive_count || 0) - inactiveRemoved));
        this.donorsSummary.total_count = String(Math.max(0, Number(this.donorsSummary.total_count || 0) - (activeRemoved + inactiveRemoved)));
        this.donorsSummary.assigned_count = String(Math.max(0, Number(this.donorsSummary.assigned_count || 0) - assignedRemoved));
        
        // הפחתה מהצפי הכללי
        let totalExpectedRemoved = 0;
        deletedDonors.forEach(donor => {
          if (donor.expectedDonation && donor.expectedDonation > 0) {
            totalExpectedRemoved += donor.expectedDonation;
          }
        });
        if (totalExpectedRemoved > 0) {
          const currentExpected = Number(this.donorsSummary.total_expected || 0);
          this.donorsSummary.total_expected = String(Math.max(0, currentExpected - totalExpectedRemoved));
        }
        
        // עדכון צבעי הרמזור - הפחתה מהצבעים הרלוונטיים
        const colorRemovals = {};
        deletedDonors.forEach(donor => {
          if (donor.traffic_light_color) {
            const colorKey = donor.traffic_light_color;
            if (!colorRemovals[colorKey]) {
              colorRemovals[colorKey] = 0;
            }
            colorRemovals[colorKey]++;
          }
        });
        
        // עדכון הספירות של כל הצבעים
        Object.entries(colorRemovals).forEach(([color, count]) => {
          const colorKey = `${color}_count`;
          if (this.donorsSummary[colorKey] !== undefined) {
            const currentColorCount = Number(this.donorsSummary[colorKey] || 0);
            this.donorsSummary[colorKey] = String(Math.max(0, currentColorCount - count));
          }
        });
        
        // עדכון מספר התורמים שתרמו וסך התרומות
        this.updateDonorsSummaryAfterMultipleDeletion();
      }
      
      // עדכון הסטור של המתרימים אם יש לנו גישה אליו
      if (this.rootStore && this.rootStore.fundraisersStore) {
        const fundraisers = this.rootStore.fundraisersStore.fundraisers;
        
        // יצירת מפה של מתרים -> מספר תורמים שנמחקו
        const fundraiserRemovals = new Map();
        const fundraiserColorRemovals = new Map();
        
        deletedDonors.forEach(donor => {
          if (donor.assigned_fundraiser_id) {
            const fundraiserId = donor.assigned_fundraiser_id;
            
            // ספירת תורמים שנמחקו מכל מתרים
            if (!fundraiserRemovals.has(fundraiserId)) {
              fundraiserRemovals.set(fundraiserId, 0);
            }
            fundraiserRemovals.set(fundraiserId, fundraiserRemovals.get(fundraiserId) + 1);
            
            // ספירת צבעי רמזור שנמחקו מכל מתרים
            if (donor.traffic_light_color) {
              if (!fundraiserColorRemovals.has(fundraiserId)) {
                fundraiserColorRemovals.set(fundraiserId, {});
              }
              const colorKey = donor.traffic_light_color;
              if (!fundraiserColorRemovals.get(fundraiserId)[colorKey]) {
                fundraiserColorRemovals.get(fundraiserId)[colorKey] = 0;
              }
              fundraiserColorRemovals.get(fundraiserId)[colorKey]++;
            }
          }
        });
        
        // עדכון כל המתרימים הרלוונטיים
        fundraiserRemovals.forEach((removalCount, fundraiserId) => {
          const fundraiserIndex = fundraisers.findIndex(f => f.fundraiser_id === fundraiserId);
          
          if (fundraiserIndex !== -1) {
            // הפחתה ממספר התורמים המשויכים למתרים
            const currentCount = Number(fundraisers[fundraiserIndex].donors_count || 0);
            fundraisers[fundraiserIndex].donors_count = String(Math.max(0, currentCount - removalCount));
            
            // עדכון ספירת צבעי רמזור
            const colorRemovals = fundraiserColorRemovals.get(fundraiserId);
            if (colorRemovals) {
              Object.entries(colorRemovals).forEach(([color, count]) => {
                const colorKey = `${color}_count`;
                if (fundraisers[fundraiserIndex][colorKey] !== undefined) {
                  const currentColorCount = Number(fundraisers[fundraiserIndex][colorKey] || 0);
                  fundraisers[fundraiserIndex][colorKey] = String(Math.max(0, currentColorCount - count));
                }
              });
            }
          }
        });

        // עדכון הסטור של המתרימים אם יש לנו גישה אליו
        if (this.rootStore && this.rootStore.fundraisersStore) {
          // קריאה לפונקציה החדשה בסטור של המתרימים לכל תורם שנמחק
          deletedDonors.forEach(donor => {
            if (donor.assigned_fundraiser_id) {
              this.rootStore.fundraisersStore.updateStoreAfterDonorDeletion(
                donor.id,
                donor.assigned_fundraiser_id,
                donor.traffic_light_color,
                donor.expectedDonation || 0
              );
            }
          });
        }
      }
    });
  }

  // עדכון הסטור אחרי שינוי שיוך מתרים
  updateDonorFundraiserAssignment(donorId, oldFundraiserId, newFundraiserId) {
    runInAction(() => {
      // עדכון התורם ברשימה
      const donorIndex = this.donors.findIndex(d => d.id === donorId);
      if (donorIndex !== -1) {
        this.donors[donorIndex].assigned_fundraiser_id = newFundraiserId;
      }

      // עדכון הסטור של המתרימים אם יש לנו גישה אליו
      if (this.rootStore && this.rootStore.fundraisersStore) {
        const fundraisers = this.rootStore.fundraisersStore.fundraisers;
        
        // הפחתה מהמתרים הישן
        if (oldFundraiserId) {
          const oldFundraiserIndex = fundraisers.findIndex(f => f.fundraiser_id === oldFundraiserId);
          if (oldFundraiserIndex !== -1) {
            const currentCount = Number(fundraisers[oldFundraiserIndex].donors_count || 0);
            fundraisers[oldFundraiserIndex].donors_count = String(Math.max(0, currentCount - 1));
          }
        }
        
        // הוספה למתרים החדש
        if (newFundraiserId) {
          const newFundraiserIndex = fundraisers.findIndex(f => f.fundraiser_id === newFundraiserId);
          if (newFundraiserIndex !== -1) {
            const currentCount = Number(fundraisers[newFundraiserIndex].donors_count || 0);
            fundraisers[newFundraiserIndex].donors_count = String(currentCount + 1);
          }
        }
      }

      // עדכון התקציר של התורמים אם יש לנו
      if (this.donorsSummary) {
        // עדכון ספירת תורמים משויכים
        if (oldFundraiserId && !newFundraiserId) {
          // הסרת שיוך - הפחתה ממשויכים
          this.donorsSummary.assigned_count = String(Math.max(0, Number(this.donorsSummary.assigned_count || 0) - 1));
        } else if (!oldFundraiserId && newFundraiserId) {
          // הוספת שיוך - הוספה למשויכים
          this.donorsSummary.assigned_count = String(Number(this.donorsSummary.assigned_count || 0) + 1);
        } else if (oldFundraiserId && newFundraiserId) {
          // שינוי שיוך - אין שינוי בספירה הכללית
        }
      }
    });

    // כפיית עדכון של הסטור
    this.forceUpdate();
  }

  // עדכון סכום צפוי לתורם (שרת + עדכון מקומי בסטורים)
  async updateDonorExpectedDonation(donorId, expectedAmount) {
    try {
      const response = await fetchWithAuth(`/api/donors/${donorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected: expectedAmount })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to update donor expected donation');
      }

      // עדכון מקומי בסטור התורמים
      runInAction(() => {
        const idx = this.donors.findIndex(d => d.id === donorId);
        if (idx !== -1) {
          this.donors[idx].expectedDonation = expectedAmount;
        }
      });

      // עדכון מקומי גם במבנה התורמים של ה־FundraisersStore (אם קיים), כדי לשמור על סינכרון מיידי
      if (this.rootStore && this.rootStore.fundraisersStore) {
        const { fundraisersStore } = this.rootStore;
        runInAction(() => {
          for (const [fundId, donorsData] of fundraisersStore.donorsMap.entries()) {
            const donorIndex = donorsData.data.findIndex(d => d.donorId === donorId);
            if (donorIndex !== -1) {
              donorsData.data[donorIndex].expectedDonation = expectedAmount;
            }
          }
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating donor expected donation:', error);
      return { success: false, message: error.message };
    }
  }

  // עדכון מקומי מהיר של סכום צפוי לתורם
  updateDonorExpectedAmount(donorId, newAmount) {
    runInAction(() => {
      // עדכון התורם ברשימה
      const donorIndex = this.donors.findIndex(d => d.id === donorId);
      if (donorIndex !== -1) {
        this.donors[donorIndex].expectedDonation = newAmount;
      }

      // עדכון התקציר - הוספת ההפרש
      if (this.donorsSummary) {
        const currentExpected = Number(this.donorsSummary.total_expected || 0);
        this.donorsSummary.total_expected = String(currentExpected + newAmount);
      }
    });
  }

  // עדכון מקומי מהיר של סכום תרומה בפועל לתורם
  updateDonorActualDonation(donorId, newAmount) {
    runInAction(() => {
      // עדכון התורם ברשימה
      const donorIndex = this.donors.findIndex(d => d.id === donorId);
      const prevActual = donorIndex !== -1 ? Number(this.donors[donorIndex].actualDonation || 0) : 0;
      if (donorIndex !== -1) {
        this.donors[donorIndex].actualDonation = newAmount;
        // כפיית רנדר ע"י יצירת עותק חדש של המערך
        this.donors = [...this.donors];
      }

      // עדכון התקציר - הוספת דלתא בלבד
      const delta = Number(newAmount || 0) - prevActual;
      if (!this.donorsSummary) {
        this.donorsSummary = { total_actual: String(Math.max(0, delta)) };
      } else {
        const currentActual = Number(this.donorsSummary.total_actual || 0);
        this.donorsSummary.total_actual = String(Math.max(0, currentActual + delta));
      }

      // סנכרון תצוגות נוספות: עדכון donorsMap ב-FundraisersStore אם קיים
      if (this.rootStore && this.rootStore.fundraisersStore) {
        const { fundraisersStore } = this.rootStore;
        if (fundraisersStore.donorsMap && typeof fundraisersStore.donorsMap.forEach === 'function') {
          fundraisersStore.donorsMap.forEach((donorsData) => {
            const idx = donorsData.data?.findIndex(d => Number(d.donorId) === Number(donorId));
            if (idx !== -1 && donorsData.data[idx]) {
              donorsData.data[idx].actualDonation = newAmount;
            }
          });
        }
      }
    });
  }

  // כפיית עדכון של הסטור
  forceUpdate() {
    runInAction(() => {
      // יצירת עותק חדש של המערך כדי לכפות עדכון
      this.donors = [...this.donors];
      if (this.donorsSummary) {
        this.donorsSummary = { ...this.donorsSummary };
      }
    });
  }

  // Clear cache to force fresh data fetch
  clearCache() {
    this.donorsCache.clear();
    this.donorsSummaryCache.clear();
  }

  // פונקציה לאיפוס הסטור
  reset() {
    runInAction(() => {
      this.donors = [];
      this.totalDonors = 0;
      this.donorsSummary = null;
      this.loadingDonors = false;
      this.errorDonors = null;
      this.filters = {};
      this.sortConfig = { key: null, direction: null };
      this.page = 1;
      this.rowsInPage = 20;
      this.fetchDebounceTimer = null;
      this.currentFetchId = 0;
      this.inFlightController = null;
      this.assignableDonors = [];
      this.loadingAssignableDonors = false;
      this.navigationIds = [];
      this.selectedDonors = [];
      this.navigationMode = null;
      this.navigationFundraiserId = null;
      this.synagogues = [];
      this.loadingSynagogues = false;
    });
  }
}

export default DonorsStore;