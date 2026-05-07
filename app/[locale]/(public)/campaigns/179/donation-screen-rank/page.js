'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/* ── assets ── */
const A = '/campaigns/179';
const ASSET = {
  bgSky:           `${A}/bg-sky.png`,
  bgPurple:        `${A}/bg-purple.png`,
  colBg:           `${A}/col-bg.png`,
  logo1:           `${A}/logo1.png`,
  logo2:           `${A}/logo2.png`,
  mazalTov:        `${A}/mazal-tov.png`,
  frameLong:       `${A}/frame-long.png`,
  cornersBar:      `${A}/corners-bar.png`,
  corner:          `${A}/corner.png`,
  shtiebelRow:     `${A}/shtiebel-row.png`,
  progressEmpty:   `${A}/progress-empty.png`,
  progressFull:    `${A}/progress-full.png`,
  remainingFrame:  `${A}/remaining-frame.png`,
  collectedFrame:  `${A}/collected-frame.png`,
};

// Map rank name → rank title image + donor frame image
const RANK_MAP = {
  'שושבין לתורה':  { title: `${A}/rank-shushvin.png`, frame: `${A}/frame-white.png`,  textColor: '#3a1a6e' },
  'שושבין':         { title: `${A}/rank-shushvin.png`, frame: `${A}/frame-white.png`,  textColor: '#3a1a6e' },
  'חתן תורה':     { title: `${A}/rank-chatan.png`,   frame: `${A}/frame-silver.png`, textColor: '#2a1a4e' },
  'חתן':            { title: `${A}/rank-chatan.png`,   frame: `${A}/frame-silver.png`, textColor: '#2a1a4e' },
  'מחולל המהפכה': { title: `${A}/rank-mecholel.png`, frame: `${A}/frame-gold.png`,   textColor: '#2a0a00' },
  'מחולל':          { title: `${A}/rank-mecholel.png`, frame: `${A}/frame-gold.png`,   textColor: '#2a0a00' },
};
// Fallback by sorted index (lowest→white, mid→silver, highest→gold)
const FRAME_BY_IDX = [
  { frame: `${A}/frame-white.png`,  title: null, textColor: '#3a1a6e' },
  { frame: `${A}/frame-silver.png`, title: null, textColor: '#2a1a4e' },
  { frame: `${A}/frame-gold.png`,   title: null, textColor: '#2a0a00' },
];

/* ── helpers ── */
const CAMPAIGN_ID = 179;

