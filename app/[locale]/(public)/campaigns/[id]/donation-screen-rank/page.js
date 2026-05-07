'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

/* ─── helpers ─── */
function fmt(value, currency) {
	if (value === null || value === undefined) return '';
	try {
		return new Intl.NumberFormat('he-IL', {
			style: 'currency', currency: currency || 'ILS', maximumFractionDigits: 0
		}).format(Number(value));
	} catch (_) { return String(value); }
}

function normalizeUrl(url) {
	if (!url) return '';
	if (/^(https?:|data:|blob:)/.test(url)) return url;
	return url.startsWith('/') ? url : `/${url}`;
}

function getRankForAmount(amount, sortedRanks) {
	if (!amount || amount <= 0 || !sortedRanks?.length) return null;
	for (let i = 0; i < sortedRanks.length; i++) {
		const ra = Number(sortedRanks[i].amount);
		if (i === sortedRanks.length - 1) { if (amount >= ra) return sortedRanks[i]; }
		else if (amount >= ra && amount < Number(sortedRanks[i + 1].amount)) return sortedRanks[i];
	}
	return null;
}

/* ─── animated number hook ─── */
function useAnim(target, ms = 700) {
	const [v, setV] = useState(0);
	const fromRef = useRef(0);
	const rafRef = useRef(null);
	useEffect(() => {
		const from = fromRef.current;
		if (from === target) return;
		const start = performance.now();
		const tick = (t) => {
			const p = Math.min(1, (t - start) / ms);
			const e = 1 - Math.pow(1 - p, 3);
			setV(Math.round(from + (target - from) * e));
			if (p < 1) rafRef.current = requestAnimationFrame(tick);
			else fromRef.current = target;
		};
		if (rafRef.current) cancelAnimationFrame(rafRef.current);
		rafRef.current = requestAnimationFrame(tick);
		return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
	}, [target, ms]);
	return v;
}

/* ─── scrolling column ─── */
function RankColumn({ rank, donors, settings, width }) {
	const wrapRef = useRef(null);
	const contentRef = useRef(null);
	const timerRef = useRef(null);
	const dirRef = useRef(1);
	const speed = 0.55;
	const nameFontSize = settings?.fontSizeNameFront || 26;
	const textColor = settings?.frontBoxTextColor || '#1a1255';

	const startScroll = useCallback(() => {
		clearInterval(timerRef.current);
		const w = wrapRef.current, c = contentRef.current;
		if (!w || !c || c.scrollHeight <= w.clientHeight) return;
		timerRef.current = setInterval(() => {
			const wr = wrapRef.current, cr = contentRef.current;
			if (!wr || !cr) return;
			const max = cr.scrollHeight - wr.clientHeight;
			if (dirRef.current === 1) {
				if (wr.scrollTop >= max) dirRef.current = -1;
				else wr.scrollTop += speed;
			} else {
				if (wr.scrollTop <= 0) dirRef.current = 1;
				else wr.scrollTop -= speed;
			}
		}, 20);
	}, []);

	useEffect(() => {
		const t = setTimeout(startScroll, 900);
		return () => { clearTimeout(t); clearInterval(timerRef.current); };
	}, [donors.length, startScroll]);

	const colW = width || 260;

	return (
		<div style={{
			width: colW, flexShrink: 0,
			display: 'flex', flexDirection: 'column',
			background: 'rgba(255,252,244,0.91)',
			border: '2px solid #c8a96e',
			borderRadius: 6,
			boxShadow: '0 0 0 1px rgba(255,255,255,0.7) inset, 0 4px 18px rgba(0,0,0,0.18)',
			overflow: 'hidden',
			height: '100%',
		}}>
			{/* Rank title */}
			<div style={{
				padding: '14px 12px 6px',
				textAlign: 'center',
				fontSize: settings?.fontSizeRank || 30,
				fontWeight: 700,
				color: textColor,
				lineHeight: 1.1,
			}}>
				{rank?.name || ''}
			</div>

			{/* Ornament */}
			<div style={{ textAlign: 'center', padding: '0 12px 6px', color: '#c8a96e', fontSize: 18, letterSpacing: 6, opacity: 0.8 }}>
				✦ · · ✦ · · ✦
			</div>
			<div style={{ height: 1, background: 'linear-gradient(90deg,transparent,#c8a96e,transparent)', margin: '0 12px 8px' }} />

			{/* Scrolling donor list */}
			<div ref={wrapRef} style={{ flex: 1, overflowY: 'hidden', overflowX: 'hidden' }}>
				<div ref={contentRef} style={{ padding: '4px 8px 12px' }}>
					{donors.map((d) => {
						const name = [d.first_name || d.firstName, d.last_name || d.lastName].filter(Boolean).join(' ');
						return (
							<div key={d.id} style={{
								textAlign: 'center',
								fontSize: nameFontSize,
								color: textColor,
								padding: '8px 6px',
								lineHeight: 1.25,
								borderBottom: '1px solid rgba(200,169,110,0.25)',
							}}>
								{d.isAnonymous ? 'בעילום שם' : (name || 'תורם אנונימי')}
							</div>
						);
					})}
					{donors.length === 0 && (
						<div style={{ textAlign: 'center', color: '#bbb', fontSize: 14, padding: 20 }}>אין תורמים</div>
					)}
				</div>
			</div>
		</div>
	);
}

