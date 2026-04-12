"use client"
import { makeAutoObservable, runInAction } from "mobx";
import fetchWithAuth from '../../app/utils/fetchWithAuth';

class ContactsStore {
    // נתוני אנשי קשר
    contacts = [];
    totalContacts = 0;
    totalDonationsSum = 0;
    loadingContacts = false;
    errorContacts = null;

    // פגינציה
    page = 1;
    pageSize = 20;
    totalPages = 0;

    // חיפוש, סינון, מיון
    search = '';
    filters = {};
    sortField = 'firstName';
    sortDirection = 'asc';

    // עמודות - נטען מה-DB
    columnSettings = null;
    loadingColumnSettings = false;

    // שדות מותאמים
    customFields = [];
    loadingCustomFields = false;

    // תגיות
    tags = [];
    loadingTags = false;

    // בחירה
    selectedContactIds = new Set();
    selectAll = false;

    // טאב פעיל
    activeTab = 'myContacts';
    needsAttentionCount = 0;

    // פאנל צד
    activeContact = null;
    sidePanelOpen = false;

    // Debounce
    fetchDebounceTimer = null;
    currentFetchId = 0;

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this, {
            rootStore: false,
            fetchDebounceTimer: false,
            currentFetchId: false,
        });
    }

    get clientId() {
        return this.rootStore?.clientId;
    }

    // =====================
    // אנשי קשר - Fetch
    // =====================

    async fetchContacts(softLoad = false) {
        if (!this.clientId) return;

        const fetchId = ++this.currentFetchId;
        if (!softLoad) this.loadingContacts = true;
        this.errorContacts = null;

        try {
            const params = new URLSearchParams({
                clientId: String(this.clientId),
                paginated: 'true',
                page: String(this.page),
                pageSize: String(this.pageSize),
                sortBy: this.sortField,
                sortOrder: this.sortDirection,
            });

            if (this.search) params.set('search', this.search);

            // סינון לפי טאב — status
            if (this.activeTab === 'needsAttention') {
                params.set('statusFilter', 'pending');
            } else {
                params.set('statusFilter', 'regular');
            }

            // סינון לפי תגיות
            if (this.filters.tagIds?.length) {
                this.filters.tagIds.forEach(id => params.append('tagIds', String(id)));
            }
            // סינון לפי קמפיינים
            if (this.filters.campaignIds?.length) {
                this.filters.campaignIds.forEach(id => params.append('campaignIds', String(id)));
            }
            // סינון פעילים/לא פעילים
            if (this.filters.active !== undefined) {
                params.set('active', String(this.filters.active));
            }
            // סינון לפי אימייל
            if (this.filters.hasEmail !== undefined) {
                params.set('hasEmail', String(this.filters.hasEmail));
            }
            // סינון לפי טלפון
            if (this.filters.hasMobile !== undefined) {
                params.set('hasMobile', String(this.filters.hasMobile));
            }
            // סינון לפי שם
            if (this.filters.name) {
                params.set('name', this.filters.name);
            }
            // סינון לפי עיר
            if (this.filters.city) {
                params.set('city', this.filters.city);
            }
            // סינון לפי מקור
            if (this.filters.source) {
                params.set('source', this.filters.source);
            }
            // סינון לפי סוג
            if (this.filters.type) {
                params.set('type', this.filters.type);
            }
            // סינון לפי שם פרטי (מרובה)
            if (this.filters.firstNames?.length) {
                this.filters.firstNames.forEach(v => params.append('firstNames', v));
            }
            // סינון לפי שם משפחה (מרובה)
            if (this.filters.lastNames?.length) {
                this.filters.lastNames.forEach(v => params.append('lastNames', v));
            }
            // סינון לפי רחוב (מרובה)
            if (this.filters.streets?.length) {
                this.filters.streets.forEach(v => params.append('streets', v));
            }
            // סינון לפי מספר בית (מרובה)
            if (this.filters.houseNumbers?.length) {
                this.filters.houseNumbers.forEach(v => params.append('houseNumbers', v));
            }
            // סינון לפי תואר לפני (מרובה)
            if (this.filters.titlesBefore?.length) {
                this.filters.titlesBefore.forEach(v => params.append('titlesBefore', v));
            }
            // סינון לפי תואר אחרי (מרובה)
            if (this.filters.titlesAfter?.length) {
                this.filters.titlesAfter.forEach(v => params.append('titlesAfter', v));
            }
            // סינון לפי מתרים אחראי (מרובה)
            if (this.filters.fundraiserNames?.length) {
                this.filters.fundraiserNames.forEach(v => params.append('fundraiserNames', v));
            }
            // סינון לפי שם אב (מרובה)
            if (this.filters.fatherNames?.length) {
                this.filters.fatherNames.forEach(v => params.append('fatherNames', v));
            }
            // סינון לפי שם אם (מרובה)
            if (this.filters.motherNames?.length) {
                this.filters.motherNames.forEach(v => params.append('motherNames', v));
            }
            // סינון לפי בית כנסת (מרובה)
            if (this.filters.synagogues?.length) {
                this.filters.synagogues.forEach(v => params.append('synagogues', v));
            }
            // סינון לפי עיר (מרובה)
            if (this.filters.cities?.length) {
                this.filters.cities.forEach(v => params.append('cities', v));
            }
            // סינון לפי דירוג (מינימום)
            if (this.filters.rating) {
                params.set('rating', String(this.filters.rating));
            }
            // סינון לפי מתרים
            if (this.filters.isFundraiser) {
                params.set('isFundraiser', 'true');
            }
            // סינון לפי הו"ק
            if (this.filters.standingOrder !== undefined && this.filters.standingOrder !== null) {
                params.set('standingOrder', String(this.filters.standingOrder));
            }
            // סינון לפי טווח צפי תרומה
            if (this.filters.expectedMin > 0) {
                params.set('expectedMin', String(this.filters.expectedMin));
            }
            if (this.filters.expectedMax && this.filters.expectedMax < 1000000) {
                params.set('expectedMax', String(this.filters.expectedMax));
            }
            // סינון לפי טווח תרומה בפועל
            if (this.filters.actualMin > 0) {
                params.set('actualMin', String(this.filters.actualMin));
            }
            if (this.filters.actualMax && this.filters.actualMax < 1000000) {
                params.set('actualMax', String(this.filters.actualMax));
            }
            // סינון לפי מקור תרומה (מרובה)
            if (this.filters.sources?.length) {
                this.filters.sources.forEach(s => params.append('sources', s));
            }
            // סינון לפי דרך יצירת קשר
            if (this.filters.contactMethod?.length) {
                this.filters.contactMethod.forEach(m => params.append('contactMethod', m));
            }
            // סינון לפי גיל
            if (this.filters.ageFrom) {
                params.set('ageFrom', String(this.filters.ageFrom));
            }
            if (this.filters.ageTo) {
                params.set('ageTo', String(this.filters.ageTo));
            }

            const res = await fetchWithAuth(`/api/people?${params.toString()}`);
            if (!res?.ok) throw new Error('Failed to fetch contacts');

            const data = await res.json();

            runInAction(() => {
                if (fetchId !== this.currentFetchId) return; // stale
                this.contacts = data.data || [];
                this.totalContacts = data.total || 0;
                this.totalDonationsSum = data.totalDonationsSum || 0;
                this.totalPages = data.totalPages || 0;
                this.loadingContacts = false;
            });
        } catch (error) {
            runInAction(() => {
                if (fetchId !== this.currentFetchId) return;
                this.errorContacts = error.message;
                this.loadingContacts = false;
            });
        }
    }

    debouncedFetchContacts(delay = 300) {
        if (this.fetchDebounceTimer) clearTimeout(this.fetchDebounceTimer);
        this.fetchDebounceTimer = setTimeout(() => this.fetchContacts(true), delay);
    }

    // =====================
    // פגינציה
    // =====================

    setPage(page) {
        this.page = page;
        this.fetchContacts();
    }

    setPageSize(size) {
        this.pageSize = size;
        this.page = 1;
        this.fetchContacts();
    }

    // =====================
    // חיפוש ומיון
    // =====================

    setSearch(term) {
        this.search = term;
        this.page = 1;
        this.debouncedFetchContacts();
    }

    setSort(field, direction) {
        this.sortField = field;
        this.sortDirection = direction;
        this.page = 1;
        this.fetchContacts();
    }

    setFilters(newFilters) {
        this.filters = { ...this.filters, ...newFilters };
        this.page = 1;
        this.debouncedFetchContacts();
    }

    clearFilters() {
        this.filters = {};
        this.search = '';
        this.page = 1;
        this.fetchContacts();
    }

    // =====================
    // טאב פעיל
    // =====================

    setActiveTab(tab) {
        if (this.activeTab === tab) return;
        this.activeTab = tab;
        this.page = 1;
        this.search = '';
        this.filters = {};
        this.selectedContactIds = new Set();
        this.selectAll = false;
        this.fetchContacts();
    }

    async fetchNeedsAttentionCount() {
        if (!this.clientId) return;
        try {
            const params = new URLSearchParams({
                clientId: String(this.clientId),
                paginated: 'true',
                page: '1',
                pageSize: '1',
                statusFilter: 'pending',
                sortBy: 'firstName',
                sortOrder: 'asc',
            });
            const res = await fetchWithAuth(`/api/people?${params.toString()}`);
            if (!res?.ok) return;
            const data = await res.json();
            runInAction(() => {
                this.needsAttentionCount = data.total || 0;
            });
        } catch (e) {
            // שגיאה שקטה — הספירה אינה קריטית
        }
    }

    async resolveContact(contactId) {
        try {
            const res = await fetchWithAuth(`/api/people/${contactId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: null }),
            });
            if (!res?.ok) throw new Error('Failed to resolve contact');
            runInAction(() => {
                this.contacts = this.contacts.filter(c => c.id !== contactId);
                this.totalContacts = Math.max(0, this.totalContacts - 1);
                this.needsAttentionCount = Math.max(0, this.needsAttentionCount - 1);
            });
            return true;
        } catch (error) {
            console.error('Error resolving contact:', error);
            throw error;
        }
    }

    // =====================
    // בחירה
    // =====================

    toggleContactSelection(contactId) {
        const newSet = new Set(this.selectedContactIds);
        if (newSet.has(contactId)) {
            newSet.delete(contactId);
        } else {
            newSet.add(contactId);
        }
        this.selectedContactIds = newSet;
        this.selectAll = newSet.size === this.contacts.length;
    }

    toggleSelectAll() {
        if (this.selectAll) {
            this.selectedContactIds = new Set();
            this.selectAll = false;
        } else {
            this.selectedContactIds = new Set(this.contacts.map(c => c.id));
            this.selectAll = true;
        }
    }

    clearSelection() {
        this.selectedContactIds = new Set();
        this.selectAll = false;
    }

    get selectedContacts() {
        return this.contacts.filter(c => this.selectedContactIds.has(c.id));
    }

    // =====================
    // פאנל צד
    // =====================

    openSidePanel(contact) {
        this.activeContact = contact;
        this.sidePanelOpen = true;
    }

    closeSidePanel() {
        this.activeContact = null;
        this.sidePanelOpen = false;
    }

    // =====================
    // עדכון / מחיקה
    // =====================

    async updateContact(contactId, updateData) {
        try {
            const res = await fetchWithAuth(`/api/people/${contactId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            if (!res?.ok) throw new Error('Failed to update contact');

            const updated = await res.json();

            runInAction(() => {
                const idx = this.contacts.findIndex(c => c.id === contactId);
                if (idx !== -1) {
                    this.contacts[idx] = { ...this.contacts[idx], ...updated };
                }
                if (this.activeContact?.id === contactId) {
                    this.activeContact = { ...this.activeContact, ...updated };
                }
            });

            return updated;
        } catch (error) {
            console.error('Error updating contact:', error);
            throw error;
        }
    }

    async deleteContact(contactId) {
        try {
            const res = await fetchWithAuth(`/api/people/${contactId}`, {
                method: 'DELETE',
            });
            if (!res?.ok) throw new Error('Failed to delete contact');

            runInAction(() => {
                this.contacts = this.contacts.filter(c => c.id !== contactId);
                this.totalContacts -= 1;
                if (this.activeContact?.id === contactId) {
                    this.closeSidePanel();
                }
            });
        } catch (error) {
            console.error('Error deleting contact:', error);
            throw error;
        }
    }

    // =====================
    // הוספה לקמפיין
    // =====================

    async addToCampaign({ campaignId, personIds, role, ...options }) {
        try {
            const res = await fetchWithAuth('/api/people/add-to-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId, personIds, role, ...options }),
            });
            if (!res?.ok) throw new Error('Failed to add to campaign');

            const result = await res.json();
            // רענון הנתונים כדי לעדכן campaignRoles
            await this.fetchContacts();
            return result;
        } catch (error) {
            console.error('Error adding to campaign:', error);
            throw error;
        }
    }

    // =====================
    // הגדרות עמודות
    // =====================

    async fetchColumnSettings() {
        if (!this.clientId) return;
        this.loadingColumnSettings = true;

        try {
            const res = await fetchWithAuth(`/api/contacts-settings?clientId=${this.clientId}`);
            if (!res?.ok) throw new Error('Failed to fetch column settings');

            const data = await res.json();
            runInAction(() => {
                this.columnSettings = data.columnDefinitions || data.settings;
                this.loadingColumnSettings = false;
            });
        } catch (error) {
            console.error('Error fetching column settings:', error);
            runInAction(() => { this.loadingColumnSettings = false; });
        }
    }

    async saveColumnSettings(settings) {
        if (!this.clientId) return;

        try {
            const res = await fetchWithAuth('/api/contacts-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: this.clientId, columnDefinitions: settings }),
            });
            if (!res?.ok) throw new Error('Failed to save column settings');

            const data = await res.json();
            runInAction(() => {
                this.columnSettings = data.columnDefinitions || data.settings;
            });
        } catch (error) {
            console.error('Error saving column settings:', error);
            throw error;
        }
    }

    // =====================
    // שדות מותאמים
    // =====================

    async fetchCustomFields() {
        if (!this.clientId) return;
        this.loadingCustomFields = true;

        try {
            const res = await fetchWithAuth(`/api/custom-fields?clientId=${this.clientId}`);
            if (!res?.ok) throw new Error('Failed to fetch custom fields');

            const data = await res.json();
            runInAction(() => {
                this.customFields = data;
                this.loadingCustomFields = false;
            });
        } catch (error) {
            console.error('Error fetching custom fields:', error);
            runInAction(() => { this.loadingCustomFields = false; });
        }
    }

    async createCustomField(fieldData) {
        try {
            const res = await fetchWithAuth('/api/custom-fields', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: this.clientId, ...fieldData }),
            });
            if (!res?.ok) throw new Error('Failed to create custom field');

            const field = await res.json();
            runInAction(() => {
                this.customFields.push(field);
            });
            return field;
        } catch (error) {
            console.error('Error creating custom field:', error);
            throw error;
        }
    }

    async updateCustomField(fieldId, updateData) {
        try {
            const res = await fetchWithAuth(`/api/custom-fields/${fieldId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            if (!res?.ok) throw new Error('Failed to update custom field');

            const updated = await res.json();
            runInAction(() => {
                const idx = this.customFields.findIndex(f => f.id === fieldId);
                if (idx !== -1) this.customFields[idx] = updated;
            });
            return updated;
        } catch (error) {
            console.error('Error updating custom field:', error);
            throw error;
        }
    }

    async deleteCustomField(fieldId) {
        try {
            const res = await fetchWithAuth(`/api/custom-fields/${fieldId}`, {
                method: 'DELETE',
            });
            if (!res?.ok) throw new Error('Failed to delete custom field');

            runInAction(() => {
                this.customFields = this.customFields.filter(f => f.id !== fieldId);
            });
        } catch (error) {
            console.error('Error deleting custom field:', error);
            throw error;
        }
    }

    // =====================
    // תגיות
    // =====================

    async fetchTags() {
        if (!this.clientId) return;
        this.loadingTags = true;

        try {
            const res = await fetchWithAuth(`/api/tags?clientId=${this.clientId}`);
            if (!res?.ok) throw new Error('Failed to fetch tags');

            const data = await res.json();
            runInAction(() => {
                this.tags = data;
                this.loadingTags = false;
            });
        } catch (error) {
            console.error('Error fetching tags:', error);
            runInAction(() => { this.loadingTags = false; });
        }
    }

    async createTag(tagData) {
        try {
            const res = await fetchWithAuth('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: this.clientId, ...tagData }),
            });
            if (!res?.ok) throw new Error('Failed to create tag');

            const tag = await res.json();
            runInAction(() => {
                this.tags.push(tag);
            });
            return tag;
        } catch (error) {
            console.error('Error creating tag:', error);
            throw error;
        }
    }

    async bulkTag({ personIds, tagIds, action = 'add' }) {
        try {
            const res = await fetchWithAuth('/api/people/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personIds, tagIds, action }),
            });
            if (!res?.ok) throw new Error('Failed to bulk tag');

            // רענון אנשי קשר כדי לעדכן תגיות
            await this.fetchContacts();
            return await res.json();
        } catch (error) {
            console.error('Error bulk tagging:', error);
            throw error;
        }
    }

    // =====================
    // ייצוא
    // =====================

    async exportContacts() {
        if (!this.clientId) return;

        try {
            const params = new URLSearchParams({ clientId: String(this.clientId) });

            if (this.search) params.set('search', this.search);
            if (this.filters.tagIds?.length) {
                this.filters.tagIds.forEach(id => params.append('tagIds', String(id)));
            }
            if (this.filters.campaignIds?.length) {
                this.filters.campaignIds.forEach(id => params.append('campaignIds', String(id)));
            }
            if (this.filters.active !== undefined) {
                params.set('active', String(this.filters.active));
            }

            const res = await fetchWithAuth(`/api/people/export?${params.toString()}`);
            if (!res?.ok) throw new Error('Failed to export contacts');

            return await res.json();
        } catch (error) {
            console.error('Error exporting contacts:', error);
            throw error;
        }
    }

    // =====================
    // היסטוריה
    // =====================

    async fetchContactHistory(contactId) {
        try {
            const res = await fetchWithAuth(`/api/people/${contactId}/history`);
            if (!res?.ok) throw new Error('Failed to fetch history');
            return await res.json();
        } catch (error) {
            console.error('Error fetching contact history:', error);
            throw error;
        }
    }

    // =====================
    // חיפוש מהיר (Autocomplete)
    // =====================

    async searchContacts(query) {
        if (!this.clientId || !query || query.length < 2) return [];

        try {
            const res = await fetchWithAuth(
                `/api/people/search?clientId=${this.clientId}&q=${encodeURIComponent(query)}`
            );
            if (!res?.ok) return [];
            return await res.json();
        } catch {
            return [];
        }
    }

    // =====================
    // איפוס
    // =====================

    reset() {
        this.contacts = [];
        this.totalContacts = 0;
        this.loadingContacts = false;
        this.errorContacts = null;
        this.page = 1;
        this.totalPages = 0;
        this.search = '';
        this.filters = {};
        this.sortField = 'firstName';
        this.sortDirection = 'asc';
        this.columnSettings = null;
        this.customFields = [];
        this.tags = [];
        this.selectedContactIds = new Set();
        this.selectAll = false;
        this.activeTab = 'myContacts';
        this.needsAttentionCount = 0;
        this.activeContact = null;
        this.sidePanelOpen = false;
    }
}

export default ContactsStore;
