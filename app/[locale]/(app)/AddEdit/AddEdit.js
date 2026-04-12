"use client";

import {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import styles from "./AddEdit.module.scss";
import Button from "@/app/components/Button";
import { useForm } from "react-hook-form";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useTranslations } from 'next-intl';
import Input from "@/app/components/Input";
import DonationsTable from "./DonationsTable";
import ConcatMethod from "./ConcatMethod";
import { SelectFundRaiser } from "./SelectFund";
import ProgressTabs from "./ProgressTabs/ProgressTabs";
import Star from "@/app/icons/star.svg";
import Note from "@/app/icons/note.svg";
import NoteIcon from "@/app/icons/note.svg";
import CalendarIcon from "@/app/icons/calendar.svg";
import CalendarComponent from "@/app/components/calendar/Calendar";
import AssigneePicker from "@/app/components/assigneePicker/AssigneePicker";
import FundraiserDonors from "./FundraiserDonors/FundraiserDonors";
import LeftArrow from '@/app/icons/left.svg';
import RightArrow from '@/app/icons/right.svg';
import AssignDonorsOverlay from "./AssignDonorsOverlay/AssignDonorsOverlay";
import SaveComponent from "../Alerts/Save";
import { useAppContext } from "@/app/components/AppContext";
import { observer } from "mobx-react-lite";
import { formStore } from "@/app/stores/formStore";
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import DonationForm from '@/components/DonationForm/DonationForm';
import { RankForm } from "./RankForm";
import InvitationProgress from '@/app/components/InvitationProgress/InvitationProgress';
import { dbStatusToHebrew } from '@/lib/statusMappings';

