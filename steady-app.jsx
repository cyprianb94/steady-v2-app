import { useState, useEffect, useRef } from "react";

const C = {
  cream: '#F4EFE6', surface: '#FDFAF5', card: '#F0EAE0',
  ink: '#1C1510', ink2: '#3D3028', muted: '#9A8E7E', border: '#E5DDD0',
  clay: '#C4522A', clayBg: '#FDF0EB',
  amber: '#D4882A', amberBg: '#FDF6EB',
  forest: '#2A5C45', forestBg: '#EEF4F1',
  navy: '#1B3A6B', navyBg: '#EDF1F8',
  slate: '#8A8E9A',
};

const TYPE_COLOR = { INTERVAL: C.clay, TEMPO: C.amber, EASY: C.forest, LONG: C.navy, REST: C.slate };
const TYPE_BG = { INTERVAL: C.clayBg, TEMPO: C.amberBg, EASY: C.forestBg, LONG: C.navyBg, REST: '#F4F4F6' };

const sessions = [
  { id:1, day:'M', date:'Mar 17', type:'EASY', name:'Easy 10km', status:'completed',
    planned:{ distance:'10.0km', pace:'5:20–5:40/km', hr:'Zone 2' },
    actual:{ distance:'10.2km', pace:'5:32/km', hr:'138 bpm', elapsed:'56:17' },
    splits:[5.20,5.28,5.35,5.30,5.38,5.25,5.31,5.36,5.29,5.28],
    plannedSplits:[5.30,5.30,5.30,5.30,5.30,5.30,5.30,5.30,5.30,5.30],
    coach:'Solid easy run. HR averaged 138 — well within Zone 2. Pace conservatively managed after the interval day. This is exactly how an easy Monday should look.' },
  { id:2, day:'T', date:'Mar 18', type:'INTERVAL', name:'6×800m', status:'off-target',
    planned:{ distance:'13km total', pace:'3:52/km per rep', hr:'Zone 5' },
    actual:{ distance:'12.8km', pace:'3:58/km avg reps', hr:'174 bpm', elapsed:'1:04:22' },
    splits:[3.51,3.53,3.55,4.02,4.05,4.08],
    plannedSplits:[3.52,3.52,3.52,3.52,3.52,3.52],
    coach:'Reps 1–3 hit target at 3:51–3:55/km. Then reps 4–6 faded to 4:02–4:08/km. Your warmup HR was 147 — elevated before you even started. This is accumulated fatigue from the block, not a fitness ceiling. Worth discussing before Thursday.' },
  { id:3, day:'W', date:'Mar 19', type:'EASY', name:'Easy 8km + legs', status:'completed',
    planned:{ distance:'8.0km', pace:'5:30–5:50/km', hr:'Zone 2' },
    actual:{ distance:'7.9km', pace:'5:41/km', hr:'132 bpm', elapsed:'44:59' },
    splits:[5.42,5.38,5.44,5.40,5.43,5.39,5.42,5.41],
    plannedSplits:[5.40,5.40,5.40,5.40,5.40,5.40,5.40,5.40],
    coach:'Easy effort, HR well controlled at 132. Good recovery session. This is exactly how a Wednesday should look when you have a tempo the next day.' },
  { id:4, day:'T', date:'Mar 20', type:'TEMPO', name:'12km Tempo', status:'today',
    planned:{ distance:'12km', pace:'4:10–4:20/km', hr:'Zone 4' }, actual:null, coach:null },
  { id:5, day:'F', date:'Mar 21', type:'REST', name:'Rest', status:'upcoming',
    planned:null, actual:null, coach:null },
  { id:6, day:'S', date:'Mar 22', type:'EASY', name:'Easy 14km', status:'upcoming',
    planned:{ distance:'14km', pace:'5:20–5:40/km', hr:'Zone 2' }, actual:null, coach:null },
  { id:7, day:'S', date:'Mar 23', type:'LONG', name:'22km Long Run', status:'upcoming',
    planned:{ distance:'22km', pace:'5:10–5:30/km', hr:'Zone 2–3' }, actual:null, coach:null },
];

