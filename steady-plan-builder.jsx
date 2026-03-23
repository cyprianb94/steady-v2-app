import { useState, useEffect, useRef, useCallback } from "react";

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  cream:'#F4EFE6', surface:'#FDFAF5',
  ink:'#1C1510', ink2:'#3D3028', muted:'#9A8E7E', border:'#E5DDD0',
  clay:'#C4522A', clayBg:'#FDF0EB',
  amber:'#D4882A', amberBg:'#FDF6EB',
  forest:'#2A5C45', forestBg:'#EEF4F1',
  navy:'#1B3A6B', navyBg:'#EDF1F8',
  slate:'#8A8E9A',
};
const TYPE = {
  EASY:     { color:C.forest, bg:C.forestBg, label:'Easy Run',  abbr:'E', emoji:'○' },
  INTERVAL: { color:C.clay,   bg:C.clayBg,   label:'Intervals', abbr:'I', emoji:'▲' },
  TEMPO:    { color:C.amber,  bg:C.amberBg,  label:'Tempo',     abbr:'T', emoji:'◆' },
  LONG:     { color:C.navy,   bg:C.navyBg,   label:'Long Run',  abbr:'L', emoji:'◉' },
  REST:     { color:C.slate,  bg:'#F2F2F4',  label:'Rest',      abbr:'R', emoji:'—' },
};
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const PHASE_COLOR = { BASE:C.navy, BUILD:C.clay, RECOVERY:'#7C5CBF', PEAK:C.amber, TAPER:C.forest };
const PHASE_META = {
  BASE:     { label:'Base',     color:C.navy,     desc:'Aerobic foundation, easy miles' },
  BUILD:    { label:'Build',    color:C.clay,     desc:'Intensity & volume increase' },
  RECOVERY: { label:'Recovery', color:'#7C5CBF',  desc:'Deload weeks, keep fresh' },
  PEAK:     { label:'Peak',     color:C.amber,    desc:'Highest load before taper' },
  TAPER:    { label:'Taper',    color:C.forest,   desc:'Wind down, stay sharp' },
};
const REP_DISTS = [200,300,400,500,600,800,1000,1200,1600,2000];
const RECOVERY_OPTS = ['45s','60s','90s','2min','3min','4min','5min'];

// Generate pace list from 3:00 to 7:00 in 5s increments
function genPaces() {
  const list = [];
  for (let m = 3; m <= 7; m++) {
    for (let s = 0; s < 60; s += 5) {
      list.push(`${m}:${String(s).padStart(2,'0')}`);
    }
  }
  return list;
}
const ALL_PACES = genPaces(); // 3:00 → 7:00

// Distance lists
const KM_LIST   = Array.from({length:39},(_,i)=>`${i+2}`);   // 2–40
const WU_LIST   = ['0.5','1','1.5','2','2.5','3','4','5'];
const REP_DIST_LIST = REP_DISTS.map(String);

function useFont() {
  useEffect(()=>{
    const l=document.createElement('link');
    l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Space+Mono:wght@400;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap';
    document.head.appendChild(l);
    return ()=>{try{document.head.removeChild(l)}catch{}};
  },[]);
}

// ── Scroll Drum Picker ────────────────────────────────────────────────────────
const ITEM_H = 38;
const VISIBLE = 5; // odd number
const PAD = Math.floor(VISIBLE/2);

function ScrollPicker({ items, value, onChange, formatDisplay, color, suffix='' }) {
  const ref = useRef(null);
  const idx = items.indexOf(String(value));
  const safeIdx = idx < 0 ? 0 : idx;
  const isScrolling = useRef(false);
  const timer = useRef(null);

  // Scroll to selected item on mount / value change
  useEffect(()=>{
    if (!ref.current || isScrolling.current) return;
    ref.current.scrollTop = safeIdx * ITEM_H;
  }, [safeIdx]);

  const handleScroll = useCallback(()=>{
    isScrolling.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(()=>{
      isScrolling.current = false;
      if (!ref.current) return;
      const rawIdx = Math.round(ref.current.scrollTop / ITEM_H);
      const clampedIdx = Math.max(0, Math.min(items.length-1, rawIdx));
      // Snap
      ref.current.scrollTop = clampedIdx * ITEM_H;
      onChange(items[clampedIdx]);
    }, 120);
  },[items, onChange]);

  const ac = color || C.clay;

  return (
    <div style={{position:'relative', height: ITEM_H * VISIBLE, overflow:'hidden', borderRadius:12,
      background:C.cream, border:`1.5px solid ${C.border}`, userSelect:'none'}}>
      {/* Fade top */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:ITEM_H*PAD,
        background:`linear-gradient(to bottom, ${C.cream}, ${C.cream}00)`,
        zIndex:2, pointerEvents:'none'}}/>
      {/* Highlight band */}
      <div style={{position:'absolute',top:ITEM_H*PAD,left:0,right:0,height:ITEM_H,
        background:`${ac}12`, borderTop:`1.5px solid ${ac}40`,
        borderBottom:`1.5px solid ${ac}40`, zIndex:1, pointerEvents:'none'}}/>
      {/* Fade bottom */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:ITEM_H*PAD,
        background:`linear-gradient(to top, ${C.cream}, ${C.cream}00)`,
        zIndex:2, pointerEvents:'none'}}/>
      {/* Scrollable list */}
      <div ref={ref} onScroll={handleScroll} style={{
        height:'100%', overflowY:'scroll', scrollSnapType:'y mandatory',
        scrollbarWidth:'none', msOverflowStyle:'none',
        WebkitOverflowScrolling:'touch',
      }}>
        <style>{`div::-webkit-scrollbar{display:none}`}</style>
        {/* Padding items top */}
        {Array.from({length:PAD},(_,i)=>(
          <div key={`t${i}`} style={{height:ITEM_H, scrollSnapAlign:'start'}}/>
        ))}
        {items.map((item,i)=>{
          const dist = Math.abs(i - safeIdx);
          const isCenter = dist === 0;
          return (
            <div key={item} onClick={()=>{
              if(ref.current) ref.current.scrollTop = i*ITEM_H;
              onChange(item);
            }} style={{
              height:ITEM_H, scrollSnapAlign:'start',
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', zIndex:3, position:'relative',
            }}>
              <span style={{
                fontFamily:'Space Mono, monospace',
                fontSize: isCenter ? 17 : dist===1 ? 13 : 11,
                fontWeight: isCenter ? 700 : 400,
                color: isCenter ? ac : dist===1 ? C.ink2 : C.muted,
                opacity: dist > 2 ? 0.3 : 1,
                transition:'all 0.1s',
              }}>{(formatDisplay ? formatDisplay(item) : item)}{suffix && isCenter ? suffix : ''}</span>
            </div>
          );
        })}
        {/* Padding items bottom */}
        {Array.from({length:PAD},(_,i)=>(
          <div key={`b${i}`} style={{height:ITEM_H, scrollSnapAlign:'start'}}/>
        ))}
      </div>
    </div>
  );
}