const AddEdit = observer(({ isOpen, onClose, onSubmit, invitationOnly = false, donorProp = null, hideAddDonation = false }) => {
  // Constants
  const stars = 3;

  // Hooks
  const { stores } = useAppContext();
  const { donorsStore, fundraisersStore } = stores;
  const t = useTranslations('addEdit');

  // Function to remove dashes from phone
  const formatPhoneNumber = (phone) => {
    if (!phone) return phone;
    return phone.replace(/-/g, '');
  };
  const {
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      titleBefore: "",
      titleAfter: "",
      mainMobile: "",
      email: "",
      city: "",
      address: "",
      houseNumber: "",
      landlinePhone: "",
      fundraiserId: null,
      synagogue: "",
      country: "",
      // English name fields
      firstNameEn: "",
      lastNameEn: "",
      titleBeforeEn: "",
      titleAfterEn: ""
    }
  });
  
  // State and Refs
  const donor = formStore.currentData;
  const fund = formStore.formType === 'fundraiser';
  
  // בדוק אם להציג את קוביית ההזמנות ושדות נוספים
  const { campaign } = useAppContext();
  const showInvitationSection = campaign?.showInvitationColumn || false;
  
  // Check if ANY donor in the campaign has English names (like in donors page)
  const hasEnglishNamesInCampaign = useMemo(() => {
    const donors = donorsStore?.donors || [];
    return donors.some(d => 
      d.english_first_name || 
      d.english_last_name || 
      d.english_title_before || 
      d.english_title_after
    );
  }, [donorsStore?.donors]);
  
  // Check if ANY donor in the campaign has country data
  const hasCountryInCampaign = useMemo(() => {
    const donors = donorsStore?.donors || [];
    return donors.some(d => d.country || d.country_name);
  }, [donorsStore?.donors]);
  
  // Active fields from campaign (fields that were mapped during import)
  let activeFields = {};
  if (campaign?.activeFields) {
    if (typeof campaign.activeFields === 'string') {
      try {
        activeFields = JSON.parse(campaign.activeFields);
      } catch (e) {
        console.error('Failed to parse activeFields:', e);
        activeFields = {};
      }
    } else if (typeof campaign.activeFields === 'object') {
      activeFields = campaign.activeFields;
    }
  }
  
  // Show English name fields if ANY donor in the campaign has English name data
  const showTitleFields = true;
  const showEnglishName = hasEnglishNamesInCampaign || activeFields.englishName === true;
  const showCountry = hasCountryInCampaign || activeFields.country === true;

  const [activeTab, setActiveTab] = useState(
    formStore.initialTab || (fund && donor ? "fundraiser" : "personal")
  );
  const [isFundraiser, setIsFundraiser] = useState(fund || donor?.isFundraiser);
  const [currentDonor, setCurrentDonor] = useState(donor);
  const [cityId, setCityId] = useState(donor?.cityId || null);
  const [cityInput, setCityInput] = useState(donor?.city || "");
  const [streetInput, setStreetInput] = useState(donor?.address || "");
  const [countryInput, setCountryInput] = useState(donor?.country_name || "");
  const [preferredContact, setPreferredContact] = useState("phone");
  const [showValidationMessage, setShowValidationMessage] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [showAssignOverlay, setShowAssignOverlay] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDonationFormOpen, setIsDonationFormOpen] = useState(false);
  const popupRef = useRef(null);
  const originalValuesRef = useRef(null);

  // Derived State
  const synagogues = donorsStore.synagogues;
  const firstName = watch("firstName");
  const lastName = watch("lastName");
  const mainMobile = watch("mainMobile");
  const email = watch("email");
  const fundraiserId = watch("fundraiserId");
  const landlinePhone = watch("landlinePhone");
  const synagogue = watch("synagogue");
  const hasEmail = email && /\S+@\S+\.\S+/.test(email);
  
  // State for invitation tracking
  const [invitationSent, setInvitationSent] = useState(false);
  const [arrivalConfirmed, setArrivalConfirmed] = useState(false);
  const [actuallyArrived, setActuallyArrived] = useState(false);
  
  // State for notes
  const [notes, setNotes] = useState("");
  const [notesFocused, setNotesFocused] = useState(false);
  const [noteFollowUpDate, setNoteFollowUpDate] = useState("");
  const [noteAssignee, setNoteAssignee] = useState(null);
  const [donorNotes, setDonorNotes] = useState([]);
  const [showAddDonorNote, setShowAddDonorNote] = useState(false);
  const [newDonorNoteText, setNewDonorNoteText] = useState("");
  const [newDonorNoteFollowUpDate, setNewDonorNoteFollowUpDate] = useState("");
  const [newDonorNoteAssignee, setNewDonorNoteAssignee] = useState(null);
  const [isSavingDonorNote, setIsSavingDonorNote] = useState(false);
  const [markingDonorNoteId, setMarkingDonorNoteId] = useState(null);
  const newDonorNoteRef = useRef(null);
  const notesSectionRef = useRef(null);

  // Contact search autocomplete (add mode only)
  const [contactSuggestions, setContactSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const contactSearchRef = useRef(null);
  const contactSearchDebounceRef = useRef(null);

  const searchContacts = useCallback(async (query) => {
    if (!query || query.length < 2) { setContactSuggestions([]); setShowSuggestions(false); return; }
    try {
      const res = await fetch(`/api/people/search?q=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setContactSuggestions(data || []);
        setShowSuggestions(data.length > 0);
      }
    } catch (err) { console.error('Contact search error:', err); }
  }, []);

  // Trigger contact search on name change (only in add mode)
  useEffect(() => {
    if (formStore.mode !== 'add' || selectedPersonId) return;
    const query = `${firstName || ''} ${lastName || ''}`.trim();
    if (contactSearchDebounceRef.current) clearTimeout(contactSearchDebounceRef.current);
    contactSearchDebounceRef.current = setTimeout(() => searchContacts(query), 400);
    return () => clearTimeout(contactSearchDebounceRef.current);
  }, [firstName, lastName, formStore.mode, selectedPersonId, searchContacts]);

  // Close suggestions on click outside
  useEffect(() => {
    if (!showSuggestions) return;
    const handleClick = (e) => {
      if (contactSearchRef.current && !contactSearchRef.current.contains(e.target)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSuggestions]);

  const handleSelectContact = (contact) => {
    setSelectedPersonId(contact.id);
    setShowSuggestions(false);
    setContactSuggestions([]);
    // Populate form fields from existing contact
    setValue("firstName", contact.firstName || contact.first_name || "");
    setValue("lastName", contact.lastName || contact.last_name || "");
    setValue("mainMobile", formatPhoneNumber(contact.mainMobile || contact.main_mobile || ""));
    setValue("landlinePhone", formatPhoneNumber(contact.landlinePhone || contact.landline_phone || ""));
    setValue("email", contact.email || "");
    setValue("houseNumber", contact.houseNumber || contact.house_number || "");
    if (contact.city || contact.city_name) setCityInput(contact.city || contact.city_name || "");
    if (contact.street || contact.street_name) setStreetInput(contact.street || contact.street_name || "");
    if (contact.synagogue) setValue("synagogue", contact.synagogue);
    if (contact.firstName_en || contact.firstNameEn) setValue("firstNameEn", contact.firstName_en || contact.firstNameEn || "");
    if (contact.lastName_en || contact.lastNameEn) setValue("lastNameEn", contact.lastName_en || contact.lastNameEn || "");
  };

  const clearSelectedContact = () => {
    setSelectedPersonId(null);
  };

  // Deep link: גלילה אוטומטית לאזור ההערות כשנפתח מקישור במייל
  useEffect(() => {
    if (!formStore.scrollToNotes || formStore.mode !== 'edit' || !donor) return;
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (notesSectionRef.current) {
        clearInterval(interval);
        notesSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (attempts >= 20) {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [formStore.scrollToNotes, formStore.mode, donor]);

  // Effects
  useEffect(() => {
    if (donor && formStore.mode === 'edit' && !hideAddDonation) {
      if (formStore.formType === 'fundraiser') {
        fundraisersStore.fetchNavigationIds();
      } else if (!formStore.navigationScopeFundraiserId) {
        donorsStore.fetchNavigationIds();
      }
    }
    if (formStore.cities.length === 0) formStore.fetchCities();
    if (!hideAddDonation && donorsStore.synagogues.length === 0) donorsStore.fetchSynagogues();
  }, [donor, formStore.mode, formStore.formType, formStore.navigationScopeFundraiserId, hideAddDonation]);

  useEffect(() => {
    if (hideAddDonation) return; // contacts page — no campaign context
    const shouldFetchAssignableDonors = (fund || donor?.isFundraiser || donor?.fundraiser_id);
    if (shouldFetchAssignableDonors) {
      donorsStore.fetchAssignableDonors();
    }
  }, [fund, donor, donorsStore, hideAddDonation]);

  useEffect(() => {
    if (formStore.currentData && formStore.currentData !== donor) {
      setCurrentDonor(formStore.currentData);
    }
  }, [formStore.currentData, donor]);

  useEffect(() => {
    if ((donor && !donor.isFundraiser && !fund) || (activeTab === "fundraiser" && !isFundraiser)) {
      setActiveTab("personal");
    }
  }, [donor, fund, activeTab, isFundraiser]);
  
  useEffect(() => {
    const currentDonor = invitationOnly && donorProp ? donorProp : donor;
    if (currentDonor) {
      const formData = {
        firstName: currentDonor.first_name || "",
        lastName: currentDonor.last_name || "",
        titleBefore: currentDonor.title_before || "",
        titleAfter: currentDonor.title_after || "",
        mainMobile: formatPhoneNumber(currentDonor.main_mobile || ""),
        landlinePhone: formatPhoneNumber(currentDonor.phone_landline || ""),
        email: currentDonor.email || "",
        city: currentDonor.city_name || currentDonor.city || "",
        address: currentDonor.street_name || "",
        houseNumber: currentDonor.house_number || "",
        fundraiserId: currentDonor.assigned_fundraiser_id ?? null,
        synagogue: currentDonor.synagogue || "",
        country: currentDonor.country_name || "",
        // English name
        firstNameEn: currentDonor.english_name?.first_name || "",
        lastNameEn: currentDonor.english_name?.last_name || "",
        titleBeforeEn: currentDonor.english_name?.title_before || "",
        titleAfterEn: currentDonor.english_name?.title_after || ""
      };
      reset(formData);
      setPreferredContact(currentDonor.preferredContact || "phone");
      setIsFundraiser(currentDonor.isFundraiser || formStore.formType === 'fundraiser');
      setCityInput(currentDonor.city_name || currentDonor.city || "");
      setStreetInput(currentDonor.street_name || "");
      setCountryInput(currentDonor.country_name || "");
      setCurrentDonor(currentDonor);
      setInvitationSent(currentDonor.invitationSent || false);
      setArrivalConfirmed(currentDonor.arrivalConfirmed || false);
      setActuallyArrived(currentDonor.actuallyArrived || false);
      setNotes(currentDonor.notes || "");
      setDonorNotes(currentDonor.donorNotes || []);
      
      // Save original values
      originalValuesRef.current = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        mainMobile: formData.mainMobile,
        landlinePhone: formData.landlinePhone,
        email: formData.email,
        cityInput: currentDonor.city_name || currentDonor.city || "",
        streetInput: currentDonor.street_name || "",
        houseNumber: formData.houseNumber,
        fundraiserId: formData.fundraiserId,
        preferredContact: currentDonor.preferredContact || "phone",
        synagogue: formData.synagogue,
        notes: currentDonor.notes || ""
      };
      
      formStore.setDirty(false);
    } else {
      reset();
      setPreferredContact("phone");
      setIsFundraiser(formStore.formType === 'fundraiser');
      setNotes("");
      setNoteFollowUpDate("");
      setNoteAssignee(null);
      setDonorNotes([]);
      
      // Reset original values for new donor
      originalValuesRef.current = {
        firstName: "",
        lastName: "",
        mainMobile: "",
        landlinePhone: "",
        email: "",
        cityInput: "",
        streetInput: "",
        houseNumber: "",
        fundraiserId: null,
        preferredContact: "phone",
        synagogue: "",
        notes: ""
      };
      
      setNotes("");
      setNoteFollowUpDate("");
      setNoteAssignee(null);
      setDonorNotes([]);
      formStore.setDirty(false);
    }
  }, [donor, reset, formStore.formType]);

  useEffect(() => {
    if (cityId) {
      formStore.fetchStreets(cityId);
    }
  }, [cityId]);

  useEffect(() => {
    const msg = getFirstValidationMessage();
    if (msg != validationMessage) setShowValidationMessage(false);
    if (!msg) {
      setShowValidationMessage(false);
      setValidationMessage("");
    }
  }, [firstName, lastName, mainMobile, email]);

  // Auto-check if form has changed
  useEffect(() => {
    const hasChanged = checkIfFormChanged();
    formStore.setDirty(hasChanged);
  }, [firstName, lastName, mainMobile, landlinePhone, email, cityInput, streetInput, watch("houseNumber"), fundraiserId, preferredContact, synagogue, notes]);
  
  // Helper Functions
  const checkIfFormChanged = () => {
    if (!originalValuesRef.current) return false;
    
    const original = originalValuesRef.current;
    const current = {
      firstName,
      lastName,
      mainMobile: formatPhoneNumber(mainMobile),
      landlinePhone: formatPhoneNumber(landlinePhone),
      email,
      cityInput,
      streetInput,
      houseNumber: watch("houseNumber"),
      fundraiserId,
      preferredContact,
      synagogue,
      notes
    };

    return (
      original.firstName !== current.firstName ||
      original.lastName !== current.lastName ||
      original.mainMobile !== current.mainMobile ||
      original.landlinePhone !== current.landlinePhone ||
      original.email !== current.email ||
      original.cityInput !== current.cityInput ||
      original.streetInput !== current.streetInput ||
      original.houseNumber !== current.houseNumber ||
      original.fundraiserId !== current.fundraiserId ||
      original.preferredContact !== current.preferredContact ||
      original.synagogue !== current.synagogue ||
      original.notes !== current.notes
    );
  };

  const getCurrentFundraiserStatus = () => {
    if (!donor) return { shalon: 'לא_נשלח', expected: 'לא_נשלח' };
    const fundraiser = fundraisersStore.fundraisers.find(f => f.person_id === donor.id);
    if (fundraiser) {
      return {
        shalon: dbStatusToHebrew(fundraiser.status_questionnaire) || 'לא_נשלח',
        expected: dbStatusToHebrew(fundraiser.status_forecast) || 'לא_נשלח'
      };
    }
    return { shalon: 'לא_נשלח', expected: 'לא_נשלח' };
  };

  const getNavigationIds = () => {
    return formStore.formType === 'fundraiser'
      ? fundraisersStore.navigationIds
      : donorsStore.navigationIds;
  };
  
  const getCurrentIndex = () => {
    const navigationIds = getNavigationIds();
    if (!navigationIds || !donor) return -1;
    const currentPersonId = donor.id || donor.person_id;
    return navigationIds.findIndex(id => id === currentPersonId);
  };
  
  const getFirstValidationMessage = () => {
    if (!watch("firstName").trim()) return t('firstNameRequired');
    if (!watch("lastName").trim()) return t('lastNameRequired');
    if (!watch("mainMobile").trim()) return t('mobileRequired');
    if (watch("email").trim() && !/\S+@\S+\.\S+/.test(watch("email"))) return t('invalidEmail');
    if (isFundraiser && !watch("email").trim()) return t('fundraiserEmailRequired');
    if (isFundraiser && watch("email").trim() && !/\S+@\S+\.\S+/.test(watch("email"))) return t('fundraiserValidEmailRequired');
    return null;
  };

  const isFormValid = () => !getFirstValidationMessage();

  const doPendingAction = () => {
    if (pendingAction === 'close') onClose();
    else if (pendingAction === 'next') handleNext();
    else if (pendingAction === 'prev') handlePrev();
    setPendingAction(null);
  };

  // Event Handlers
  const handleNext = async () => {
    const navigationIds = getNavigationIds();
    const currentIndex = getCurrentIndex();
    if (navigationIds && currentIndex < navigationIds.length - 1) {
      const nextId = navigationIds[currentIndex + 1];
      await formStore.navigateToPersonId(nextId);
    }
  };

  const handlePrev = async () => {
    const navigationIds = getNavigationIds();
    const currentIndex = getCurrentIndex();
    if (navigationIds && currentIndex > 0) {
      const prevId = navigationIds[currentIndex - 1];
      await formStore.navigateToPersonId(prevId);
    }
  };

  const handleClose = () => {
    if (formStore.isDirty) {
      setPendingAction('close');
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  };
  
  const onSubmitForm = async (data) => {
    setShowValidationMessage(false);
    setIsSaving(true);

    try {
      let cityIdToSend = cityId;
      const foundCity = formStore.cities.find(c => c.name === cityInput);
      if (foundCity) {
        cityIdToSend = foundCity.id;
      } else if (cityInput && cityInput.length > 1) {
        const res = await fetchWithAuth("/api/cities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cityInput })
        });
        const { id } = await res.json();
        cityIdToSend = id;
        formStore.setCities([...formStore.cities, { id, name: cityInput }]);
      }

      let streetIdToSend = null;
      const foundStreet = formStore.streets.find(s => s.name === streetInput);
      if (foundStreet) {
        streetIdToSend = foundStreet.id;
      } else if (streetInput && streetInput.length > 1 && cityIdToSend) {
        const res = await fetchWithAuth("/api/streets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: streetInput, cityId: cityIdToSend })
        });
        const { id } = await res.json();
        streetIdToSend = id;
        formStore.setStreets([...formStore.streets, { id, name: streetInput }]);
      }
      
      const result = await onSubmit?.({
        ...data,
        mainMobile: formatPhoneNumber(data.mainMobile),
        phone: formatPhoneNumber(data.landlinePhone),
        cityId: cityIdToSend,
        streetId: streetIdToSend,
        preferredContact,
        fundraiserId: data.fundraiserId,
        invitationSent,
        arrivalConfirmed,
        actuallyArrived,
        notes,
        noteFollowUpDate,
        noteAssignee,
        titleBefore: data.titleBefore,
        titleAfter: data.titleAfter,
        englishName: {
          titleBefore: watch("titleBeforeEn") || null,
          firstName: watch("firstNameEn") || null,
          lastName: watch("lastNameEn") || null,
          titleAfter: watch("titleAfterEn") || null
        }
      });

      if (result) {
        formStore.setDirty(false);
      }
      
      return result;
    } finally {
      setIsSaving(false);
    }
  };

  // Save a new donor note (for edit mode - additional notes)
  const handleSaveDonorNote = async () => {
    const currentDonor = invitationOnly && donorProp ? donorProp : donor;
    if (!currentDonor?.donorId || !newDonorNoteText.trim() || !newDonorNoteFollowUpDate || isSavingDonorNote) return;
    setIsSavingDonorNote(true);
    try {
      const response = await fetchWithAuth('/api/donors/add-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorId: currentDonor.donorId,
          note: newDonorNoteText.trim(),
          followUpDate: newDonorNoteFollowUpDate,
          ...(newDonorNoteAssignee?.userId ? { assignedToUserId: newDonorNoteAssignee.userId } : {}),
          ...(newDonorNoteAssignee?.name ? { assignedToName: newDonorNoteAssignee.name } : {})
        })
      });
      const data = await response.json();
      if (data.success) {
        setDonorNotes(prev => [...prev, data.data]);
        setShowAddDonorNote(false);
        setNewDonorNoteText('');
        setNewDonorNoteFollowUpDate('');
        setNewDonorNoteAssignee(null);
      }
    } catch (error) {
      console.error('Error saving donor note:', error);
    } finally {
      setIsSavingDonorNote(false);
    }
  };

  // Toggle donor note completed
  const handleDonorNoteToggle = async (noteItem) => {
    if (markingDonorNoteId) return;
    const newCompleted = !noteItem.noteCompleted;
    setMarkingDonorNoteId(noteItem.id);
    try {
      const response = await fetchWithAuth('/api/donors/mark-note-completed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: noteItem.id, completed: newCompleted })
      });
      const data = await response.json();
      if (data.success) {
        setDonorNotes(prev => prev.map(n =>
          n.id === noteItem.id
            ? { ...n, noteCompleted: newCompleted, noteCompletedAt: newCompleted ? new Date().toISOString() : null }
            : n
        ));
      }
    } catch (error) {
      console.error('Error toggling donor note completed:', error);
    } finally {
      setMarkingDonorNoteId(null);
    }
  };
  
  // Special function to update only invitation status
  const updateInvitationOnly = async () => {
    setIsSaving(true);
    try {
      const { campaignId } = stores;
      const currentDonor = invitationOnly && donorProp ? donorProp : donor;
      const response = await fetchWithAuth(`/api/invitation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: currentDonor?.person_id || currentDonor?.id,
          campaignId,
          invitationSent,
          arrivalConfirmed,
          actuallyArrived
        })
      });
      
      if (response.ok) {
        formStore.setDirty(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating invitation status:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };
  
  // Early return for 'rank' form type
  if (formStore.formType === 'rank') {
    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogPortal>
                <AlertDialogContent className="p-[0] w-[800px] max-w-[95vw] max-h-[90vh] h-[700px] sm:max-w-[none] max-sm:w-[95vw] max-sm:h-[85vh]">
                    <AlertDialogTitle className="sr-only">
                        {formStore.currentData ? t('editRank') : t('addNewRank')}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="sr-only">
                        {t('rankFormDescription')}
                    </AlertDialogDescription>
                    <RankForm onSubmit={onSubmit} onCancel={onClose} />
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialog>
    );
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={isSaving ? undefined : handleClose}>
      <AlertDialogPortal>
        <AlertDialogContent className={`p-[0] w-[880px] max-w-[95vw] max-h-[90vh] h-[933px] sm:max-w-[none] max-sm:w-[95vw] max-sm:h-[90vh]`}>
          <AlertDialogTitle className="sr-only">{donor ? t('editDonor') : t('addNewDonor')}</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">{t('donorFormDescription')}</AlertDialogDescription>
          {formStore.isLoading && !isSaving ? (
            <div className={styles.loading}>
              <p>{t('loadingData')}</p>
            </div>
          ) : (
            <div ref={popupRef} className={styles.dialog}>
              <div className={`${styles.header}`}>
                {donor &&
                  <span className="body-1">
                    {fund ?
                      <span className={styles.fundraiserName}>{t('theFundraiser')}</span>
                      :
                      <span>{t('theDonor')} {isFundraiser && <span className={styles.fundraiserName}>{t('alsoFundraiser')}</span>}</span>
                    }
                  </span>}

                <h1 className={`card-4 ${fund ? styles.fundraiserName : ''}`}>
                  {donor
                    ? `${donor.first_name || firstName || ""} ${donor.last_name || lastName || ""}`
                    : (isFundraiser ? t('addNewFundraiser') : t('addNewDonor'))}
                </h1>

                {getNavigationIds() && getNavigationIds().length > 1 && !invitationOnly && (
                  <div className={styles.donorNav}>
                    <button
                      disabled={isSaving || !getNavigationIds() || getCurrentIndex() <= 0}
                      onClick={() => {
                        const actuallyChanged = checkIfFormChanged();
                        if (actuallyChanged) {
                          setPendingAction('prev');
                          setShowUnsavedDialog(true);
                        } else {
                          handlePrev();
                        }
                      }}
                    >
                      <RightArrow />
                    </button>
                    <button
                      disabled={isSaving || !getNavigationIds() || getCurrentIndex() >= getNavigationIds().length - 1}
                      onClick={() => {
                        const actuallyChanged = checkIfFormChanged();
                        if (actuallyChanged) {
                          setPendingAction('next');
                          setShowUnsavedDialog(true);
                        } else {
                          handleNext();
                        }
                      }}
                    >
                      <LeftArrow />
                    </button>
                  </div>
                )}
                <div className={`${styles.stars} ${(!isFundraiser || invitationOnly) ? styles.hidden : ""}`}>
                  {[...Array(5)].map((_, index) => {
                    const isFilled = index < stars;
                    return (
                      <Star
                        key={index}
                        className={`${styles.star} ${isFilled ? styles.filled : ""}`}
                      />
                    );
                  })}
                </div>
                {!invitationOnly && !hideAddDonation && (
                  <div className={styles.addDonationButtonWrapper}>
                    <Button
                      text={t('addDonation')}
                      onClick={() => setIsDonationFormOpen(true)}
                      small donor primary
                      disabled={isSaving}
                    />
                  </div>
                )}
              </div>
              <div className={styles.form}>
                {showAssignOverlay && (
                  <AssignDonorsOverlay
                    fundraiser={currentDonor}
                    onClose={() => setShowAssignOverlay(false)}
                  />
                )}
                <>
                  <div className={styles.formContent}>
                    {!invitationOnly && (
                      <div className={styles.tabSwitcher}>
                        <button
                          className={`${styles.sectionTitle} ${!isFundraiser || activeTab === "personal" ? `${styles.active} table-1` : "table-2"}`}
                          onClick={() => setActiveTab("personal")}
                          disabled={isSaving}
                        >
                          {t('personalDetails')}
                        </button>
                        {isFundraiser && <button
                          className={`${styles.sectionTitle} ${activeTab === "fundraiser" ? `${styles.active} table-1` : "table-2"}`}
                          onClick={() => setActiveTab("fundraiser")}
                          disabled={isSaving}
                        >
                          {t('fundraiserManagement')}
                        </button>}
                      </div>
                    )}
                    {activeTab === "personal" && (
                      <div className={styles.tabContent}>
                        <form onSubmit={handleSubmit(onSubmitForm)} className={styles.allDetails}>
                          <div className={styles.formSection}>
                            <h3 className={styles.sectionTitle}>{t('personalDetails')}</h3>
                            <div className={styles.grid}>
                              <div className={styles.section1}>
                                {showTitleFields && (
                                  <Input
                                    placeholder={t('titleBefore')}
                                    value={watch("titleBefore")}
                                    onChange={(e) => { setValue("titleBefore", e.target.value); }}
                                    disabled={invitationOnly || isSaving}
                                  />
                                )}
                                <Input
                                  placeholder={t('firstName')}
                                  value={firstName}
                                  onChange={(e) => { setValue("firstName", e.target.value); }}
                                  disabled={invitationOnly || isSaving}
                                />
                                <Input
                                  placeholder={t('lastName')}
                                  value={lastName}
                                  onChange={(e) => { setValue("lastName", e.target.value); }}
                                  disabled={invitationOnly || isSaving}
                                />
                                {/* Contact autocomplete suggestions (add mode only) */}
                                {formStore.mode === 'add' && showSuggestions && contactSuggestions.length > 0 && (
                                  <div ref={contactSearchRef} className={styles.contactSuggestionsDropdown}>
                                    <div className={styles.contactSuggestionsHeader}>{t('existingContactsFound')}</div>
                                    {contactSuggestions.map((c) => (
                                      <div key={c.id} className={styles.contactSuggestionItem} onClick={() => handleSelectContact(c)}>
                                        <span className={styles.contactSuggestionName}>{`${c.lastName || c.last_name || ''} ${c.firstName || c.first_name || ''}`.trim()}</span>
                                        <span className={styles.contactSuggestionDetail}>{[c.mainMobile || c.main_mobile, c.email, c.city || c.city_name].filter(Boolean).join(' · ')}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {formStore.mode === 'add' && selectedPersonId && (
                                  <div className={styles.selectedContactBanner}>
                                    <span>{t('existingContactSelected')}</span>
                                    <button type="button" onClick={clearSelectedContact} className={styles.clearContactBtn}>✕</button>
                                  </div>
                                )}
                                {showTitleFields && (
                                  <Input
                                    placeholder={t('titleAfter')}
                                    value={watch("titleAfter")}
                                    onChange={(e) => { setValue("titleAfter", e.target.value); }}
                                    disabled={invitationOnly || isSaving}
                                  />
                                )}
                                <Input
                                  placeholder={t('mobilePhone')}
                                  value={mainMobile}
                                  onChange={(e) => { 
                                    const formattedPhone = formatPhoneNumber(e.target.value);
                                    setValue("mainMobile", formattedPhone); 
                                  }}
                                  validationError={errors.mainMobile && t('requiredField')}
                                  disabled={invitationOnly || isSaving}
                                />
                                <Input
                                  placeholder={t('landlinePhone')}
                                  value={landlinePhone}
                                  onChange={(e) => { 
                                    const formattedPhone = formatPhoneNumber(e.target.value);
                                    setValue("landlinePhone", formattedPhone); 
                                  }}
                                  disabled={invitationOnly || isSaving}
                                />
                                <Input
                                  placeholder={isFundraiser ? `${t('email')} *` : t('email')}
                                  value={email}
                                  onChange={(e) => { setValue("email", e.target.value); }}
                                  disabled={invitationOnly || isSaving}
                                  required={isFundraiser}
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* English Name Section - only show if active in campaign */}
                          {showEnglishName && (
                            <div className={styles.formSection}>
                              <h3 className={styles.sectionTitle}>{t('englishName')}</h3>
                              <div className={styles.englishNameGrid}>
                                <Input
                                  placeholder={t('titleBeforeEn')}
                                  value={watch("titleBeforeEn")}
                                  onChange={(e) => { setValue("titleBeforeEn", e.target.value); }}
                                  disabled={invitationOnly || isSaving}
                                  dir="ltr"
                                />
                                <Input
                                  placeholder={t('firstNameEn')}
                                  value={watch("firstNameEn")}
                                  onChange={(e) => { setValue("firstNameEn", e.target.value); }}
                                  disabled={invitationOnly || isSaving}
                                  dir="ltr"
                                />
                                <Input
                                  placeholder={t('lastNameEn')}
                                  value={watch("lastNameEn")}
                                  onChange={(e) => { setValue("lastNameEn", e.target.value); }}
                                  disabled={invitationOnly || isSaving}
                                  dir="ltr"
                                />
                                <Input
                                  placeholder={t('titleAfterEn')}
                                  value={watch("titleAfterEn")}
                                  onChange={(e) => { setValue("titleAfterEn", e.target.value); }}
                                  disabled={invitationOnly || isSaving}
                                  dir="ltr"
                                />
                              </div>
                            </div>
                          )}
                          
                          <div className={styles.formSection}>
                            <ConcatMethod hasEmail={hasEmail} preferredContact={preferredContact} setPreferredContact={setPreferredContact} disabled={invitationOnly || isSaving} />
                          </div>
                          
                          <div className={styles.formSection}>
                            <h3 className={styles.sectionTitle}>{t('addressDetails')}</h3>
                            <div className={styles.addressGrid}>
                              <Input
                                placeholder={t('street')}
                                list="streets-list"
                                value={streetInput}
                                onChange={e => {
                                  setStreetInput(e.target.value);
                                }}
                                disabled={invitationOnly || isSaving}
                              />
                              <datalist id="streets-list">
                                {formStore.streets.map(street => <option key={street.id} value={street.name} />)}
                              </datalist>
                              <Input
                                placeholder={t('houseNumber')}
                                value={watch("houseNumber")}
                                onChange={(e) => { setValue("houseNumber", e.target.value); }}
                                disabled={invitationOnly || isSaving}
                              />
                              <Input
                                placeholder={t('city')}
                                list="cities-list"
                                value={cityInput}
                                onChange={e => {
                                  setCityInput(e.target.value);
                                  const found = formStore.cities.find(c => c.name === e.target.value);
                                  if (found) setCityId(found.id);
                                  else setCityId(null);
                                }}
                                disabled={invitationOnly || isSaving}
                              />
                              <datalist id="cities-list">
                                {formStore.cities.map(city => <option key={city.id} value={city.name} />)}
                              </datalist>
                              {showCountry && (
                                <Input
                                  placeholder={t('country')}
                                  value={countryInput}
                                  onChange={(e) => { setCountryInput(e.target.value); }}
                                  disabled={invitationOnly || isSaving}
                                />
                              )}
                              <Input
                                placeholder={t('synagogue')}
                                list="synagogues-list"
                                value={synagogue}
                                onChange={e => {
                                  setValue("synagogue", e.target.value);
                                }}
                                disabled={invitationOnly || isSaving}
                              />
                              <datalist id="synagogues-list">
                                {donorsStore.synagogues.map(synagogue => <option key={synagogue} value={synagogue} />)}
                              </datalist>
                            </div>
                          </div>
                          
                          {!invitationOnly && !hideAddDonation && (
                            <SelectFundRaiser
                              fundraiserId={fundraiserId}
                              setValue={setValue}
                              donor={donor}
                              setDirty={(value) => formStore.setDirty(value)}
                            />
                          )}
                          {showInvitationSection && (
                            <div className={styles.invitationBox}>
                              <h2 className={`${styles.invitationTitle} table-1`}>{t('invitationTracking')}</h2>
                              <InvitationProgress
                                invitationSent={invitationSent}
                                arrivalConfirmed={arrivalConfirmed}
                                actuallyArrived={actuallyArrived}
                                onChange={(values) => {
                                  setInvitationSent(values.invitationSent);
                                  setArrivalConfirmed(values.arrivalConfirmed);
                                  setActuallyArrived(values.actuallyArrived);
                                  formStore.setDirty(true);
                                }}
                              />
                            </div>
                          )}
                          {!invitationOnly && (
                            <div ref={notesSectionRef} className={styles.notesBox}>
                              <h2 className={`${styles.notesTitle} table-1`}>{t('notes')}</h2>
                              
                              {/* Add mode: NoteInput-style textarea with calendar and assignee */}
                              {formStore.mode !== 'edit' && (
                                <>
                                  <div className={`${styles.row} ${notesFocused ? styles.focused : ''} ${notes ? styles.hasValue : ''}`}>
                                    <div className={styles.inputWrapper}>
                                      <textarea
                                        ref={(el) => {
                                          if (el) {
                                            el.style.height = 'auto';
                                            el.style.height = `${el.scrollHeight}px`;
                                          }
                                        }}
                                        rows={1}
                                        dir="rtl"
                                        className={`${styles.notesInput} table-2`}
                                        placeholder=""
                                        value={notes}
                                        onFocus={() => setNotesFocused(true)}
                                        onBlur={() => setNotesFocused(false)}
                                        onInput={(e) => {
                                          e.target.style.height = 'auto';
                                          e.target.style.height = `${e.target.scrollHeight}px`;
                                        }}
                                        onChange={(e) => {
                                          setNotes(e.target.value);
                                          formStore.setDirty(true);
                                        }}
                                        disabled={isSaving}
                                      />
                                      <span className={styles.icon} aria-hidden>
                                        <Note />
                                      </span>
                                    </div>
                                    {notes && notes.trim() && (
                                      <div className={styles.inlineCalendar}>
                                        <CalendarComponent
                                          onDateSelect={(dateData) => {
                                            const selectedDate = dateData?.date || dateData;
                                            if (selectedDate instanceof Date) {
                                              const yyyy = selectedDate.getFullYear();
                                              const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                              const dd = String(selectedDate.getDate()).padStart(2, '0');
                                              setNoteFollowUpDate(`${yyyy}-${mm}-${dd}`);
                                            }
                                          }}
                                          range={false}
                                          iconOnly
                                        />
                                      </div>
                                    )}
                                    {notes && notes.trim() && (
                                      <div className={styles.inlineAssignee}>
                                        <AssigneePicker
                                          campaignId={campaign?.id}
                                          onSelect={(a) => setNoteAssignee(a)}
                                          selectedName={noteAssignee?.name}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}

                              {/* Edit mode: Show existing notes with traffic-light colors + add form */}
                              {formStore.mode === 'edit' && (
                                <div className={styles.donorNotesSection}>
                                  {/* Legacy notes field (first note text) */}
                                  {notes && (!donorNotes.length || donorNotes[0]?.note !== notes) && (
                                    <div className={styles.editModeNoteInner}>
                                      <div className={styles.editModeNoteRow}>
                                        <span className={styles.editModeNoteIcon}>
                                          <NoteIcon />
                                        </span>
                                        <span className={styles.editModeNoteContent}>{notes}</span>
                                      </div>
                                    </div>
                                  )}
                                  {/* Donor notes from donor_notes table */}
                                  {donorNotes.map((noteItem) => {
                                    const noteHasFollowUp = Boolean(noteItem.followUpDate);
                                    const noteIsOverdue = noteHasFollowUp && !noteItem.noteCompleted && new Date(noteItem.followUpDate) < new Date();
                                    const noteInnerClass = `${styles.editModeNoteInner} ${noteItem.noteCompleted ? styles.noteCompleted : ''} ${noteIsOverdue ? styles.noteOverdue : ''}`;
                                    return (
                                      <div key={noteItem.id} className={noteInnerClass}>
                                        <div className={styles.editModeNoteRow}>
                                          <span className={styles.editModeNoteIcon}>
                                            <NoteIcon />
                                          </span>
                                          <span className={styles.editModeNoteContent}>{noteItem.note}</span>
                                          {noteHasFollowUp && (
                                            <div className={styles.noteFooterIcons}>
                                              <div className={styles.noteFooterIconItem}>
                                                <CalendarIcon />
                                                <span className={styles.noteFooterIconLabel}>{new Date(noteItem.followUpDate).toLocaleDateString('he-IL')}</span>
                                              </div>
                                              <div className={styles.noteFooterIconItem} title={noteItem.assignedToName || ''}>
                                                <svg width="22" height="22" viewBox="0 0 9 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                  <path d="M5.79282 5.11C6.05961 4.87907 6.2736 4.59344 6.42026 4.27251C6.56692 3.95158 6.64283 3.60285 6.64282 3.25C6.64282 2.58696 6.37943 1.95107 5.91059 1.48223C5.44175 1.01339 4.80586 0.75 4.14282 0.75C3.47978 0.75 2.8439 1.01339 2.37506 1.48223C1.90621 1.95107 1.64282 2.58696 1.64282 3.25C1.64282 3.60285 1.71872 3.95158 1.86539 4.27251C2.01205 4.59344 2.22603 4.87907 2.49282 5.11C1.79289 5.42694 1.19905 5.93876 0.782312 6.58427C0.36557 7.22978 0.143558 7.98166 0.142822 8.75C0.142822 8.88261 0.195501 9.00979 0.289269 9.10355C0.383037 9.19732 0.510214 9.25 0.642822 9.25C0.775431 9.25 0.902608 9.19732 0.996376 9.10355C1.09014 9.00979 1.14282 8.88261 1.14282 8.75C1.14282 7.95435 1.45889 7.19129 2.0215 6.62868C2.58411 6.06607 3.34717 5.75 4.14282 5.75C4.93847 5.75 5.70153 6.06607 6.26414 6.62868C6.82675 7.19129 7.14282 7.95435 7.14282 8.75C7.14282 8.88261 7.1955 9.00979 7.28927 9.10355C7.38304 9.19732 7.51021 9.25 7.64282 9.25C7.77543 9.25 7.90261 9.19732 7.99638 9.10355C8.09014 9.00979 8.14282 8.88261 8.14282 8.75C8.14209 7.98166 7.92007 7.22978 7.50333 6.58427C7.08659 5.93876 6.49275 5.42694 5.79282 5.11ZM4.14282 4.75C3.84615 4.75 3.55614 4.66203 3.30947 4.4972C3.06279 4.33238 2.87053 4.09811 2.757 3.82403C2.64347 3.54994 2.61377 3.24834 2.67164 2.95736C2.72952 2.66639 2.87238 2.39912 3.08216 2.18934C3.29194 1.97956 3.55922 1.8367 3.85019 1.77882C4.14116 1.72094 4.44276 1.75065 4.71685 1.86418C4.99094 1.97771 5.2252 2.16997 5.39003 2.41664C5.55485 2.66332 5.64282 2.95333 5.64282 3.25C5.64282 3.64782 5.48479 4.02936 5.20348 4.31066C4.92218 4.59196 4.54065 4.75 4.14282 4.75Z" fill="currentColor"/>
                                                </svg>
                                                {noteItem.assignedToName && <span className={styles.noteFooterIconLabel}>{noteItem.assignedToName}</span>}
                                              </div>
                                            </div>
                                          )}
                                          {noteHasFollowUp && (
                                            <button
                                              type="button"
                                              className={`${styles.noteToggleButton} ${noteItem.noteCompleted ? styles.active : styles.inactive} ${markingDonorNoteId === noteItem.id ? styles.loading : ''}`}
                                              onClick={() => handleDonorNoteToggle(noteItem)}
                                              disabled={markingDonorNoteId === noteItem.id}
                                            >
                                              <span className={styles.noteToggleCircle}></span>
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {/* Add note button - only show when there are existing notes */}
                                  {(notes || donorNotes.length > 0) && (
                                    <div className={styles.addNoteButtonCenter}>
                                      <button
                                        type="button"
                                        className={styles.addNoteButton}
                                        onClick={() => setShowAddDonorNote(!showAddDonorNote)}
                                        title={t('addNote') || 'הוספת הערה'}
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                          <line x1="12" y1="5" x2="12" y2="19" />
                                          <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                      </button>
                                    </div>
                                  )}
                                  {/* Add note form - show always if no notes, or on button click */}
                                  {(showAddDonorNote || (!notes && donorNotes.length === 0)) && (
                                    <div className={styles.addNoteForm}>
                                      <div className={styles.addNoteInputRow}>
                                        <div className={styles.inputWrapper}>
                                          <textarea
                                            ref={newDonorNoteRef}
                                            className={`${styles.addNoteTextarea} table-2`}
                                            placeholder={t('addNote') || 'הוסף הערה...'}
                                            value={newDonorNoteText}
                                            onChange={(e) => setNewDonorNoteText(e.target.value)}
                                            rows={1}
                                            dir="rtl"
                                            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                          />
                                          <span className={styles.icon} aria-hidden>
                                            <NoteIcon />
                                          </span>
                                        </div>
                                        {newDonorNoteText.trim() && (
                                          <div className={styles.inlineCalendar}>
                                            <CalendarComponent
                                              onDateSelect={(dateData) => {
                                                const selectedDate = dateData?.date || dateData;
                                                if (selectedDate instanceof Date) {
                                                  const yyyy = selectedDate.getFullYear();
                                                  const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                                  const dd = String(selectedDate.getDate()).padStart(2, '0');
                                                  setNewDonorNoteFollowUpDate(`${yyyy}-${mm}-${dd}`);
                                                }
                                              }}
                                              range={false}
                                              iconOnly
                                            />
                                          </div>
                                        )}
                                        {newDonorNoteText.trim() && (
                                          <div className={styles.inlineAssignee}>
                                            <AssigneePicker
                                              campaignId={campaign?.id}
                                              onSelect={(a) => setNewDonorNoteAssignee(a)}
                                              selectedName={newDonorNoteAssignee?.name}
                                            />
                                          </div>
                                        )}
                                      </div>
                                      {newDonorNoteText.trim() && (
                                        <div className={styles.addNoteActions}>
                                          <button
                                            type="button"
                                            className={styles.addNoteSaveBtn}
                                            onClick={handleSaveDonorNote}
                                            disabled={!newDonorNoteText.trim() || !newDonorNoteFollowUpDate || !newDonorNoteAssignee || isSavingDonorNote}
                                          >
                                            {isSavingDonorNote ? t('saving') : t('save')}
                                          </button>
                                          <button
                                            type="button"
                                            className={styles.addNoteCancelBtn}
                                            onClick={() => { setShowAddDonorNote(false); setNewDonorNoteText(''); setNewDonorNoteFollowUpDate(''); setNewDonorNoteAssignee(null); }}
                                          >
                                            {t('cancel')}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          {!invitationOnly && <DonationsTable donations={donor?.donations || []} />}
                        </form>
                      </div>
                    )}

                    {activeTab === "fundraiser" && (
                      <div className={styles.tabContent}>
                        <div className={styles.fundraiserTabScroll}>
                          <ProgressTabs
                            mode={"shalon"}
                            statusKey={getCurrentFundraiserStatus()}
                            hasDonors={true}
                            onStartAssign={() => setShowAssignOverlay(true)}
                          />
                          <FundraiserDonors
                            popupRef={popupRef}
                            fundraiser={currentDonor}
                            onStartAssign={() => setShowAssignOverlay(true)}
                          />
                        </div>
                      </div>
                    )}
                    {showValidationMessage && (
                      <div className={`${styles.validationMessage} validation`}>
                        {validationMessage}
                      </div>
                    )}
                  </div>
                  <div className={styles.buttons}>
                    <Button
                      text={isSaving ? t('saving') : (invitationOnly ? t('updateInvitationStatus') : t('saveChanges'))}
                      loading={isSaving}
                      onClick={async () => {
                        if (invitationOnly) {
                          const result = await updateInvitationOnly();
                          if (result) {
                            onClose();
                          }
                        } else {
                          if (!isFormValid()) {
                            const msg = getFirstValidationMessage();
                            setValidationMessage(msg);
                            setShowValidationMessage(true);
                          } else {
                            setShowValidationMessage(false);
                            
                            const formData = {
                              firstName,
                              lastName,
                              mainMobile,
                              landlinePhone,
                              email,
                              city: cityInput,
                              address: streetInput,
                              houseNumber: watch("houseNumber"),
                              fundraiserId,
                              synagogue,
                              notes
                            };
                            
                            const result = await onSubmitForm(formData);
                            if (result) {
                              onClose();
                            }
                          }
                        }
                      }}
                      type="button"
                      disabled={invitationOnly ? isSaving : (!isFormValid() || isSaving)}
                      disabledClick={invitationOnly ? isSaving : (!isFormValid() || isSaving)}
                    />
                  </div>
                </>

              </div>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialogPortal >
      {showUnsavedDialog &&
        <SaveComponent
          isOpen={showUnsavedDialog}
          onSaveChanges={async () => {
            setShowUnsavedDialog(false);
            setIsSaving(true);
            try {
              const formData = {
                firstName,
                lastName,
                mainMobile: formatPhoneNumber(mainMobile),
                landlinePhone: formatPhoneNumber(landlinePhone),
                email,
                city: cityInput,
                address: streetInput,
                houseNumber: watch("houseNumber"),
                fundraiserId,
                preferredContact,
                notes
              };
              await onSubmitForm(formData);
              if (pendingAction === 'close') {
                onClose();
              } else {
                doPendingAction();
              }
            } finally {
              setIsSaving(false);
            }
          }}
          onCancelChanges={() => {
            setShowUnsavedDialog(false);
            formStore.setDirty(false);
            doPendingAction();
          }}
        />}
      {isDonationFormOpen && (
        <DonationForm
          donor={donorsStore.donors.find(d => d.person_id === donor?.id)}
          isOpen={isDonationFormOpen}
          mode="add"
          onClose={() => setIsDonationFormOpen(false)}
          onSuccess={() => setIsDonationFormOpen(false)}
        />
      )}
    </AlertDialog >
  );
});

export default AddEdit;
