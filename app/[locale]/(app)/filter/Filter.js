"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import styles from "./Filter.module.scss";
import Filter from "@/app/icons/filter.svg";
import Input from "@/app/components/Input";
import Button from "@/app/components/Button";
import Circle from "@/app/icons/circle24.svg"
import IconTooltip from "@/app/components/IconTooltip/IconTooltip";
import MultiRangeSlider from "./multiRangeSlider/multiRangeSlider";
import X from "@/app/icons/x.svg"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import fetchWithAuth from '@/app/utils/fetchWithAuth';

const FilterComponent = forwardRef(function FilterComponent(
  { isOpen, onClose, onlyDonor = false, showSynagogueFilter = false, onChange, onApply, campaignId }, 
  ref
) {
  const [selectedRole, setSelectedRole] = useState("fundraiser");
  const [expectedRange, setExpectedRange] = useState({ min: 0, max: 1000000 });
  const [actualRange, setActualRange] = useState({ min: 0, max: 1000000 });
  const [trafficScore, setTrafficScore] = useState(null);
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [synagogue, setSynagogue] = useState([]); // Changed to array for multi-select
  const [synagogues, setSynagogues] = useState([]);
  const [loadingSynagogues, setLoadingSynagogues] = useState(false);
  const [synagogueDropdownOpen, setSynagogueDropdownOpen] = useState(false);

  const trafficScores = [
    { value: "", color: styles.none, label: "אין מידע" },
    { value: "red", color: styles.low, label: "פוטנציאל נמוך" },
    { value: "orange", color: styles.medium, label: "פוטנציאל בינוני" },
    { value: "green", color: styles.high, label: "פוטנציאל גבוה" },
  ];

  const updateFilters = (changed = {}) => {
    const filters = {
      selectedRole,
      expectedRange,
      actualRange,
      trafficScore,
      city: typeof city === 'string' ? city.trim() : city,
      street: typeof street === 'string' ? street.trim() : street,
      houseNumber: typeof houseNumber === 'string' ? houseNumber.trim() : houseNumber,
      firstName: typeof firstName === 'string' ? firstName.trim() : firstName,
      lastName: typeof lastName === 'string' ? lastName.trim() : lastName,
      phone: typeof phone === 'string' ? phone.trim() : phone,
      mobile: typeof mobile === 'string' ? mobile.trim() : mobile,
      email: typeof email === 'string' ? email.trim() : email,
      synagogue,
      ...changed
    };
    if (onChange) onChange(filters);
  };

  const handleExpectedChange = (values) => {
    const newRange = {
      min: Math.max(0, Math.min(values.min, expectedRange.max - 1)),
      max: Math.min(1000000, Math.max(values.max, expectedRange.min + 1)),
    };
    setExpectedRange(newRange);
    updateFilters({ expectedRange: newRange });
  };

  const handleActualChange = (values) => {
    const newRange = {
      min: Math.max(0, Math.min(values.min, actualRange.max - 1)),
      max: Math.min(1000000, Math.max(values.max, actualRange.min + 1)),
    };
    setActualRange(newRange);
    updateFilters({ actualRange: newRange });
  };

  const handleTrafficScoreChange = (value) => {
    const newScore = trafficScore === value ? null : value;
    setTrafficScore(newScore);
    updateFilters({ trafficScore: newScore });
  };

  const handleCityChange = (e) => {
    const value = e.target.value;
    setCity(value);
    updateFilters({ city: value.trim() });
  };

  const handleStreetChange = (e) => {
    const value = e.target.value;
    setStreet(value);
    updateFilters({ street: value.trim() });
  };

  const handleHouseNumberChange = (e) => {
    const value = e.target.value;
    setHouseNumber(value);
    updateFilters({ houseNumber: value.trim() });
  };

  const handleFirstNameChange = (e) => {
    const value = e.target.value;
    setFirstName(value);
    updateFilters({ firstName: value.trim() });
  };

  const handleLastNameChange = (e) => {
    const value = e.target.value;
    setLastName(value);
    updateFilters({ lastName: value.trim() });
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    setPhone(value);
    updateFilters({ phone: value.trim() });
  };

  const handleMobileChange = (e) => {
    const value = e.target.value;
    setMobile(value);
    updateFilters({ mobile: value.trim() });
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    updateFilters({ email: value.trim() });
  };
  
  const handleSynagogueChange = (value) => {
    // Toggle synagogue in the array
    setSynagogue(prev => {
      let newSynagogues;
      if (value === 'all') {
        // "all" clears the filter
        newSynagogues = [];
      } else if (prev.includes(value)) {
        // Remove if already selected
        newSynagogues = prev.filter(s => s !== value);
      } else {
        // Add new selection
        newSynagogues = [...prev, value];
      }
      updateFilters({ synagogue: newSynagogues });
      return newSynagogues;
    });
  };

  const getSynagogueDisplayText = () => {
    if (loadingSynagogues) return "טוען בתי כנסת...";
    if (!synagogue || synagogue.length === 0) return "בחר בית כנסת";
    if (synagogue.length === 1) {
      if (synagogue[0] === 'no-synagogue') return "אנשים ללא בית כנסת";
      return synagogue[0];
    }
    return `${synagogue.length} בתי כנסת נבחרו`;
  };

  // שליפת בתי הכנסת
  const fetchSynagogues = async () => {
    if (!showSynagogueFilter || !campaignId) return;
    
    setLoadingSynagogues(true);
    try {
      const res = await fetchWithAuth(`/api/donors/synagogues?campaignId=${campaignId}`);
      const data = await res.json();
      if (data.success) {
        setSynagogues(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching synagogues:', error);
    } finally {
      setLoadingSynagogues(false);
    }
  };

  // שליפת בתי הכנסת כשהפילטר נפתח
  useEffect(() => {
    if (isOpen && showSynagogueFilter) {
      fetchSynagogues();
    }
  }, [isOpen, showSynagogueFilter]);

  const handleApplyFilters = () => {
    if (onApply) {
      onApply({
        selectedRole,
        expectedRange,
        actualRange,
        trafficScore,
        city: typeof city === 'string' ? city.trim() : city,
        street: typeof street === 'string' ? street.trim() : street,
        houseNumber: typeof houseNumber === 'string' ? houseNumber.trim() : houseNumber,
        firstName: typeof firstName === 'string' ? firstName.trim() : firstName,
        lastName: typeof lastName === 'string' ? lastName.trim() : lastName,
        phone: typeof phone === 'string' ? phone.trim() : phone,
        mobile: typeof mobile === 'string' ? mobile.trim() : mobile,
        email: typeof email === 'string' ? email.trim() : email
      });
    }
  };

  const handleResetFilters = () => {
    setExpectedRange({ min: 0, max: 1000000 });
    setActualRange({ min: 0, max: 1000000 });
    setTrafficScore(null);
    setCity("");
    setStreet("");
    setHouseNumber("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setMobile("");
    setEmail("");
    setSynagogue([]); // Reset to empty array for multi-select
    
    // Create a reset object to pass to onChange
    const resetFiltersState = {
      selectedRole, // Keep the current role or reset if needed
      expectedRange: { min: 0, max: 1000000 },
      actualRange: { min: 0, max: 1000000 },
      trafficScore: null,
      city: "",
      street: "",
      houseNumber: "",
      firstName: "",
      lastName: "",
      phone: "",
      mobile: "",
      email: "",
      synagogue: []
    };

    if (onChange) {
      onChange(resetFiltersState);
    }
  };
  
  useImperativeHandle(ref, () => ({
    reset: handleResetFilters
  }));

  return (
    <>
      {isOpen && (
        <div 
          className={styles.overlay} 
          onClick={onClose}
        />
      )}
      <div 
        className={`${styles.filterContainer} ${isOpen ? styles.open : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className={styles.closeButton} style={{ color: 'var(--Icon-able-Icon, #0C4AD5)' }}>
          <X />
        </button>
      <div className={`${styles.filterHeader} headline-2`}>סינון מתקדם</div>
      <div className={styles.filterContentWrapper}>
        <div className={styles.filterContent}>
          {!onlyDonor &&
            <div className={styles.roleSelectionWrapper}>
              <h2 className={`table-2 ${styles.smallTitle}`}>מי שאתה מחפש הוא:</h2>
              <div className={`${styles.roleSelection} button-1`}>
                <button
                  className={`${styles.roleButton} ${selectedRole === "fundraiser" ? styles.active : ""}`}
                  onClick={() => {
                    setSelectedRole("fundraiser");
                    updateFilters({ selectedRole: "fundraiser" });
                  }}
                >
                  מתרים
                </button>
                <button
                  className={`${styles.roleButton} ${selectedRole === "donor" ? styles.active : ""}`}
                  onClick={() => {
                    setSelectedRole("donor");
                    updateFilters({ selectedRole: "donor" });
                  }}
                >
                  תורם
                </button>
              </div>
            </div>
          }
          <MultiRangeSlider
            min={0}
            max={1000000}
            currentMin={expectedRange.min}
            currentMax={expectedRange.max}
            type="expected"
            onChange={handleExpectedChange}
          />
          <MultiRangeSlider
            min={0}
            max={1000000}
            currentMin={actualRange.min}
            currentMax={actualRange.max}
            type="actual"
            onChange={handleActualChange}
          />
          <div className={styles.trafficScoreWrapper}>
            <h2 className={`table-2 ${styles.smallTitle}`}>ניקוד רמזור</h2>
            <div className={styles.trafficScore}>

              {trafficScores.map((score) => (
                <div
                  key={score.value}
                  className={`${styles.trafficButton} ${score.color} ${trafficScore === score.value ? styles.active : ""}`}
                  onClick={() => handleTrafficScoreChange(score.value)}
                >
                  <IconTooltip icon={<Circle />} text={score.label} />
                </div>
              ))}
            </div>
          </div>
          <div className={styles.fields}>
            <div className={styles.address}>
              <Input placeholder="עיר" value={city} onChange={handleCityChange} />
              <Input placeholder="רחוב" value={street} onChange={handleStreetChange} />
              <Input placeholder="מספר בית" small value={houseNumber} onChange={handleHouseNumberChange} />
            </div>
            <div className={styles.details}>
              <Input placeholder="שם פרטי" value={firstName} onChange={handleFirstNameChange} />
              <Input placeholder="שם משפחה" value={lastName} onChange={handleLastNameChange} />
              <Input placeholder="טלפון נייח" value={phone} onChange={handlePhoneChange} />
              <Input placeholder="טלפון נייד" value={mobile} onChange={handleMobileChange} />
            </div>
            <Input placeholder="כתובת מייל" value={email} onChange={handleEmailChange} />
          </div>
          
          {/* פילטר בית כנסת - Multi-select */}
          {showSynagogueFilter && (
            <div className={styles.synagogueFilter}>
              <span className={styles.selectFund}>
                <label className={`${styles["floating-label"]} ${synagogue && synagogue.length > 0 ? styles.visible : ""} small-button-1`}>
                  בחר בתי כנסת
                </label>
                <div className={styles.multiSelectContainer}>
                  <button
                    type="button"
                    className={`${styles.multiSelectTrigger} ${!synagogue || synagogue.length === 0 ? styles.noSelection : ""}`}
                    onClick={() => setSynagogueDropdownOpen(!synagogueDropdownOpen)}
                    disabled={loadingSynagogues}
                  >
                    <span className="button-1">{getSynagogueDisplayText()}</span>
                    <svg className={`${styles.chevron} ${synagogueDropdownOpen ? styles.open : ""}`} width="12" height="12" viewBox="0 0 12 12">
                      <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    </svg>
                  </button>
                  {synagogueDropdownOpen && (
                    <div className={styles.multiSelectDropdown}>
                      <div 
                        className={`${styles.multiSelectOption} ${!synagogue || synagogue.length === 0 ? styles.selected : ""}`}
                        onClick={() => {
                          handleSynagogueChange('all');
                          setSynagogueDropdownOpen(false);
                        }}
                      >
                        <span className={styles.checkbox}>
                          {(!synagogue || synagogue.length === 0) && <span className={styles.checkmark}>✓</span>}
                        </span>
                        כל בתי הכנסת
                      </div>
                      <div 
                        className={`${styles.multiSelectOption} ${synagogue?.includes('no-synagogue') ? styles.selected : ""}`}
                        onClick={() => handleSynagogueChange('no-synagogue')}
                      >
                        <span className={styles.checkbox}>
                          {synagogue?.includes('no-synagogue') && <span className={styles.checkmark}>✓</span>}
                        </span>
                        אנשים ללא בית כנסת
                      </div>
                      {synagogues.filter(s => s !== 'no-synagogue').map((synagogueName) => (
                        <div 
                          key={synagogueName}
                          className={`${styles.multiSelectOption} ${synagogue?.includes(synagogueName) ? styles.selected : ""}`}
                          onClick={() => handleSynagogueChange(synagogueName)}
                        >
                          <span className={styles.checkbox}>
                            {synagogue?.includes(synagogueName) && <span className={styles.checkmark}>✓</span>}
                          </span>
                          {synagogueName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </span>
            </div>
          )}
        </div>
      </div>
      {onApply && <Button onClick={handleApplyFilters} text="הצג תוצאות" primary small />}
      <Button onClick={handleResetFilters} text="אפס סינון" secondary small />
      </div>
    </>
  );
});

export default FilterComponent;