const chatMessages = [
  { role:'coach', time:'9:14am', text:"Yesterday's intervals — let me give you the honest read." },
  { role:'coach', time:'9:14am', text:"Reps 1–3 were exactly on target at 3:51–3:55/km. Then reps 4–6 drifted to 4:02–4:08/km. Your warmup HR was already at 147 — above amber threshold — and hit 178 by rep 4. This is accumulated fatigue from the training block. Not a fitness problem." },
  { role:'user', time:'9:22am', text:"Yeah reps 4 and 5 felt horrible. Legs just stopped responding." },
  { role:'coach', time:'9:23am', text:"Exactly right — and that's useful information. The speed is clearly there; reps 1–3 prove it.\n\nI want to flag Thursday's tempo. Given the fatigue reading, I'd suggest converting it to an easy 10km. You have a 22km long run Sunday — that's the key session this week. Better to arrive fresh." },
  { role:'plan-edit', time:'9:23am',
    before:{ name:'12km Tempo Run', pace:'4:10–4:20/km', distance:'12km' },
    after:{ name:'Easy 10km', pace:'5:20–5:40/km', distance:'10km' },
    sessionDate:'Thu Mar 20' },
  { role:'user', time:'9:31am', text:"Makes sense. Let's do it." },
  { role:'coach', time:'9:31am', text:"Done — plan updated. Thursday is now an easy 10km. That gives you 3 days of relatively low stress before the long run.\n\nFor Sunday: start at 5:25/km, no faster. Don't let the first 5km feel easy." },
];

