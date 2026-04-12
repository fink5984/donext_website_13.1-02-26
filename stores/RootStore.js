"use client"
import { makeAutoObservable, reaction } from "mobx";
import DonorsStore from "./modules/DonorsStore";
import FundraisersStore from "./modules/FundraisersStore";
import DonationsStore from "./modules/DonationsStore";
import RanksStore from "./modules/RanksStore";
import QuestionnaireStore from "./modules/QuestionnaireStore";
import OperatorsStore from "./modules/OperatorsStore";
import OperatorRanksStore from "./modules/OperatorRanksStore";
import ContactsStore from "./modules/ContactsStore";
import fetchWithAuth from "../app/utils/fetchWithAuth";
import { formStore } from "../app/stores/formStore";


class RootStore {
  campaignId = null;
  clientId = null;
  cities = [];
  streets = [];
  searchTerm = '';
  campaign = null;
  isLoadingCampaign = false;

      constructor() {
        this.donorsStore = new DonorsStore(this);
        this.fundraisersStore = new FundraisersStore(this);
        this.donationsStore = new DonationsStore(this);
        this.ranksStore = new RanksStore(this);
        this.questionnaireStore = new QuestionnaireStore(this);
        this.operatorsStore = new OperatorsStore(this);
        this.operatorRanksStore = new OperatorRanksStore(this);
        this.contactsStore = new ContactsStore(this);
    
    makeAutoObservable(this, {
      donorsStore: false,
      fundraisersStore: false,
      ranksStore: false,
      questionnaireStore: false,
      operatorsStore: false,
      operatorRanksStore: false,
      contactsStore: false
    });

    // Reaction for fetching data when campaign changes
    reaction(
      () => this.campaignId,
      (campaignId) => {
        if (campaignId) {
          
          // שימוש ב-Promise.all כדי למנוע race conditions
          Promise.all([
            this.donorsStore.fetchDonors({ noLimit: !this.donorsStore.usePagination }),
            this.donorsStore.fetchDonorsSummary(),
            this.fundraisersStore.fetchFundraisers(),
            this.fundraisersStore.fetchFundraisersSummary(),
            this.ranksStore.fetchRanks(),
            this.operatorRanksStore.fetchRanks(),
            this.fetchCampaignData()
          ]).catch(error => {
            console.error('Error fetching initial data:', error);
          });
        }
      },
      { fireImmediately: false } // מונע קריאה מיותרת ברגע הראשון
    );

    // Reaction for donors filters/pagination
    reaction(
      () => ({
        filters: this.donorsStore.filters,
        sortConfig: this.donorsStore.sortConfig,
        page: this.donorsStore.page,
        rowsInPage: this.donorsStore.rowsInPage,
        searchTerm: this.searchTerm
      }),
      (current, previous) => {
        if (this.campaignId) {
          const fetchOptions = { noLimit: !this.donorsStore.usePagination };
          
          // אם רק הדף השתנה - קריאה מיידית
          if (previous && current.page !== previous.page) {
            this.donorsStore.fetchDonors(fetchOptions);
          }
          // אם סינונים או חיפוש השתנו - עם debounce
          else if (
            !previous || 
            JSON.stringify(current.filters) !== JSON.stringify(previous.filters) ||
            current.searchTerm !== previous.searchTerm
          ) {
            this.donorsStore.debouncedFetchDonors(fetchOptions);
          }
          // אם המיון או מספר השורות השתנו - קריאה מיידית
          else {
            this.donorsStore.fetchDonors(fetchOptions);
          }
        }
      },
      { fireImmediately: false } // מונע קריאה מיותרת ברגע הראשון
    );

    // Reaction for fundraisers filters/pagination
    reaction(
      () => ({
        filters: this.fundraisersStore.filters,
        sortConfig: this.fundraisersStore.sortConfig,
        page: this.fundraisersStore.page,
        rowsInPage: this.fundraisersStore.rowsInPage
      }),
      (current, previous) => {
        if (this.campaignId) {
          if (previous && current.page !== previous.page) {
            this.fundraisersStore.fetchFundraisers();
          }
          else if (
            !previous || 
            JSON.stringify(current.filters) !== JSON.stringify(previous.filters)
          ) {
            this.fundraisersStore.debouncedFetchFundraisers();
          }
          else {
            this.fundraisersStore.fetchFundraisers();
          }
          // אל תקרא כאן ל-fetchFundraisersSummary!
        }
      },
      { fireImmediately: false } // מונע קריאה מיותרת ברגע הראשון
    );

    // Reaction for ranks filters/pagination
    reaction(
      () => ({
        filters: this.ranksStore.filters,
        sortConfig: this.ranksStore.sortConfig,
        page: this.ranksStore.page,
        rowsInPage: this.ranksStore.rowsInPage
      }),
      () => {
        if (this.campaignId) {
          this.ranksStore.fetchRanks();
        }
      },
      { fireImmediately: false }
    );
  }

  async fetchCampaignData() {
    // מניעת קריאות כפולות - אם הקמפיין כבר נטען, לא צריך לטעון שוב
    if (!this.campaignId || this.isLoadingCampaign) return;
    if (this.campaign && this.campaign.id === this.campaignId) return;
    
    this.isLoadingCampaign = true;
    try {
      const res = await fetchWithAuth(`/api/campaigns/${this.campaignId}`);
      if (!res || !res.ok) {
        throw new Error('Failed to fetch campaign');
      }
      const data = await res.json();
      this.campaign = data;
    } catch (error) {
      console.error('Error fetching campaign:', error);
      this.campaign = null;
    } finally {
      this.isLoadingCampaign = false;
    }
  }

  updateCampaign(updates) {
    if (this.campaign) {
      this.campaign = { ...this.campaign, ...updates };
    }
  }

  setCampaignId(id) {
      // רק אם ה-ID השתנה, נעדכן אותו (כדי למנוע קריאות מיותרות)
      if (this.campaignId !== id) {
        this.campaignId = id;
      }
  }

  setClientId(id) {
    this.clientId = id;
  }

  setCities(cities) {
    this.cities = cities;
  }

  setStreets(streets) {
    this.streets = streets;
  }

  // פונקציה לאיפוס כל הסטורים
  resetAllStores() {
    // איפוס נתוני RootStore
    this.campaignId = null;
    this.clientId = null;
    this.cities = [];
    this.streets = [];
    this.searchTerm = '';
    this.campaign = null;
    this.isLoadingCampaign = false;

    // איפוס סטורי המודולים
    this.donorsStore.reset();
    this.fundraisersStore.reset();
    this.donationsStore.reset();
    this.operatorsStore.resetStore();
    this.contactsStore.reset();
    
    // איפוס formStore
    formStore.reset();
  }
}

const rootStore = new RootStore();
export default rootStore;
