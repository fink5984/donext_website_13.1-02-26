"use client";

import { useState, useEffect, useContext } from 'react';
import { AppContext } from '@/app/components/AppContext';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import Button from '@/app/components/Button';
import FileUpload from '@/app/components/FileUpload';
import styles from './additional-settings.module.scss';

// System icons
import ScreensIcon from '@/app/icons/screens.svg';
import EyeIcon from '@/app/icons/eye.svg';
import GalleryIcon from '@/app/icons/gallery.svg';
import RanksIcon from '@/app/icons/ranks.svg';
import InfoIcon from '@/app/icons/info.svg';
import PhoneIcon from '@/app/icons/phone.svg';
import CalendarIcon from '@/app/icons/calendar.svg';
import EditIcon from '@/app/icons/edit.svg';

export default function AdditionalSettingsPage() {
    const { campaignId } = useContext(AppContext);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    
    // State for form fields
    const [formData, setFormData] = useState({
        publicScreenRanks: [],
        publicScreenAbout: '',
        publicScreenPhone: '',
        publicScreenEmail: '',
        publicScreenBanners: [],
        publicScreenStartDate: '',
        publicScreenEndDate: '',
        isEnabled: false,
        showDonationDetails: true,
        promoVideoUrl: ''
    });

    // State for copied link notification
    const [linkCopied, setLinkCopied] = useState(false);
    
    // State for ranks input
    const [newRank, setNewRank] = useState({ name: '', amount: '', image: '' });
    const [editingRankIndex, setEditingRankIndex] = useState(null);
    
    // State for banners input
    const [editingBannerIndex, setEditingBannerIndex] = useState(null);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [uploadingRankImage, setUploadingRankImage] = useState(false);

    // Function to convert Google Drive link to direct image URL
    const convertGoogleDriveUrl = (url) => {
        if (!url || !url.includes('drive.google.com')) {
            return url; // Not a Google Drive link, return as is
        }
        
        // Extract file ID from various Google Drive URL formats
        let fileId = null;
        
        // Format: https://drive.google.com/file/d/FILE_ID/view
        const match1 = url.match(/\/file\/d\/([^\/]+)/);
        if (match1) {
            fileId = match1[1];
        }
        
        // Format: https://drive.google.com/open?id=FILE_ID
        const match2 = url.match(/[?&]id=([^&]+)/);
        if (match2) {
            fileId = match2[1];
        }
        
        // If already in direct format, return as is
        if (url.includes('/uc?export=view') || url.includes('/uc?id=')) {
            return url;
        }
        
        // Convert to direct image URL
        if (fileId) {
            return `https://drive.google.com/uc?export=view&id=${fileId}`;
        }
        
        return url; // Return original if couldn't parse
    };

    useEffect(() => {
        if (campaignId) {
            fetchSettings();
        }
    }, [campaignId]);

    const fetchSettings = async () => {
        try {
            setIsLoading(true);
            const response = await fetchWithAuth(`/api/campaigns/${campaignId}/additional-settings`);
            if (response.ok) {
                const data = await response.json();
                setFormData({
                    publicScreenRanks: data.publicScreenRanks || [],
                    publicScreenAbout: data.publicScreenAbout || '',
                    publicScreenPhone: data.publicScreenPhone || '',
                    publicScreenEmail: data.publicScreenEmail || '',
                    publicScreenBanners: data.publicScreenBanners || [],
                    publicScreenStartDate: data.publicScreenStartDate ? new Date(data.publicScreenStartDate).toISOString().slice(0, 16) : '',
                    publicScreenEndDate: data.publicScreenEndDate ? new Date(data.publicScreenEndDate).toISOString().slice(0, 16) : '',
                    publicScreenRanksBackgroundColor: data.publicScreenRanksBackgroundColor || '#b45309',
                    isEnabled: data.isEnabled ?? false,
                    showDonationDetails: data.showDonationDetails ?? true,
                    promoVideoUrl: data.promoVideoUrl || ''
                });
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            setErrorMessage('שגיאה בטעינת ההגדרות');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            setErrorMessage('');
            
            const response = await fetchWithAuth(`/api/campaigns/${campaignId}/additional-settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                setSuccessMessage('ההגדרות נשמרו בהצלחה!');
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                const error = await response.json();
                setErrorMessage(error.error || 'שגיאה בשמירת ההגדרות');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            setErrorMessage('שגיאה בשמירת ההגדרות');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRankImageUploadComplete = (url) => {
        try {
            if (!url) {
                console.error('No URL received from upload');
                setErrorMessage('העלאת התמונה נכשלה - לא התקבל קישור');
                return;
            }
            console.log('✅ Rank image uploaded successfully:', url);
            setNewRank({ ...newRank, image: url });
            setUploadingRankImage(false);
        } catch (error) {
            console.error('Error handling rank image upload:', error);
            setErrorMessage('שגיאה בעדכון התמונה');
        }
    };

    const handleAddRank = () => {
        try {
            if (!newRank.name || !newRank.amount) {
                setErrorMessage('יש למלא שם וסכום לדרגה');
                return;
            }
            
            // Convert Google Drive URL to direct format (אם קיים)
            const convertedImageUrl = newRank.image ? convertGoogleDriveUrl(newRank.image) : null;
            
            console.log('🔄 Adding/Editing rank:');
            console.log('  Name:', newRank.name);
            console.log('  Amount:', newRank.amount);
            console.log('  Original image:', newRank.image);
            console.log('  Converted image:', convertedImageUrl);
            
            const rankToAdd = { 
                name: newRank.name, 
                amount: parseFloat(newRank.amount),
                icon: convertedImageUrl || null  // שים לב: השדה צריך להיות "icon" לא "image"
            };
            
            if (editingRankIndex !== null) {
                // עריכת דרגה קיימת
                const updatedRanks = [...formData.publicScreenRanks];
                updatedRanks[editingRankIndex] = rankToAdd;
                setFormData({
                    ...formData,
                    publicScreenRanks: updatedRanks
                });
                setEditingRankIndex(null);
            } else {
                // הוספת דרגה חדשה
                setFormData({
                    ...formData,
                    publicScreenRanks: [...formData.publicScreenRanks, rankToAdd]
                });
            }
            setNewRank({ name: '', amount: '', image: '' });
            setErrorMessage(''); // נקה שגיאות קודמות
        } catch (error) {
            console.error('Error adding rank:', error);
            setErrorMessage('שגיאה בהוספת הדרגה: ' + error.message);
        }
    };

    const handleEditRank = (index) => {
        const rank = formData.publicScreenRanks[index];
        setNewRank({ 
            name: rank.name, 
            amount: rank.amount,
            image: rank.icon || ''  // השדה במודל הוא "icon"
        });
        setEditingRankIndex(index);
    };

    const handleRemoveRank = (index) => {
        setFormData({
            ...formData,
            publicScreenRanks: formData.publicScreenRanks.filter((_, i) => i !== index)
        });
    };

    // Rank drag & drop handlers
    const handleRankDragStart = (e, index) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', index);
    };

    const handleRankDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleRankDrop = (e, dropIndex) => {
        e.preventDefault();
        const dragIndex = parseInt(e.dataTransfer.getData('text/html'));
        
        if (dragIndex === dropIndex) return;
        
        const newRanks = [...formData.publicScreenRanks];
        const draggedItem = newRanks[dragIndex];
        
        // Remove from old position
        newRanks.splice(dragIndex, 1);
        // Insert at new position
        newRanks.splice(dropIndex, 0, draggedItem);
        
        setFormData({
            ...formData,
            publicScreenRanks: newRanks
        });
    };

    const handleDragStart = (e, index) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', index);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        const dragIndex = parseInt(e.dataTransfer.getData('text/html'));
        
        if (dragIndex === dropIndex) return;
        
        const newRanks = [...formData.publicScreenRanks];
        const draggedItem = newRanks[dragIndex];
        
        // Remove from old position
        newRanks.splice(dragIndex, 1);
        // Insert at new position
        newRanks.splice(dropIndex, 0, draggedItem);
        
        setFormData({
            ...formData,
            publicScreenRanks: newRanks
        });
    };

    const handleInputChange = (field, value) => {
        setFormData({
            ...formData,
            [field]: value
        });
    };

    // Banner handlers
    const handleBannerUploadComplete = (url) => {
        try {
            if (!url) {
                console.error('No URL received from banner upload');
                setErrorMessage('העלאת הבנר נכשלה - לא התקבל קישור');
                return;
            }
            console.log('✅ Banner uploaded successfully:', url);
            
            if (editingBannerIndex !== null) {
                // עריכת בנר קיים - מחיקת הישן והחלפתו בחדש
                const updatedBanners = [...formData.publicScreenBanners];
                updatedBanners[editingBannerIndex] = url;
                setFormData({
                    ...formData,
                    publicScreenBanners: updatedBanners
                });
                setEditingBannerIndex(null);
            } else {
                // הוספת בנר חדש
                setFormData({
                    ...formData,
                    publicScreenBanners: [...formData.publicScreenBanners, url]
                });
            }
            setUploadingBanner(false);
        } catch (error) {
            console.error('Error handling banner upload:', error);
            setErrorMessage('שגיאה בעדכון הבנר');
        }
    };

    const handleEditBanner = (index) => {
        setEditingBannerIndex(index);
    };

    const handleRemoveBanner = (index) => {
        setFormData({
            ...formData,
            publicScreenBanners: formData.publicScreenBanners.filter((_, i) => i !== index)
        });
    };

    const handleBannerDragStart = (e, index) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', index);
    };

    const handleBannerDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleBannerDrop = (e, dropIndex) => {
        e.preventDefault();
        const dragIndex = parseInt(e.dataTransfer.getData('text/html'));
        
        if (dragIndex === dropIndex) return;
        
        const newBanners = [...formData.publicScreenBanners];
        const draggedItem = newBanners[dragIndex];
        
        // Remove from old position
        newBanners.splice(dragIndex, 1);
        // Insert at new position
        newBanners.splice(dropIndex, 0, draggedItem);
        
        setFormData({
            ...formData,
            publicScreenBanners: newBanners
        });
    };

    if (!campaignId) {
        return (
            <div className={styles.container}>
                <div className={styles.noSelection}>
                    אנא בחר קמפיין כדי לערוך את ההגדרות הנוספות
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>טוען הגדרות...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <h1>הגדרות מסך ציבורי</h1>
                <p className={styles.subtitle}>הגדר את המסך הציבורי של הקמפיין</p>

                {successMessage && (
                    <div className={styles.success}>{successMessage}</div>
                )}

                {errorMessage && (
                    <div className={styles.error}>{errorMessage}</div>
                )}

            <div className={styles.settingsGrid}>
                {/* הפעלת מסך ציבורי */}
                <div className={styles.settingsSection}>
                    <h2><ScreensIcon className={styles.sectionTitleIcon} />הפעלת מסך ציבורי</h2>
                    
                    <div className={styles.toggleContainer}>
                        <label className={styles.toggleLabel}>
                            <input
                                type="checkbox"
                                checked={formData.isEnabled}
                                onChange={(e) => handleInputChange('isEnabled', e.target.checked)}
                                className={styles.toggleInput}
                            />
                            <span className={styles.toggleSwitch}></span>
                            <span className={styles.toggleText}>
                                {formData.isEnabled ? 'מסך ציבורי פעיל' : 'מסך ציבורי מכובה'}
                            </span>
                        </label>
                        
                        {formData.isEnabled && (
                            <div className={styles.publicScreenLink}>
                                <span className={styles.linkLabel}>קישור למסך הציבורי:</span>
                                <div className={styles.linkContainer}>
                                    <input
                                        type="text"
                                        readOnly
                                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/he/public-screen/${campaignId}`}
                                        className={styles.linkInput}
                                    />
                                    <button
                                        className={styles.copyButton}
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/he/public-screen/${campaignId}`);
                                            setLinkCopied(true);
                                            setTimeout(() => setLinkCopied(false), 2000);
                                        }}
                                    >
                                        {linkCopied ? '✓ הועתק!' : '📋 העתק'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* הצגת פרטי תרומות */}
                <div className={styles.settingsSection}>
                    <h2><EyeIcon className={styles.sectionTitleIcon} />הצגת פרטי תרומות</h2>
                    
                    <div className={styles.toggleContainer}>
                        <label className={styles.toggleLabel}>
                            <input
                                type="checkbox"
                                checked={formData.showDonationDetails}
                                onChange={(e) => handleInputChange('showDonationDetails', e.target.checked)}
                                className={styles.toggleInput}
                            />
                            <span className={styles.toggleSwitch}></span>
                            <span className={styles.toggleText}>
                                {formData.showDonationDetails ? 'מציג את כל הטאבים (תורמים, מתרימים, מובילים, אודות)' : 'מציג רק טאב אודות'}
                            </span>
                        </label>
                    </div>
                </div>

                {/* בנרים למסך הציבורי */}
                <div className={styles.settingsSection}>
                    <h2><GalleryIcon className={styles.sectionTitleIcon} />בנרים למסך הציבורי</h2>
                    
                    {formData.publicScreenBanners.length > 0 && (
                        <div className={styles.bannersGrid}>
                            {formData.publicScreenBanners.map((banner, index) => (
                                <div 
                                    key={index} 
                                    className={styles.bannerCard}
                                    draggable
                                    onDragStart={(e) => handleBannerDragStart(e, index)}
                                    onDragOver={handleBannerDragOver}
                                    onDrop={(e) => handleBannerDrop(e, index)}
                                >
                                    <div className={styles.bannerCardImage}>
                                        <img 
                                            src={banner} 
                                            alt={`בנר ${index + 1}`}
                                        />
                                        <div className={styles.bannerCardOverlay}>
                                            <span className={styles.dragIcon}>⋮⋮</span>
                                        </div>
                                    </div>
                                    <div className={styles.bannerCardFooter}>
                                        <span className={styles.bannerCardTitle}>בנר #{index + 1}</span>
                                        <div className={styles.bannerCardActions}>
                                            <button
                                                className={styles.iconButton}
                                                onClick={() => handleEditBanner(index)}
                                                title="החלף"
                                            >
                                                🔄
                                            </button>
                                            <button
                                                className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                                onClick={() => handleRemoveBanner(index)}
                                                title="מחק"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className={styles.uploadCard}>
                        <FileUpload
                            campaignId={campaignId}
                            onUploadComplete={handleBannerUploadComplete}
                            accept="image/*"
                            label={editingBannerIndex !== null ? '📤 החלף בנר' : '📤 העלה בנר חדש'}
                            endpoint="/api/storage"
                            prefix="banners"
                            previousUrl={editingBannerIndex !== null ? formData.publicScreenBanners[editingBannerIndex] : undefined}
                        />
                        
                        {editingBannerIndex !== null && (
                            <button
                                className={styles.cancelButton}
                                onClick={() => {
                                    setEditingBannerIndex(null);
                                }}
                            >
                                ביטול עריכה
                            </button>
                        )}
                        
                        {formData.publicScreenBanners.length > 1 && (
                            <p className={styles.infoText}>
                                💡 הבנרים יתחלפו אוטומטית כל 10 שניות במסך הציבורי
                            </p>
                        )}
                    </div>
                </div>

                {/* דרגות תרומה */}
                <div className={styles.settingsSection}>
                    <h2><RanksIcon className={styles.sectionTitleIcon} />דרגות תרומה</h2>

                    {formData.publicScreenRanks.length > 0 && (
                        <div className={styles.ranksGrid}>
                            {formData.publicScreenRanks.map((rank, index) => (
                                <div 
                                    key={index} 
                                    className={styles.rankCard}
                                    draggable
                                    onDragStart={(e) => handleRankDragStart(e, index)}
                                    onDragOver={handleRankDragOver}
                                    onDrop={(e) => handleRankDrop(e, index)}
                                >
                                    <div className={styles.rankCardOverlay}>
                                        <span className={styles.dragIcon}>⋮⋮</span>
                                    </div>
                                    {rank.icon && (
                                        <img 
                                            src={rank.icon} 
                                            alt={rank.name}
                                            className={styles.rankIcon}
                                        />
                                    )}
                                    <div className={styles.rankDetails}>
                                        <span className={styles.rankName}>{rank.name}</span>
                                        <span className={styles.rankAmount}>₪{rank.amount.toLocaleString()}</span>
                                    </div>
                                    <div className={styles.rankActions}>
                                        <button
                                            className={styles.iconButton}
                                            onClick={() => handleEditRank(index)}
                                            title="ערוך"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                            onClick={() => handleRemoveRank(index)}
                                            title="מחק"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className={styles.uploadCard}>
                        <h3 className={styles.sectionSubtitle}>
                            {editingRankIndex !== null ? 'ערוך דרגה' : 'הוסף דרגה חדשה'}
                        </h3>
                        <div className={styles.rankInputs}>
                            <input
                                type="text"
                                placeholder="שם הדרגה"
                                value={newRank.name}
                                onChange={(e) => setNewRank({ ...newRank, name: e.target.value })}
                                className={styles.input}
                            />
                            <input
                                type="number"
                                placeholder="סכום"
                                value={newRank.amount}
                                onChange={(e) => setNewRank({ ...newRank, amount: e.target.value })}
                                className={styles.input}
                            />
                        </div>
                        
                        <div className={styles.rankImageSection}>
                            <h4 className={styles.sectionSubtitle}>תמונה לדרגה (אופציונלי)</h4>
                            
                            <FileUpload
                                campaignId={campaignId}
                                onUploadComplete={handleRankImageUploadComplete}
                                accept="image/*"
                                label="📤 העלה תמונה"
                                endpoint="/api/storage"
                                prefix="ranks"
                                previousUrl={newRank.image}
                            />
                            
                            {newRank.image && (
                                <div className={styles.imagePreview}>
                                    <img src={newRank.image} alt="תצוגה מקדימה" onError={(e) => e.target.style.display = 'none'} />
                                </div>
                            )}
                        </div>

                        <button
                            className={styles.addButton}
                            onClick={handleAddRank}
                            disabled={!newRank.name || !newRank.amount}
                        >
                            {editingRankIndex !== null ? 'עדכן דרגה' : 'הוסף דרגה'}
                        </button>
                        
                        {editingRankIndex !== null && (
                            <button
                                className={styles.cancelButton}
                                onClick={() => {
                                    setNewRank({ name: '', amount: '', image: '' });
                                    setEditingRankIndex(null);
                                }}
                            >
                                ביטול
                            </button>
                        )}
                    </div>
                </div>

                {/* אודות */}
                <div className={styles.settingsSection}>
                    <h2><InfoIcon className={styles.sectionTitleIcon} />אודות הקמפיין</h2>
                    <textarea
                        className={styles.textarea}
                        rows={6}
                        placeholder="כתוב כאן מידע אודות הקמפיין..."
                        value={formData.publicScreenAbout}
                        onChange={(e) => handleInputChange('publicScreenAbout', e.target.value)}
                    />
                </div>

                {/* פרטי יצירת קשר */}
                <div className={styles.settingsSection}>
                    <h2><PhoneIcon className={styles.sectionTitleIcon} />פרטי יצירת קשר</h2>
                    
                    <div className={styles.contactForm}>
                        <div className={styles.formGroup}>
                            <label>טלפון</label>
                            <input
                                type="tel"
                                placeholder="050-1234567"
                                value={formData.publicScreenPhone}
                                onChange={(e) => handleInputChange('publicScreenPhone', e.target.value)}
                                className={styles.input}
                            />
                        </div>
                        
                        <div className={styles.formGroup}>
                            <label>אימייל</label>
                            <input
                                type="email"
                                placeholder="example@example.com"
                                value={formData.publicScreenEmail}
                                onChange={(e) => handleInputChange('publicScreenEmail', e.target.value)}
                                className={styles.input}
                            />
                        </div>
                    </div>
                </div>

                {/* תאריכי קמפיין */}
                <div className={styles.settingsSection}>
                    <h2><CalendarIcon className={styles.sectionTitleIcon} />תאריכי קמפיין</h2>
                    
                    <div className={styles.contactForm}>
                        <div className={styles.formGroup}>
                            <label>תאריך ושעת התחלה</label>
                            <input
                                type="datetime-local"
                                value={formData.publicScreenStartDate}
                                onChange={(e) => handleInputChange('publicScreenStartDate', e.target.value)}
                                className={styles.input}
                            />
                        </div>
                        
                        <div className={styles.formGroup}>
                            <label>תאריך ושעת סיום</label>
                            <input
                                type="datetime-local"
                                value={formData.publicScreenEndDate}
                                onChange={(e) => handleInputChange('publicScreenEndDate', e.target.value)}
                                className={styles.input}
                            />
                        </div>
                    </div>
                </div>

                {/* צבע רקע לדרגות */}
                <div className={styles.settingsSection}>
                    <h2><EditIcon className={styles.sectionTitleIcon} />עיצוב דרגות</h2>
                    
                    <div className={styles.colorPickerContainer}>
                        <div className={styles.formGroup}>
                            <label>צבע רקע לדרגות</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <input
                                    type="color"
                                    value={formData.publicScreenRanksBackgroundColor}
                                    onChange={(e) => handleInputChange('publicScreenRanksBackgroundColor', e.target.value)}
                                    className={styles.colorInput}
                                />
                                <input
                                    type="text"
                                    value={formData.publicScreenRanksBackgroundColor}
                                    onChange={(e) => handleInputChange('publicScreenRanksBackgroundColor', e.target.value)}
                                    className={styles.input}
                                    style={{ maxWidth: '150px' }}
                                    placeholder="#b45309"
                                />
                                <div 
                                    className={styles.colorPreview}
                                    style={{ 
                                        backgroundColor: formData.publicScreenRanksBackgroundColor,
                                        width: '60px',
                                        height: '40px',
                                        borderRadius: '8px',
                                        border: '1px solid #ddd'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* סרטון פרסומי */}
                <div className={styles.settingsSection}>
                    <h2>🎬 סרטון פרסומי</h2>
                    <p className={styles.sectionDesc}>הסרטון יוצג כחלון צף למבקרים במסך הציבורי לאחר 5 שניות (פעם אחת בלבד)</p>

                    {formData.promoVideoUrl && (
                        <div className={styles.videoPreview}>
                            <video
                                src={formData.promoVideoUrl}
                                controls
                                style={{ width: '100%', maxHeight: '220px', borderRadius: '8px', marginBottom: '10px' }}
                            />
                            <button
                                className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                onClick={() => handleInputChange('promoVideoUrl', '')}
                            >
                                🗑️ הסר סרטון
                            </button>
                        </div>
                    )}

                    <FileUpload
                        campaignId={campaignId}
                        onUploadComplete={(url) => handleInputChange('promoVideoUrl', url)}
                        accept="video/*"
                        label={formData.promoVideoUrl ? '🔄 החלף סרטון' : '📤 העלה סרטון'}
                        endpoint="/api/storage"
                        prefix="promo-videos"
                        previousUrl={formData.promoVideoUrl || undefined}
                    />
                </div>

                {/* כפתור שמירה */}
                <div className={styles.actions}>
                    <Button
                        text={isSaving ? 'שומר...' : 'שמור הגדרות'}
                        onClick={handleSave}
                        disabled={isSaving}
                        primary
                    />
                </div>
            </div>
            </div>
        </div>
    );
}
