"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import XIcon from "@/app/icons/exitMini.svg";
import SearchIcon from "@/app/icons/search.svg";
import DoNextLoader from '@/app/components/DoNextLoader';

/**
 * AddFromContactsModal
 * 
 * Opens from campaign donor/fundraiser pages. Lets user search the centralized contacts
 * (people table) and select contacts to add to the current campaign with a given role.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - onSuccess: (result) => void — called after successful add
 *  - campaignId: number — current campaign id
 *  - role: 'donor' | 'fundraiser' | 'operator'
 */
export default function AddFromContactsModal({ isOpen, onClose, onSuccess, campaignId, role = 'donor' }) {
  const t = useTranslations('addFromContacts');
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  // Search contacts on input change (debounced)
  const doSearch = useCallback(async (term) => {
    if (!term || term.length < 2) {
      setContacts([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/people/search?q=${encodeURIComponent(term)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data || []);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, doSearch]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setContacts([]);
      setSelectedIds(new Set());
      setError('');
    }
  }, [isOpen]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map(c => c.id)));
    }
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/people/add-to-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-campaign-id': String(campaignId),
        },
        body: JSON.stringify({
          personIds: [...selectedIds],
          campaignId,
          role,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        onSuccess?.(result);
      } else {
        const data = await res.json();
        setError(data.error || t('addError'));
      }
    } catch (err) {
      console.error('Error adding contacts:', err);
      setError(t('addError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const roleLabelKey = role === 'donor' ? 'asDonor' : role === 'fundraiser' ? 'asFundraiser' : 'asOperator';

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: '16px' }}>{t('title')}</h2>
          <button onClick={onClose} style={closeBtnStyle}><XIcon /></button>
        </div>

        {/* Search bar */}
        <div style={searchBarStyle}>
          <SearchIcon style={{ width: 16, height: 16, opacity: 0.4, flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            style={searchInputStyle}
            autoFocus
          />
        </div>

        <div style={{ padding: '0 16px', fontSize: '13px', color: '#888', marginBottom: '4px' }}>
          {t('addingAs')} <strong>{t(roleLabelKey)}</strong>
          {selectedIds.size > 0 && <span> — {t('selected', { count: selectedIds.size })}</span>}
        </div>

        {/* Contact list */}
        <div style={listContainerStyle}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}><DoNextLoader /></div>
          ) : contacts.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>
              {search.length < 2 ? t('typeToSearch') : t('noResults')}
            </div>
          ) : (
            <>
              {/* Select all row */}
              <div style={rowStyle} onClick={selectAll}>
                <input
                  type="checkbox"
                  checked={contacts.length > 0 && selectedIds.size === contacts.length}
                  readOnly
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#666' }}>
                  {t('selectAll')} ({contacts.length})
                </span>
              </div>
              {contacts.map(contact => (
                <div key={contact.id} style={{ ...rowStyle, backgroundColor: selectedIds.has(contact.id) ? '#edf5fd' : 'white' }} onClick={() => toggleSelect(contact.id)}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(contact.id)}
                    readOnly
                    style={{ cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>
                      {`${contact.lastName || ''} ${contact.firstName || ''}`.trim()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[contact.mainMobile, contact.email, contact.city].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {/* Footer */}
        <div style={footerStyle}>
          <button style={cancelBtnStyle} onClick={onClose} disabled={submitting}>{t('cancel')}</button>
          <button style={confirmBtnStyle} onClick={handleSubmit} disabled={submitting || selectedIds.size === 0}>
            {submitting ? t('adding') : t('addButton', { count: selectedIds.size })}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Inline styles ─── */
const overlayStyle = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
};
const modalStyle = {
  background: '#fff', borderRadius: '16px', width: '500px', maxHeight: '80vh',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
};
const headerStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 20px', borderBottom: '1px solid #e4e4e4',
};
const closeBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', padding: '4px' };
const searchBarStyle = {
  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
  margin: '12px 16px', border: '1px solid #d0e2fb', borderRadius: '8px', background: '#f8fafc',
};
const searchInputStyle = {
  flex: 1, border: 'none', outline: 'none', fontSize: '14px', background: 'transparent',
  fontFamily: 'inherit',
};
const listContainerStyle = {
  flex: 1, overflowY: 'auto', borderTop: '1px solid #f0f0f0',
  borderBottom: '1px solid #f0f0f0', maxHeight: '400px',
};
const rowStyle = {
  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px',
  cursor: 'pointer', borderBottom: '1px solid #f5f5f5', transition: 'background 0.15s',
};
const errorStyle = {
  padding: '8px 16px', color: '#d32f2f', fontSize: '13px',
};
const footerStyle = {
  display: 'flex', justifyContent: 'flex-end', gap: '12px',
  padding: '12px 20px', borderTop: '1px solid #eee',
};
const cancelBtnStyle = {
  padding: '8px 16px', background: '#fff', border: '1px solid #d0e2fb',
  borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit',
};
const confirmBtnStyle = {
  padding: '8px 20px', background: '#0C4AD5', border: 'none', borderRadius: '8px',
  color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500, fontFamily: 'inherit',
};
