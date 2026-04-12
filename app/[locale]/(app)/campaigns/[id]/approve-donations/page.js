'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import fetchWithAuth from '@/app/utils/fetchWithAuth';

export default function ApproveDonationsPage() {
    const params = useParams();
    const campaignId = params?.id;

    const [loading, setLoading] = useState(true);
    const [donations, setDonations] = useState([]);
    const [approvedDonations, setApprovedDonations] = useState([]);
    const [waitingDonations, setWaitingDonations] = useState([]);

    const [searchUnapproved, setSearchUnapproved] = useState('');
    const [searchApproved, setSearchApproved] = useState('');
    const [refreshTick, setRefreshTick] = useState(0);
    const [processingIds, setProcessingIds] = useState([]);

    async function loadAll() {
        if (!campaignId) return;
        setLoading(true);
        try {
            // טוען תרומות לא מאושרות
            const unapprovedRes = await fetchWithAuth(`/api/donations?campaignId=${campaignId}&approved=false&limit=200`);
            const unapprovedJson = await unapprovedRes.json();
            const unapprovedRows = Array.isArray(unapprovedJson?.data?.donations) ? unapprovedJson.data.donations : [];
            setDonations(unapprovedRows);

            // טוען תרומות מאושרות
            const approvedRes = await fetchWithAuth(`/api/donations?campaignId=${campaignId}&approved=true&limit=200`);
            const approvedJson = await approvedRes.json();
            const approvedRows = Array.isArray(approvedJson?.data?.donations) ? approvedJson.data.donations : [];
            setApprovedDonations(approvedRows);
        } catch (_) {
            setDonations([]);
            setApprovedDonations([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadAll(); }, [campaignId, refreshTick]);



    const filteredUnapproved = useMemo(() => {
        const term = searchUnapproved.trim().toLowerCase();
        if (!term) return donations;
        return donations.filter(d => {
            const name = `${d?.donor?.person?.firstName || ''} ${d?.donor?.person?.lastName || ''}`.toLowerCase();
            return name.includes(term);
        });
    }, [donations, searchUnapproved]);

    const filteredApproved = useMemo(() => {
        const term = searchApproved.trim().toLowerCase();
        if (!term) return approvedDonations;
        return approvedDonations.filter(d => {
            const name = `${d?.donor?.person?.firstName || ''} ${d?.donor?.person?.lastName || ''}`.toLowerCase();
            return name.includes(term);
        });
    }, [approvedDonations, searchApproved]);

    // חישוב סכומים
    const sumUnapproved = useMemo(() => {
        return filteredUnapproved.reduce((sum, d) => sum + (Number(d.monthlyAmount) || 0), 0);
    }, [filteredUnapproved]);

    const sumWaiting = useMemo(() => {
        return waitingDonations.reduce((sum, d) => sum + (Number(d.monthlyAmount) || 0), 0);
    }, [waitingDonations]);

    const sumApproved = useMemo(() => {
        return filteredApproved.reduce((sum, d) => sum + (Number(d.monthlyAmount) || 0), 0);
    }, [filteredApproved]);

    async function approveDirectly(donation) {
        // העברה לעמודת ההמתנה מיד
        setDonations(prev => prev.filter(d => d.id !== donation.id));
        setWaitingDonations(prev => [...prev, donation]);
        setProcessingIds(prev => [...prev, donation.id]);
        
        try {
            await fetchWithAuth(`/api/donations/${donation.id}`, { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ donateApproval: true }) 
            });
            
            // אחרי הצלחה - העברה מהמתנה למאושרות
            setWaitingDonations(prev => prev.filter(d => d.id !== donation.id));
            setApprovedDonations(prev => [...prev, { ...donation, donateApproval: true }]);
        } catch (error) {
            console.error('Error updating donation:', error);
            // במקרה של שגיאה - החזרה לממתינות
            setWaitingDonations(prev => prev.filter(d => d.id !== donation.id));
            setDonations(prev => [...prev, donation]);
        } finally {
            setProcessingIds(prev => prev.filter(id => id !== donation.id));
        }
    }



    async function unapproveIntegrated(donation) {
        // העברה לעמודת ההמתנה מיד
        setApprovedDonations(prev => prev.filter(d => d.id !== donation.id));
        setWaitingDonations(prev => [...prev, donation]);
        setProcessingIds(prev => [...prev, donation.id]);
        
        try {
            await fetchWithAuth(`/api/donations/${donation.id}`, { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ donateApproval: false }) 
            });
            
            // אחרי הצלחה - העברה מהמתנה לממתינות
            setWaitingDonations(prev => prev.filter(d => d.id !== donation.id));
            setDonations(prev => [...prev, { ...donation, donateApproval: false }]);
        } catch (error) {
            console.error('Error updating donation:', error);
            // במקרה של שגיאה - החזרה למאושרות
            setWaitingDonations(prev => prev.filter(d => d.id !== donation.id));
            setApprovedDonations(prev => [...prev, donation]);
        } finally {
            setProcessingIds(prev => prev.filter(id => id !== donation.id));
        }
    }

    if (loading) {
        return (
            <div className="w-full max-w-7xl mx-auto p-4">
                {/* <h1 className="text-2xl font-bold mb-4 text-right">אישור תרומות</h1> */}
                <div className="py-10 text-center">טוען תרומות...</div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen bg-gray-100" dir="rtl">
            {/* כותרת עליונה */}
            <div className="bg-white border-b p-4 flex justify-between items-center">
                <h1 className="text-xl font-bold">קמפיין: בדיקה</h1>
                <div></div>
            </div>

            {/* אזור הטיימר */}
            

            {/* שלוש עמודות */}
            <div className="flex h-full p-4 gap-4">
                
                {/* עמודת תרומות ממתינות לאישור */}
                <div className="flex flex-col w-1/3">
                    <div className="text-center bg-white border p-3 rounded-t">
                        <div className="font-semibold text-lg mb-1">תרומות ממתינות לאישור</div>
                        <div className="text-sm text-gray-600">
                            ₪ {sumUnapproved.toLocaleString('he-IL')} ע"י {filteredUnapproved.length} תורמים
                        </div>
                        <input
                            value={searchUnapproved}
                            onChange={e => setSearchUnapproved(e.target.value)}
                            placeholder="הקלד שם"
                            className="w-full border px-3 py-1 rounded mt-2"
                        />
                    </div>
                    <div className="bg-white border border-t-0 rounded-b flex-1 overflow-y-auto">
                        {filteredUnapproved.map(donation => (
                            <div key={donation.id} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50">
                                <button
                                    onClick={() => approveDirectly(donation)}
                                    className="px-3 py-1 border rounded text-sm flex items-center hover:bg-blue-50"
                                    disabled={processingIds.includes(donation.id)}
                                >
                                    {processingIds.includes(donation.id) ? (
                                        <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></span>
                                    ) : (
                                        '»'
                                    )}
                                </button>
                                <div className="flex-1 mx-3">
                                    <div className="font-medium text-sm">
                                        {`${donation?.donor?.person?.firstName || ''} ${donation?.donor?.person?.lastName || ''}`}
                                    </div>
                                </div>
                                <div className="text-sm font-semibold">
                                    {Number(donation.monthlyAmount || 0).toLocaleString('he-IL')}
                                </div>
                            </div>
                        ))}
                        {filteredUnapproved.length === 0 && (
                            <div className="p-6 text-center text-gray-500">אין תרומות ממתינות</div>
                        )}
                    </div>
                </div>

                {/* עמודת תרומות בהמתנה */}
                <div className="flex flex-col w-1/3">
                    <div className="text-center bg-white border p-3 rounded-t">
                        <div className="font-semibold text-lg mb-1">תרומות בהמתנה</div>
                        <div className="text-sm text-gray-600">
                            ₪ {sumWaiting.toLocaleString('he-IL')} ע"י {waitingDonations.length} תורמים
                        </div>
                    </div>
                    <div className="bg-white border border-t-0 rounded-b flex-1 overflow-y-auto">
                        {waitingDonations.map(donation => (
                            <div key={donation.id} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50">
                                <div className="px-3 py-1 border rounded text-sm flex items-center">
                                    <span className="w-4 h-4 border-2 border-yellow-300 border-t-yellow-600 rounded-full animate-spin"></span>
                                </div>
                                <div className="flex-1 mx-3">
                                    <div className="font-medium text-sm">
                                        {`${donation?.donor?.person?.firstName || ''} ${donation?.donor?.person?.lastName || ''}`}
                                    </div>
                                </div>
                                <div className="text-sm font-semibold">
                                    {Number(donation.monthlyAmount || 0).toLocaleString('he-IL')}
                                </div>
                            </div>
                        ))}
                        {waitingDonations.length === 0 && (
                            <div className="p-6 text-center text-gray-500">אין תרומות בהמתנה</div>
                        )}
                    </div>
                </div>

                {/* עמודת תרומות מאושרות */}
                <div className="flex flex-col w-1/3">
                    <div className="text-center bg-white border p-3 rounded-t">
                        <div className="font-semibold text-lg mb-1">תרומות מאושרות</div>
                        <div className="text-sm text-gray-600">
                            ₪ {sumApproved.toLocaleString('he-IL')} ע"י {filteredApproved.length} תורמים
                        </div>
                        <input
                            value={searchApproved}
                            onChange={e => setSearchApproved(e.target.value)}
                            placeholder="הקלד שם"
                            className="w-full border px-3 py-1 rounded mt-2"
                        />
                    </div>
                    <div className="bg-white border border-t-0 rounded-b flex-1 overflow-y-auto">
                                                {filteredApproved.map(donation => (
                            <div key={donation.id} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50">
                                <div className="text-sm font-semibold">
                                    {Number(donation.monthlyAmount || 0).toLocaleString('he-IL')}
                                </div>
                                <div className="flex-1 mx-3">
                                    <div className="font-medium text-sm">
                                        {`${donation?.donor?.person?.firstName || ''} ${donation?.donor?.person?.lastName || ''}`}
                                    </div>
                                </div>
                                <button
                                    onClick={() => unapproveIntegrated(donation)}
                                    className="px-3 py-1 border rounded text-sm flex items-center hover:bg-blue-50"
                                    disabled={processingIds.includes(donation.id)}
                                >
                                    {processingIds.includes(donation.id) ? (
                                        <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></span>
                                    ) : (
                                        '«'
                                    )}
                                </button>
                </div>
                        ))}
                        {filteredApproved.length === 0 && (
                            <div className="p-6 text-center text-gray-500">אין תרומות מאושרות</div>
            )}
                    </div>
                </div>
            </div>
        </div>
    );
}