// ── Dual picker row (label + picker) ─────────────────────────────────────────
function PickerField({ label, items, value, onChange, color, suffix, note, half }) {
  return (
    <div style={{flex: half ? '0 0 48%' : 1}}>
      <div style={{fontFamily:'DM Sans,sans-serif', fontSize:9.5, letterSpacing:1.5,
        textTransform:'uppercase', fontWeight:700, color:C.muted, marginBottom:8}}>{label}</div>
      <ScrollPicker items={items} value={String(value)} onChange={onChange}
        color={color} suffix={suffix}/>
      {note && <div style={{fontFamily:'DM Sans,sans-serif',fontSize:10.5,color:C.muted,
        marginTop:6,lineHeight:1.4}}>{note}</div>}
    </div>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────
function Section({ children, last }) {
  return (
    <div style={{padding:'14px 20px', borderBottom: last ? 'none' : `1px solid ${C.border}`}}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{fontFamily:'DM Sans,sans-serif',fontSize:9.5,letterSpacing:1.5,
    textTransform:'uppercase',fontWeight:700,color:C.muted,marginBottom:12}}>{children}</div>;
}

// ── Rep Stepper (kept as stepper — reps are small integers) ──────────────────
function RepStepper({ value, onChange }) {
  return (
    <div style={{display:'flex',alignItems:'center',background:C.cream,
      borderRadius:10,border:`1.5px solid ${C.border}`,overflow:'hidden',alignSelf:'flex-start'}}>
      <button onClick={()=>onChange(Math.max(2,value-1))} style={{width:40,height:40,
        background:'none',border:'none',fontSize:22,color:C.clay,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>−</button>
      <div style={{minWidth:32,textAlign:'center',fontFamily:'Space Mono,monospace',
        fontSize:18,fontWeight:700,color:C.ink}}>{value}</div>
      <button onClick={()=>onChange(Math.min(20,value+1))} style={{width:40,height:40,
        background:'none',border:'none',fontSize:22,color:C.clay,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>+</button>
    </div>
  );
}

// ── Chip row (for rep distance only now) ─────────────────────────────────────
function ChipRow({ options, value, onChange, format, color }) {
  return (
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
      {options.map(o=>{
        const active = String(o)===String(value);
        const ac = color||C.clay;
        return (
          <button key={o} onClick={()=>onChange(o)} style={{
            fontFamily:'Space Mono,monospace', fontSize:11, fontWeight:active?700:400,
            padding:'6px 10px', borderRadius:8, cursor:'pointer',
            border:`1.5px solid ${active?ac:C.border}`,
            background:active?`${ac}18`:C.cream,
            color:active?ac:C.muted,
          }}>{format?format(o):o}</button>
        );
      })}
    </div>
  );
}

// ── Session summary label ─────────────────────────────────────────────────────
function sessionLabel(s) {
  if (!s||s.type==='REST') return 'Rest';
  if (s.type==='INTERVAL') {
    const wu = s.warmup ? `${s.warmup}km w/u · ` : '';
    const cd = s.cooldown ? ` · ${s.cooldown}km c/d` : '';
    return `${wu}${s.reps}×${s.repDist}m${s.pace?' @ '+s.pace:''}${cd}`;
  }
  return `${s.distance}km${s.pace?' @ '+s.pace:''}`;
}

function SessionDot({type, size=9}) {
  if (!type||type==='REST') return <div style={{width:size,height:size,borderRadius:'50%',background:C.border}}/>;
  return <div style={{width:size,height:size,borderRadius:'50%',background:TYPE[type].color}}/>;
}

// ── Session Editor Sheet ──────────────────────────────────────────────────────
function SessionEditor({ dayIndex, existing, onSave, onClose }) {
  const init = existing?.type || 'EASY';
  const [type,     setType]     = useState(init);
  const [dist,     setDist]     = useState(String(existing?.distance || '8'));
  const [reps,     setReps]     = useState(existing?.reps || 6);
  const [repDist,  setRepDist]  = useState(existing?.repDist || 800);
  const [pace,     setPace]     = useState(existing?.pace || '4:30');
  const [warmup,   setWarmup]   = useState(existing?.warmup || '1.5');
  const [cooldown, setCooldown] = useState(existing?.cooldown || '1');
  const [recovery, setRecovery] = useState(existing?.recovery || '90s');

  const isInterval = type==='INTERVAL';
  const isTempo    = type==='TEMPO';
  const isRest     = type==='REST';
  const needsPace  = !isRest;
  const needsWuCd  = isInterval||isTempo;
  const tc = TYPE[type];

  // Default paces by type
  const defaultPace = { EASY:'5:20', LONG:'5:10', TEMPO:'4:20', INTERVAL:'3:50' };
  useEffect(()=>{ setPace(existing?.pace || defaultPace[type] || '4:30'); },[type]);

  const build = () => {
    if (isRest) return { type:'REST' };
    const s = { type, pace };
    if (isInterval) Object.assign(s,{ reps, repDist, recovery, warmup, cooldown });
    else if (isTempo) Object.assign(s,{ distance:Number(dist), warmup, cooldown });
    else Object.assign(s,{ distance:Number(dist) });
    return s;
  };

  return (
    <div style={{position:'absolute',inset:0,background:'rgba(28,21,16,0.6)',zIndex:60,
      display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={onClose}>
      <div style={{background:C.surface,borderRadius:'22px 22px 0 0',
        maxHeight:'90%',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'center',padding:'10px 0 4px'}}>
          <div style={{width:36,height:4,borderRadius:2,background:C.border}}/>
        </div>

        {/* Header */}
        <div style={{padding:'6px 20px 12px',borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontFamily:'DM Sans,sans-serif',fontSize:12,color:C.muted,marginBottom:2}}>{DAYS[dayIndex]}</div>
          <div style={{fontFamily:'Playfair Display,serif',fontSize:18,color:tc.color,fontWeight:600,lineHeight:1.3,wordBreak:'break-word'}}>
            {isRest ? 'Rest day' : sessionLabel({type,distance:Number(dist),reps,repDist,pace,warmup,cooldown})}
          </div>
        </div>

        {/* Type picker */}
        <Section>
          <SectionLabel>Session type</SectionLabel>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6}}>
            {Object.entries(TYPE).map(([t,meta])=>(
              <button key={t} onClick={()=>setType(t)} style={{
                padding:'9px 4px',borderRadius:10,
                border:`1.5px solid ${type===t?meta.color:C.border}`,
                background:type===t?meta.bg:C.cream,cursor:'pointer',
                display:'flex',flexDirection:'column',alignItems:'center',gap:4,
              }}>
                <span style={{fontSize:13,color:meta.color}}>{meta.emoji}</span>
                <span style={{fontFamily:'DM Sans,sans-serif',fontSize:9,fontWeight:700,
                  color:type===t?meta.color:C.muted,letterSpacing:0.5}}>{meta.abbr}</span>
              </button>
            ))}
          </div>
        </Section>

        {!isRest && (
          <>
            {/* Reps + rep distance (intervals) OR distance (others) */}
            <Section>
              {isInterval ? (
                <>
                  <SectionLabel>Repetitions</SectionLabel>
                  <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
                    <RepStepper value={reps} onChange={setReps}/>
                    <span style={{fontFamily:'DM Sans,sans-serif',fontSize:13,color:C.muted}}>reps</span>
                  </div>
                  <SectionLabel>Rep distance</SectionLabel>
                  <ChipRow options={REP_DISTS} value={repDist} onChange={setRepDist}
                    format={v=>v+'m'} color={C.clay}/>
                  <div style={{marginTop:10,background:C.clayBg,borderRadius:8,padding:'8px 12px',
                    display:'flex',gap:10,alignItems:'center'}}>
                    <span style={{fontFamily:'Space Mono,monospace',fontSize:13,color:C.clay,fontWeight:700}}>
                      {reps}×{repDist}m
                    </span>
                    <span style={{fontFamily:'DM Sans,sans-serif',fontSize:11,color:C.muted}}>
                      ≈{Math.round(reps*repDist/1000*10)/10}km reps
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <SectionLabel>Distance</SectionLabel>
                  <ScrollPicker items={KM_LIST} value={dist} onChange={setDist}
                    color={tc.color} suffix=" km"/>
                </>
              )}
            </Section>

            {/* Target pace */}
            <Section>
              <SectionLabel>Target pace</SectionLabel>
              <ScrollPicker items={ALL_PACES} value={pace} onChange={setPace}
                color={tc.color} suffix=" /km"/>
              <div style={{fontFamily:'DM Sans,sans-serif',fontSize:11,color:C.muted,marginTop:8}}>
                { isInterval ? 'per rep effort' :
                  isTempo    ? 'sustained effort · Zone 4' :
                  type==='LONG' ? 'easy long effort · Zone 2' :
                  'conversational · Zone 2' }
              </div>
            </Section>

            {/* Recovery between reps (intervals only) */}
            {isInterval && (
              <Section>
                <SectionLabel>Recovery between reps</SectionLabel>
                <ChipRow options={RECOVERY_OPTS} value={recovery} onChange={setRecovery} color={C.clay}/>
              </Section>
            )}

            {/* Warmup + Cooldown (interval + tempo) */}
            {needsWuCd && (
              <Section>
                <SectionLabel>Warm-up & cool-down</SectionLabel>
                <div style={{display:'flex',gap:12}}>
                  <PickerField label="Warm-up" items={WU_LIST} value={warmup}
                    onChange={setWarmup} color={tc.color} suffix=" km" half note="Before main set"/>
                  <PickerField label="Cool-down" items={WU_LIST} value={cooldown}
                    onChange={setCooldown} color={tc.color} suffix=" km" half note="After main set"/>
                </div>
              </Section>
            )}
          </>
        )}

        {/* Actions */}
        <Section last>
          <div style={{display:'flex',gap:10}}>
            {existing && existing.type!=='REST' && (
              <button onClick={()=>onSave(dayIndex,null)} style={{
                fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:600,
                padding:'10px 14px',borderRadius:22,cursor:'pointer',
                background:'#FEE2E2',border:'1.5px solid #FECACA',color:'#991B1B'}}>
                Remove
              </button>
            )}
            <button onClick={()=>onSave(dayIndex,build())} style={{
              flex:1,fontFamily:'DM Sans,sans-serif',fontSize:14,fontWeight:600,
              padding:'12px',borderRadius:22,cursor:'pointer',
              background:C.clay,border:`1.5px solid ${C.clay}`,color:'white'}}>
              {existing?'Update session':'Add session'}
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

// Recovery jog distance per rep at ~5:30/km easy jog pace (km)
const RECOVERY_KM = {
  '45s':0.14, '60s':0.18, '90s':0.27,
  '2min':0.36, '3min':0.55, '4min':0.73, '5min':0.91,
};

function sessionKm(d) {
  if (!d || d.type === 'REST') return 0;
  const wu  = d.warmup   ? Number(d.warmup)   : 0;
  const cd  = d.cooldown ? Number(d.cooldown) : 0;
  const rec = d.recovery ? (RECOVERY_KM[d.recovery] || 0) * (d.reps || 1) : 0;
  if (d.type === 'INTERVAL' && d.reps && d.repDist)
    return Math.round((d.reps * d.repDist / 1000 + rec + wu + cd) * 10) / 10;
  if (d.distance) return d.distance + wu + cd;
  return 8;
}

// ── Plan generator ────────────────────────────────────────────────────────────
function generatePlan(template, totalWeeks, progPct, phases) {
  // Build ordered week list with phase labels, inserting RECOVERY weeks evenly in BUILD
  const PHASE_ORDER = ['BASE','BUILD','RECOVERY','PEAK','TAPER'];
  const ph = phases || defaultPhases(totalWeeks);

  // Spread RECOVERY weeks evenly across the BUILD section
  const buildTotal = ph.BUILD + ph.RECOVERY;
  const recoveryInterval = ph.RECOVERY > 0
    ? Math.floor(ph.BUILD / (ph.RECOVERY + 1))
    : Infinity;

  // Build array of phase labels, length = totalWeeks
  const weekPhases = [];
  let baseLeft  = ph.BASE;
  let buildLeft = ph.BUILD;
  let recLeft   = ph.RECOVERY;
  let peakLeft  = ph.PEAK;
  let taperLeft = ph.TAPER;
  let buildCount = 0; // weeks since last recovery in build

  for (let i = 0; i < totalWeeks; i++) {
    if (baseLeft > 0) { weekPhases.push('BASE'); baseLeft--; }
    else if (buildLeft > 0 || recLeft > 0) {
      // Insert recovery every N build weeks
      if (recLeft > 0 && buildCount > 0 && buildCount % recoveryInterval === 0) {
        weekPhases.push('RECOVERY'); recLeft--;
      } else if (buildLeft > 0) {
        weekPhases.push('BUILD'); buildLeft--; buildCount++;
      } else {
        weekPhases.push('RECOVERY'); recLeft--;
      }
    }
    else if (peakLeft > 0)  { weekPhases.push('PEAK');  peakLeft--; }
    else if (taperLeft > 0) { weekPhases.push('TAPER'); taperLeft--; }
    else weekPhases.push('TAPER');
  }

  const taperStart = weekPhases.lastIndexOf('PEAK') + 1;

  return weekPhases.map((phase, w) => {
    const prog     = Math.floor(w / 2);
    const isTaper  = phase === 'TAPER';
    const isRecov  = phase === 'RECOVERY';
    const taperIdx = isTaper ? w - taperStart : 0;
    const factor   = (progPct > 0 && !isTaper && !isRecov)
      ? Math.pow(1 + progPct / 100, prog)
      : 1;

    const days = template.map(s => {
      if (!s || s.type === 'REST') return { type: 'REST' };
      const out = { ...s };

      if (progPct > 0 && !isTaper && !isRecov) {
        if (s.type === 'INTERVAL') out.reps = Math.min(20, Math.round((s.reps || 6) * factor));
        else if (s.distance)       out.distance = Math.round((s.distance || 8) * factor);
      }
      if (isRecov) {
        // Recovery week: 65% of template volume
        if (out.reps)     out.reps     = Math.max(3, Math.round((s.reps || 6) * 0.65));
        if (out.distance) out.distance = Math.max(3, Math.round((s.distance || 8) * 0.65));
      }
      if (isTaper) {
        const f = taperIdx === 0 ? 0.80 : 0.60;
        if (out.reps)     out.reps     = Math.max(3, Math.round(out.reps * f));
        if (out.distance) out.distance = Math.max(3, Math.round(out.distance * f));
      }
      return out;
    });

    const km = days.reduce((acc, d) => acc + sessionKm(d), 0);

    return { phase, days, km: Math.round(km) };
  });
}

// ── Propagate modal ───────────────────────────────────────────────────────────
function PropagateModal({ changeDesc, weekIndex, totalWeeks, onApply, onClose }) {
  const [scope,setScope] = useState('remaining');
  const opts = [
    {k:'this',      label:'This week only',        sub:`Week ${weekIndex+1} only`},
    {k:'remaining', label:'All remaining weeks',   sub:`Weeks ${weekIndex+1}–${totalWeeks}`},
    {k:'build',     label:'Build phase only',      sub:'Leaves peak & taper unchanged'},
  ];
  return (
    <div style={{position:'absolute',inset:0,background:'rgba(28,21,16,0.65)',zIndex:70,
      display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={onClose}>
      <div style={{background:C.surface,borderRadius:'22px 22px 0 0'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'center',padding:'10px 0 4px'}}>
          <div style={{width:36,height:4,borderRadius:2,background:C.border}}/>
        </div>
        <div style={{padding:'10px 20px 14px',borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontFamily:'Playfair Display,serif',fontSize:19,color:C.ink,fontWeight:600,marginBottom:5}}>
            Apply change where?
          </div>
          <span style={{fontFamily:'Space Mono,monospace',fontSize:12,color:C.clay,fontWeight:700}}>{changeDesc}</span>
        </div>
        <div style={{padding:'12px 20px',display:'flex',flexDirection:'column',gap:8}}>
          {opts.map(o=>(
            <div key={o.k} onClick={()=>setScope(o.k)} style={{
              padding:'12px 14px',borderRadius:12,cursor:'pointer',
              border:`1.5px solid ${scope===o.k?C.clay:C.border}`,
              background:scope===o.k?C.clayBg:C.cream,
              display:'flex',justifyContent:'space-between',alignItems:'center',
            }}>
              <div>
                <div style={{fontFamily:'DM Sans,sans-serif',fontSize:14,color:C.ink,fontWeight:scope===o.k?600:400}}>{o.label}</div>
                <div style={{fontFamily:'DM Sans,sans-serif',fontSize:11,color:C.muted,marginTop:2}}>{o.sub}</div>
              </div>
              <div style={{width:20,height:20,borderRadius:'50%',flexShrink:0,
                border:`2px solid ${scope===o.k?C.clay:C.border}`,
                background:scope===o.k?C.clay:'transparent',
                display:'flex',alignItems:'center',justifyContent:'center'}}>
                {scope===o.k&&<div style={{width:7,height:7,borderRadius:'50%',background:'white'}}/>}
              </div>
            </div>
          ))}
        </div>
        <div style={{padding:'0 20px 28px'}}>
          <button onClick={()=>onApply(scope)} style={{
            width:'100%',fontFamily:'DM Sans,sans-serif',fontSize:14,fontWeight:600,
            padding:'12px',borderRadius:22,cursor:'pointer',
            background:C.clay,border:`1.5px solid ${C.clay}`,color:'white'}}>
            Apply change
          </button>
        </div>
      </div>
    </div>
  );
}

// Sensible defaults when switching session type
const TYPE_DEFAULTS = {
  EASY:     { type:'EASY',     distance:8,  pace:'5:20' },
  INTERVAL: { type:'INTERVAL', reps:6, repDist:800, pace:'3:50', recovery:'90s', warmup:'1.5', cooldown:'1' },
  TEMPO:    { type:'TEMPO',    distance:10, pace:'4:20', warmup:'2', cooldown:'1.5' },
  LONG:     { type:'LONG',     distance:20, pace:'5:10' },
  REST:     { type:'REST' },
};

// ── Inline session row in expanded week ───────────────────────────────────────
function SessionRow({ sess, dayIndex, weekIndex, totalWeeks, onChanged }) {
  const [pending,     setPending]     = useState(null);
  const [editingPace, setEditingPace] = useState(false);

  const currentType = sess?.type || 'REST';
  const isRest      = currentType === 'REST';
  const tc          = TYPE[currentType];
  const isInterval  = currentType === 'INTERVAL';

  const fire = (updated, desc) => setPending({ updated, desc });

  const switchType = (newType) => {
    if (newType === currentType) return;
    // Carry over distance/pace where it makes sense, otherwise use defaults
    const defaults = { ...TYPE_DEFAULTS[newType] };
    if (newType !== 'REST' && newType !== 'INTERVAL' && sess?.distance)
      defaults.distance = sess.distance;
    if (newType !== 'REST' && sess?.pace)
      defaults.pace = sess.pace;
    fire(defaults, `Change ${DAYS[dayIndex]} to ${TYPE[newType].label}`);
  };

  // Type chip strip — shown for every row
  const TypeStrip = () => (
    <div style={{display:'flex',gap:5,marginBottom:isRest?0:10}}>
      {Object.entries(TYPE).map(([t, meta]) => {
        const active = t === currentType;
        return (
          <button key={t} onClick={()=>switchType(t)} style={{
            display:'flex', alignItems:'center', gap:4,
            padding:'4px 9px', borderRadius:7, cursor:'pointer',
            border:`1.5px solid ${active ? meta.color : C.border}`,
            background: active ? meta.bg : C.cream,
            transition:'all 0.12s',
          }}>
            <span style={{fontSize:10, color:meta.color}}>{meta.emoji}</span>
            <span style={{fontFamily:'DM Sans,sans-serif', fontSize:9.5, fontWeight:active?700:400,
              color:active?meta.color:C.muted, letterSpacing:0.4}}>{meta.abbr}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <div style={{padding:'10px 0', borderBottom:`1px solid ${C.border}`}}>

        {/* Day label */}
        <span style={{fontFamily:'DM Sans,sans-serif', fontSize:11, fontWeight:700,
          color:tc.color, display:'block', marginBottom:8}}>{DAYS[dayIndex]}</span>

        {/* Type switcher — always visible */}
        <TypeStrip/>

        {/* Volume + pace controls — hidden for REST */}
        {!isRest && (
          <>
            {isInterval ? (
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',background:C.cream,
                  borderRadius:8,border:`1.5px solid ${C.border}`,overflow:'hidden'}}>
                  <button onClick={()=>fire({...sess,reps:Math.max(2,sess.reps-1)},
                    `${Math.max(2,sess.reps-1)}×${sess.repDist}m on ${DAYS[dayIndex]}`)}
                    style={{width:30,height:30,background:'none',border:'none',fontSize:18,color:C.clay,cursor:'pointer'}}>−</button>
                  <span style={{fontFamily:'Space Mono,monospace',fontSize:13,fontWeight:700,color:C.ink,padding:'0 4px'}}>{sess.reps}</span>
                  <span style={{fontFamily:'DM Sans,sans-serif',fontSize:10,color:C.muted,marginRight:4}}>reps</span>
                  <button onClick={()=>fire({...sess,reps:Math.min(20,sess.reps+1)},
                    `${Math.min(20,sess.reps+1)}×${sess.repDist}m on ${DAYS[dayIndex]}`)}
                    style={{width:30,height:30,background:'none',border:'none',fontSize:18,color:C.clay,cursor:'pointer'}}>+</button>
                </div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {REP_DISTS.map(d=>(
                    <button key={d} onClick={()=>fire({...sess,repDist:d},`${sess.reps}×${d}m on ${DAYS[dayIndex]}`)} style={{
                      fontFamily:'Space Mono,monospace',fontSize:10,
                      fontWeight:sess.repDist===d?700:400,
                      padding:'4px 7px',borderRadius:6,cursor:'pointer',
                      border:`1.5px solid ${sess.repDist===d?C.clay:C.border}`,
                      background:sess.repDist===d?C.clayBg:C.cream,
                      color:sess.repDist===d?C.clay:C.muted,
                    }}>{d}m</button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                {[-2,-1].map(s=>(
                  <button key={s} onClick={()=>fire({...sess,distance:Math.max(2,(sess.distance||8)+s)},
                    `${Math.max(2,(sess.distance||8)+s)}km on ${DAYS[dayIndex]}`)} style={{
                    width:30,height:30,borderRadius:7,border:`1.5px solid ${C.border}`,
                    background:C.cream,color:C.ink,fontFamily:'DM Sans,sans-serif',
                    fontSize:12,fontWeight:600,cursor:'pointer'}}>−{Math.abs(s)}</button>
                ))}
                <span style={{fontFamily:'Space Mono,monospace',fontSize:14,fontWeight:700,
                  color:C.ink,minWidth:52,textAlign:'center'}}>
                  {sess.distance||'?'}km
                </span>
                {[1,2].map(s=>(
                  <button key={s} onClick={()=>fire({...sess,distance:Math.min(40,(sess.distance||8)+s)},
                    `${Math.min(40,(sess.distance||8)+s)}km on ${DAYS[dayIndex]}`)} style={{
                    width:30,height:30,borderRadius:7,border:`1.5px solid ${C.border}`,
                    background:C.cream,color:C.ink,fontFamily:'DM Sans,sans-serif',
                    fontSize:12,fontWeight:600,cursor:'pointer'}}>+{s}</button>
                ))}
              </div>
            )}

            {/* Pace toggle */}
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontFamily:'DM Sans,sans-serif',fontSize:11,color:C.muted}}>Pace:</span>
              <button onClick={()=>setEditingPace(p=>!p)} style={{
                fontFamily:'Space Mono,monospace',fontSize:12,fontWeight:700,
                color:editingPace?'white':tc.color,
                background:editingPace?tc.color:`${tc.color}15`,
                border:`1.5px solid ${tc.color}50`,
                borderRadius:8,padding:'4px 10px',cursor:'pointer',
              }}>{sess.pace||'—'} /km {editingPace?'▲':'▼'}</button>
            </div>

            {editingPace && (
              <div style={{marginTop:10,padding:12,background:C.cream,
                border:`1.5px solid ${C.border}`,borderRadius:12}}>
                <div style={{fontFamily:'DM Sans,sans-serif',fontSize:9.5,letterSpacing:1.5,
                  textTransform:'uppercase',fontWeight:700,color:C.muted,marginBottom:8}}>
                  Override pace for week {weekIndex+1}
                </div>
                <ScrollPicker items={ALL_PACES} value={sess.pace||'4:30'} color={tc.color} suffix=" /km"
                  onChange={v=>{ onChanged(dayIndex,{...sess,pace:v},'this'); }}/>
              </div>
            )}
          </>
        )}
      </div>

      {pending && (
        <PropagateModal
          changeDesc={pending.desc}
          weekIndex={weekIndex}
          totalWeeks={totalWeeks}
          onApply={(scope)=>{ onChanged(dayIndex, pending.updated, scope); setPending(null); }}
          onClose={()=>setPending(null)}
        />
      )}
    </>
  );
}

// ── Default phase calculator ──────────────────────────────────────────────────
function defaultPhases(totalWeeks) {
  const taper    = Math.max(2, Math.round(totalWeeks * 0.13));
  const peak     = Math.max(1, Math.round(totalWeeks * 0.13));
  const recovery = 0;
  const base     = Math.max(1, Math.round(totalWeeks * 0.20));
  const build    = Math.max(1, totalWeeks - base - peak - taper - recovery);
  return { BASE: base, BUILD: build, RECOVERY: recovery, PEAK: peak, TAPER: taper };
}

// ── Phase Editor ──────────────────────────────────────────────────────────────
function PhaseEditor({ totalWeeks, phases, onChange }) {
  const PHASE_ORDER = ['BASE','BUILD','RECOVERY','PEAK','TAPER'];
  const used = PHASE_ORDER.reduce((s,p)=>s+phases[p], 0);
  const remaining = totalWeeks - used;

  // Adjust a phase by delta, clamping min to 0 (RECOVERY) or 1 (others), 
  // and auto-stealing from/giving to BUILD
  const adjust = (phase, delta) => {
    const next = { ...phases };
    const min = phase === 'RECOVERY' ? 0 : 1;
    const newVal = Math.max(min, next[phase] + delta);
    const diff = newVal - next[phase];
    if (diff === 0) return;
    // Steal from / give to BUILD (but never take BUILD below 1)
    const buildAfter = next.BUILD - diff;
    if (buildAfter < 1 && phase !== 'BUILD') return;
    next[phase] = newVal;
    if (phase !== 'BUILD') next.BUILD = Math.max(1, buildAfter);
    onChange(next);
  };

  const barTotal = Math.max(totalWeeks, 1);

  return (
    <div>
      {/* Visual bar */}
      <div style={{display:'flex',height:28,borderRadius:8,overflow:'hidden',marginBottom:12,gap:1}}>
        {PHASE_ORDER.filter(p=>phases[p]>0).map(p=>{
          const meta = PHASE_META[p];
          const pct = (phases[p] / barTotal) * 100;
          return (
            <div key={p} style={{flex:`0 0 ${pct}%`, background:meta.color,
              display:'flex',alignItems:'center',justifyContent:'center',minWidth:0}}>
              {pct > 8 && (
                <span style={{fontFamily:'DM Sans,sans-serif',fontSize:8.5,fontWeight:700,
                  letterSpacing:0.8,textTransform:'uppercase',color:'white',
                  whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',padding:'0 4px'}}>
                  {meta.label}
                </span>
              )}
            </div>
          );
        })}
        {remaining > 0 && (
          <div style={{flex:`0 0 ${(remaining/barTotal)*100}%`,background:C.border,
            display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontFamily:'Space Mono,monospace',fontSize:9,color:C.muted}}>
              {remaining}w unassigned
            </span>
          </div>
        )}
      </div>

      {/* Per-phase rows */}
      <div style={{display:'flex',flexDirection:'column',gap:4}}>
        {PHASE_ORDER.map(p=>{
          const meta = PHASE_META[p];
          const wks = phases[p];
          const isBuild = p === 'BUILD';
          const isRecovery = p === 'RECOVERY';
          return (
            <div key={p} style={{display:'flex',alignItems:'center',gap:10,
              padding:'8px 12px',borderRadius:10,
              background:wks>0?`${meta.color}0E`:C.cream,
              border:`1.5px solid ${wks>0?meta.color+'30':C.border}`,
            }}>
              {/* Color dot + label */}
              <div style={{width:8,height:8,borderRadius:'50%',background:meta.color,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:'DM Sans,sans-serif',fontSize:12.5,fontWeight:600,color:C.ink}}>
                  {meta.label}
                  {isBuild && (
                    <span style={{fontFamily:'DM Sans,sans-serif',fontSize:10,fontWeight:400,
                      color:C.muted,marginLeft:6}}>auto-adjusts</span>
                  )}
                </div>
                <div style={{fontFamily:'DM Sans,sans-serif',fontSize:10.5,color:C.muted,
                  marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  {meta.desc}
                </div>
              </div>
              {/* Week count + stepper */}
              <div style={{display:'flex',alignItems:'center',gap:0,flexShrink:0}}>
                <button onClick={()=>adjust(p,-1)} disabled={isBuild}
                  style={{width:28,height:28,borderRadius:'6px 0 0 6px',
                    border:`1.5px solid ${C.border}`,borderRight:'none',
                    background:isBuild?C.cream:C.surface,color:isBuild?C.border:C.clay,
                    fontFamily:'DM Sans,sans-serif',fontSize:16,cursor:isBuild?'default':'pointer'}}>−</button>
                <div style={{minWidth:42,height:28,display:'flex',alignItems:'center',
                  justifyContent:'center',border:`1.5px solid ${C.border}`,background:C.cream}}>
                  <span style={{fontFamily:'Space Mono,monospace',fontSize:12,
                    fontWeight:700,color:wks>0?meta.color:C.muted}}>
                    {wks}w
                  </span>
                </div>
                <button onClick={()=>adjust(p,1)} disabled={isBuild}
                  style={{width:28,height:28,borderRadius:'0 6px 6px 0',
                    border:`1.5px solid ${C.border}`,borderLeft:'none',
                    background:isBuild?C.cream:C.surface,color:isBuild?C.border:C.clay,
                    fontFamily:'DM Sans,sans-serif',fontSize:16,cursor:isBuild?'default':'pointer'}}>+</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total check */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10}}>
        <span style={{fontFamily:'DM Sans,sans-serif',fontSize:11,color:C.muted}}>
          Total assigned
        </span>
        <span style={{fontFamily:'Space Mono,monospace',fontSize:12,
          fontWeight:700,color:used===totalWeeks?C.forest:C.clay}}>
          {used}/{totalWeeks} weeks {used===totalWeeks?'✓':''}
        </span>
      </div>
    </div>
  );
}

// ── Step 1 ────────────────────────────────────────────────────────────────────
function StepGoal({ onNext }) {
  const [race,       setRace]       = useState('Marathon');
  const [weeks,      setWeeks]      = useState(16);
  const [target,     setTarget]     = useState('sub-3:30');
  const [phases,     setPhases]     = useState(()=>defaultPhases(16));
  const [showPhases, setShowPhases] = useState(false);

  // Recompute phases when total weeks changes, preserving any custom ratios
  const handleWeeksChange = (w) => {
    setWeeks(w);
    setPhases(defaultPhases(w));
  };

  const distances = ['5K','10K','Half Marathon','Marathon'];
  const targets = {
    '5K':['sub-18','sub-20','sub-22','sub-25'],
    '10K':['sub-38','sub-42','sub-45','sub-50'],
    'Half Marathon':['sub-1:25','sub-1:30','sub-1:45','sub-2:00'],
    'Marathon':['sub-3:00','sub-3:15','sub-3:30','sub-4:00'],
  };
  return (
    <div style={{flex:1,overflowY:'auto',padding:'20px 18px 24px'}}>
      <div style={{marginBottom:20}}>
        <div style={{fontFamily:'DM Sans,sans-serif',fontSize:10,color:C.muted,
          letterSpacing:1.5,textTransform:'uppercase',fontWeight:600,marginBottom:5}}>STEP 1 OF 3</div>
        <h1 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:C.ink,margin:0,fontWeight:600,lineHeight:1.2}}>
          What are you training for?
        </h1>
      </div>
      <SectionLabel>Race distance</SectionLabel>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:20}}>
        {distances.map(d=>(
          <button key={d} onClick={()=>{setRace(d);setTarget(targets[d][2]);}} style={{
            fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:race===d?600:400,
            padding:'8px 16px',borderRadius:20,cursor:'pointer',
            border:`1.5px solid ${race===d?C.clay:C.border}`,
            background:race===d?C.clayBg:C.surface,color:race===d?C.clay:C.ink,
          }}>{d}</button>
        ))}
      </div>
      <SectionLabel>Time target</SectionLabel>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:20}}>
        {(targets[race]||[]).map(t=>(
          <button key={t} onClick={()=>setTarget(t)} style={{
            fontFamily:'Space Mono,monospace',fontSize:13,fontWeight:target===t?700:400,
            padding:'8px 16px',borderRadius:20,cursor:'pointer',
            border:`1.5px solid ${target===t?C.clay:C.border}`,
            background:target===t?C.clayBg:C.surface,color:target===t?C.clay:C.ink,
          }}>{t}</button>
        ))}
      </div>
      <div style={{marginBottom:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <SectionLabel>Weeks to race</SectionLabel>
          <span style={{fontFamily:'Space Mono,monospace',fontSize:14,color:C.clay,fontWeight:700}}>{weeks} wks</span>
        </div>
        <input type="range" min={8} max={24} value={weeks}
          onChange={e=>handleWeeksChange(+e.target.value)}
          style={{width:'100%',accentColor:C.clay,cursor:'pointer'}}/>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
          <span style={{fontFamily:'DM Sans,sans-serif',fontSize:10,color:C.muted}}>8 weeks</span>
          <span style={{fontFamily:'DM Sans,sans-serif',fontSize:10,color:C.muted}}>24 weeks</span>
        </div>
      </div>
      {/* Phase structure */}
      <div style={{marginBottom:20}}>
        <button onClick={()=>setShowPhases(p=>!p)} style={{
          width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',
          background:showPhases?C.clayBg:C.surface,
          border:`1.5px solid ${showPhases?C.clay:C.border}`,
          borderRadius:showPhases?'12px 12px 0 0':12,
          padding:'11px 14px',cursor:'pointer',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {/* Mini phase bar preview */}
            <div style={{display:'flex',height:10,width:60,borderRadius:4,overflow:'hidden',gap:1}}>
              {['BASE','BUILD','RECOVERY','PEAK','TAPER'].filter(p=>phases[p]>0).map(p=>(
                <div key={p} style={{flex:phases[p],background:PHASE_META[p].color}}/>
              ))}
            </div>
            <span style={{fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:600,color:C.ink}}>
              Customise phases
            </span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontFamily:'DM Sans,sans-serif',fontSize:11,color:C.muted}}>
              {['BASE','BUILD','RECOVERY','PEAK','TAPER']
                .filter(p=>phases[p]>0)
                .map(p=>`${phases[p]}w ${PHASE_META[p].label}`)
                .join(' · ')}
            </span>
            <span style={{fontFamily:'DM Sans,sans-serif',fontSize:13,color:C.muted,
              display:'inline-block',transform:showPhases?'rotate(90deg)':'none',
              transition:'transform 0.2s'}}>›</span>
          </div>
        </button>

        {showPhases && (
          <div style={{border:`1.5px solid ${C.clay}`,borderTop:'none',
            borderRadius:'0 0 12px 12px',background:C.cream,padding:'14px 14px 16px'}}>
            <div style={{fontFamily:'DM Sans,sans-serif',fontSize:11.5,color:C.muted,
              lineHeight:1.5,marginBottom:14}}>
              BUILD auto-adjusts to fill remaining weeks. Add RECOVERY weeks for planned deload.
            </div>
            <PhaseEditor totalWeeks={weeks} phases={phases} onChange={setPhases}/>
          </div>
        )}
      </div>

      <div style={{background:C.forestBg,border:`1px solid ${C.forest}30`,borderRadius:12,
        padding:'12px 14px',marginBottom:22,display:'flex',gap:10}}>
        <div style={{width:6,height:6,borderRadius:'50%',background:C.forest,marginTop:5,flexShrink:0}}/>
        <div style={{fontFamily:'DM Sans,sans-serif',fontSize:13,color:C.ink2,lineHeight:1.55}}>
          <strong style={{color:C.forest}}>Steady</strong> — {weeks}-week {race} plan for {target}.{' '}
          {phases.BASE}w base · {phases.BUILD}w build{phases.RECOVERY>0?` · ${phases.RECOVERY}w recovery`:''}
          {' '}· {phases.PEAK}w peak · {phases.TAPER}w taper.
        </div>
      </div>

      <button onClick={()=>onNext({race,weeks,target,phases})} style={{
        width:'100%',fontFamily:'DM Sans,sans-serif',fontSize:14,fontWeight:600,
        padding:'12px',borderRadius:22,cursor:'pointer',
        background:C.clay,border:`1.5px solid ${C.clay}`,color:'white'}}>
        Build my template week →
      </button>
    </div>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────
function StepTemplate({ goal, onNext }) {
  const [template,setTemplate] = useState([
    {type:'EASY',    distance:8,  pace:'5:20'},
    {type:'INTERVAL',reps:6, repDist:800, pace:'3:50', recovery:'90s', warmup:'1.5', cooldown:'1'},
    {type:'EASY',    distance:8,  pace:'5:30'},
    {type:'TEMPO',   distance:10, pace:'4:20', warmup:'2', cooldown:'1.5'},
    null,
    {type:'EASY',    distance:12, pace:'5:20'},
    {type:'LONG',    distance:20, pace:'5:10'},
  ]);
  const [editing, setEditing] = useState(null);

  const totalKm = template.reduce((acc,s) => acc + sessionKm(s), 0);

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:'16px 18px 8px',flexShrink:0}}>
        <div style={{fontFamily:'DM Sans,sans-serif',fontSize:10,color:C.muted,
          letterSpacing:1.5,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>STEP 2 OF 3</div>
        <h1 style={{fontFamily:'Playfair Display,serif',fontSize:24,color:C.ink,
          margin:'0 0 4px',fontWeight:600,lineHeight:1.2}}>Design your week</h1>
        <p style={{fontFamily:'DM Sans,sans-serif',fontSize:13,color:C.muted,margin:0,lineHeight:1.5}}>
          This pattern repeats across all {goal.weeks} weeks. Tap any day to adjust.
        </p>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'6px 18px 0'}}>
        <div style={{background:C.forestBg,border:`1px solid ${C.forest}25`,borderRadius:10,
          padding:'10px 12px',marginBottom:12,display:'flex',gap:10}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:C.forest,marginTop:5,flexShrink:0}}/>
          <div style={{fontFamily:'DM Sans,sans-serif',fontSize:12.5,color:C.ink2,lineHeight:1.5}}>
            <strong style={{color:C.forest}}>Steady</strong> — This is your base week. It repeats across all {goal.weeks} weeks — you'll be able to fine-tune each week individually in the next step. Set the structure here, adjust the details there.
          </div>
        </div>
        {DAYS.map((day,i)=>{
          const s = template[i];
          const isRest = !s||s.type==='REST';
          const tc = s?TYPE[s.type]:null;
          return (
            <div key={day} onClick={()=>setEditing(i)} style={{
              background:isRest?C.cream:tc?.bg||C.cream,
              border:`1.5px solid ${isRest?C.border:tc?.color+'35'||C.border}`,
              borderRadius:12,padding:'11px 14px',cursor:'pointer',
              display:'flex',alignItems:'center',gap:12,marginBottom:6,
            }}>
              <div style={{width:30,flexShrink:0}}>
                <div style={{fontFamily:'DM Sans,sans-serif',fontSize:11,fontWeight:600,
                  color:isRest?C.muted:tc?.color,letterSpacing:0.3}}>{day}</div>
              </div>
              {isRest?(
                <>
                  <span style={{flex:1,fontFamily:'DM Sans,sans-serif',fontSize:13,color:C.muted}}>Rest day</span>
                  <span style={{fontFamily:'DM Sans,sans-serif',fontSize:20,color:C.border}}>+</span>
                </>
              ):(
                <>
                  <div style={{flex:1,overflow:'hidden'}}>
                    <div style={{fontFamily:'DM Sans,sans-serif',fontSize:12.5,fontWeight:500,color:C.ink,
                      whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {sessionLabel(s)}
                    </div>
                    <div style={{fontFamily:'DM Sans,sans-serif',fontSize:11,color:C.muted,marginTop:1}}>
                      {tc?.label}
                    </div>
                  </div>
                  <span style={{fontFamily:'DM Sans,sans-serif',fontSize:14,color:C.muted,flexShrink:0}}>›</span>
                </>
              )}
            </div>
          );
        })}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,
          padding:'11px 14px',margin:'12px 0 20px',
          display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontFamily:'DM Sans,sans-serif',fontSize:11,color:C.muted,fontWeight:600,
            letterSpacing:0.5,textTransform:'uppercase'}}>Template volume</span>
          <span style={{fontFamily:'Space Mono,monospace',fontSize:13,color:C.clay,fontWeight:700}}>~{Math.round(totalKm)}km / week</span>
        </div>
        <div style={{fontFamily:'DM Sans,sans-serif',fontSize:10.5,color:C.muted,marginTop:4}}>
          Includes warm-up, cool-down and recovery jogs between reps
        </div>
      </div>
      <div style={{padding:'10px 18px 20px',borderTop:`1px solid ${C.border}`,flexShrink:0}}>
        <button onClick={()=>onNext(template)} style={{
          width:'100%',fontFamily:'DM Sans,sans-serif',fontSize:14,fontWeight:600,
          padding:'12px',borderRadius:22,cursor:'pointer',
          background:C.clay,border:`1.5px solid ${C.clay}`,color:'white'}}>
          Generate {goal.weeks}-week plan →
        </button>
      </div>
      {editing!==null && (
        <SessionEditor dayIndex={editing} existing={template[editing]}
          onSave={(i,sess)=>{const t=[...template];t[i]=sess;setTemplate(t);setEditing(null);}}
          onClose={()=>setEditing(null)}/>
      )}
    </div>
  );
}

// ── Step 3 ────────────────────────────────────────────────────────────────────
function StepPlan({ goal, template, onDone }) {
  const [plan,       setPlan]       = useState(()=>generatePlan(template,goal.weeks,0,goal.phases));
  const [progState,  setProgState]  = useState(null); // null=undecided, false=flat, number=pct
  const [customPct,  setCustomPct]  = useState('7');
  const [showCustom, setShowCustom] = useState(false);
  const [expanded,   setExpanded]   = useState(null);

  const accept = (pct) => {
    setPlan(generatePlan(template, goal.weeks, pct, goal.phases));
    setProgState(pct);
  };

  const applyChange = (weekIndex, dayIndex, updated, scope) => {
    setPlan(prev => prev.map((w,wi) => {
      let apply = false;
      if (scope==='this')      apply = wi===weekIndex;
      else if (scope==='remaining') apply = wi>=weekIndex;
      else if (scope==='build') apply = wi>=weekIndex && w.phase==='BUILD';
      if (!apply) return w;

      const days = w.days.map((d,di) => {
        if (di!==dayIndex) return d;
        if (wi===weekIndex) return updated;
        const base = template[dayIndex];
        if (!d||d.type==='REST'||!base||base.type==='REST') return updated;
        // Apply delta for volume, preserve pace if same-week override
        if (updated.type==='INTERVAL'&&d.type==='INTERVAL') {
          const dr = (updated.reps||6)-(base.reps||6);
          return {...d, reps:Math.max(2,(d.reps||6)+dr), repDist:updated.repDist};
        }
        if (d.distance!==undefined) {
          const dd = (updated.distance||8)-(base.distance||8);
          return {...d, distance:Math.max(2,(d.distance||8)+dd)};
        }
        return updated;
      });

      const km = days.reduce((acc,d) => acc + sessionKm(d), 0);
      return {...w, days, km:Math.round(km)};
    }));
  };

  const maxKm = Math.max(...plan.map(w=>w.km), 1);

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
      <div style={{padding:'12px 18px 6px',flexShrink:0}}>
        <div style={{fontFamily:'DM Sans,sans-serif',fontSize:10,color:C.muted,
          letterSpacing:1.5,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>STEP 3 OF 3</div>
        <h1 style={{fontFamily:'Playfair Display,serif',fontSize:22,color:C.ink,margin:0,fontWeight:600,lineHeight:1.2}}>
          Your {goal.weeks}-week plan
        </h1>
        <div style={{fontFamily:'DM Sans,sans-serif',fontSize:12,color:C.muted,marginTop:3}}>
          {goal.race} · {goal.target} · Tap any week to edit sessions
        </div>
      </div>

      {/* Progression card */}
      {progState===null && (
        <div style={{margin:'6px 18px 8px',background:C.amberBg,
          border:`1.5px solid ${C.amber}45`,borderRadius:12,padding:'12px 14px',flexShrink:0}}>
          <div style={{fontFamily:'DM Sans,sans-serif',fontSize:13,color:C.ink2,lineHeight:1.55,marginBottom:10}}>
            <strong style={{color:C.amber}}>Steady</strong> — Add progressive overload?
            Volume builds automatically through the build phase, then tapers before race day.
          </div>
          {!showCustom ? (
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={()=>accept(7)} style={{
                fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:700,
                padding:'8px 14px',borderRadius:22,cursor:'pointer',
                background:C.amber,border:`1.5px solid ${C.amber}`,color:'white'}}>
                Yes, +7% / 2 weeks
              </button>
              <button onClick={()=>setShowCustom(true)} style={{
                fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:600,
                padding:'8px 14px',borderRadius:22,cursor:'pointer',
                background:C.surface,border:`1.5px solid ${C.border}`,color:C.ink}}>
                Custom %
              </button>
              <button onClick={()=>accept(0)} style={{
                fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:600,
                padding:'8px 14px',borderRadius:22,cursor:'pointer',
                background:C.surface,border:`1.5px solid ${C.border}`,color:C.muted}}>
                Keep flat
              </button>
            </div>
          ) : (
            <div>
              <div style={{fontFamily:'DM Sans,sans-serif',fontSize:12,color:C.ink2,marginBottom:10}}>
                Volume increase every 2 weeks:
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                {['5','7','10','12','15'].map(p=>(
                  <button key={p} onClick={()=>setCustomPct(p)} style={{
                    fontFamily:'Space Mono,monospace',fontSize:12,
                    fontWeight:customPct===p?700:400,
                    padding:'6px 12px',borderRadius:8,cursor:'pointer',
                    border:`1.5px solid ${customPct===p?C.amber:C.border}`,
                    background:customPct===p?`${C.amber}18`:C.cream,
                    color:customPct===p?C.amber:C.muted,
                  }}>{p}%</button>
                ))}
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <input value={customPct} onChange={e=>setCustomPct(e.target.value.replace(/\D/g,''))}
                    style={{width:44,fontFamily:'Space Mono,monospace',fontSize:13,fontWeight:700,
                      textAlign:'center',padding:'6px 8px',borderRadius:8,
                      border:`1.5px solid ${C.amber}`,background:C.cream,color:C.amber,outline:'none'}}/>
                  <span style={{fontFamily:'DM Sans,sans-serif',fontSize:12,color:C.muted}}>%</span>
                </div>
                <button onClick={()=>accept(Number(customPct)||7)} style={{
                  fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:700,
                  padding:'8px 14px',borderRadius:22,cursor:'pointer',
                  background:C.amber,border:`1.5px solid ${C.amber}`,color:'white'}}>
                  Apply {customPct}%
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {progState!==null && (
        <div style={{margin:'0 18px 8px',background:C.forestBg,
          border:`1px solid ${C.forest}25`,borderRadius:10,padding:'8px 12px',flexShrink:0,
          display:'flex',gap:8,alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{color:C.forest,fontSize:14}}>✓</span>
            <span style={{fontFamily:'DM Sans,sans-serif',fontSize:12.5,color:C.forest,fontWeight:500}}>
              {progState===0 ? 'Flat plan.' : `+${progState}% progression every 2 weeks.`}
            </span>
          </div>
          <button onClick={()=>setProgState(null)} style={{
            fontFamily:'DM Sans,sans-serif',fontSize:11,color:C.muted,
            background:'none',border:'none',cursor:'pointer',padding:0}}>change</button>
        </div>
      )}

      {/* Week list */}
      <div style={{flex:1,overflowY:'auto',padding:'0 18px 16px'}}>
        {plan.map((w,wi)=>{
          const isExp = expanded===wi;
          const pc = (PHASE_META[w.phase]||PHASE_META.BUILD).color;
          return (
            <div key={wi} style={{marginBottom:6}}>
              <div onClick={()=>setExpanded(isExp?null:wi)} style={{
                padding:'10px 14px',
                borderRadius:isExp?'12px 12px 0 0':12,
                border:`1.5px solid ${isExp?C.clay:C.border}`,
                background:isExp?C.clayBg:C.surface,cursor:'pointer',
              }}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontFamily:'Space Mono,monospace',fontSize:11,
                    color:isExp?C.clay:C.muted,fontWeight:isExp?700:400}}>W{wi+1}</span>
                  <div style={{flex:1,display:'flex',gap:3,alignItems:'center'}}>
                    {w.days.map((d,di)=><SessionDot key={di} type={d?.type} size={8}/>)}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                    <span style={{fontFamily:'Space Mono,monospace',fontSize:11,color:C.ink}}>{w.km}km</span>
                    <span style={{fontFamily:'DM Sans,sans-serif',fontSize:8,fontWeight:700,
                      letterSpacing:1,textTransform:'uppercase',color:pc,
                      background:`${pc}18`,borderRadius:20,padding:'2px 7px'}}>{w.phase}</span>
                    <span style={{fontSize:13,color:isExp?C.clay:C.muted,
                      display:'inline-block',transform:isExp?'rotate(90deg)':'none',
                      transition:'transform 0.2s',fontFamily:'DM Sans,sans-serif'}}>›</span>
                  </div>
                </div>
                <div style={{marginTop:7,height:2,background:C.border,borderRadius:1,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${Math.round(w.km/maxKm*100)}%`,
                    background:pc,borderRadius:1,transition:'width 0.4s'}}/>
                </div>
              </div>

              {isExp && (
                <div style={{border:`1.5px solid ${C.clay}`,borderTop:'none',
                  borderRadius:'0 0 12px 12px',background:C.cream,
                  padding:'8px 14px 12px',position:'relative'}}>
                  <div style={{fontFamily:'DM Sans,sans-serif',fontSize:9,color:C.muted,
                    letterSpacing:1.2,fontWeight:700,textTransform:'uppercase',marginBottom:6}}>
                    Edit sessions · any change will ask where to apply
                  </div>
                  {w.days.map((d,di)=>(
                    <SessionRow key={di} sess={d} dayIndex={di}
                      weekIndex={wi} totalWeeks={plan.length}
                      onChanged={(dayIdx,updated,scope)=>applyChange(wi,dayIdx,updated,scope)}/>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{padding:'10px 18px 20px',borderTop:`1px solid ${C.border}`,flexShrink:0}}>
        <button onClick={onDone} style={{
          width:'100%',fontFamily:'DM Sans,sans-serif',fontSize:14,fontWeight:600,
          padding:'12px',borderRadius:22,cursor:'pointer',
          background:C.clay,border:`1.5px solid ${C.clay}`,color:'white'}}>
          Save plan and start training →
        </button>
      </div>
    </div>
  );
}

// ── Steps indicator ───────────────────────────────────────────────────────────
function Steps({ current }) {
  return (
    <div style={{display:'flex',gap:6,padding:'0 18px 10px',flexShrink:0}}>
      {[1,2,3].map(n=>(
        <div key={n} style={{height:3,flex:1,borderRadius:2,
          background:n<=current?C.clay:C.border,transition:'background 0.3s'}}/>
      ))}
    </div>
  );
}

function SuccessScreen({ goal }) {
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',padding:'32px 24px',textAlign:'center'}}>
      <div style={{width:68,height:68,borderRadius:'50%',background:C.forestBg,
        border:`2px solid ${C.forest}50`,display:'flex',alignItems:'center',
        justifyContent:'center',marginBottom:18,fontSize:28}}>✓</div>
      <h1 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:C.ink,
        margin:'0 0 10px',fontWeight:600}}>Plan is live</h1>
      <p style={{fontFamily:'DM Sans,sans-serif',fontSize:14,color:C.muted,lineHeight:1.6,
        margin:'0 0 24px',maxWidth:260}}>
        Your {goal.weeks}-week {goal.race} plan for {goal.target} is ready.
      </p>
      <div style={{background:C.forestBg,border:`1px solid ${C.forest}30`,borderRadius:12,
        padding:'14px 16px',width:'100%',maxWidth:280,textAlign:'left'}}>
        <div style={{fontFamily:'DM Sans,sans-serif',fontSize:13,color:C.ink2,lineHeight:1.6}}>
          <strong style={{color:C.forest}}>Steady</strong> — After each run I'll compare it to what was
          planned and come to you with the honest read.
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  useFont();
  const [step,     setStep]     = useState(1);
  const [goal,     setGoal]     = useState(null);
  const [template, setTemplate] = useState(null);

  return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',
      minHeight:'100vh',padding:20,boxSizing:'border-box',
      background:'linear-gradient(135deg,#DDD8CE 0%,#C8C0B0 100%)'}}>
      <div style={{width:390,height:844,maxHeight:'90vh',background:C.cream,borderRadius:44,
        boxShadow:'0 40px 100px rgba(0,0,0,0.35),0 0 0 1px rgba(0,0,0,0.08),inset 0 1px 0 rgba(255,255,255,0.6)',
        display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>

        {/* Status bar */}
        <div style={{height:44,display:'flex',justifyContent:'space-between',
          alignItems:'center',padding:'0 28px',flexShrink:0}}>
          <span style={{fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:600,color:C.ink}}>9:41</span>
          <div style={{display:'flex',gap:7,alignItems:'center'}}>
            <div style={{display:'flex',gap:2,alignItems:'flex-end',height:10}}>
              {[3,5,7,10].map((h,i)=><div key={i} style={{width:3,height:h,background:C.ink,borderRadius:1}}/>)}
            </div>
            <svg width="15" height="10" fill="none">
              <rect x=".75" y=".75" width="12" height="8.5" rx="1.5" stroke={C.ink} strokeWidth="1.5"/>
              <rect x="13.5" y="3" width="1.5" height="4" rx=".75" fill={C.ink}/>
              <rect x="2" y="2.25" width="8" height="5.5" rx=".75" fill={C.ink}/>
            </svg>
          </div>
        </div>

        {/* Nav */}
        {step<=3 && (
          <div style={{padding:'2px 18px 0',flexShrink:0}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              {step>1
                ? <button onClick={()=>setStep(s=>s-1)} style={{fontFamily:'DM Sans,sans-serif',
                    fontSize:13,color:C.muted,background:'none',border:'none',cursor:'pointer',padding:0}}>← Back</button>
                : <div/>
              }
              <span style={{fontFamily:'DM Sans,sans-serif',fontSize:12,color:C.muted}}>New plan</span>
              <div/>
            </div>
            <Steps current={step}/>
          </div>
        )}

        {step===1 && <StepGoal onNext={g=>{setGoal(g);setStep(2);}}/>}
        {step===2 && goal && <StepTemplate goal={goal} onNext={t=>{setTemplate(t);setStep(3);}}/>}
        {step===3 && goal && template && <StepPlan goal={goal} template={template} onDone={()=>setStep(4)}/>}
        {step===4 && goal && <SuccessScreen goal={goal}/>}
      </div>
    </div>
  );
}