function PaceTrace({ planned, actual, type }) {
  if (!planned?.length || !actual?.length) return null;
  const w = 260, h = 52;
  const all = [...planned, ...actual];
  const mn = Math.min(...all) - 0.05, mx = Math.max(...all) + 0.05;
  const toY = v => h - ((v - mn) / (mx - mn)) * h;
  const toX = (i, len) => (i / (len - 1)) * w;
  const path = arr => arr.map((v, i) => `${i===0?'M':'L'}${toX(i,arr.length).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ overflow:'visible', display:'block' }}>
      <path d={path(planned)} stroke={C.border} strokeWidth="1.5" fill="none" strokeDasharray="5 3"/>
      <path d={path(actual)} stroke={TYPE_COLOR[type]||C.clay} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SessionSheet({ session, onClose }) {
  const si = { completed:{label:'COMPLETED',color:C.forest}, 'off-target':{label:'OFF TARGET',color:C.amber}, today:{label:'TODAY',color:C.clay}, upcoming:{label:'UPCOMING',color:C.muted} }[session.status]||{label:'—',color:C.muted};
  const tc = TYPE_COLOR[session.type]||C.muted;

  return (
    <div style={{ position:'absolute', inset:0, background:'rgba(28,21,16,0.55)', zIndex:50, display:'flex', flexDirection:'column', justifyContent:'flex-end' }} onClick={onClose}>
      <div style={{ background:C.surface, borderRadius:'20px 20px 0 0', maxHeight:'88%', overflow:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:C.border }}/>
        </div>
        <div style={{ padding:'8px 20px 16px', borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:10, letterSpacing:1.5, color:tc, fontWeight:600, textTransform:'uppercase' }}>{session.type}</span>
              <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:22, color:C.ink, margin:'4px 0 2px', fontWeight:600 }}>{session.name}</h2>
              <p style={{ fontFamily:'DM Sans, sans-serif', color:C.muted, fontSize:13, margin:0 }}>{session.date}</p>
            </div>
            <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:9, letterSpacing:1.5, color:si.color, fontWeight:700, textTransform:'uppercase', marginTop:4 }}>{si.label}</span>
          </div>
        </div>

        {session.planned && (
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}` }}>
            <p style={{ fontFamily:'DM Sans, sans-serif', fontSize:9, letterSpacing:1.5, textTransform:'uppercase', color:C.muted, fontWeight:600, margin:'0 0 10px' }}>PLANNED</p>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
              {Object.entries(session.planned).map(([k,v])=>(
                <div key={k}>
                  <div style={{ fontFamily:'Space Mono, monospace', fontSize:14, color:C.ink, fontWeight:700 }}>{v}</div>
                  <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:10, color:C.muted, marginTop:2 }}>{k==='hr'?'heart rate':k==='pace'?'target pace':'distance'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {session.actual && (
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}` }}>
            <p style={{ fontFamily:'DM Sans, sans-serif', fontSize:9, letterSpacing:1.5, textTransform:'uppercase', color:C.muted, fontWeight:600, margin:'0 0 10px' }}>ACTUAL</p>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
              {Object.entries(session.actual).map(([k,v])=>(
                <div key={k}>
                  <div style={{ fontFamily:'Space Mono, monospace', fontSize:14, color:C.ink, fontWeight:700 }}>{v}</div>
                  <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:10, color:C.muted, marginTop:2 }}>{k==='hr'?'avg HR':k==='pace'?'avg pace':k==='elapsed'?'elapsed':'distance'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {session.actual && session.splits && (
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}` }}>
            <p style={{ fontFamily:'DM Sans, sans-serif', fontSize:9, letterSpacing:1.5, textTransform:'uppercase', color:C.muted, fontWeight:600, margin:'0 0 10px' }}>PACE TRACE</p>
            <div style={{ display:'flex', gap:14, marginBottom:10 }}>
              {[['──  ─','planned',C.muted,true],['───','actual',tc,false]].map(([sym,lab,col,dash])=>(
                <div key={lab} style={{ display:'flex', gap:5, alignItems:'center' }}>
                  <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={col} strokeWidth="2" strokeDasharray={dash?"4 2":undefined}/></svg>
                  <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:11, color:C.muted }}>{lab}</span>
                </div>
              ))}
            </div>
            <PaceTrace planned={session.plannedSplits} actual={session.splits} type={session.type}/>
          </div>
        )}

        {session.coach && (
          <div style={{ padding:'14px 20px 20px' }}>
            <p style={{ fontFamily:'DM Sans, sans-serif', fontSize:9, letterSpacing:1.5, textTransform:'uppercase', color:C.muted, fontWeight:600, margin:'0 0 10px' }}>STEADY'S READ</p>
            <p style={{ fontFamily:'DM Sans, sans-serif', fontSize:14, color:C.ink2, lineHeight:1.65, margin:0 }}>{session.coach}</p>
          </div>
        )}

        {!session.actual && session.status==='today' && (
          <div style={{ padding:'16px 20px 24px' }}>
            <div style={{ background:C.clayBg, border:`1px solid ${C.clay}30`, borderRadius:10, padding:'12px 14px' }}>
              <p style={{ fontFamily:'DM Sans, sans-serif', fontSize:13, color:C.ink2, lineHeight:1.5, margin:0 }}>
                This session is scheduled for today. Your run will appear here once it syncs from Strava or Apple Health — usually within 15 minutes of finishing.
              </p>
            </div>
          </div>
        )}
        {!session.actual && session.status==='upcoming' && (
          <div style={{ padding:'16px 20px 24px' }}>
            <p style={{ fontFamily:'DM Sans, sans-serif', fontSize:14, color:C.muted, lineHeight:1.5, margin:0 }}>Upcoming session — check back after your run.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WeekTab({ onSessionClick }) {
  const doneKm = 31.1, plannedKm = 67;
  const pct = doneKm/plannedKm;
  const dot = s => ({ completed:{c:C.forest,l:'✓'}, 'off-target':{c:C.amber,l:'⚠'}, today:{c:C.clay,l:'›'}, upcoming:{c:C.border,l:''} }[s.status]||{c:C.muted,l:''});

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'18px 14px 0' }}>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:11, color:C.muted, letterSpacing:0.5, marginBottom:3 }}>MAR 17 – 23 · 2026</div>
        <h1 style={{ fontFamily:'Playfair Display, serif', fontSize:24, color:C.ink, margin:0, fontWeight:600, lineHeight:1.2 }}>Week 14 · Build Phase</h1>
      </div>

      <div style={{ background:C.surface, borderRadius:12, padding:'12px 14px', border:`1px solid ${C.border}`, marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:10, color:C.muted, letterSpacing:1, textTransform:'uppercase', fontWeight:600 }}>WEEKLY LOAD</span>
          <div style={{ display:'flex', gap:10 }}>
            <span style={{ fontFamily:'Space Mono, monospace', fontSize:12, color:C.forest, fontWeight:700 }}>{doneKm}km</span>
            <span style={{ fontFamily:'Space Mono, monospace', fontSize:12, color:C.muted }}>/ {plannedKm}km</span>
          </div>
        </div>
        <div style={{ height:5, background:C.border, borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct*100}%`, background:C.forest, borderRadius:3 }}/>
        </div>
      </div>

      <div style={{ background:`${C.clay}0C`, border:`1px solid ${C.clay}28`, borderRadius:10, padding:'10px 12px', marginBottom:14, display:'flex', gap:9, alignItems:'flex-start' }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:C.clay, marginTop:5, flexShrink:0 }}/>
        <p style={{ fontFamily:'DM Sans, sans-serif', fontSize:13, color:C.ink2, margin:0, lineHeight:1.5 }}>
          <strong style={{ fontWeight:600, color:C.ink }}>Steady</strong> — Tempo today. Your last tempo faded in the back half. Start at 4:18 and build — don't force 4:10 from the gun.
        </p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5, marginBottom:12 }}>
        {sessions.map(s => {
          const d = dot(s), tc = TYPE_COLOR[s.type]||C.slate, isToday = s.status==='today', isRest = s.type==='REST';
          return (
            <div key={s.id} onClick={()=>!isRest&&onSessionClick(s)} style={{
              background: isToday ? '#FFFDF8' : C.cream,
              border: isToday ? `1.5px solid ${C.clay}` : `1px solid ${C.border}`,
              borderRadius:10, padding:'8px 3px', cursor:isRest?'default':'pointer',
              display:'flex', flexDirection:'column', alignItems:'center', gap:5,
              minHeight: isRest ? 68 : 86,
              boxShadow: isToday ? `0 2px 10px ${C.clay}20` : 'none',
            }}>
              <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:9, fontWeight:600, color:isToday?C.clay:C.muted, letterSpacing:0.5, textTransform:'uppercase' }}>{s.day}</span>
              {!isRest && <>
                <div style={{ width:7, height:7, borderRadius:'50%', background:tc, opacity: s.status==='upcoming'?0.5:1 }}/>
                <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:8.5, color:C.ink2, fontWeight:500, textAlign:'center', lineHeight:1.25 }}>
                  {s.name.length>10?s.name.slice(0,9)+'…':s.name}
                </span>
                {d.l && <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:12, color:d.c, fontWeight:700, lineHeight:1 }}>{d.l}</span>}
                {s.actual && <span style={{ fontFamily:'Space Mono, monospace', fontSize:8, color:C.muted, textAlign:'center' }}>{s.actual.distance}</span>}
              </>}
              {isRest && <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:9, color:C.muted, marginTop:6 }}>rest</span>}
            </div>
          );
        })}
      </div>

      <div style={{ display:'flex', gap:10, flexWrap:'wrap', paddingBottom:20 }}>
        {Object.entries(TYPE_COLOR).filter(([t])=>t!=='REST').map(([t,c])=>(
          <div key={t} style={{ display:'flex', gap:5, alignItems:'center' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:c }}/>
            <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:9, color:C.muted, textTransform:'capitalize', letterSpacing:0.3 }}>{t.charAt(0)+t.slice(1).toLowerCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockTab() {
  const weeks = [
    { n:10, d:'Feb 24', t:['EASY','INTERVAL','EASY','TEMPO','REST','EASY','LONG'], p:52, a:49, pct:94 },
    { n:11, d:'Mar 3',  t:['EASY','INTERVAL','EASY','TEMPO','REST','EASY','LONG'], p:58, a:54, pct:93 },
    { n:12, d:'Mar 10', t:['EASY','EASY','REST','EASY','REST','EASY','EASY'],      p:44, a:44, pct:100, label:'Recovery' },
    { n:13, d:'Mar 10', t:['EASY','INTERVAL','EASY','TEMPO','REST','EASY','LONG'], p:62, a:58, pct:94 },
    { n:14, d:'Mar 17', t:['EASY','INTERVAL','EASY','TEMPO','REST','EASY','LONG'], p:67, a:31, pct:46, current:true },
    { n:15, d:'Mar 24', t:['EASY','INTERVAL','EASY','TEMPO','REST','EASY','LONG'], p:70, a:null },
    { n:16, d:'Mar 31', t:['EASY','INTERVAL','EASY','TEMPO','REST','EASY','LONG'], p:72, a:null },
    { n:17, d:'Apr 7',  t:['EASY','INTERVAL','EASY','REST','REST','EASY','LONG'],  p:56, a:null, label:'Peak' },
    { n:18, d:'Apr 14', t:['EASY','TEMPO','EASY','REST','REST','EASY','REST'],     p:38, a:null, label:'Taper' },
  ];
  const phases = [{ l:'BASE',w:2 },{ l:'BUILD',w:5,active:true },{ l:'PEAK',w:1 },{ l:'TAPER',w:1 }];

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'18px 14px 0' }}>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:10, color:C.muted, letterSpacing:1, textTransform:'uppercase', fontWeight:600, marginBottom:3 }}>GOAL RACE</div>
        <h1 style={{ fontFamily:'Playfair Display, serif', fontSize:22, color:C.ink, margin:0, fontWeight:600 }}>San Sebastián Marathon</h1>
        <div style={{ display:'flex', gap:14, marginTop:6, flexWrap:'wrap' }}>
          {[['Nov 22, 2026',C.clay],['18 weeks out',C.muted],['sub-3:30',C.navy]].map(([v,c])=>(
            <span key={v} style={{ fontFamily:'Space Mono, monospace', fontSize:11, color:c, fontWeight:700 }}>{v}</span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:18 }}>
        <div style={{ display:'flex', gap:2, height:26, borderRadius:6, overflow:'hidden', marginBottom:5 }}>
          {phases.map(p=>(
            <div key={p.l} style={{ flex:p.w, background:p.active?C.clay:C.border, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:8.5, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:p.active?'white':C.muted }}>{p.l}</span>
            </div>
          ))}
        </div>
        <p style={{ fontFamily:'DM Sans, sans-serif', fontSize:11, color:C.muted, margin:0 }}>Build phase · Week 5 of 8 · Peak volume approaching</p>
      </div>

      {weeks.map(w=>(
        <div key={w.n} style={{
          marginBottom:6, background:w.current?C.surface:'transparent',
          border:w.current?`1.5px solid ${C.clay}35`:`1px solid ${w.a!==null&&!w.current?C.border:'transparent'}`,
          borderRadius:10, padding:'10px 12px',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, flexShrink:0 }}>
              <div style={{ fontFamily:'Space Mono, monospace', fontSize:11, color:w.current?C.clay:C.muted, fontWeight:w.current?700:400 }}>W{w.n}</div>
              <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:9, color:C.muted, marginTop:1 }}>{w.d}</div>
            </div>
            <div style={{ display:'flex', gap:3.5, flex:1, alignItems:'center' }}>
              {w.t.map((t,i)=>(
                <div key={i} style={{ width:9, height:9, borderRadius:'50%', background:w.a!==null||w.current?(TYPE_COLOR[t]||C.slate):C.border, opacity:w.a===null&&!w.current?0.4:1 }}/>
              ))}
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              {w.a!==null ? (
                <span style={{ fontFamily:'Space Mono, monospace', fontSize:10, color:C.ink }}>{w.a}/{w.p}km</span>
              ) : w.current ? (
                <span style={{ fontFamily:'Space Mono, monospace', fontSize:10, color:C.clay }}>{w.a}/ {w.p}km</span>
              ) : (
                <span style={{ fontFamily:'Space Mono, monospace', fontSize:10, color:C.muted }}>{w.p}km</span>
              )}
              {w.label && <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:8.5, color:C.muted, letterSpacing:0.5, textTransform:'uppercase', marginTop:2 }}>{w.label}</div>}
            </div>
          </div>
          {(w.a!==null||w.current) && (
            <div style={{ marginTop:7, height:3, background:C.border, borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${w.pct||0}%`, background:w.pct===100?C.forest:w.pct>70?C.amber:C.clay, borderRadius:2 }}/>
            </div>
          )}
        </div>
      ))}
      <div style={{ height:24 }}/>
    </div>
  );
}

