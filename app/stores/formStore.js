import { makeAutoObservable, runInAction } from "mobx";
import fetchWithAuth from '../utils/fetchWithAuth';

class FormStore {
    isOpen = false;
    mode = null; // 'add' | 'edit'
    formType = null; // 'donor' | 'fundraiser'
    initialTab = null; // 'personal' | 'fundraiser'
    scrollToNotes = false; // deep link: גלילה לאזור ההערות בפתיחת הכרטיס
    currentData = null;
    isLoading = false;
    errors = {};
    
    // New properties for navigation
    isDirty = false;
    cities = [];
    streets = [];
    fundraisersWithCount = [];
    isLoadingFundraisers = false;

    constructor() {
        makeAutoObservable(this);
    }

    // Open form for adding
    openAddForm(formType) {
        this.isOpen = true;
        this.mode = 'add';
        this.formType = formType;
        this.currentData = null;
        this.clearErrors();
    }

    // Open form for editing
    async openEditForm(itemData, formType, campaignId) {
        this.isOpen = true;
        this.mode = 'edit';
        this.formType = formType;
        
        // If we have a person_id, fetch the complete person data
        if (itemData.person_id) {
            await this.fetchPersonData(itemData.person_id, campaignId);
        } else {
            runInAction(() => {
                this.currentData = itemData;
            });
        }
    }

    // Fetch person data from server using person_id
    async fetchPersonData(personId, campaignId) {
        runInAction(() => {
            this.isLoading = true;
        });
        try {
            const url = `/api/people?personId=${personId}`;
            const headers = {};
            if (campaignId) headers['x-campaign-id'] = String(campaignId);
            const response = await fetchWithAuth(url, { headers });
            if (response.ok) {
                const personData = await response.json();
                runInAction(() => {
                    this.currentData = personData;
                });
            }
        } catch (error) {
            // Error handled silently
        } finally {
            runInAction(() => {
                this.isLoading = false;
            });
        }
    }

    // Close form
    closeForm() {
        this.isOpen = false;
        this.mode = null;
        this.formType = null;
        this.initialTab = null;
        this.scrollToNotes = false;
        this.currentData = null;
        this.isLoading = false;
        this.clearErrors();
    }

    // Clear errors
    clearErrors() {
        this.errors = {};
    }

    // Set loading state
    setLoading(loading) {
        this.isLoading = loading;
    }

    // Submit form data
    async submitForm(clientId, campaignId, formData) {
        this.setLoading(true);
        this.clearErrors();

        try {
            // Use clientId from currentData if it exists, otherwise use provided clientId
            const actualClientId = this.currentData?.client_id || clientId;
            
            const submitData = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
                email: formData.email,
                mainMobile: formData.mainMobile,
                cityId: formData.cityId,
                streetId: formData.streetId,
                houseNumber: formData.houseNumber,
                clientId: actualClientId,
                personId: this.currentData?.id || null,
                synagogue: formData.synagogue,
                fundraiserId: formData.fundraiserId,
                campaignId: campaignId,
                invitationSent: formData.invitationSent,
                arrivalConfirmed: formData.arrivalConfirmed,
                actuallyArrived: formData.actuallyArrived,
                notes: formData.notes,
                noteFollowUpDate: formData.noteFollowUpDate || null,
                noteAssignee: formData.noteAssignee || null,
                englishName: formData.englishName
            };
            
            console.log('formStore submitForm - personId:', this.currentData?.id, 'mode:', this.mode, 'formType:', this.formType);

            const response = await fetchWithAuth('/api/people', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(submitData)
            });

