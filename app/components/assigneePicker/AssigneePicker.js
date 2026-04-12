"use client";
import React, { useState, useEffect, useRef } from 'react';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import './AssigneePicker.scss';

const PersonSvg = () => (
    <svg width="22" height="22" viewBox="0 0 9 10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.79282 5.11C6.05961 4.87907 6.2736 4.59344 6.42026 4.27251C6.56692 3.95158 6.64283 3.60285 6.64282 3.25C6.64282 2.58696 6.37943 1.95107 5.91059 1.48223C5.44175 1.01339 4.80586 0.75 4.14282 0.75C3.47978 0.75 2.8439 1.01339 2.37506 1.48223C1.90621 1.95107 1.64282 2.58696 1.64282 3.25C1.64282 3.60285 1.71872 3.95158 1.86539 4.27251C2.01205 4.59344 2.22603 4.87907 2.49282 5.11C1.79289 5.42694 1.19905 5.93876 0.782312 6.58427C0.36557 7.22978 0.143558 7.98166 0.142822 8.75C0.142822 8.88261 0.195501 9.00979 0.289269 9.10355C0.383037 9.19732 0.510214 9.25 0.642822 9.25C0.775431 9.25 0.902608 9.19732 0.996376 9.10355C1.09014 9.00979 1.14282 8.88261 1.14282 8.75C1.14282 7.95435 1.45889 7.19129 2.0215 6.62868C2.58411 6.06607 3.34717 5.75 4.14282 5.75C4.93847 5.75 5.70153 6.06607 6.26414 6.62868C6.82675 7.19129 7.14282 7.95435 7.14282 8.75C7.14282 8.88261 7.1955 9.00979 7.28927 9.10355C7.38304 9.19732 7.51021 9.25 7.64282 9.25C7.77543 9.25 7.90261 9.19732 7.99638 9.10355C8.09014 9.00979 8.14282 8.88261 8.14282 8.75C8.14209 7.98166 7.92007 7.22978 7.50333 6.58427C7.08659 5.93876 6.49275 5.42694 5.79282 5.11ZM4.14282 4.75C3.84615 4.75 3.55614 4.66203 3.30947 4.4972C3.06279 4.33238 2.87053 4.09811 2.757 3.82403C2.64347 3.54994 2.61377 3.24834 2.67164 2.95736C2.72952 2.66639 2.87238 2.39912 3.08216 2.18934C3.29194 1.97956 3.55922 1.8367 3.85019 1.77882C4.14116 1.72094 4.44276 1.75065 4.71685 1.86418C4.99094 1.97771 5.2252 2.16997 5.39003 2.41664C5.55485 2.66332 5.64282 2.95333 5.64282 3.25C5.64282 3.64782 5.48479 4.02936 5.20348 4.31066C4.92218 4.59196 4.54065 4.75 4.14282 4.75Z" fill="currentColor"/>
    </svg>
);

const AssigneePicker = ({ campaignId, onSelect, selectedName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [members, setMembers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetched, setFetched] = useState(false);
    const wrapperRef = useRef(null);
    const popupRef = useRef(null);
    const searchInputRef = useRef(null);

    // Fetch members when opening for the first time
    useEffect(() => {
        if (isOpen && !fetched && campaignId) {
            setLoading(true);
            fetchWithAuth(`/api/campaigns/${campaignId}/members`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setMembers(data.data || []);
                    }
                    setFetched(true);
                })
                .catch(() => setFetched(true))
                .finally(() => setLoading(false));
        }
    }, [isOpen, fetched, campaignId]);

    // Focus search input when popup opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            requestAnimationFrame(() => {
                searchInputRef.current?.focus();
            });
        }
    }, [isOpen]);

    // Click outside close
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (wrapperRef.current && wrapperRef.current.contains(e.target)) return;
            setIsOpen(false);
        };
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handler, true);
        }, 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handler, true);
        };
    }, [isOpen]);

    const handleToggle = () => {
        setIsOpen(prev => !prev);
    };

    const handleSelect = (member) => {
        onSelect?.({
            userId: member.userId,
            name: member.name
        });
        setIsOpen(false);
        setSearch('');
    };

    const filtered = members.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.roleLabel.includes(search)
    );

    const isRtl = typeof document !== 'undefined' && (document.documentElement.dir === 'rtl' || document.body.dir === 'rtl');

    return (
        <div className="assignee-picker-wrapper" ref={wrapperRef}>
            <button
                type="button"
                className="assignee-icon-btn"
                onClick={handleToggle}
                title="שייך למישהו"
            >
                <PersonSvg />
            </button>
            {selectedName && (
                <span className="assignee-selected-label">{selectedName}</span>
            )}
            {isOpen && (
                <div
                    className="assignee-popup"
                    ref={popupRef}
                    style={isRtl ? { left: 0, right: 'auto' } : { right: 0, left: 'auto' }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="assignee-search">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="חיפוש..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            dir="rtl"
                        />
                    </div>
                    <div className="assignee-list">
                        {loading && <div className="assignee-loading">טוען...</div>}
                        {!loading && filtered.length === 0 && (
                            <div className="assignee-empty">לא נמצאו תוצאות</div>
                        )}
                        {!loading && filtered.map((member, idx) => (
                            <div
                                key={idx}
                                className="assignee-item"
                                onClick={() => handleSelect(member)}
                            >
                                <span className="assignee-name">{member.name}</span>
                                <span className="assignee-role">{member.roleLabel}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssigneePicker;