function CoachTab() {
  const [input, setInput] = useState('');
  const [applied, setApplied] = useState(false);
  const endRef = useRef(null);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}); },[]);

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 16px 11px', borderBottom:`1px solid ${C.border}`, background:C.surface, display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <div style={{ width:38, height:38, borderRadius:'50%', background:C.ink, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontFamily:'Playfair Display, serif', fontSize:17, color:C.cream, fontWeight:700 }}>S</span>
        </div>
        <div>
          <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:15, fontWeight:600, color:C.ink, lineHeight:1.2 }}>Steady</div>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:C.forest }}/>
            <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:10.5, color:C.muted }}>Active · reading your full plan</span>
          </div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 14px 8px' }}>
        <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:10.5, color:C.muted, textAlign:'center', marginBottom:14, letterSpacing:0.3 }}>Today · Tue Mar 18</div>

        {chatMessages.map((m,i)=>{
          if (m.role==='plan-edit') return (
            <div key={i} style={{ marginBottom:12 }}>
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
                <div style={{ background:`${C.amber}18`, padding:'8px 12px', borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:C.amber }}>PLAN EDIT PROPOSAL · {m.sessionDate}</span>
                </div>
                <div style={{ display:'flex', padding:'10px 12px', gap:8 }}>
                  <div style={{ flex:1, background:'#FEF2F2', borderRadius:8, padding:'8px 10px' }}>
                    <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:8.5, color:'#991B1B', fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:6 }}>Before</div>
                    <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:12, fontWeight:600, color:C.ink }}>{m.before.name}</div>
                    <div style={{ fontFamily:'Space Mono, monospace', fontSize:10, color:C.muted, marginTop:4 }}>{m.before.distance}</div>
                    <div style={{ fontFamily:'Space Mono, monospace', fontSize:10, color:C.muted }}>{m.before.pace}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', color:C.amber, fontFamily:'Space Mono, monospace', fontSize:14, fontWeight:700, flexShrink:0 }}>→</div>
                  <div style={{ flex:1, background:'#F0FDF4', borderRadius:8, padding:'8px 10px' }}>
                    <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:8.5, color:'#166534', fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:6 }}>After</div>
                    <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:12, fontWeight:600, color:C.ink }}>{m.after.name}</div>
                    <div style={{ fontFamily:'Space Mono, monospace', fontSize:10, color:C.muted, marginTop:4 }}>{m.after.distance}</div>
                    <div style={{ fontFamily:'Space Mono, monospace', fontSize:10, color:C.muted }}>{m.after.pace}</div>
                  </div>
                </div>
                {!applied ? (
                  <div style={{ display:'flex', gap:8, padding:'0 12px 12px' }}>
                    <button onClick={()=>setApplied(true)} style={{ flex:1, padding:'9px', borderRadius:8, border:'none', background:C.forest, color:'white', fontFamily:'DM Sans, sans-serif', fontSize:12, fontWeight:600, cursor:'pointer' }}>Apply change</button>
                    <button style={{ flex:1, padding:'9px', borderRadius:8, border:`1px solid ${C.border}`, background:'transparent', fontFamily:'DM Sans, sans-serif', fontSize:12, color:C.muted, cursor:'pointer' }}>Discuss more</button>
                  </div>
                ) : (
                  <div style={{ padding:'0 12px 12px' }}>
                    <div style={{ background:C.forestBg, borderRadius:8, padding:'9px 12px', fontFamily:'DM Sans, sans-serif', fontSize:12, color:C.forest, fontWeight:500, display:'flex', gap:6, alignItems:'center' }}>
                      <span style={{ fontSize:14 }}>✓</span> Plan updated — Thursday changed to Easy 10km
                    </div>
                  </div>
                )}
              </div>
            </div>
          );

          const isCoach = m.role==='coach';
          return (
            <div key={i} style={{ marginBottom:8, display:'flex', justifyContent:isCoach?'flex-start':'flex-end' }}>
              <div style={{
                maxWidth:'83%', background:isCoach?C.card:C.surface,
                borderRadius:isCoach?'5px 14px 14px 14px':'14px 5px 14px 14px',
                padding:'10px 13px', border:`1px solid ${isCoach?'#E0D8CE':C.border}`,
              }}>
                <p style={{ fontFamily:'DM Sans, sans-serif', fontSize:13.5, color:C.ink, margin:0, lineHeight:1.58, whiteSpace:'pre-line' }}>{m.text}</p>
                <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:9.5, color:C.muted, marginTop:4, textAlign:isCoach?'left':'right' }}>{m.time}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>

      <div style={{ padding:'8px 12px 16px', borderTop:`1px solid ${C.border}`, background:C.surface, display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Message Steady…"
          style={{ flex:1, padding:'10px 14px', borderRadius:22, border:`1px solid ${C.border}`, background:C.cream, fontFamily:'DM Sans, sans-serif', fontSize:14, color:C.ink, outline:'none' }}/>
        {input && (
          <button onClick={()=>setInput('')} style={{ width:36, height:36, borderRadius:'50%', background:C.clay, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:16, fontWeight:700, fontFamily:'DM Sans, sans-serif' }}>↑</button>
        )}
      </div>
    </div>
  );
}