/* ─── shtiebel / community sidebar ─── */
function ShtiebelPanel({ donors, settings, currency }) {
	const nameFontSize = settings?.fontSizeShtiebel || 18;

	// Group donors by shtiebel / community field (try various field names)
	const groups = useMemo(() => {
		const map = {};
		donors.forEach(d => {
			const amount = Number(d.amount ?? d.actualDonation ?? d.monthly_amount ?? 0);
			if (amount <= 0) return;
			const key =
				d.shtiebel_name ?? d.shtiebelName ??
				d.community_name ?? d.communityName ??
				(d.shtiebel_id ? `קהילה ${d.shtiebel_id}` : null);
			if (!key) return;
			if (!map[key]) map[key] = { name: key, total: 0, count: 0 };
			map[key].total += amount;
			map[key].count++;
		});
		return Object.values(map).sort((a, b) => b.total - a.total);
	}, [donors]);

	if (groups.length === 0) return (
		<div style={{ color: 'rgba(26,18,85,0.4)', fontSize: 14, textAlign: 'center', padding: 20 }}>
			אין נתוני בתי כנסת
		</div>
	);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '4px 0' }}>
			{groups.map((g) => (
				<div key={g.name} style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					background: 'rgba(255,252,244,0.88)',
					border: '1.5px solid #c8a96e',
					borderRadius: 5,
					padding: '7px 12px',
					gap: 10,
					boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
				}}>
					<div style={{ fontSize: nameFontSize, fontWeight: 700, color: '#1a1255', flex: 1, textAlign: 'right' }}>
						{g.name}
					</div>
					<div style={{ fontSize: nameFontSize, fontWeight: 700, color: '#3a1a6e', flexShrink: 0, direction: 'ltr' }}>
						{fmt(g.total, currency)}
					</div>
				</div>
			))}
		</div>
	);
}