            if (response.ok) {
                const result = await response.json();
                
                // אם זה מתרים חדש, הוסף אותו למתרימים (הוספה לתורמים נעשית באופן אוטומטי ב-API)
                if (this.formType === 'fundraiser' && !this.currentData?.id) {
                    // הוסף למתרימים עם מזהה המתרים האחראי
                    const fundraiserResponse = await fetchWithAuth('/api/fundraisers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            campaignId,
                            personId: result.personId,
                            // fundraiserId: formData.fundraiserId || null,
                            // activeDonor: false // או true לפי הצורך
                        }),
                    });
                    if (fundraiserResponse.ok) {
                        const fundraiserResult = await fundraiserResponse.json();
                        const fData = fundraiserResult?.data;
                        if (fData) {
                            result.fundraiserId = fData.fundraiser_id || fData.id;
                        }
                    }
                }
                // אם זה תורם חדש (ולא מתרים), הוסף אותו גם לטבלת התורמים
                else if (this.formType === 'donor' && !this.currentData?.id && result.personId) {
                    const donorResponse = await fetchWithAuth('/api/donors', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            campaignId,
                            personIds: [result.personId],
                            fundraiserId: formData.fundraiserId || undefined // שליחה ישירה של המתרים!
                        }),
                    });
                    // Create DonorNote for new donor if noteFollowUpDate is provided
                    if (formData.notes && formData.noteFollowUpDate && donorResponse.ok) {
                        const donorResult = await donorResponse.json();
                        const newDonorId = donorResult?.donors?.[0]?.id || donorResult?.donorId;
                        if (newDonorId) {
                            await fetchWithAuth('/api/donors/add-note', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    donorId: newDonorId,
                                    note: formData.notes,
                                    followUpDate: formData.noteFollowUpDate,
                                    ...(formData.noteAssignee?.userId ? { assignedToUserId: formData.noteAssignee.userId } : {}),
                                    ...(formData.noteAssignee?.name ? { assignedToName: formData.noteAssignee.name } : {})
                                })
                            });
                        }
                    }
                }

                this.setLoading(false);
                return result;
            } else {
                this.setLoading(false);
                return null;
            }
        } catch (error) {
            this.setLoading(false);
            this.errors.submit = 'שגיאה בשמירת הנתונים';
            return null;
        }
    }

    // New method: Set dirty state
    setDirty(dirty) {
        this.isDirty = dirty;
    }

    // New method: Set cities
    setCities(cities) {
        this.cities = cities;
    }

    // New method: Set streets
    setStreets(streets) {
        this.streets = streets;
    }

    // New method: Fetch cities
    async fetchCities() {
        try {
            const response = await fetchWithAuth('/api/cities');
            const cities = await response.json();
            this.setCities(cities);
        } catch (error) {
            // Error handled silently
        }
    }

    // New method: Fetch streets for a city
    async fetchStreets(cityId) {
        if (!cityId) {
            this.setStreets([]);
            return;
        }
        
        try {
            const response = await fetchWithAuth(`/api/streets?cityId=${cityId}`);
            const streets = await response.json();
            this.setStreets(streets);
        } catch (error) {
            this.setStreets([]);
        }
    }

    // New method: Navigate to next/previous person
    async navigateToPersonId(personId) {
        if (!personId) return;
        
        this.setLoading(true);
        
        try {
            await this.fetchPersonData(personId);
            this.setDirty(false); // Reset dirty state for new person
        } catch (error) {
            // Error handled silently
        } finally {
            this.setLoading(false);
        }
    }

    async fetchFundraisersWithCount() {
        console.log('fetchFundraisersWithCount called, current length:', this.fundraisersWithCount.length);
        
        if (this.fundraisersWithCount.length > 0) {
            console.log('Using cached fundraisers');
            return;
        }

        runInAction(() => {
            this.isLoadingFundraisers = true;
        });

        try {
            console.log('Fetching fundraisers from API...');
            const res = await fetchWithAuth(`/api/fundraisers?count=true`);
            console.log('API response status:', res.status);
            
            if (res.ok) {
                const data = await res.json();
                console.log('API returned data:', data);
                console.log('Fundraisers count from API:', data.data?.length);
                
                runInAction(() => {
                    this.fundraisersWithCount = data.data || [];
                    console.log('Stored fundraisers in store:', this.fundraisersWithCount.length);
                });
            } else {
                console.log('API response not ok:', res.status);
                const errorText = await res.text();
                console.log('Error response:', errorText);
            }
        } catch (error) {
            console.error('Error fetching fundraisers:', error);
        } finally {
            runInAction(() => {
                this.isLoadingFundraisers = false;
            });
        }
    }

    // Reset fundraisers cache (call when campaign changes)
    resetFundraisersCache() {
        runInAction(() => {
            this.fundraisersWithCount = [];
            this.isLoadingFundraisers = false;
        });
    }

    // Full reset for form store
    reset() {
        runInAction(() => {
            this.isOpen = false;
            this.mode = null;
            this.formType = null;
            this.currentData = null;
            this.isLoading = false;
            this.errors = {};
            this.isDirty = false;
            this.cities = [];
            this.streets = [];
            this.fundraisersWithCount = [];
            this.isLoadingFundraisers = false;
        });
    }

    // Enhanced method: Update current data
    updateCurrentData(data) {
        this.currentData = { ...this.currentData, ...data };
    }
}

export const formStore = new FormStore(); 