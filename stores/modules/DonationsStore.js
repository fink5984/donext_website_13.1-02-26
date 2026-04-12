import { makeAutoObservable, runInAction } from 'mobx';
import fetchWithAuth from '@/app/utils/fetchWithAuth';

class DonationsStore {
    donations = [];
    groupedDonations = []; // תרומות מקובצות לפי תורם
    loading = false;
    error = null;
    summary = null;
    rankDetails = null;
    rankDetailsLoading = false;

    // פילטרים ומיון
    searchTerm = '';
    sortField = 'created_at';
    sortDirection = 'desc';

    // פילטרים מתקדמים
    filters = {
        expectedRange: { min: 0, max: 1000000 },
        actualRange: { min: 0, max: 1000000 },
        trafficScore: null,
        city: '',
        street: '',
        houseNumber: '',
        firstName: '',
        lastName: '',
        phone: '',
        mobile: '',
        email: '',
        hasPaymentMethod: null
    };

    // פגינציה
    currentPage = 1;
    pageSize = 10;
    totalCount = 0;

    // קאשינג
    donationsCache = new Map(); // key -> { ts, data, total }
    summaryCache = new Map(); // key -> { ts, data }
    cacheTTLms = 60 * 1000; // 60 seconds TTL

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this, {
            rootStore: false
        });
        // Track in-flight requests for cancellation
        this.currentFetchId = 0;
        this.inFlightController = null;
    }

    // יצירת מפתח קאש עבור תרומות
    getDonationsCacheKey(campaignId) {
        const params = new URLSearchParams();
        if (campaignId) params.append('campaignId', campaignId);
        if (this.searchTerm) params.append('search', this.searchTerm);
        params.append('sortField', this.sortField);
        params.append('sortDir', this.sortDirection);
        params.append('limit', this.pageSize);
        params.append('offset', (this.currentPage - 1) * this.pageSize);
        params.append('groupByDonor', 'true');
        
        // הוספת פילטרים
        Object.keys(this.filters).forEach(key => {
            const value = this.filters[key];
            if (value !== null && value !== '' && value !== undefined) {
                if (key === 'expectedRange') {
                    params.append('expectedMin', value.min);
                    params.append('expectedMax', value.max);
                } else if (key === 'actualRange') {
                    params.append('actualMin', value.min);
                    params.append('actualMax', value.max);
                } else {
                    params.append(key, value);
                }
            }
        });
        
        return `donations:${params.toString()}`;
    }

    // טעינת תרומות
    async loadDonations(campaignId = null, silent = false) {
        // בדיקת קאש
        const cacheKey = this.getDonationsCacheKey(campaignId);
        const cached = this.donationsCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < this.cacheTTLms) {
            runInAction(() => {
                this.donations = cached.data;
                this.groupedDonations = cached.data; // הנתונים כבר מקובצים
                this.totalCount = cached.total;
                this.loading = false;
            });
            return;
        }

        // רק אם זה לא רענון שקט, נציג loading
        if (!silent) {
            this.loading = true;
        }
        this.error = null;

        try {
            // Cancel any in-flight request
            try {
                if (this.inFlightController) this.inFlightController.abort();
            } catch (_) { }
            const fetchId = ++this.currentFetchId;
            const controller = new AbortController();
            this.inFlightController = controller;

            const params = new URLSearchParams({
                search: this.searchTerm,
                sortField: this.sortField,
                sortDir: this.sortDirection,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                groupByDonor: 'true' // תמיד נקבץ לפי תורמים
            });

            // הוספת campaignId אם קיים
            if (campaignId) {
                params.append('campaignId', campaignId.toString());
            }

            // הוספת פילטרים מתקדמים
            if (this.filters.expectedRange.min > 0 || this.filters.expectedRange.max < 1000000) {
                params.append('expectedMin', this.filters.expectedRange.min.toString());
                params.append('expectedMax', this.filters.expectedRange.max.toString());
            }
            if (this.filters.actualRange.min > 0 || this.filters.actualRange.max < 1000000) {
                params.append('actualMin', this.filters.actualRange.min.toString());
                params.append('actualMax', this.filters.actualRange.max.toString());
            }
            if (this.filters.trafficScore) {
                params.append('trafficScore', this.filters.trafficScore);
            }
            if (this.filters.city) {
                params.append('city', this.filters.city);
            }
            if (this.filters.street) {
                params.append('street', this.filters.street);
            }
            if (this.filters.houseNumber) {
                params.append('houseNumber', this.filters.houseNumber);
            }
            if (this.filters.firstName) {
                params.append('firstName', this.filters.firstName);
            }
            if (this.filters.lastName) {
                params.append('lastName', this.filters.lastName);
            }
            if (this.filters.phone) {
                params.append('phone', this.filters.phone);
            }
            if (this.filters.mobile) {
                params.append('mobile', this.filters.mobile);
            }
            if (this.filters.email) {
                params.append('email', this.filters.email);
            }
            if (this.filters.hasPaymentMethod !== null) {
                params.append('hasPaymentMethod', this.filters.hasPaymentMethod.toString());
            }

            const response = await fetchWithAuth(`/api/donations?${params}`, { signal: controller.signal });

            if (response.ok) {
                const responseData = await response.json();
                if (fetchId === this.currentFetchId) {
                    const donations = responseData.data?.donations || [];
                    const total = responseData.data?.total || 0;
                    
                    runInAction(() => {
                        this.donations = donations; // שמירת הנתונים המקוריים
                        this.groupedDonations = donations; // כעת donations כבר מקובצים מהשרת
                        this.totalCount = total;
                    });
                    
                    // שמירת התוצאות בקאש
                    this.donationsCache.set(cacheKey, { ts: Date.now(), data: donations, total });
                }
            } else {
                throw new Error('Failed to load donations');
            }
        } catch (error) {
            const isAbortError = typeof error?.name === 'string' && error.name === 'AbortError';
            if (!isAbortError) {
                runInAction(() => {
                    this.error = error.message;
                });
            }
        } finally {
            runInAction(() => {
                this.loading = false;
            });
            this.inFlightController = null;
        }
    }

    // עדכון חיפוש
    setSearchTerm(term, campaignId = null) {
        this.searchTerm = term;
        this.currentPage = 1;
        this.loadDonations(campaignId);
    }

    // עדכון מיון - אם לוחצים על אותו שדה ואותו כיוון, מאפסים למצב דיפולט
    setSort(field, direction = null, campaignId = null) {
        // אם לוחצים על אותו שדה ואותו כיוון - אפס למצב דיפולט
        if (this.sortField === field && this.sortDirection === direction) {
            this.sortField = 'created_at';
            this.sortDirection = 'desc';
        } else {
            this.sortField = field;
            this.sortDirection = direction || (this.sortField === field ? (this.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc');
        }
        this.currentPage = 1;
        this.loadDonations(campaignId);
    }

    // עדכון עמוד
    setPage(page, campaignId = null) {
        this.currentPage = page;
        this.loadDonations(campaignId);
    }

    // עדכון גודל עמוד
    setPageSize(size, campaignId = null) {
        this.pageSize = size;
        this.currentPage = 1; // איפוס לעמוד הראשון
        this.loadDonations(campaignId);
    }

    // עדכון פילטרים מתקדמים
    setFilters(newFilters, campaignId = null) {
        this.filters = { ...this.filters, ...newFilters };
        this.currentPage = 1;
        this.loadDonations(campaignId);
    }

    // איפוס פילטרים
    resetFilters(campaignId = null) {
        this.searchTerm = '';
        this.sortField = 'created_at';
        this.sortDirection = 'desc';
        this.currentPage = 1;
        this.filters = {
            expectedRange: { min: 0, max: 1000000 },
            actualRange: { min: 0, max: 1000000 },
            trafficScore: null,
            city: '',
            street: '',
            houseNumber: '',
            firstName: '',
            lastName: '',
            phone: '',
            mobile: '',
            email: '',
            hasPaymentMethod: null
        };
        this.loadDonations(campaignId);
    }

    // הוספת תרומה חדשה לסטור המקומי
    addDonationToStore(newDonation, campaign = null) {
        runInAction(() => {

            this.donations.unshift(newDonation);
            this.totalCount += 1;
            
            // עדכן את הנתונים המקובצים
            this.updateGroupedDonations(newDonation, 'add', campaign);
        });
        
        // נקה קאש כדי שהנתונים יטענו מחדש בפעם הבאה
        this.donationsCache.clear();
        this.summaryCache.clear();
    }

    // ניקוי קאש ורענון מיידי (לשימוש כשתרומה מתווספת דרך API חיצוני)
    invalidateCacheAndRefresh(campaignId = null) {
        runInAction(() => {
            this.donationsCache.clear();
            this.summaryCache.clear();
        });
        if (campaignId) {
            // רענון שקט ברקע - לא מציג loading
            this.loadDonations(campaignId, true);
            this.loadSummary(campaignId);
        }
    }

    // עדכון תרומה קיימת בסטור המקומי
    updateDonationInStore(updatedDonation, campaign = null) {
        runInAction(() => {

            // חפש את התרומה הקיימת ברשימה הרגילה
            const index = this.donations.findIndex(d => d.id === updatedDonation.id);
            
            // חפש את התרומה גם בנתונים המקובצים
            let foundInGrouped = false;
            for (const group of this.groupedDonations) {
                const donationIndex = group.donations.findIndex(d => d.id === updatedDonation.id);
                if (donationIndex !== -1) {
                    foundInGrouped = true;
                    break;
                }
            }
            
            if (index !== -1 || foundInGrouped) {
                // התרומה קיימת - עדכן אותה
                if (index !== -1) {
                    this.donations[index] = updatedDonation;
                }
                this.updateGroupedDonations(updatedDonation, 'update', campaign);
            } else {
                // התרומה לא קיימת - הוסף אותה (למקרה של תרומה חדשה)
                this.donations.unshift(updatedDonation);
                this.totalCount += 1;
                this.updateGroupedDonations(updatedDonation, 'add', campaign);
            }
        });
    }

    // פונקציה עזר לעדכון הנתונים המקובצים
    updateGroupedDonations(donation, action, campaign = null) {
        if (!donation) {
            console.error('updateGroupedDonations: donation is null or undefined');
            return;
        }

        const donorId = donation.donor?.id || donation.donorId;
        
        if (!donorId) {
            console.error('updateGroupedDonations: donorId is null or undefined', donation);
            return;
        }
        
        if (action === 'add') {
            // מצא את קבוצת התורם או צור חדשה
            const existingGroupIndex = this.groupedDonations.findIndex(group => group.donor?.id === donorId);
            
            if (existingGroupIndex !== -1) {
                // הוסף לקבוצה קיימת ועדכן את הסכום
                const calculatedAmount = this.calculateActualAmount(donation, campaign);
                this.groupedDonations[existingGroupIndex].donations.unshift(donation);
                this.groupedDonations[existingGroupIndex].totalAmount += calculatedAmount;
            } else {
                // צור קבוצה חדשה
                const calculatedAmount = this.calculateActualAmount(donation, campaign);
                const newGroup = {
                    id: donorId,
                    donor: donation.donor,
                    donations: [donation],
                    totalAmount: calculatedAmount,
                    expectedAmount: parseFloat(donation.donor?.expected || 0)
                };
                this.groupedDonations.unshift(newGroup);
            }
        } else if (action === 'update') {
            // עדכן תרומה קיימת בקבוצות
            for (const group of this.groupedDonations) {
                const donationIndex = group.donations.findIndex(d => d.id === donation.id);
                if (donationIndex !== -1) {
                    const oldAmount = this.calculateActualAmount(group.donations[donationIndex], campaign);
                    const newAmount = this.calculateActualAmount(donation, campaign);
                    
                    group.donations[donationIndex] = donation;
                    group.totalAmount = group.totalAmount - oldAmount + newAmount;
                    break;
                }
            }
        }
    }

    // מחיקת תרומה
    async deleteDonation(donationId, campaignId = null) {
        try {
            const response = await fetchWithAuth(`/api/donations/${donationId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                let deletedDonation = null;
                let donorGroupWithDeletion = null;
                
                // עדכון מקומי - הסרת התרומה מהרשימה
                runInAction(() => {
                    // מצא את התרומה שנמחקת כדי לחשב את הסכום שלה
                    for (const donorGroup of this.groupedDonations) {
                        deletedDonation = donorGroup.donations.find(d => d.id === donationId);
                        if (deletedDonation) {
                            donorGroupWithDeletion = donorGroup;
                            break;
                        }
                    }
                    
                    this.donations = this.donations.filter(d => d.id !== donationId);
                    
                    // עדכון הנתונים המקובצים עם עדכון הסכום הכללי
                    this.groupedDonations = this.groupedDonations.map(donorGroup => {
                        const updatedDonations = donorGroup.donations.filter(d => d.id !== donationId);
                        const deletedFromThisGroup = donorGroup.donations.length !== updatedDonations.length;
                        
                        if (deletedFromThisGroup && deletedDonation) {
                            // עדכן את הסכום הכללי
                            const deletedAmount = this.calculateActualAmount(deletedDonation);
                            return {
                                ...donorGroup,
                                donations: updatedDonations,
                                totalAmount: Math.max(0, donorGroup.totalAmount - deletedAmount)
                            };
                        }
                        
                        return {
                            ...donorGroup,
                            donations: updatedDonations
                        };
                    }).filter(donorGroup => donorGroup.donations.length > 0); // הסר תורמים ללא תרומות
                    
                    this.totalCount = Math.max(0, this.totalCount - 1);
                });
                
                // עדכון המתרימים מקומית
                if (deletedDonation && this.rootStore?.fundraisersStore) {
                    this.updateFundraiserAfterDonationDeletion(deletedDonation, donorGroupWithDeletion);
                }
                
                // נקה קאש כדי שהנתונים יטענו מחדש
                this.donationsCache.clear();
                this.summaryCache.clear();

                // אם הדף הנוכחי נשאר ריק ויש עוד רשומות, טען מחדש
                if (this.groupedDonations.length === 0 && this.totalCount > 0) {
                    // אם אנחנו לא בדף הראשון, חזור לדף הקודם
                    if (this.currentPage > 1) {
                        runInAction(() => {
                            this.currentPage = this.currentPage - 1;
                        });
                    }
                    // טען את הנתונים מחדש
                    await this.loadDonations(campaignId);
                }

                return true;
            } else {
                throw new Error('Failed to delete donation');
            }
        } catch (error) {
            runInAction(() => {
                this.error = error.message;
            });
            return false;
        }
    }

    // מחיקת תרומות מרובות
    async deleteMultipleDonations(donationIds, campaignId = null) {
        try {
            const results = [];
            const deletedDonationsData = []; // שמירת נתוני התרומות שנמחקו לעדכון המתרימים
            // שמור את מצב הטעינה המחודשת - נעשה רק פעם אחת בסוף
            const shouldReloadAfter = donationIds.length > 0;
            
            for (const donationId of donationIds) {
                const response = await fetchWithAuth(`/api/donations/${donationId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    let deletedDonation = null;
                    let donorGroupWithDeletion = null;
                    
                    // עדכון מקומי של כל מחיקה
                    runInAction(() => {
                        for (const donorGroup of this.groupedDonations) {
                            deletedDonation = donorGroup.donations.find(d => d.id === donationId);
                            if (deletedDonation) {
                                donorGroupWithDeletion = donorGroup;
                                break;
                            }
                        }

                        this.donations = this.donations.filter(d => d.id !== donationId);

                        this.groupedDonations = this.groupedDonations.map(donorGroup => {
                            const updatedDonations = donorGroup.donations.filter(d => d.id !== donationId);
                            const deletedFromThisGroup = donorGroup.donations.length !== updatedDonations.length;

                            if (deletedFromThisGroup && deletedDonation) {
                                const deletedAmount = this.calculateActualAmount(deletedDonation);
                                return {
                                    ...donorGroup,
                                    donations: updatedDonations,
                                    totalAmount: Math.max(0, donorGroup.totalAmount - deletedAmount)
                                };
                            }

                            return {
                                ...donorGroup,
                                donations: updatedDonations
                            };
                        }).filter(donorGroup => donorGroup.donations.length > 0);

                        this.totalCount = Math.max(0, this.totalCount - 1);
                    });
                    
                    // שמירת נתוני התרומה שנמחקה
                    if (deletedDonation) {
                        deletedDonationsData.push({
                            donation: deletedDonation,
                            donorGroup: donorGroupWithDeletion
                        });
                    }
                    
                    results.push(true);
                } else {
                    results.push(false);
                }
            }
            
            // עדכון המתרימים מקומית עבור כל התרומות שנמחקו
            if (deletedDonationsData.length > 0 && this.rootStore?.fundraisersStore) {
                deletedDonationsData.forEach(({ donation, donorGroup }) => {
                    this.updateFundraiserAfterDonationDeletion(donation, donorGroup);
                });
            }
            
            // נקה קאש
            this.donationsCache.clear();
            this.summaryCache.clear();
            
            // טען מחדש אם הדף נשאר ריק
            if (shouldReloadAfter && this.groupedDonations.length === 0 && this.totalCount > 0) {
                if (this.currentPage > 1) {
                    runInAction(() => {
                        this.currentPage = this.currentPage - 1;
                    });
                }
                await this.loadDonations(campaignId);
            }
            
            return results.every(result => result); // החזר true רק אם כולם הצליחו
        } catch (error) {
            runInAction(() => {
                this.error = error.message;
            });
            return false;
        }
    }

    // חישוב מספר עמודים
    get totalPages() {
        return Math.ceil(this.totalCount / this.pageSize);
    }

    // בדיקה אם יש תוצאות
    get hasResults() {
        return this.groupedDonations.length > 0;
    }

    // בדיקה אם יש פילטרים פעילים
    get hasActiveFilters() {
        return this.searchTerm !== '' ||
            this.filters.expectedRange.min > 0 ||
            this.filters.expectedRange.max < 1000000 ||
            this.filters.actualRange.min > 0 ||
            this.filters.actualRange.max < 1000000 ||
            this.filters.trafficScore !== null ||
            this.filters.city !== '' ||
            this.filters.street !== '' ||
            this.filters.houseNumber !== '' ||
            this.filters.firstName !== '' ||
            this.filters.lastName !== '' ||
            this.filters.phone !== '' ||
            this.filters.mobile !== '' ||
            this.filters.email !== '' ||
            this.filters.hasPaymentMethod !== null;
    }

    // טעינת תקציר תרומות
    async loadSummary(campaignId) {
        try {
            // בדיקת קאש
            const cacheKey = `summary:${campaignId}`;
            const cached = this.summaryCache.get(cacheKey);
            if (cached && Date.now() - cached.ts < this.cacheTTLms) {
                runInAction(() => {
                    this.summary = cached.data;
                });
                return;
            }

            const response = await fetchWithAuth(`/api/donations/summary?campaignId=${campaignId}`);

            if (response.ok) {
                const data = await response.json();
                runInAction(() => {
                    this.summary = data;
                });
                
                // שמירת התוצאות בקאש
                this.summaryCache.set(cacheKey, { ts: Date.now(), data });
            } else {
                throw new Error('Failed to load donations summary');
            }
        } catch (error) {
            runInAction(() => {
                this.error = error.message;
            });
        }
    }

    // טעינת פרטי דרגה
    fetchRankDetails = async (rankAmount, campaignId) => {
        this.rankDetailsLoading = true;
        this.error = null;
        try {
            const params = new URLSearchParams({
                amount: rankAmount,
                campaignId: campaignId
            });
            const response = await fetchWithAuth(`/api/donations/rank-details?${params}`);

            if (response.ok) {
                const data = await response.json();
                runInAction(() => {
                    this.rankDetails = data.data;
                });
            } else {
                throw new Error('Failed to load rank details');
            }
        } catch (error) {
            runInAction(() => {
                this.error = error.message;
            });
        } finally {
            runInAction(() => {
                this.rankDetailsLoading = false;
            });
        }
    }

    clearRankDetails = () => {
        this.rankDetails = null;
    }

    // קיבוץ תרומות לפי תורם
    groupDonationsByDonor(donations) {
        const grouped = {};
        
        donations.forEach(donation => {
            const donorId = donation.donor?.id;
            const donorKey = `${donation.donor?.person?.firstName || ''}_${donation.donor?.person?.lastName || ''}_${donorId}`;
            
            if (!grouped[donorKey]) {
                grouped[donorKey] = {
                    id: donorId,
                    donor: donation.donor,
                    donations: [],
                    totalAmount: 0,
                    expectedAmount: parseFloat(donation.donor?.expected || 0)
                };
            }
            
            grouped[donorKey].donations.push(donation);
            grouped[donorKey].totalAmount += this.calculateActualAmount(donation);
        });
        
        return Object.values(grouped);
    }

    // חישוב סכום בפועל לתרומה - לוגיקה זהה לרכיב המקורי
    calculateActualAmount(donation, campaign = null) {
        const monthlyAmount = parseFloat(donation.monthlyAmount || 0);
        const donationType = campaign?.donation_type;

        // אם זה קמפיין פרויקט - כפול במספר התשלומים
        if (donationType === 'project' && donation.numberOfPayments && donation.numberOfPayments > 0) {
            return monthlyAmount * donation.numberOfPayments;
        }

        // אם זה קמפיין פרויקט ללא מספר תשלומים או unlimited
        if (donationType === 'project') {
            return monthlyAmount;
        }

        // אם זה קמפיין חודשי - לא כופל, מציג רק את הסכום החודשי
        if (donationType === 'monthly') {
            return monthlyAmount;
        }

        // ברירת מחדל - החזר את הסכום החודשי
        return monthlyAmount;
    }

    // סימון הערות כנקראו
    markNotesAsRead(donationIds) {
        runInAction(() => {
            // עדכון בנתונים המקובצים
            this.groupedDonations.forEach(group => {
                group.donations.forEach(donation => {
                    if (donationIds.includes(donation.id)) {
                        donation.noteRead = true;
                    }
                });
            });
            
            // עדכון בנתונים הרגילים אם יש
            this.donations.forEach(donation => {
                if (donationIds.includes(donation.id)) {
                    donation.noteRead = true;
                }
            });
        });
    }

    // עדכון המתרימים מקומית לאחר מחיקת תרומה
    updateFundraiserAfterDonationDeletion(deletedDonation, donorGroupWithDeletion) {
        if (!this.rootStore?.fundraisersStore || !deletedDonation) return;
        
        const fundraiserId = deletedDonation.donor?.fundraiser_id;
        if (!fundraiserId) return;
        
        runInAction(() => {
            const fundraisersStore = this.rootStore.fundraisersStore;
            
            // מצא את המתרים ברשימה
            const fundraiserIndex = fundraisersStore.fundraisers.findIndex(
                f => f.id === fundraiserId || f.fundraiser_id === fundraiserId
            );
            
            if (fundraiserIndex !== -1) {
                const fundraiser = fundraisersStore.fundraisers[fundraiserIndex];
                const deletedAmount = this.calculateActualAmount(deletedDonation, this.rootStore.campaign);
                
                // עדכון התרמה בפועל
                const currentActualSum = Number(fundraiser.actual_donation_sum || 0);
                fundraiser.actual_donation_sum = Math.max(0, currentActualSum - deletedAmount);
                
                // בדיקה אם לתורם נשארו תרומות נוספות
                const donorStillHasDonations = donorGroupWithDeletion && 
                    donorGroupWithDeletion.donations.length > 1; // אם יש יותר מתרומה אחת (שכבר הוסרה)
                
                // אם זו הייתה התרומה היחידה של התורם, הפחת גם את מספר התורמים בפועל
                if (!donorStillHasDonations) {
                    const currentActualDonors = Number(fundraiser.actual_donors_count || 0);
                    fundraiser.actual_donors_count = Math.max(0, currentActualDonors - 1);
                }
                
                // עדכון הסיכום של המתרימים אם קיים
                if (fundraisersStore.fundraisersSummary) {
                    const summary = fundraisersStore.fundraisersSummary;
                    
                    // עדכון סך התרומות בפועל
                    const currentTotalActual = Number(summary.total_actual_donation_sum || 0);
                    summary.total_actual_donation_sum = Math.max(0, currentTotalActual - deletedAmount);
                    
                    // עדכון מספר התורמים בפועל אם התורם לא נשאר עם תרומות
                    if (!donorStillHasDonations) {
                        const currentTotalActualDonors = Number(summary.total_actual_donors_count || 0);
                        summary.total_actual_donors_count = Math.max(0, currentTotalActualDonors - 1);
                    }
                }
            }
            
            // נקה את הקאש של המתרימים כדי שבטעינה הבאה הנתונים יהיו מהשרת
            fundraisersStore.invalidateFundraisersCache();
        });
    }

    // פונקציה לניקוי cache של summary
    invalidateSummaryCache() {
        this.summaryCache.clear();
    }

    // פונקציה לאיפוס הסטור
    reset() {
        runInAction(() => {
            this.donations = [];
            this.groupedDonations = [];
            this.loading = false;
            this.error = null;
            this.summary = null;
            this.rankDetails = null;
            this.rankDetailsLoading = false;
            this.searchTerm = '';
            this.sortField = 'created_at';
            this.sortDirection = 'desc';
            this.currentPage = 1;
            this.pageSize = 10;
            this.totalCount = 0;
            this.currentFetchId = 0;
            this.inFlightController = null;
            this.filters = {
                expectedRange: { min: 0, max: 1000000 },
                actualRange: { min: 0, max: 1000000 },
                trafficScore: null,
                city: '',
                street: '',
                houseNumber: '',
                firstName: '',
                lastName: '',
                phone: '',
                mobile: '',
                email: '',
                hasPaymentMethod: null
            };
        });
    }
}

export default DonationsStore; 