function SettingsTab() {
  const sections = [
    { title:'PLAN', rows:[
      { l:'Training plan', v:'Custom 20-week marathon block', s:'Imported Mar 1 · 127 sessions' },
      { l:'Goal race', v:'San Sebastián Marathon', s:'Nov 22 · sub-3:30 target' },
    ]},
    { title:'INTEGRATIONS', rows:[
      { l:'Strava', v:'● Connected', vc:C.forest, s:'Auto-syncing activities' },
      { l:'Apple Health', v:'● Connected', vc:C.forest, s:'Auto-syncing workouts' },
      { l:'Garmin Connect', v:'○ Connect', vc:C.muted, s:'Tap to connect' },
    ]},
    { title:'SUBSCRIPTION', rows:[
      { l:'Plan', v:'Steady Pro', s:'£9.99/month · renews Apr 1' },
      { l:'Account', v:'cyprian@…', s:'' },
    ]},
  ];
  return (
    <div style={{ flex:1, overflowY:'auto', padding:'18px 14px 0' }}>
      <h1 style={{ fontFamily:'Playfair Display, serif', fontSize:26, color:C.ink, margin:'0 0 22px', fontWeight:600 }}>Settings</h1>
      {sections.map(sec=>(
        <div key={sec.title} style={{ marginBottom:22 }}>
          <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:9.5, fontWeight:700, letterSpacing:1.5, color:C.muted, textTransform:'uppercase', marginBottom:8 }}>{sec.title}</div>
          <div style={{ background:C.surface, borderRadius:12, border:`1px solid ${C.border}`, overflow:'hidden' }}>
            {sec.rows.map((r,i)=>(
              <div key={i} style={{ padding:'13px 16px', borderBottom:i<sec.rows.length-1?`1px solid ${C.border}`:'none', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:14, color:C.ink, fontWeight:500 }}>{r.l}</div>
                  {r.s && <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:11, color:C.muted, marginTop:2 }}>{r.s}</div>}
                </div>
                <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:13, color:r.vc||C.muted, textAlign:'right' }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ height:24 }}/>
    </div>
  );
}