/* ═══════════════════ MAIN PAGE ═══════════════════ */
export default function DonationScreenRankPage() {
	const params = useParams();
	const campaignId = params?.id;

	const [settings, setSettings] = useState(null);
	const settingsRef = useRef(null);
	const amountBigRef = useRef(0);
	const [donors, setDonors] = useState([]);
	const donorsRef = useRef([]);
	const [campaign, setCampaign] = useState(null);
	const [ranks, setRanks] = useState([]);
	const [loading, setLoading] = useState(true);

	// Big-screen overlay
	const [overlayDonor, setOverlayDonor] = useState(null);
	const [overlayStage, setOverlayStage] = useState('hidden');
	const queueRef = useRef([]);
	const processingRef = useRef(false);
	const prevAmountsRef = useRef(new Map());

	const pusherRef = useRef(null);
	const channelRef = useRef(null);

	/* ─── initial load ─── */
	useEffect(() => {
		let alive = true;
		(async () => {
			try {
				const [sRes, dRes, cRes, rRes] = await Promise.all([
					fetch(`/api/campaigns/${campaignId}/screen-settings`, { cache: 'no-store' }),
					fetch(`/api/fundraising/donors?campaignId=${campaignId}&includeInactive=true&limit=2000`, { cache: 'no-store' }),
					fetch(`/api/campaigns/${campaignId}`, { cache: 'no-store' }),
					fetch(`/api/ranks?campaignId=${campaignId}`, { cache: 'no-store' }),
				]);
				if (!alive) return;
				const [sJ, dJ, cJ, rJ] = await Promise.all([sRes?.json?.(), dRes?.json?.(), cRes?.ok ? cRes.json() : null, rRes?.ok ? rRes.json() : null]);
				setSettings(sJ || {});
				setDonors(Array.isArray(dJ?.data) ? dJ.data : []);
				setCampaign(cJ);
				setRanks(rJ?.data || []);
			} catch (_) { if (alive) setSettings({}); }
			finally { if (alive) setLoading(false); }
		})();
		return () => { alive = false; };
	}, [campaignId]);

	useEffect(() => { if (loading) { const t = setTimeout(() => setLoading(false), 5000); return () => clearTimeout(t); } }, [loading]);
	useEffect(() => { settingsRef.current = settings; amountBigRef.current = settings?.amountBigScreen || 0; }, [settings]);
	useEffect(() => { donorsRef.current = donors; }, [donors]);

	/* ─── poll settings ─── */
	useEffect(() => {
		if (!campaignId) return;
		let dead = false;
		const id = setInterval(async () => {
			try {
				const r = await fetch(`/api/campaigns/${campaignId}/screen-settings`);
				if (!r.ok || dead) return;
				const next = await r.json();
				setSettings(p => { try { if (JSON.stringify(p || {}) === JSON.stringify(next || {})) return p; } catch (_) {} return { ...(p || {}), ...next }; });
			} catch (_) {}
		}, 5000);
		return () => { dead = true; clearInterval(id); };
	}, [campaignId]);

	/* ─── poll donors + big-screen check ─── */
	useEffect(() => {
		if (!campaignId) return;
		let dead = false;
		const id = setInterval(async () => {
			try {
				const thr = Number(amountBigRef.current || 0);
				const r = await fetch(`/api/fundraising/donors?campaignId=${campaignId}&includeInactive=true&limit=2000`);
				const data = r.ok ? await r.json() : { data: [] };
				const list = Array.isArray(data?.data) ? data.data : [];
				if (thr > 0) {
					const next = new Map();
					list.forEach(d => {
						const av = Number(d.amount ?? d.actualDonation ?? d.monthly_amount ?? 0);
						next.set(d.id, av);
						const prev = prevAmountsRef.current.get(d.id);
						if (av >= thr && prev !== av) enqueue(d);
					});
					prevAmountsRef.current = next;
				}
				if (!dead) setDonors(list);
			} catch (_) {}
		}, 5000);
		return () => { dead = true; clearInterval(id); };
	}, [campaignId]);

	/* ─── pusher ─── */
	useEffect(() => {
		if (!campaignId || !process.env.NEXT_PUBLIC_PUSHER_KEY) return;
		let cleanup;
		(async () => {
			try {
				if (pusherRef.current) return;
				const Pusher = (await import('pusher-js')).default;
				pusherRef.current = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
					cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu',
					wsHost: process.env.NEXT_PUBLIC_PUSHER_HOST,
					wsPort: Number(process.env.NEXT_PUBLIC_PUSHER_PORT || 6001),
					forceTLS: process.env.NEXT_PUBLIC_PUSHER_TLS === 'true',
					enabledTransports: ['ws', 'wss'],
				});
				const ch = `donation-screen.${campaignId}`;
				channelRef.current = pusherRef.current.subscribe(ch);
				channelRef.current.bind('DonationScreen', (e) => {
					try {
						const d = e?.donor || e || {};
						const av = Number(d.amount ?? d.actualDonation ?? d.monthly_amount ?? d.total_amount ?? 0);
						const thr = Number(amountBigRef.current || 0);
						if (thr && av >= thr && !(e?.skip?.skip)) {
							const existing = donorsRef.current.find(x => x.id === d.id);
							if (!existing || Number(existing?.amount ?? existing?.actualDonation ?? 0) !== av) enqueue(d);
						}
						setDonors(prev => { const i = prev.findIndex(x => x.id === d.id); if (i === -1) return [...prev, d]; const n = [...prev]; n[i] = d; return n; });
					} catch (_) {}
				});
				channelRef.current.bind('ScreenSettingsUpdated', (e) => {
					try { const n = e?.settings || e || {}; setSettings(p => ({ ...(p || {}), ...n })); } catch (_) {}
				});
				cleanup = () => {
					try { channelRef.current?.unbind_all(); pusherRef.current?.unsubscribe(ch); pusherRef.current?.disconnect(); channelRef.current = pusherRef.current = null; } catch (_) {}
				};
			} catch (_) {}
		})();
		return () => cleanup?.();
	}, [campaignId]);

	/* ─── big-screen overlay queue ─── */
	const wait = (ms) => new Promise(r => setTimeout(r, ms));
	function enqueue(d) {
		if (!d) return;
		queueRef.current.push(JSON.parse(JSON.stringify(d)));
		process_queue();
	}
	async function process_queue() {
		if (processingRef.current) return;
		processingRef.current = true;
		try {
			while (queueRef.current.length > 0) {
				const d = queueRef.current.shift();
				setOverlayDonor(d);
				setOverlayStage('in');
				await wait(Number(settings?.bigScreenDuration || 6000));
				setOverlayStage('out');
				await wait(450);
				setOverlayStage('hidden');
			}
		} finally { processingRef.current = false; }
	}

	/* ─── derived values ─── */
	const totalAmount = useMemo(() => donors.reduce((s, d) => s + Number(d.amount ?? d.actualDonation ?? 0), 0), [donors]);
	const targetAmount = Number(campaign?.targetAmount ?? campaign?.target_amount ?? settings?.goal ?? 0);
	const participants = donors.filter(d => Number(d.amount ?? d.actualDonation ?? 0) > 0).length;
	const currency = campaign?.currency || 'ILS';
	const pct = targetAmount > 0 ? Math.min(100, Math.floor((totalAmount / targetAmount) * 100)) : 0;
	const remaining = Math.max(0, targetAmount - totalAmount);

	const animCollected = useAnim(Math.round(totalAmount));
	const animRemaining = useAnim(Math.round(remaining));

	const bgScreen = normalizeUrl(settings?.bgScreen || '');
	const bgBigDon = normalizeUrl(settings?.bgBigDonations || '');
	const logoUrl = settings?.bsLogoUrl || campaign?.logo || '';
	const logoH = settings?.bsLogoHeight || 90;
	const showShtiebel = Boolean(settings?.displayShtiebel);

	const sortedRanks = useMemo(() => [...ranks].sort((a, b) => Number(a.amount) - Number(b.amount)), [ranks]);
	const ranksWithDonors = useMemo(() => sortedRanks.map(rank => ({
		...rank,
		donors: donors
			.filter(d => {
				const av = Number(d.amount ?? d.actualDonation ?? d.monthly_amount ?? 0);
				return av > 0 && getRankForAmount(av, sortedRanks)?.id === rank.id;
			})
			.sort((a, b) => new Date(b.updated_at || b.updatedAt || 0) - new Date(a.updated_at || a.updatedAt || 0))
	})), [sortedRanks, donors]);

	if (loading) return (
		<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#1a1255', background: '#f5ece0' }}>
			טוען מסך דרגות...
		</div>
	);

	/* ─── column width calculation ─── */
	const shtiebelPanelW = showShtiebel ? 200 : 0;
	const gap = 24;
	const hPad = 24;
	const numCols = ranksWithDonors.length || 1;
	// Each col gets equal width (approximate, CSS handles the rest)
	const colW = settings?.cubeWidth || 260;

	/* ─── header badge style ─── */
	const badge = (children) => (
		<div style={{
			background: 'rgba(255,252,244,0.92)',
			border: '2px solid #c8a96e',
			borderRadius: 5,
			padding: '8px 16px',
			boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
			color: '#1a1255',
			fontWeight: 700,
			textAlign: 'center',
			direction: 'rtl',
			minWidth: 120,
		}}>
			{children}
		</div>
	);

	return (
		<div style={{
			position: 'fixed', inset: 0,
			border: '12px solid #5a3a2e',
			boxSizing: 'border-box',
			backgroundImage: bgScreen ? `url("${bgScreen}")` : undefined,
			backgroundSize: '100% 100%',
			backgroundColor: '#f0e6d2',
			display: 'flex', flexDirection: 'column',
			overflow: 'hidden',
			fontFamily: "'Frank Ruhl Libre', 'Heebo', 'David', serif",
			direction: 'rtl',
		}}>

			{/* ════════ HEADER ════════ */}
			<div style={{
				flexShrink: 0,
				display: 'flex', alignItems: 'center', justifyContent: 'space-between',
				padding: '10px 20px 8px',
				gap: 16,
				minHeight: 110,
			}}>
				{/* LEFT — remaining */}
				{badge(
					<>
						<div style={{ fontSize: 13, fontWeight: 600, opacity: 0.8, marginBottom: 3 }}>נותרו עוד</div>
						<div style={{ fontSize: 22, fontWeight: 900 }}>
							{targetAmount > 0 ? `כ-${fmt(animRemaining, currency)}` : '—'}
						</div>
					</>
				)}

				{/* CENTER — logo + progress bar */}
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
					{logoUrl && (
						<img src={logoUrl} alt="logo" style={{ height: logoH, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }} />
					)}
					{!logoUrl && campaign?.name && (
						<div style={{ fontSize: 26, fontWeight: 700, color: '#1a1255', textAlign: 'center' }}>{campaign.name}</div>
					)}
					{/* Progress bar */}
					<div style={{ width: '100%', maxWidth: 700, height: 28, background: 'rgba(0,0,0,0.35)', borderRadius: 14, overflow: 'hidden', border: '1.5px solid rgba(200,169,110,0.5)' }}>
						<div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #5a3aaa, #3a1a6e)', borderRadius: 14, transition: 'width 0.8s ease' }} />
					</div>
					<div style={{ fontSize: 14, color: '#3a1a6e', fontWeight: 700 }}>
						סה"כ נתרם: {fmt(animCollected, currency)} · {participants} תורמים
					</div>
				</div>

				{/* RIGHT — percentage */}
				{badge(
					<>
						<div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{pct}%</div>
						<div style={{ fontSize: 13, fontWeight: 600, opacity: 0.8, marginTop: 2 }}>מחיעד</div>
					</>
				)}
			</div>

			{/* ════════ BODY — columns + optional shtiebel panel ════════ */}
			<div style={{
				flex: 1,
				display: 'flex',
				flexDirection: 'row',
				gap,
				padding: `8px ${hPad}px 16px`,
				overflow: 'hidden',
				alignItems: 'stretch',
			}}>
				{/* Rank columns */}
				<div style={{
					flex: 1,
					display: 'flex',
					flexDirection: 'row',
					gap,
					overflow: 'hidden',
					justifyContent: 'center',
				}}>
					{ranksWithDonors.map(r => (
						<RankColumn key={r.id} rank={r} donors={r.donors} settings={settings} width={colW} />
					))}
					{ranksWithDonors.length === 0 && (
						<div style={{ color: 'rgba(26,18,85,0.4)', fontSize: 20, margin: 'auto' }}>אין דרגות מוגדרות</div>
					)}
				</div>

				{/* Shtiebel panel */}
				{showShtiebel && (
					<div style={{
						width: shtiebelPanelW,
						flexShrink: 0,
						display: 'flex',
						flexDirection: 'column',
						overflow: 'hidden',
					}}>
						{/* Panel header */}
						<div style={{
							background: 'rgba(255,252,244,0.85)',
							border: '2px solid #c8a96e',
							borderRadius: '5px 5px 0 0',
							padding: '8px 12px',
							textAlign: 'center',
							fontSize: 16,
							fontWeight: 700,
							color: '#1a1255',
							flexShrink: 0,
						}}>
							בתי כנסת
						</div>
						{/* Panel body scrollable */}
						<div style={{
							flex: 1,
							overflowY: 'auto',
							overflowX: 'hidden',
							border: '2px solid #c8a96e',
							borderTop: 'none',
							borderRadius: '0 0 5px 5px',
							background: 'rgba(240,230,210,0.6)',
							padding: 6,
						}}>
							<ShtiebelPanel donors={donors} settings={settings} currency={currency} />
						</div>
					</div>
				)}
			</div>

			{/* CSS */}
			<style jsx global>{`
				@keyframes dsrIn  { 0%{opacity:0;transform:scale(0.4) translateY(60px)} 60%{opacity:1;transform:scale(1.04) translateY(-8px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
				@keyframes dsrOut { 0%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(0.7)} }
				.dsr-in  { animation: dsrIn  0.5s ease-out forwards; }
				.dsr-out { animation: dsrOut 0.4s ease-in  forwards; }
			`}</style>

			{/* ════════ BIG DONATION OVERLAY ════════ */}
			{overlayStage !== 'hidden' && overlayDonor && (
				<div className={overlayStage === 'in' ? 'dsr-in' : 'dsr-out'}
					style={{
						position: 'fixed', inset: 0, zIndex: 9999,
						display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
						background: bgBigDon ? `url("${bgBigDon}") center/100% 100% no-repeat` : 'linear-gradient(135deg,#4a1e14,#7a4a3a)',
						border: '12px solid #5a3a2e',
					}}
				>
					<div style={{ position: 'absolute', inset: 40, border: '6px solid rgba(200,169,110,0.5)', borderRadius: 40, pointerEvents: 'none' }} />
					<div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 40, maxWidth: '90%' }}>
						{campaign?.logo && (settings?.bsShowLogo ?? true) && (
							<img src={campaign.logo} alt="logo" style={{ height: settings?.bsLogoHeight || 200, marginBottom: 40, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.4))' }} />
						)}
						<div style={{ fontSize: settings?.bsNameFontSize || 100, fontWeight: 'bold', color: settings?.bsNameColor || '#fff6eb', WebkitTextStroke: '2px #946013', textAlign: 'center', lineHeight: 1.1, textShadow: '0 6px 18px rgba(0,0,0,0.5)', marginBottom: 30 }}>
							{overlayDonor.isAnonymous ? 'בעילום שם' : ([overlayDonor.first_name || overlayDonor.firstName, overlayDonor.last_name || overlayDonor.lastName].filter(Boolean).join(' ') || 'תורם אנונימי')}
						</div>
						{(settings?.bsShowAmount ?? true) && (
							<div style={{ fontSize: settings?.bsAmountFontSize || 120, fontWeight: 'bold', color: settings?.bsAmountColor || '#f6ead2', WebkitTextStroke: '3px #946013', textShadow: '0 8px 24px rgba(0,0,0,0.5)', marginBottom: 20 }}>
								{fmt(Number(overlayDonor.amount ?? overlayDonor.actualDonation ?? overlayDonor.monthly_amount ?? 0), currency)}
							</div>
						)}
						{(settings?.bsShowRank ?? false) && (
							<div style={{ fontSize: settings?.bsRankFontSize || 70, color: settings?.bsRankColor || 'rgba(246,234,210,0.9)', WebkitTextStroke: '1px #946013' }}>
								{getRankForAmount(Number(overlayDonor.amount ?? overlayDonor.actualDonation ?? 0), sortedRanks)?.name || ''}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
