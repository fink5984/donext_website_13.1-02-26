"use client"

import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useAppContext } from '@/app/components/AppContext';
import DonationsTable from './components/DonationsTable';
import DonationsHeader from './components/DonationsHeader';
import DonationsFilters from './components/DonationsFilters';
import Pagination from '../Pagination/Pagination.js';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DonationForm from '@/components/DonationForm/DonationForm';
import styles from './donations.module.scss';
import Button from '@/app/components/Button';
import NewDoant from "@/app/icons/newDonat.svg";
import { DonationSummaryCards } from './components/DonationSummaryCards';
import { usePageTitle } from '@/app/hooks/usePageTitle';
import { useTranslations } from 'next-intl';

const DonationsPage = observer(() => {
    const t = useTranslations('donations');
    usePageTitle(t('pageTitle'));
    const { campaignId, stores, donationsStore } = useAppContext();
    const [isDonationFormOpen, setIsDonationFormOpen] = useState(false);
    const [firstLoad, setFirstLoad] = useState(true);
    const [activeTab, setActiveTab] = useState('donations');

    React.useEffect(() => {
        if (campaignId) {
            setFirstLoad(true);
            donationsStore.loadDonations(campaignId);
            donationsStore.loadSummary(campaignId);
        }
    }, [donationsStore, campaignId]);

    // Pusher לעדכון מיידי כשיש תרומה חדשה
    React.useEffect(() => {
        console.log('🔵 Pusher effect running, campaignId:', campaignId);
        if (!campaignId) return;

        let pusherClient = null;
        let channel = null;
        let mounted = true;

        async function setupPusher() {
            try {
                const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
                console.log('🔑 Pusher key:', key ? 'Found' : 'Not found');
                if (!key || !mounted) {
                    console.log('❌ Pusher not configured or component unmounted');
                    return;
                }
                
                console.log('✅ Setting up Pusher connection...');

                const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu';
                const PusherLib = (await import('pusher-js')).default;
                
                if (!mounted) return;
                
                console.log('📦 Pusher library loaded, creating client with cluster:', cluster);
                
                pusherClient = new PusherLib(key, {
                    cluster,
                    enabledTransports: ['ws', 'wss']
                });

                console.log('🔌 Pusher client created');
                
                pusherClient.connection.bind('connected', () => {
                    if (mounted) console.log('✅ Pusher connected successfully!');
                });
                
                pusherClient.connection.bind('error', (err) => {
                    if (mounted) console.error('❌ Pusher connection error:', err);
                });

                const channelName = `campaign.${campaignId}`;
                console.log('📡 Subscribing to channel:', channelName);
                channel = pusherClient.subscribe(channelName);

                channel.bind('donation-updated', (event) => {
                    if (mounted) {
                        console.log('🎉 Donation updated via Pusher:', event);
                        // רענון שקט ברקע
                        donationsStore.invalidateCacheAndRefresh(campaignId);
                    }
                });
            } catch (err) {
                if (mounted) console.error('Failed to setup Pusher:', err);
            }
        }

        setupPusher();

        return () => {
            mounted = false;
            console.log('🔴 Cleaning up Pusher connection...');
            if (channel) {
                channel.unbind('donation-updated');
            }
            if (pusherClient) {
                pusherClient.unsubscribe(`campaign.${campaignId}`);
                pusherClient.disconnect();
            }
        };
    }, [campaignId, donationsStore]);

    React.useEffect(() => {
        if (campaignId && !donationsStore.loading && !donationsStore.loadingSummary) {
            setFirstLoad(false);
        }
    }, [campaignId, donationsStore.loading, donationsStore.loadingSummary]);

    // Memoized handlers לשיפור ביצועים
    const scrollToTop = React.useCallback(() => {
        setTimeout(() => {
            const scrollableElements = document.querySelectorAll('*');
            scrollableElements.forEach(element => {
                if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) {
                    element.scrollTop = 0;
                    element.scrollLeft = 0;
                }
            });
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;
        }, 50);
    }, []);

    const handlePageChange = React.useCallback((newPage) => {
        donationsStore.setPage(newPage, campaignId);
        scrollToTop();
    }, [donationsStore, campaignId, scrollToTop]);

    const handleCommitmentPageChange = React.useCallback((page) => {
        donationsStore.setCommitmentPage(page);
        scrollToTop();
    }, [donationsStore, scrollToTop]);

    const handleRowsInPageChange = React.useCallback((value) => {
        donationsStore.setPageSize(parseInt(value), campaignId);
    }, [donationsStore, campaignId]);

    const handleOpenDonationForm = React.useCallback(() => {
        setIsDonationFormOpen(true);
    }, []);

    const handleCloseDonationForm = React.useCallback(() => {
        setIsDonationFormOpen(false);
    }, []);

    return (
        <>
            <div className={styles.pageContainer}>
                {firstLoad ? (
                    <div className={styles.loadingText}>{t('loading')}</div>
                ) : (
                    <div className={styles.cardsTableWrapper}>
                        <DonationSummaryCards />
                        <div className={styles.wrapper}>
                            <div className={styles.donors}>
                                <DonationsTable activeTab={activeTab} onTabChange={setActiveTab} />
                            {donationsStore.donations && donationsStore.donations.length > 0 ?(
                                <div className={styles.tableBottom}>
                                    <div className={styles.rowsInPage}>
                                        <span className={`table-3 ${styles.rowsInPageTitle}`}>{t('rowsInTable')}</span>
                                        <div className={`${styles.selectWrapper} small-button-1`}>
                                            <Select value={donationsStore.pageSize.toString()} onValueChange={handleRowsInPageChange}>
                                                <SelectTrigger className="selectPagesTrigger">
                                                    <SelectValue className="small-button-1">{donationsStore.pageSize}</SelectValue>
                                                </SelectTrigger>
                                                <SelectContent className="selectPagesContent">
                                                    <SelectGroup className="small-button-1 selectPagesGroup">
                                                        <SelectItem className="amount" value="10">10</SelectItem>
                                                        <SelectItem className="amount" value="15">15</SelectItem>
                                                        <SelectItem className="amount" value="20">20</SelectItem>
                                                        <SelectItem className="amount" value="25">25</SelectItem>
                                                        <SelectItem className="amount" value="50">50</SelectItem>
                                                        <SelectItem className="amount" value="100">100</SelectItem>
                                                        <SelectItem className="amount" value="200">200</SelectItem>
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <Button
                                        text={t('addNewDonation')}
                                        onClick={handleOpenDonationForm}
                                        className={styles.absoluteButton}
                                        primary
                                        icon={<NewDoant />}
                                    />
                                    <div className={styles.pagination}>
                                        {activeTab === 'commitments' ? (
                                            <Pagination
                                                currentPage={donationsStore.commitmentCurrentPage}
                                                totalPages={donationsStore.commitmentTotalPages}
                                                onPageChange={handleCommitmentPageChange}
                                            />
                                        ) : (
                                            <Pagination
                                                currentPage={donationsStore.currentPage}
                                                totalPages={donationsStore.totalPages}
                                                onPageChange={handlePageChange}
                                            />
                                        )}
                                    </div>
                                </div>
                            ):<div style={{height: '32px'}}></div>}
                        </div>
                    </div>
                    </div>
                )}
            </div>

            <DonationForm
                donor={null}
                donation={null}
                isOpen={isDonationFormOpen}
                onClose={handleCloseDonationForm}
                onSuccess={() => {
                    handleCloseDonationForm();
                    // הסטור כבר מתעדכן אוטומטית דרך addDonationToStore
                }}
            />
        </>
    );
});

export default DonationsPage; 