const TabIcon = ({ id, active }) => {
  const s = active ? C.clay : C.muted;
  const icons = {
    week: <svg width="22" height="22" fill="none" viewBox="0 0 22 22"><rect x="2" y="4" width="18" height="15" rx="2" stroke={s} strokeWidth="1.5"/><path d="M7 2v5M15 2v5M2 10h18" stroke={s} strokeWidth="1.5" strokeLinecap="round"/></svg>,
    block: <svg width="22" height="22" fill="none" viewBox="0 0 22 22"><rect x="2" y="3" width="18" height="4" rx="1.5" fill={s} opacity={active?1:0.4}/><rect x="2" y="9" width="18" height="4" rx="1.5" fill={s}/><rect x="2" y="15" width="18" height="4" rx="1.5" fill={s} opacity={active?1:0.4}/></svg>,
    coach: <svg width="22" height="22" fill="none" viewBox="0 0 22 22"><path d="M4 3h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8l-4 3.5V5a2 2 0 0 1 2-2z" stroke={s} strokeWidth="1.5" strokeLinejoin="round"/><path d="M7 8h8M7 11h5" stroke={s} strokeWidth="1.5" strokeLinecap="round"/></svg>,
    settings: <svg width="22" height="22" fill="none" viewBox="0 0 22 22"><circle cx="11" cy="11" r="3" stroke={s} strokeWidth="1.5"/><path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.93 4.93l1.41 1.41M15.66 15.66l1.41 1.41M4.93 17.07l1.41-1.41M15.66 6.34l1.41-1.41" stroke={s} strokeWidth="1.5" strokeLinecap="round"/></svg>,
  };
  return icons[id];
};

