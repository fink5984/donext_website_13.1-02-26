'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

function formatCurrency(value) {
	if (value === null || value === undefined) return '';
	try {
		return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(Number(value));
	} catch (_) {
		return String(value);
	}
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');

function normalizeUrl(url) {
	if (!url) return '';
	// allow absolute and safe schemes as-is
	if (
		url.startsWith('http://') ||
		url.startsWith('https://') ||
		url.startsWith('data:') ||
		url.startsWith('blob:')
	) return url;
	// keep root-relative paths on same origin to avoid mixed content/wrong host
	if (url.startsWith('/')) return url;
	// ensure leading slash for plain relative paths like "uploads/..."
	return `/${url}`;
}

function getRankColor(amount, ranks) {
	if (!amount || amount <= 0) return 'rgba(255,255,255,0.95)';
	try {
		if (Array.isArray(ranks) && ranks.length > 0) {
			// מיון הדרגות מהנמוכה לגבוהה
			const sortedRanks = [...ranks].sort((a, b) => Number(a.amount) - Number(b.amount));
			
			// מציאת הדרגה המתאימה לפי סכום
			let found = null;
			for (let i = 0; i < sortedRanks.length; i++) {
				const rankAmount = Number(sortedRanks[i].amount);
				if (i === sortedRanks.length - 1) {
					// הדרגה האחרונה (הגבוהה ביותר) - כל מה שגדול או שווה
					if (amount >= rankAmount) {
						found = sortedRanks[i];
					}
				} else {
					// דרגות אמצעיות - בטווח בין דרגה נוכחית לבאה
					const nextRankAmount = Number(sortedRanks[i + 1].amount);
					if (amount >= rankAmount && amount < nextRankAmount) {
						found = sortedRanks[i];
						break;
					}
				}
			}
			
			if (found) {
				// If rank has an image, use it
				if (found.image) {
					return `url('/api/${found.image}')`;
				}
				// If rank has gradient colors, use them
				if (found.colorLeft && found.colorRight) {
					return `linear-gradient(239deg, ${found.colorRight} 0%, ${found.colorLeft} 100%)`;
				}
				// If rank has single color
				const color = found.colorLeft || found.colorRight;
				if (typeof color === 'string') return color;
			}
		}
	} catch (_) {}
	// fallback to default gradient like in MONEY
	return 'linear-gradient(239deg, #d9c38f 0%, #f4edd6 100%)';
}

export default function DonationScreenPage() {
	const params = useParams();
	const campaignId = params?.id;
	const [settings, setSettings] = useState(null);
	const settingsRef = useRef(null);
	const [donors, setDonors] = useState([]);
	const donorsRef = useRef([]);
	const [summary, setSummary] = useState(null);
	const [loading, setLoading] = useState(true);
	const [campaign, setCampaign] = useState(null);
	const [ranks, setRanks] = useState([]);
	// Big-screen overlay state and queue
	const [fullScreenVisible, setFullScreenVisible] = useState(false);
	const [fullScreenDonor, setFullScreenDonor] = useState(null);
	const displayQueueRef = useRef([]);
	const isProcessingRef = useRef(false);
	const prevDonorsRef = useRef(new Map());
	const [overlayStage, setOverlayStage] = useState('hidden'); // 'hidden' | 'in' | 'out'

	// Animated totals
	const [animatedCollected, setAnimatedCollected] = useState(0);
	const [animatedRemaining, setAnimatedRemaining] = useState(0);
	const animRef = useRef(null);
	const animRemainRef = useRef(null);
	const pusherRef = useRef(null);
	const channelRef = useRef(null);

	useEffect(() => {
		let isMounted = true;
		async function load() {
			try {
				const [sRes, dRes, sumRes, cRes, rRes] = await Promise.all([
					fetch(`/api/campaigns/${campaignId}/screen-settings`, { cache: 'no-store' }),
					fetch(`/api/fundraising/donors?campaignId=${campaignId}&includeInactive=true&limit=1000`, { cache: 'no-store' }),
					fetch(`/api/fundraising/donors/summary?campaignId=${campaignId}`, { cache: 'no-store' }),
					fetch(`/api/campaigns/${campaignId}`, { cache: 'no-store' }),
					fetch(`/api/ranks?campaignId=${campaignId}`, { cache: 'no-store' })
				]);
				const sJson = await sRes?.json?.();
				const dJson = await dRes?.json?.();
				const sumJson = await sumRes?.json?.();
				const cJson = cRes?.ok ? await cRes.json() : null;
				const rJson = rRes?.ok ? await rRes.json() : null;
				if (!isMounted) return;
				setSettings(sJson || {});
				setDonors(Array.isArray(dJson?.data) ? dJson.data : []);
				setSummary(sumJson || null);
				setCampaign(cJson);
				setRanks(rJson?.data || []);
			} catch (_) {
				if (!isMounted) return;
				setSettings({});
				setDonors([]);
				setSummary(null);
			} finally {
				if (isMounted) setLoading(false);
			}
		}
		if (campaignId) load();
		else setLoading(false);
		return () => { isMounted = false; };
	}, [campaignId]);

	// Safety: ensure loading doesn't persist indefinitely if requests hang
	useEffect(() => {
		if (!loading) return;
		const id = setTimeout(() => setLoading(false), 4000);
		return () => clearTimeout(id);
	}, [loading]);

	// Keep refs in sync with latest state so realtime handlers always see fresh values
	useEffect(() => { settingsRef.current = settings; amountBigScreenRef.current = settings?.amountBigScreen || null; }, [settings]);
	useEffect(() => { donorsRef.current = donors; }, [donors]);

	// Fallback: poll settings periodically to ensure UI updates even if realtime events are missed
	useEffect(() => {
		if (!campaignId) return;
		let cancelled = false;
		async function pollSettings() {
			try {
				const res = await fetch(`/api/campaigns/${campaignId}/screen-settings`);
				if (!res.ok) return;
				const next = await res.json();
				if (cancelled) return;
				setSettings(prev => {
					try {
						const a = JSON.stringify(prev || {});
						const b = JSON.stringify(next || {});
						if (a === b) return prev;
					} catch (_) {}
					return { ...(prev || {}), ...(next || {}) };
				});
			} catch (_) {}
		}
		const id = setInterval(pollSettings, 5000);
		pollSettings();
		return () => { cancelled = true; clearInterval(id); };
	}, [campaignId]);

	const totalAmount = useMemo(() => {
		// sum only approved amounts as provided by backend mapping
		return donors.reduce((acc, d) => acc + Number(d.amount || d.actualDonation || 0), 0);
	}, [donors]);

	// Animate collected number when total changes
	useEffect(() => {
		const from = Number(animatedCollected || 0);
		const to = Number(totalAmount || 0);
		if (from === to) return;
		if (animRef.current) cancelAnimationFrame(animRef.current);
		const duration = 500; // ms
		const start = performance.now();
		const step = (t) => {
			const p = Math.min(1, (t - start) / duration);
			const eased = 1 - Math.pow(1 - p, 3);
			setAnimatedCollected(from + (to - from) * eased);
			if (p < 1) animRef.current = requestAnimationFrame(step);
		};
		animRef.current = requestAnimationFrame(step);
		return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
	}, [totalAmount]);

	// Animate remaining number when total or target changes
	useEffect(() => {
		const targetAmount = Number(campaign?.targetAmount ?? campaign?.target_amount ?? settings?.goal ?? 0);
		const from = Number(animatedRemaining || 0);
		const to = Math.max(0, targetAmount - Math.round(animatedCollected));
		if (from === to) return;
		if (animRemainRef.current) cancelAnimationFrame(animRemainRef.current);
		const duration = 800; // ms
		const start = performance.now();
		const step = (t) => {
			const p = Math.min(1, (t - start) / duration);
			const eased = 1 - Math.pow(1 - p, 3);
			setAnimatedRemaining(from + (to - from) * eased);
			if (p < 1) animRemainRef.current = requestAnimationFrame(step);
		};
		animRemainRef.current = requestAnimationFrame(step);
		return () => { if (animRemainRef.current) cancelAnimationFrame(animRemainRef.current); };
	}, [animatedCollected, campaign?.targetAmount, campaign?.target_amount, settings?.campaign?.targetAmount, settings?.campaign?.target_amount, settings?.goal]);

	// Grid sizing from settings
	const cubeWidth = settings?.cubeWidth || 220;
	const cubeHeight = settings?.cubeHeight || 120;
	const cubePadding = settings?.cubePadding || 12;
	const borderRadius = settings?.borderRadius || 12;
	const showAmount = settings?.showAmount !== false; // default true
	const displayRank = settings?.displayRank || false; // rank label if exists

	const frontBoxTextColor = settings?.frontBoxTextColor || '#111827';
	const nameFontSize = settings?.fontSizeNameFront || 18;
	const amountFontSize = settings?.fontSizeAmountBack || 18;

	const bgScreen = normalizeUrl(settings?.bgScreen || '');
	const bgBigDonations = normalizeUrl(settings?.bgBigDonations || '');
	const amountBigScreen = settings?.amountBigScreen || null;
	const amountBigScreenRef = useRef(amountBigScreen || 0);
	const topTitlesColor = settings?.topPartBottomTitlesColor || '#ffffff';

	function wait(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	function addToDisplayQueue(donor) {
		if (!donor) return;
		const cloned = JSON.parse(JSON.stringify(donor));
		displayQueueRef.current.push(cloned);
		processDisplayQueue();
	}

	async function processDisplayQueue() {
		if (isProcessingRef.current) return;
		isProcessingRef.current = true;
		try {
			while (displayQueueRef.current.length > 0) {
				const nextDonation = displayQueueRef.current.shift();
				setFullScreenDonor(nextDonation);
				setFullScreenVisible(true);
				setOverlayStage('in');
				await wait(Number(settings?.bigScreenDuration || 6000)); // display duration
				setOverlayStage('out');
				await wait(500); // exit animation buffer
				setFullScreenVisible(false);
				setOverlayStage('hidden');
			}
		} finally {
			isProcessingRef.current = false;
		}
	}

	// Header logo settings
	const headerLogoUrl = settings?.bsLogoUrl || campaign?.logo || '';
	const showHeaderLogos = Boolean(headerLogoUrl);
	const logoHeight = settings?.bsLogoHeight || 100;

	useEffect(() => {
		if (bgScreen) {
			try {
				const img = new Image();
				img.onload = () => console.log('bgScreen loaded successfully');
				img.onerror = (e) => console.log('bgScreen failed to load', e);
				img.src = bgScreen;
			} catch (e) {
				console.log('bgScreen log error', e);
			}
		}
	}, [bgScreen]);

	useEffect(() => {
		console.log('Logo debug:', {
			'settings.bsLogoUrl': settings?.bsLogoUrl,
			'campaign.logo': campaign?.logo,
			'headerLogoUrl': headerLogoUrl,
			'showHeaderLogos': showHeaderLogos
		});
	}, [settings, campaign, headerLogoUrl, showHeaderLogos]);

	// Poll for new/updated approved donations over threshold and enqueue for big-screen display
	useEffect(() => {
		if (!campaignId) return;
		let cancelled = false;
		async function poll() {
			try {
				const currentThreshold = Number(amountBigScreenRef.current || 0);
				if (!currentThreshold) return; // skip if no threshold
				const res = await fetch(`/api/fundraising/donors?campaignId=${campaignId}&includeInactive=true&limit=1000`);
				const data = res.ok ? await res.json() : { data: [] };
				const list = Array.isArray(data?.data) ? data.data : [];
				const nextMap = new Map();
				for (const d of list) {
					const amountValue = Number(d.amount ?? d.actualDonation ?? d.monthly_amount ?? 0);
					nextMap.set(d.id, { amountValue });
					const prev = prevDonorsRef.current.get(d.id);
					const crossed = amountValue >= currentThreshold;
					const changed = !prev || prev.amountValue !== amountValue;
					if (crossed && changed) {
						const existingDonor = donorsRef.current.find(existing => existing.id === d.id);
						const isNewApproval = !existingDonor || 
							Boolean(existingDonor?.donation_approved ?? existingDonor?.donationApproved ?? existingDonor?.approved) !== Boolean(d.donation_approved ?? d.donationApproved ?? d.approved) ||
							Number(existingDonor?.amount ?? existingDonor?.actualDonation ?? 0) !== amountValue;
						if (isNewApproval) {
							addToDisplayQueue(d);
						}
					}
				}
				prevDonorsRef.current = nextMap;
				if (!cancelled) setDonors(list);
			} catch (_) {}
		}
		const id = setInterval(poll, 5000);
		poll();
		return () => { cancelled = true; clearInterval(id); };
	}, [campaignId]);

	// Realtime via Pusher (same channel/event naming as MONEY). Falls back to polling if not configured.
	useEffect(() => {
		async function setupPusher() {
			try {
				const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
				if (!campaignId || !key) return; // not configured
				const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu';
				const wsHost = process.env.NEXT_PUBLIC_PUSHER_HOST || undefined;
				const wsPort = Number(process.env.NEXT_PUBLIC_PUSHER_PORT || 6001);
				const forceTLS = String(process.env.NEXT_PUBLIC_PUSHER_TLS || 'false') === 'true';
				if (pusherRef.current) return; // already connected
				const PusherLib = (await import('pusher-js')).default;
				pusherRef.current = new PusherLib(key, {
					cluster,
					wsHost,
					wsPort,
					forceTLS,
					enabledTransports: ['ws', 'wss']
				});
				const channelName = `donation-screen.${campaignId}`;
				channelRef.current = pusherRef.current.subscribe(channelName);
				const onDonation = (e) => {
					try {
						const d = e?.donor || e || {};
						const skip = e?.skip?.skip === true; // mirror MONEY skip flag
						const amountValue = Number(d.amount ?? d.actualDonation ?? d.monthly_amount ?? d.total_amount ?? 0);
						const approved = Boolean(d.donation_approved ?? d.donationApproved ?? d.approved);
						const currentSettings = settingsRef.current || {};
						const supervisorOk = (currentSettings?.supervisorApproval ? Boolean(d.supervisor_approval ?? d.supervisorApproval) : true);
						const presenceOk = (currentSettings?.byPresence ? String(d.presence_id ?? d.presenceId ?? '') === '1' : true);
						const threshold = Number(amountBigScreenRef.current || 0);
						const crossed = threshold ? amountValue >= threshold : false;
						
						if (!skip && crossed && approved && supervisorOk && presenceOk) {
							// Check if this is a new/changed donation (like in MONEY)
							const existingDonorIndex = donorsRef.current.findIndex(existing => existing.id === d.id);
							const shouldDisplay = existingDonorIndex === -1 || // New donor
								Number(donorsRef.current[existingDonorIndex]?.amount ?? donorsRef.current[existingDonorIndex]?.actualDonation ?? 0) !== amountValue || // Amount changed
								Boolean(donorsRef.current[existingDonorIndex]?.donation_approved ?? donorsRef.current[existingDonorIndex]?.donationApproved ?? donorsRef.current[existingDonorIndex]?.approved) !== approved; // Approval status changed
							
							if (shouldDisplay) {
								addToDisplayQueue(d);
							}
						}
					} catch (_) {}
				};
				const onSettingsUpdated = (e) => {
					try {
						const next = e?.settings || e || {};
						setSettings(prev => ({ ...(prev || {}), ...(next || {}) }));
					} catch (_) {}
				};
				channelRef.current.bind('DonationScreen', onDonation);
				channelRef.current.bind('ScreenSettingsUpdated', onSettingsUpdated);
				return () => {
					try {
						if (channelRef.current) {
							channelRef.current.unbind('DonationScreen', onDonation);
							channelRef.current.unbind('ScreenSettingsUpdated', onSettingsUpdated);
							pusherRef.current?.unsubscribe(channelName);
							channelRef.current = null;
						}
						if (pusherRef.current) {
							pusherRef.current.disconnect();
							pusherRef.current = null;
						}
					} catch (_) {}
				};
			} catch (err) {
				console.log('Pusher setup skipped:', err?.message || err);
				return undefined;
			}
		}
		let cleanup;
		setupPusher().then(fn => { cleanup = fn; });
		return () => { if (typeof cleanup === 'function') cleanup(); };
	}, [campaignId]);

	if (loading) {
		return (
			<div className="w-full h-screen flex items-center justify-center text-xl">טוען מסך תרמה...</div>
		);
	}

	// compute totals/progress
	const targetAmount = Number(
		campaign?.targetAmount ??
		campaign?.target_amount ??
		settings?.campaign?.targetAmount ??
		settings?.campaign?.target_amount ??
		settings?.goal ??
		0
	);
	const collected = Number(totalAmount || 0);
	const animatedCollectedSafe = Math.max(0, Math.round(animatedCollected));
	const animatedRemainingSafe = Math.max(0, Math.round(animatedRemaining));
	const progressPct = targetAmount > 0 ? Math.min(100, Math.floor((animatedCollectedSafe / targetAmount) * 100)) : 0;
	const participants = donors.reduce((acc, d) => acc + (Number(d.amount ?? d.actualDonation ?? d.monthly_amount ?? 0) > 0 ? 1 : 0), 0);

		// Header row with collected / progress / remaining
	const HeaderRow = (
		<div className="w-full px-3 md:px-6 py-6">
			<div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
				{/* Logo on the left */}
				{showHeaderLogos && (
					<div style={{ flex: '0 0 auto' }}>
						<img src={headerLogoUrl} alt="logo" style={{ height: logoHeight, objectFit: 'contain' }} />
					</div>
				)}
				
				{/* Center section with cards and progress */}
				<div style={{ display: 'flex', gap: 24, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
					{/* Right card - collected */}
					<div style={{ 
						background: '#f6ead2', 
						borderRadius: 24, 
						padding: '20px 30px',
						minWidth: 280,
						position: 'relative',
						overflow: 'hidden'
					}}>
						<div style={{ 
							position: 'absolute', 
							top: 0, 
							right: 20, 
							background: '#c6a771',
							padding: '4px 16px',
							borderRadius: '0 0 12px 12px',
							fontSize: 14,
							fontWeight: 700,
							color: '#1f2937'
						}}>סה"כ התרומות שנאספו</div>
						<div style={{ 
							color: '#1f2937', 
							fontSize: 48, 
							fontWeight: 900,
							textAlign: 'center',
							marginTop: 20,
							marginBottom: 10
						}}>{formatCurrency(animatedCollectedSafe)}</div>
						<button style={{
							width: '100%',
							background: '#0b3b3c',
							color: 'white',
							padding: '12px 24px',
							borderRadius: 16,
							border: 'none',
							fontSize: 16,
							fontWeight: 600,
							cursor: 'pointer'
						}}>על ידי {participants} משתתפים</button>
					</div>
					
					{/* Center - Progress bar */}
					<div style={{ 
						flex: '1 1 auto',
						minWidth: 300,
						maxWidth: 800,
						position: 'relative'
					}}>
						<div style={{
							height: 80,
							background: '#c6a771',
							borderRadius: 40,
							position: 'relative',
							overflow: 'hidden',
							boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.1)'
						}}>
							{/* Inner progress track */}
							<div style={{
								position: 'absolute',
								top: 10,
								bottom: 10,
								left: 10,
								right: 10,
								background: '#0b3b3c',
								borderRadius: 30,
								overflow: 'hidden'
							}}>
								{/* Progress fill */}
								<div style={{
									position: 'absolute',
									top: 0,
									bottom: 0,
									left: 0,
									width: `${progressPct}%`,
									background: 'linear-gradient(90deg, #f6ead2, #e8d4a8)',
									transition: 'width 0.5s ease'
								}} />
							</div>
							{/* Percentage text */}
							<div style={{
								position: 'absolute',
								right: 30,
								top: '50%',
								transform: 'translateY(-50%)',
								color: 'white',
								fontSize: 36,
								fontWeight: 900
							}}>{progressPct}%</div>
						</div>
					</div>
					
					{/* Left card - remaining */}
					<div style={{ 
						background: '#f6ead2', 
						borderRadius: 24, 
						padding: '20px 30px',
						minWidth: 280,
						position: 'relative',
						overflow: 'hidden'
					}}>
						<div style={{ 
							position: 'absolute', 
							top: 0, 
							right: 20, 
							background: '#c6a771',
							padding: '4px 16px',
							borderRadius: '0 0 12px 12px',
							fontSize: 14,
							fontWeight: 700,
							color: '#1f2937'
						}}>נשארו עוד</div>
						<div style={{ 
							color: '#1f2937', 
							fontSize: 48, 
							fontWeight: 900,
							textAlign: 'center',
							marginTop: 20,
							marginBottom: 10
						}}>{formatCurrency(animatedRemainingSafe)}</div>
						<div style={{
							width: '100%',
							background: '#0b3b3c',
							color: 'white',
							padding: '12px 24px',
							borderRadius: 16,
							border: 'none',
							fontSize: 16,
							fontWeight: 600,
							textAlign: 'center'
						}}>עד היעד {formatCurrency(targetAmount)}</div>
					</div>
				</div>

				{/* Logo on the right */}
				{showHeaderLogos && (
					<div style={{ flex: '0 0 auto' }}>
						<img src={headerLogoUrl} alt="logo" style={{ height: logoHeight, objectFit: 'contain' }} />
					</div>
				)}
			</div>
		</div>
	);

	return (
		<div
			className="w-full overflow-hidden"
			style={{
				backgroundImage: bgScreen ? `url("${bgScreen}")` : undefined,
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				backgroundRepeat: 'no-repeat',
				height: '100vh',
				border: '15px solid #614f37',
				boxSizing: 'border-box',
			}}
		>
			{/* Top part */}
			{/* {settings?.displayTopPart !== false && (
				<div className="w-full py-6 md:py-10 bg-black/30">
					<div className="max-w-7xl mx-auto px-4">
						{settings?.textOverTotal && (
							<div className="text-center text-2xl md:text-3xl mb-2" style={{ color: topTitlesColor }}>{settings.textOverTotal}</div>
						)}
						<div className="text-center text-white text-5xl md:text-7xl font-extrabold drop-shadow">
							{formatCurrency(totalAmount)}
						</div>
						{settings?.textUnderTotal && (
							<div className="text-center text-xl md:text-2xl mt-2" style={{ color: topTitlesColor }}>{settings.textUnderTotal}</div>
						)}
					</div>
				</div>
			)} */}

			{/* Video (optional) */}
			{settings?.videoUrl && (
				<div className="max-w-5xl mx-auto mt-6 px-4">
					{settings?.videoText && (
						<div className="text-center text-white mb-2" style={{ fontSize: settings?.videoTextFontSize ? `${settings.videoTextFontSize}px` : undefined }}>
							{settings.videoText}
						</div>
					)}
					<video
						controls
						loop={Boolean(settings?.videoRepeat)}
						className="w-full rounded-lg shadow-lg"
						src={settings.videoUrl}
					/>
				</div>
			)}

			{/* Timer texts (static rendering as in Money header) */}
			{(settings?.topTimerText || settings?.bottomTimerText) && (
				<div className="max-w-7xl mx-auto mt-6 px-4">
					{settings?.topTimerText && (
						<div className="text-center text-white text-lg md:text-xl">{settings.topTimerText}</div>
					)}
					{settings?.bottomTimerText && (
						<div className="text-center text-white text-base md:text-lg opacity-90">{settings.bottomTimerText}</div>
					)}
				</div>
			)}

			{/* Header totals and progress */}
			{HeaderRow}

			{/* Donors grid - auto scroll inside remaining viewport */}
			<div className="w-full px-3 md:px-6 py-4" style={{ height: `calc(100vh - 260px)` }}>
				<div id="donors-scroll" style={{ height: '100%', overflow: 'hidden' }}>
					<div
						style={{
							display: 'grid',
							gridAutoRows: `${cubeHeight}px`,
							gridTemplateColumns: `repeat(auto-fill, minmax(${cubeWidth}px, 1fr))`,
							gap: `${cubePadding}px`,
							animation: 'scrollY 60s linear infinite'
						}}
					>
						{donors.map((d) => {
							const fullName = [d.first_name || d.firstName, d.last_name || d.lastName].filter(Boolean).join(' ');
							const amountValue = Number(d.amount ?? d.actualDonation ?? d.monthly_amount ?? 0);
							const hasDonated = amountValue > 0;
							const textColor = hasDonated
								? (settings?.backBoxTextColor || settings?.frontBoxTextColor || '#111827')
								: (settings?.frontBoxTextColor || '#111827');
							const nameSize = hasDonated ? (settings?.fontSizeNameBack || nameFontSize) : nameFontSize;
							const amountSize = settings?.fontSizeAmountBack || amountFontSize;
							const rankBg = getRankColor(amountValue, ranks);
							return (
								<div key={d.id} style={{
									borderRadius: `${borderRadius}px`,
									boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
									background: rankBg
								}}>
									<div style={{
										width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
										alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 12px'
									}}>
										<div style={{
											overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%',
											color: textColor, fontSize: `${nameSize}px`, fontWeight: 700
										}}>
											{fullName || 'תורם אנונימי'}
										</div>
										{hasDonated && showAmount && (
											<div style={{ marginTop: 4, fontWeight: 600, fontSize: `${amountSize}px`, color: textColor }}>
												{formatCurrency(amountValue)}
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			<style jsx global>{`
			@keyframes scrollY {
				0% { transform: translateY(0); }
				50% { transform: translateY(-20%); }
				100% { transform: translateY(0); }
			}
			
			@keyframes fadeInScale {
				0% {
					opacity: 0;
					transform: scale(0.5) translateY(50px);
				}
				50% {
					opacity: 1;
					transform: scale(1.05) translateY(-10px);
				}
				100% {
					opacity: 1;
					transform: scale(1) translateY(0);
				}
			}
			
			@keyframes fadeOutScale {
				0% {
					opacity: 1;
					transform: scale(1);
				}
				100% {
					opacity: 0;
					transform: scale(0.8);
				}
			}
			
			.overlay-in {
				animation: fadeInScale 0.5s ease-out forwards;
			}
			
			.overlay-out {
				animation: fadeOutScale 0.3s ease-in forwards;
			}
			`}</style>

			{/* Full-screen big donation overlay */}
			{overlayStage !== 'hidden' && fullScreenDonor && (
				<div 
					className={overlayStage === 'in' ? 'overlay-in' : 'overlay-out'}
					style={{
						position: 'fixed', 
						inset: 0, 
						zIndex: 9999,
						display: 'flex', 
						flexDirection: 'column', 
						alignItems: 'center', 
						justifyContent: 'center',
						background: bgBigDonations ? `url("${bgBigDonations}") center/cover no-repeat` : 
							'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
						backgroundColor: 'rgba(0, 0, 0, 0.85)'
					}}
				>
					{/* Decorative border frame */}
					<div style={{
						position: 'absolute',
						inset: '40px',
						border: '8px solid rgba(255, 255, 255, 0.3)',
						borderRadius: '40px',
						pointerEvents: 'none'
					}} />
					
					{/* Content container */}
					<div style={{
						position: 'relative',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						padding: '40px',
						maxWidth: '90%'
					}}>
						{campaign?.logo && (settings?.bsShowLogo ?? true) && (
							<img 
								src={campaign.logo} 
								alt="logo" 
								style={{ 
									height: (settings?.bsLogoHeight || 200), 
									marginTop: (settings?.bsLogoTopMargin || 0),
									marginBottom: '40px',
									filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))'
								}} 
							/>
						)}
						
						<div style={{
							fontSize: (settings?.bsNameFontSize || 100),
							fontWeight: 'bold',
							color: settings?.bsNameColor || '#fff',
							marginTop: (settings?.bsNameTopMargin || 0),
							marginBottom: '30px',
							WebkitTextStroke: '2px #946013',
							textAlign: 'center', 
							lineHeight: 1.1,
							textShadow: '0 6px 18px rgba(0,0,0,0.4)',
							fontFamily: 'system-ui, -apple-system, sans-serif',
							letterSpacing: '-1px'
						}}>
							{[fullScreenDonor.first_name || fullScreenDonor.firstName, fullScreenDonor.last_name || fullScreenDonor.lastName].filter(Boolean).join(' ') || 'תורם אנונימי'}
						</div>
						
						{(settings?.bsShowAmount ?? true) && (
							<div style={{
								fontSize: (settings?.bsAmountFontSize || 120),
								fontWeight: 'bold',
								color: settings?.bsAmountColor || '#fff',
								marginTop: (settings?.bsAmountTopMargin || 0),
								marginBottom: '20px',
								WebkitTextStroke: '3px #946013',
								textShadow: '0 8px 24px rgba(0,0,0,0.5)',
								fontFamily: 'system-ui, -apple-system, sans-serif',
								letterSpacing: '-2px'
							}}>
								{formatCurrency(Number(fullScreenDonor.amount ?? fullScreenDonor.actualDonation ?? fullScreenDonor.monthly_amount ?? 0))}
							</div>
						)}
						
						{(settings?.bsShowRank ?? false) && fullScreenDonor.rank_name && (
							<div style={{
								fontSize: (settings?.bsRankFontSize || 70),
								color: settings?.bsRankColor || 'rgba(255, 255, 255, 0.9)',
								marginTop: (settings?.bsRankTopMargin || 0),
								WebkitTextStroke: '1px #946013',
								textShadow: '0 4px 12px rgba(0,0,0,0.3)',
								fontFamily: 'system-ui, -apple-system, sans-serif'
							}}>
								{fullScreenDonor.rank_name}
							</div>
						)}
					</div>
				</div>
			)}

			{/* Bottom part (optional) + donation button */}
			{settings?.displayBottomPart !== false && (
				<div className="w-full py-6">
					<div className="max-w-7xl mx-auto px-4 text-center text-white/90">
						{settings?.displayDonationButton && settings?.donationButtonUrl && (
							<div className="mt-4 flex justify-center">
								<a
									href={settings.donationButtonUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center justify-center px-6 py-3 text-lg font-semibold rounded-lg text-white"
									style={{
										background: settings?.donationButtonBackgroundImage
											? `url(${settings.donationButtonBackgroundImage}) center/cover no-repeat`
											: '#16a34a'
									}}
								>
									תרום עכשיו
								</a>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}


