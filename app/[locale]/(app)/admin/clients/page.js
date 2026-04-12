"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import AddUserForm from '@/app/components/AddUserForm';
import styles from './clients.module.scss';

export default function ClientsManagementPage() {
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const router = useRouter();

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            setIsLoading(true);
            const response = await fetchWithAuth('/api/clients');
            if (response.ok) {
                const data = await response.json();
                setClients(Array.isArray(data) ? data : data.data || []);
            } else {
                console.error('Failed to fetch clients');
            }
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddClientSuccess = (result) => {
        setSuccessMessage(`לקוח ${result.name} נוצר בהצלחה!`);
        setShowAddForm(false);
        // רענון הרשימה
        fetchClients();
        // ניקוי ההודעה אחרי 3 שניות
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const handleLogout = () => {
        // לוגיקה ליציאה מהמערכת
        router.push('/login');
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>טוען...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <h1>ניהול לקוחות</h1>
                    <p>ניהול לקוחות המערכת וקמפיינים</p>
                </div>
                <div className={styles.actions}>
                    <button 
                        className={styles.addButton}
                        onClick={() => {
                            setShowAddForm(true);
                        }}
                    >
                        + הוסף לקוח חדש
                    </button>
                    {/* <button 
                        className={styles.logoutButton}
                        onClick={handleLogout}
                    >
                        יציאה
                    </button> */}
                </div>
            </div>

            {successMessage && (
                <div className={styles.successMessage}>
                    {successMessage}
                </div>
            )}

            <div className={styles.content}>
                <div className={styles.statsCards}>
                    <div className={styles.statCard}>
                        <div className={styles.statNumber}>{clients.length}</div>
                        <div className={styles.statLabel}>סה"כ לקוחות</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statNumber}>
                            {clients.reduce((total, client) => total + (client.campaigns?.length || 0), 0)}
                        </div>
                        <div className={styles.statLabel}>סה"כ קמפיינים</div>
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <h2>רשימת לקוחות</h2>
                    {clients.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>אין לקוחות במערכת</p>
                            <button 
                                className={styles.addFirstButton}
                                onClick={() => setShowAddForm(true)}
                            >
                                הוסף לקוח ראשון
                            </button>
                        </div>
                    ) : (
                        <div className={styles.table}>
                            <div className={styles.tableHeader}>
                                <div className={styles.headerCell}>שם הלקוח</div>
                                <div className={styles.headerCell}>אימייל</div>
                                <div className={styles.headerCell}>מספר קמפיינים</div>
                                {/* <div className={styles.headerCell}>תאריך הצטרפות</div> */}
                                <div className={styles.headerCell}>סטטוס</div>
                            </div>
                            <div className={styles.tableRows}>
                                {clients.map((client) => {
                                    return (
                                        <div key={client.id} className={styles.tableRow}>
                                            <div className={styles.cell}>{client.name}</div>
                                            <div className={styles.cell}>{client.email || 'אין אימייל'}</div>
                                            <div className={styles.cell}>
                                                <span className={styles.campaignCount}>
                                                    {client.campaigns?.length || 0}
                                                </span>
                                            </div>
                                            {/* <div className={styles.cell}>
                                                {client.created_at ? new Date(client.created_at).toLocaleDateString('he-IL') : 'לא ידוע'}
                                            </div> */}
                                            <div className={styles.cell}>
                                                <span className={styles.statusActive}>פעיל</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showAddForm && (
                <div>
                    <AddUserForm
                        onClose={() => setShowAddForm(false)}
                        onSuccess={handleAddClientSuccess}
                    />
                </div>
            )}
        </div>
    );
}