export default function App() {
  const [tab, setTab] = useState('week');
  const [sel, setSel] = useState(null);

  useEffect(()=>{
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Space+Mono:wght@400;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap';
    document.head.appendChild(link);
    return ()=>{ try{document.head.removeChild(link)}catch{} };
  }, []);

  const tabs = ['week','block','coach','settings'];

  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'linear-gradient(135deg, #DDD8CE 0%, #C8C0B0 100%)', padding:20, boxSizing:'border-box', fontFamily:'DM Sans, system-ui, sans-serif' }}>
      <div style={{ width:390, height:844, maxHeight:'90vh', background:C.cream, borderRadius:44, boxShadow:'0 40px 100px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)', display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>

        {/* Status bar */}
        <div style={{ height:44, background:C.cream, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 28px', flexShrink:0 }}>
          <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:13, fontWeight:600, color:C.ink }}>9:41</span>
          <div style={{ display:'flex', gap:7, alignItems:'center' }}>
            <div style={{ display:'flex', gap:2, alignItems:'flex-end', height:10 }}>
              {[3,5,7,10].map((h,i)=><div key={i} style={{ width:3, height:h, background:C.ink, borderRadius:1 }}/>)}
            </div>
            <svg width="15" height="10" fill="none"><rect x=".75" y=".75" width="12" height="8.5" rx="1.5" stroke={C.ink} strokeWidth="1.5"/><rect x="13.5" y="3" width="1.5" height="4" rx=".75" fill={C.ink}/><rect x="2" y="2.25" width="8" height="5.5" rx=".75" fill={C.ink}/></svg>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
          {tab==='week' && <WeekTab onSessionClick={s=>setSel(s)}/>}
          {tab==='block' && <BlockTab/>}
          {tab==='coach' && <CoachTab/>}
          {tab==='settings' && <SettingsTab/>}
          {sel && <SessionSheet session={sel} onClose={()=>setSel(null)}/>}
        </div>

        {/* Tab bar */}
        <div style={{ height:70, borderTop:`1px solid ${C.border}`, display:'flex', background:C.surface, flexShrink:0, paddingBottom:6 }}>
          {tabs.map(t=>(
            <button key={t} onClick={()=>{setTab(t);setSel(null);}} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, background:'none', border:'none', cursor:'pointer', padding:'7px 0' }}>
              <TabIcon id={t} active={tab===t}/>
              <span style={{ fontFamily:'DM Sans, sans-serif', fontSize:10, fontWeight:tab===t?600:400, color:tab===t?C.clay:C.muted, letterSpacing:0.2, textTransform:'capitalize' }}>{t}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