function fmt(v) {
  if (v === null || v === undefined) return '';
  try {
    const n = Number(v);
    if (!isFinite(n)) return '';
    return `₪ ${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(n)}`;
  } catch (_) { return String(v); }
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

/* ── RankColumn component ── */
function RankColumn({ rank, donors, rankIndex, totalRanks, settings }) {
  const wrapRef = useRef(null);
  const setRef = useRef(null);
  const timerRef = useRef(null);
  const [needsLoop, setNeedsLoop] = useState(false);

  /* ── decide whether content overflows (and therefore needs the duplicate set + scrolling) ── */
  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current, s = setRef.current;
      if (!w || !s) return;
      setNeedsLoop(s.offsetHeight > w.clientHeight);
    };
    const t = setTimeout(measure, 200);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [donors.length]);

  /* ── continuous infinite-loop scroll, only when needed ── */
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!needsLoop) {
      if (wrapRef.current) wrapRef.current.scrollTop = 0;
      return;
    }
    const t = setTimeout(() => {
      const speed = 0.5;
      timerRef.current = setInterval(() => {
        const wr = wrapRef.current, sr = setRef.current;
        if (!wr || !sr) return;
        wr.scrollTop += speed;
        if (wr.scrollTop >= sr.offsetHeight) wr.scrollTop -= sr.offsetHeight;
      }, 25);
    }, 800);
    return () => { clearTimeout(t); clearInterval(timerRef.current); };
  }, [needsLoop]);

  // Find rank assets — by name first, then by index
  const rankKey = Object.keys(RANK_MAP).find(k => rank.name?.includes(k.split(' ')[0]));
  const rankAsset = rankKey ? RANK_MAP[rankKey] : (FRAME_BY_IDX[rankIndex] || FRAME_BY_IDX[0]);
  const titleImg = rankAsset.title;
  const frameImg = rankAsset.frame;
  const textColor = rankAsset.textColor || '#2a1a4e';

  const nameFontSize = settings?.fontSizeNameFront || 'clamp(14px,1.6vw,28px)';

  // Title sizing: ~14vh tall; half (~7vh) sits above parchment, half overlaps the top
  const TITLE_HEIGHT = 'clamp(80px,14vh,200px)';
  const TITLE_HALF   = 'clamp(40px,7vh,100px)';

  return (
    /* Outer wrapper — padding-top reserves space for the half-floating title */
    <div style={{
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: TITLE_HALF,
    }}>
      {/* Rank title — anchored at the top, half above & half on parchment */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '80%',
        zIndex: 3,
        pointerEvents: 'none',
      }}>
        {titleImg ? (
          <img
            src={titleImg}
            alt={rank.name}
            style={{
              width: '100%',
              height: TITLE_HEIGHT,
              objectFit: 'contain',
              display: 'block',
              filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))',
            }}
          />
        ) : (
          <div style={{ position: 'relative' }}>
            <img src={ASSET.frameLong} alt="" style={{ width: '100%', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textColor, fontSize: 'clamp(14px,1.4vw,22px)', fontWeight: 900 }}>
              {rank.name}
            </div>
          </div>
        )}
      </div>

      {/* Parchment body — clipped to overflow; stretch bg vertically so the torn bottom edge falls outside the visible area */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundImage: `url("${ASSET.colBg}")`,
        backgroundSize: '100% 110%',
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
        overflow: 'hidden',
        paddingTop: `calc(${TITLE_HALF} + 0.6vh)`,
        paddingBottom: '4vh',
      }}>
        {/* Scrolling donor pills — continuous infinite loop */}
        <div ref={wrapRef} style={{ flex: 1, overflowY: 'hidden', overflowX: 'hidden', padding: '0 0.6vw', width: '100%' }}>
          {/* First copy — measured for loop length via setRef */}
          <div ref={setRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8vh' }}>
            {donors.map((d) => {
              const name = [d.first_name || d.firstName, d.last_name || d.lastName].filter(Boolean).join(' ');
              return (
                <div key={`a-${d.id}`} style={{ position: 'relative', width: '78%' }}>
                  <img src={frameImg} alt="" style={{ width: '100%', display: 'block' }} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: textColor, fontSize: nameFontSize, fontWeight: 800,
                    fontFamily: "'Frank Ruhl Libre','Heebo','David',serif",
                    padding: '0 8%',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', textAlign: 'center' }}>
                      {d.isAnonymous ? 'בעילום שם' : (name || 'תורם אנונימי')}
                    </span>
                  </div>
                </div>
              );
            })}
            {donors.length === 0 && (
              <div style={{ color: 'rgba(100,80,40,0.35)', textAlign: 'center', padding: '2vh', fontSize: 'clamp(12px,1.2vw,18px)' }}>—</div>
            )}
          </div>

          {/* Second copy — only when content overflows (i.e. scrolling is actually needed) */}
          {needsLoop && donors.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8vh', paddingTop: '0.8vh' }}>
              {donors.map((d) => {
                const name = [d.first_name || d.firstName, d.last_name || d.lastName].filter(Boolean).join(' ');
                return (
                  <div key={`b-${d.id}`} style={{ position: 'relative', width: '78%' }}>
                    <img src={frameImg} alt="" style={{ width: '100%', display: 'block' }} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: textColor, fontSize: nameFontSize, fontWeight: 800,
                      fontFamily: "'Frank Ruhl Libre','Heebo','David',serif",
                      padding: '0 8%',
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', textAlign: 'center' }}>
                        {d.isAnonymous ? 'בעילום שם' : (name || 'תורם אנונימי')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Shtiebel panel ── */
function ShtiebelPanel({ donors, allShtieblach, settings }) {
  const groups = useMemo(() => {
    // Start with every shtiebel known to the campaign — even those with no donations
    const map = {};
    (allShtieblach || []).forEach((name) => {
      if (!name) return;
      map[name] = { name, total: 0 };
    });
    // Layer donor totals on top
    donors.forEach(d => {
      const amt = Number(d.amount ?? 0);
      const key = d.synagogue ?? d.shtiebel_name ?? d.shtiebelName ?? d.community_name ?? d.communityName ?? null;
      if (!key) return;
      if (!map[key]) map[key] = { name: key, total: 0 };
      if (amt > 0) map[key].total += amt;
    });
    return Object.values(map).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'he'));
  }, [donors, allShtieblach]);

  const fontSize = settings?.fontSizeShtiebel || 'clamp(10px,1.05vw,18px)';
  const circleSize = 'clamp(14px,1.8vw,28px)';

  /* ── continuous infinite-loop scroll, only when rows overflow ── */
  const wrapRef = useRef(null);
  const setRef = useRef(null);
  const timerRef = useRef(null);
  const [needsLoop, setNeedsLoop] = useState(false);

  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current, s = setRef.current;
      if (!w || !s) return;
      setNeedsLoop(s.offsetHeight > w.clientHeight);
    };
    const t = setTimeout(measure, 200);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [groups.length]);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (!needsLoop) {
      if (wrapRef.current) wrapRef.current.scrollTop = 0;
      return;
    }
    const t = setTimeout(() => {
      const speed = 0.5;
      timerRef.current = setInterval(() => {
        const wr = wrapRef.current, sr = setRef.current;
        if (!wr || !sr) return;
        wr.scrollTop += speed;
        if (wr.scrollTop >= sr.offsetHeight) wr.scrollTop -= sr.offsetHeight;
      }, 25);
    }, 800);
    return () => { clearTimeout(t); clearInterval(timerRef.current); };
  }, [needsLoop]);

  const renderRow = (g, key) => (
    <div key={key} style={{ position: 'relative', width: '100%', marginBottom: '1vh', zIndex: 1 }}>
      {/* Gold circle connector */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        width: circleSize, height: circleSize, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #f5d78e, #a07838)',
        border: '0.15vw solid #c8a96e',
        zIndex: 2,
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
      {/* Row image with text — two halves, each centered (right=name, left=amount) */}
      <div style={{ position: 'relative' }}>
        <img src={ASSET.shtiebelRow} alt="" style={{ width: '100%', display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }} />
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center',
          fontSize, fontWeight: 700, color: '#2a1a4e',
          fontFamily: "'Frank Ruhl Libre','Heebo','David',serif",
        }}>
          {/* Right half (RTL first) — synagogue name, centered, with safe gap from center circle */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingInline: `calc(${circleSize} * 0.6) 0.5vw` }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', textAlign: 'center' }}>{g.name}</span>
          </div>
          {/* Left half — amount, centered */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingInline: `0.5vw calc(${circleSize} * 0.6)` }}>
            <span style={{ direction: 'ltr', opacity: g.total > 0 ? 1 : 0.45 }}>{fmt(g.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Match the parchment top of RankColumn — TITLE_HALF padding so rows start where the parchment starts
  const TITLE_HALF = 'clamp(40px,7vh,100px)';

  return (
    <div style={{
      width: 'clamp(180px,18vw,320px)',
      flexShrink: 0,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      paddingTop: TITLE_HALF,
    }}>
      <div ref={wrapRef} style={{ flex: 1, minHeight: 0, overflowY: 'hidden', overflowX: 'hidden', width: '100%' }}>
        {/* First copy — measured for loop length via setRef */}
        <div ref={setRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {groups.map((g) => renderRow(g, `a-${g.name}`))}

          {groups.length === 0 && Array.from({ length: 8 }).map((_, i) => (
            <div key={`ph-${i}`} style={{ position: 'relative', width: '100%', marginBottom: '1vh', zIndex: 1 }}>
              <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: circleSize, height: circleSize, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #f5d78e, #a07838)', border: '0.15vw solid #c8a96e', zIndex: 2 }} />
              <img src={ASSET.shtiebelRow} alt="" style={{ width: '100%', display: 'block', opacity: 0.7 }} />
            </div>
          ))}
        </div>

        {/* Second copy — only rendered when scrolling is actually needed, for seamless loop */}
        {needsLoop && groups.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {groups.map((g) => renderRow(g, `b-${g.name}`))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════ MAIN PAGE ════════════════════ */
export default function Campaign179DonationScreenRank() {
  const [settings, setSettings] = useState(null);
  const settingsRef = useRef(null);
  const amountBigRef = useRef(0);
  const [donors, setDonors] = useState([]);
  const donorsRef = useRef([]);
  const [campaign, setCampaign] = useState(null);
  const [ranks, setRanks] = useState([]);
  const [shtieblach, setShtieblach] = useState([]);
  const [loading, setLoading] = useState(true);

  const [overlayDonor, setOverlayDonor] = useState(null);
  const [overlayStage, setOverlayStage] = useState('hidden');
  const queueRef = useRef([]);
  const processingRef = useRef(false);
  const prevAmountsRef = useRef(new Map());

  // Celebration overlay (any new donor entering / upgrading a rank)
  const [celebState, setCelebState] = useState(null); // { donor, rank, frameImg, titleImg, textColor } | null
  const celebQueueRef = useRef([]);
  const celebProcessingRef = useRef(false);
  const lastRankByDonorRef = useRef(null); // null = not initialized, then Map<donorId, rankId>
  const celebCanvasRef = useRef(null);

  const pusherRef = useRef(null);
  const channelRef = useRef(null);

  /* ── load ── */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sRes, dRes, cRes, rRes, syRes] = await Promise.all([
          fetch(`/api/campaigns/${CAMPAIGN_ID}/screen-settings`, { cache: 'no-store' }),
          fetch(`/api/fundraising/donors?campaignId=${CAMPAIGN_ID}&includeInactive=true&includeUnapproved=true&useMonthlyOnly=true&limit=2000`, { cache: 'no-store' }),
          fetch(`/api/campaigns/${CAMPAIGN_ID}`, { cache: 'no-store' }),
          fetch(`/api/ranks?campaignId=${CAMPAIGN_ID}`, { cache: 'no-store' }),
          fetch(`/api/donors/synagogues?campaignId=${CAMPAIGN_ID}`, { cache: 'no-store' }),
        ]);
        if (!alive) return;
        const [sJ, dJ, cJ, rJ, syJ] = await Promise.all([
          sRes?.json?.(),
          dRes?.json?.(),
          cRes?.ok ? cRes.json() : null,
          rRes?.ok ? rRes.json() : null,
          syRes?.ok ? syRes.json() : null,
        ]);
        setSettings(sJ || {});
        setDonors(Array.isArray(dJ?.data) ? dJ.data : []);
        setCampaign(cJ);
        setRanks(rJ?.data || []);
        setShtieblach(Array.isArray(syJ?.data) ? syJ.data : []);
      } catch (_) { if (alive) setSettings({}); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (loading) { const t = setTimeout(() => setLoading(false), 5000); return () => clearTimeout(t); } }, [loading]);
  useEffect(() => { settingsRef.current = settings; amountBigRef.current = settings?.amountBigScreen || 0; }, [settings]);
  useEffect(() => { donorsRef.current = donors; }, [donors]);

  /* ── poll settings ── */
  useEffect(() => {
    let dead = false;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/campaigns/${CAMPAIGN_ID}/screen-settings`);
        if (!r.ok || dead) return;
        const next = await r.json();
        setSettings(p => { try { if (JSON.stringify(p) === JSON.stringify(next)) return p; } catch (_) {} return { ...(p || {}), ...next }; });
      } catch (_) {}
    }, 5000);
    return () => { dead = true; clearInterval(id); };
  }, []);

  /* ── poll donors ── */
  useEffect(() => {
    let dead = false;
    const id = setInterval(async () => {
      try {
        const thr = Number(amountBigRef.current || 0);
        const r = await fetch(`/api/fundraising/donors?campaignId=${CAMPAIGN_ID}&includeInactive=true&includeUnapproved=true&useMonthlyOnly=true&limit=2000`);
        const data = r.ok ? await r.json() : {};
        const list = Array.isArray(data?.data) ? data.data : [];
        if (thr > 0) {
          const nextMap = new Map();
          list.forEach(d => {
            const av = Number(d.amount ?? d.actualDonation ?? d.monthly_amount ?? 0);
            nextMap.set(d.id, av);
            const prev = prevAmountsRef.current.get(d.id);
            if (av >= thr && prev !== av) enqueue(d);
          });
          prevAmountsRef.current = nextMap;
        }
        if (!dead) setDonors(list);
      } catch (_) {}
    }, 5000);
    return () => { dead = true; clearInterval(id); };
  }, []);

  /* ── pusher ── */
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return;
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
        const ch = `donation-screen.${CAMPAIGN_ID}`;
        channelRef.current = pusherRef.current.subscribe(ch);
        channelRef.current.bind('DonationScreen', (e) => {
          try {
            const d = e?.donor || e || {};
            const av = Number(d.amount ?? d.actualDonation ?? d.monthly_amount ?? d.total_amount ?? 0);
            const thr = Number(amountBigRef.current || 0);
            if (thr && av >= thr && !(e?.skip?.skip)) {
              const ex = donorsRef.current.find(x => x.id === d.id);
              if (!ex || Number(ex?.amount ?? ex?.actualDonation ?? 0) !== av) enqueue(d);
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
  }, []);

  /* ── overlay queue ── */
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  function enqueue(d) {
    if (!d) return;
    queueRef.current.push(JSON.parse(JSON.stringify(d)));
    run_queue();
  }
  async function run_queue() {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const d = queueRef.current.shift();
        setOverlayDonor(d);
        setOverlayStage('in');
        await wait(Number(settings?.bigScreenDuration || 6000));
        setOverlayStage('out');
        await wait(500);
        setOverlayStage('hidden');
      }
    } finally { processingRef.current = false; }
  }

  /* ── celebration queue (3-second pop-up + confetti) ── */
  function enqueueCeleb(item) {
    if (!item?.donor || !item?.rank) return;
    celebQueueRef.current.push(item);
    runCelebQueue();
  }
  async function runCelebQueue() {
    if (celebProcessingRef.current) return;
    celebProcessingRef.current = true;
    try {
      while (celebQueueRef.current.length > 0) {
        const item = celebQueueRef.current.shift();
        setCelebState(item);
        await wait(3000);
        setCelebState(null);
        await wait(250); // small pause between bursts
      }
    } finally { celebProcessingRef.current = false; }
  }

  /* ── detect new rank assignments / upgrades and trigger celebrations ── */
  useEffect(() => {
    if (!ranks.length) return;
    const sorted = [...ranks].sort((a, b) => Number(a.amount) - Number(b.amount));
    const nextMap = new Map();
    donors.forEach(d => {
      const av = Number(d.amount ?? 0);
      const r = getRankForAmount(av, sorted);
      nextMap.set(d.id, r?.id ?? null);
    });

    // First pass after donors+ranks load — record state but don't celebrate
    if (lastRankByDonorRef.current === null) {
      lastRankByDonorRef.current = nextMap;
      return;
    }

    donors.forEach(d => {
      const av = Number(d.amount ?? 0);
      const r = getRankForAmount(av, sorted);
      const newRankId = r?.id ?? null;
      const prevRankId = lastRankByDonorRef.current.get(d.id);
      // Trigger when a donor enters a rank (new or upgrade) — i.e. rank id changes to a non-null value
      if (newRankId !== null && newRankId !== prevRankId) {
        const rankKey = Object.keys(RANK_MAP).find(k => r.name?.includes(k.split(' ')[0]));
        const idx = sorted.findIndex(x => x.id === r.id);
        const asset = rankKey ? RANK_MAP[rankKey] : (FRAME_BY_IDX[idx] || FRAME_BY_IDX[0]);
        enqueueCeleb({
          donor: d,
          rank: r,
          frameImg: asset.frame,
          titleImg: asset.title,
          textColor: asset.textColor || '#2a1a4e',
        });
      }
    });

    lastRankByDonorRef.current = nextMap;
    // We intentionally don't list `ranks` in deps — sorted is derived inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donors, ranks]);

  /* ── confetti burst while celebration is visible ── */
  useEffect(() => {
    if (!celebState) return;
    let alive = true;
    let interval;
    let myConfetti;
    (async () => {
      try {
        const mod = await import('canvas-confetti');
        if (!alive || !celebCanvasRef.current) return;
        const confetti = mod.default;
        myConfetti = confetti.create(celebCanvasRef.current, { resize: true, useWorker: false });
        const fire = () => {
          if (!myConfetti) return;
          // Two angled bursts from bottom-left and bottom-right
          myConfetti({
            particleCount: 80,
            spread: 70,
            startVelocity: 50,
            origin: { x: 0.15, y: 0.85 },
            angle: 60,
            colors: ['#f5d78e', '#a07838', '#c8a96e', '#3a1a6e', '#fff'],
            scalar: 1.4,
            ticks: 200,
          });
          myConfetti({
            particleCount: 80,
            spread: 70,
            startVelocity: 50,
            origin: { x: 0.85, y: 0.85 },
            angle: 120,
            colors: ['#f5d78e', '#a07838', '#c8a96e', '#3a1a6e', '#fff'],
            scalar: 1.4,
            ticks: 200,
          });
        };
        fire();
        interval = setInterval(fire, 700);
      } catch (_) {}
    })();
    return () => {
      alive = false;
      if (interval) clearInterval(interval);
      try { myConfetti?.reset?.(); } catch (_) {}
    };
  }, [celebState]);

  /* ── derived ── */
  const totalAmount = useMemo(() => donors.reduce((s, d) => s + Number(d.amount ?? d.actualDonation ?? 0), 0), [donors]);
  const targetAmount = Number(campaign?.targetAmount ?? campaign?.target_amount ?? settings?.goal ?? 0);
  const participants = donors.filter(d => Number(d.amount ?? d.actualDonation ?? 0) > 0).length;
  const pct = targetAmount > 0 ? Math.min(100, Math.floor((totalAmount / targetAmount) * 100)) : 0;
  const remaining = Math.max(0, targetAmount - totalAmount);

  const animCollected = useAnim(Math.round(totalAmount));
  const animRemaining = useAnim(Math.round(remaining));

  const sortedRanks = useMemo(() => [...ranks].sort((a, b) => Number(a.amount) - Number(b.amount)), [ranks]);
  const ranksWithDonors = useMemo(() => sortedRanks.map((rank, idx) => ({
    ...rank,
    _idx: idx,
    donors: donors
      .filter(d => {
        const av = Number(d.amount ?? d.actualDonation ?? d.monthly_amount ?? 0);
        return av > 0 && getRankForAmount(av, sortedRanks)?.id === rank.id;
      })
      .sort((a, b) => new Date(b.updated_at || b.updatedAt || 0) - new Date(a.updated_at || a.updatedAt || 0))
  })), [sortedRanks, donors]);

  const showShtiebel = Boolean(settings?.displayShtiebel);
  const bgBigDon = settings?.bgBigDonations ? settings.bgBigDonations : '';

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundImage: `url("${ASSET.bgSky}")`, backgroundSize: '100% 100%' }}>
        <img src={ASSET.logo1} alt="" style={{ height: 'clamp(60px,12vh,160px)' }} />
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundImage: `url("${ASSET.bgSky}")`,
      backgroundSize: '100% 100%',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Frank Ruhl Libre','Heebo','David',serif",
      direction: 'rtl',
      overflow: 'hidden',
      height: '100vh',
      width: '100vw',
    }}>

      {/* ═══════ HEADER ═══════ */}
      {/* RTL flex: items render right→left in DOM order. Tight grouping with gap matching the columns row (1vw). */}
      <div style={{
        flexShrink: 0,
        height: '12vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.6vh 1.5vw',
        gap: '1vw',
        position: 'relative',
      }}>
        {/* RIGHT side (first in RTL) — חלבי ובשרי logo (larger; aligned at top) */}
        <img src={ASSET.logo1} alt="logo" style={{ flexShrink: 0, alignSelf: 'flex-start', marginTop: '0.25vh', height: '13.5vh', width: 'auto', maxWidth: '14vw', objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))' }} />

        {/* Collected frame — now on the right (next to logo2) */}
        <div style={{ position: 'relative', flexShrink: 0, height: '11vh' }}>
          <img src={ASSET.collectedFrame} alt="" style={{ height: '100%', width: 'auto', display: 'block' }} />
          <div style={{
            position: 'absolute', left: '5%', right: '5%', bottom: '5%', height: '55%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#3a1a6e', fontSize: 'clamp(16px,1.8vw,32px)', fontWeight: 900, direction: 'ltr',
          }}>
            {fmt(animCollected)}
          </div>
        </div>

        {/* Center progress bar — natural aspect (5.7:1). Height grows with width to avoid distortion. */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            position: 'relative',
            width: 'min(50vw, calc(11vh * 5.7))',
            maxHeight: '11vh',
            aspectRatio: '5.7 / 1',
          }}>
            <img src={ASSET.progressEmpty} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
            <img
              src={ASSET.progressFull}
              alt=""
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%', display: 'block',
                clipPath: `inset(0 0 0 ${Math.max(0, 100 - pct)}%)`,
                transition: 'clip-path 0.6s ease-out',
              }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#3a1a6e', fontSize: 'clamp(20px,2.4vw,42px)', fontWeight: 900,
              textShadow: '0 1px 3px rgba(255,255,255,0.6)',
            }}>
              {pct}% מהיעד
            </div>
          </div>
        </div>

        {/* Remaining frame — now on the left (next to logo1) */}
        <div style={{ position: 'relative', flexShrink: 0, height: '11vh' }}>
          <img src={ASSET.remainingFrame} alt="" style={{ height: '100%', width: 'auto', display: 'block' }} />
          <div style={{
            position: 'absolute', left: '5%', right: '5%', bottom: '5%', height: '55%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#3a1a6e', fontSize: 'clamp(16px,1.8vw,32px)', fontWeight: 900, direction: 'ltr',
          }}>
            {fmt(animRemaining)}
          </div>
        </div>

        {/* LEFT side (last in RTL) — קרן התורה logo */}
        <img src={ASSET.logo2} alt="logo" style={{ flexShrink: 0, height: '11.5vh', width: 'auto', maxWidth: '12vw', objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))' }} />
      </div>

      {/* ═══════ MAIN PURPLE AREA ═══════ */}
      <div style={{
        flex: 1,
        minHeight: 0,
        backgroundImage: `url("${ASSET.bgPurple}")`,
        // Stretch the image taller than the container & anchor at top,
        // so the torn TOP edge stays visible but the torn BOTTOM edge is clipped below the viewport.
        backgroundSize: '100% 103%',
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Mazal tov text */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '2.5vh 0 0.8vh' }}>
          <img src={ASSET.mazalTov} alt="מזל טוב" style={{ maxHeight: '7vh', maxWidth: '70vw', objectFit: 'contain' }} />
        </div>

        {/* ═══ Columns row ═══ */}
        <div style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row',
          gap: '1vw',
          padding: '0.5vh 4.5vw 5vh',
          overflow: 'hidden',
          alignItems: 'stretch',
        }}>
          {/* Shtiebel panel — first in DOM = rightmost in RTL */}
          {showShtiebel && (
            <ShtiebelPanel donors={donors} allShtieblach={shtieblach} settings={settings} />
          )}

          {[...ranksWithDonors].reverse().map((rank) => (
            <RankColumn
              key={rank.id}
              rank={rank}
              donors={rank.donors}
              rankIndex={rank._idx}
              totalRanks={sortedRanks.length}
              settings={settings}
            />
          ))}

          {ranksWithDonors.length === 0 && (
            <div style={{ color: 'rgba(240,220,180,0.5)', fontSize: 'clamp(14px,1.5vw,24px)', margin: 'auto' }}>אין דרגות מוגדרות</div>
          )}
        </div>

      </div>

      {/* CSS animations + hide accessibility widget on this screen */}
      <style jsx global>{`
        @keyframes c179In  { 0%{opacity:0;transform:scale(0.3) translateY(80px)} 60%{opacity:1;transform:scale(1.05) translateY(-10px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes c179Out { 0%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(0.7)} }
        .c179-in  { animation: c179In  0.6s ease-out forwards; }
        .c179-out { animation: c179Out 0.4s ease-in  forwards; }

        @keyframes c179CelebFade {
          0%   { opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes c179CelebPop {
          0%   { transform: scale(0.4) translateY(40px); opacity: 0; }
          25%  { transform: scale(1.08) translateY(-6px); opacity: 1; }
          40%  { transform: scale(1) translateY(0); opacity: 1; }
          85%  { transform: scale(1) translateY(0); opacity: 1; }
          100% { transform: scale(0.85) translateY(-10px); opacity: 0; }
        }
        .c179-celeb     { animation: c179CelebFade 3s ease-out forwards; }
        .c179-celeb-pop { animation: c179CelebPop  3s cubic-bezier(.16,.84,.32,1) forwards; }

        .a11y-trigger, .a11y-menu { display: none !important; }
      `}</style>

      {/* ═══════ NEW-DONOR CELEBRATION (3s confetti pop) ═══════ */}
      {celebState && (() => {
        const d = celebState.donor;
        const name = [d.first_name || d.firstName, d.last_name || d.lastName].filter(Boolean).join(' ');
        return (
          <div className="c179-celeb"
            style={{
              position: 'fixed', inset: 0, zIndex: 9998,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(20,8,40,0.55)',
              backdropFilter: 'blur(2px)',
              pointerEvents: 'none',
            }}
          >
            {/* Confetti canvas */}
            <canvas ref={celebCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} />

            {/* Centerpiece — rank title + large donor pill */}
            <div className="c179-celeb-pop" style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2vh' }}>
              {celebState.titleImg && (
                <img src={celebState.titleImg} alt={celebState.rank?.name || ''}
                  style={{ height: 'clamp(80px,18vh,260px)', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.55))' }}
                />
              )}
              <div style={{ position: 'relative', width: 'min(70vw, 900px)' }}>
                <img src={celebState.frameImg} alt="" style={{ width: '100%', display: 'block', filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.55))' }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: celebState.textColor, fontSize: 'clamp(28px,4.5vw,80px)', fontWeight: 900,
                  fontFamily: "'Frank Ruhl Libre','Heebo','David',serif",
                  padding: '0 6%',
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', textAlign: 'center' }}>
                    {d.isAnonymous ? 'בעילום שם' : (name || 'תורם אנונימי')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════ BIG DONATION OVERLAY ═══════ */}
      {overlayStage !== 'hidden' && overlayDonor && (
        <div className={overlayStage === 'in' ? 'c179-in' : 'c179-out'}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            backgroundImage: bgBigDon ? `url("${bgBigDon}") center/100% 100% no-repeat` : `url("${ASSET.bgPurple}")`,
            backgroundSize: '100% 100%',
          }}
        >
          <div style={{ position: 'absolute', inset: 'clamp(20px,5vh,80px)', border: 'clamp(3px,0.6vw,10px) solid rgba(200,169,110,0.6)', borderRadius: 'clamp(16px,3vw,50px)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'clamp(16px,3vw,50px)', maxWidth: '85%' }}>
            {/* Rank title image if available */}
            {(() => {
              const av = Number(overlayDonor.amount ?? overlayDonor.actualDonation ?? 0);
              const r = getRankForAmount(av, sortedRanks);
              const k = r ? Object.keys(RANK_MAP).find(k => r.name?.includes(k.split(' ')[0])) : null;
              const img = k ? RANK_MAP[k].title : null;
              return img ? <img src={img} alt="" style={{ height: 'clamp(60px,12vh,160px)', marginBottom: '2vh', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }} /> : null;
            })()}

            <div style={{ fontSize: settings?.bsNameFontSize || 'clamp(36px,7vw,120px)', fontWeight: 'bold', color: settings?.bsNameColor || '#f5ead2', WebkitTextStroke: '0.15vw #8a6030', textAlign: 'center', lineHeight: 1.1, textShadow: '0 4px 16px rgba(0,0,0,0.6)', marginBottom: '2vh' }}>
              {overlayDonor.isAnonymous ? 'בעילום שם' : ([overlayDonor.first_name || overlayDonor.firstName, overlayDonor.last_name || overlayDonor.lastName].filter(Boolean).join(' ') || 'תורם אנונימי')}
            </div>

            {(settings?.bsShowAmount ?? true) && (
              <div style={{ fontSize: settings?.bsAmountFontSize || 'clamp(44px,9vw,150px)', fontWeight: 'bold', color: settings?.bsAmountColor || '#f5ead2', WebkitTextStroke: '0.2vw #8a6030', textShadow: '0 6px 20px rgba(0,0,0,0.6)' }}>
                {fmt(Number(overlayDonor.amount ?? overlayDonor.actualDonation ?? overlayDonor.monthly_amount ?? 0))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
