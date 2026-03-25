import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { defaultForType, gradeToNum, gradeColor, GRADE_SCALE, computePowerRating, getRelationsSync, getRowName, setCellValue } from '../../../store/vaultStore.js';
import GradeBadge from '../../shared/GradeBadge.jsx';
import TagChip from '../../shared/TagChip.jsx';
import StarRating from '../../shared/StarRating.jsx';
import s from '../../../styles/CharacterShowcase.module.css';

const STAT_AXES = ['STR', 'END', 'AGI', 'MAG', 'INT', 'WIS', 'CHA', 'TAR'];
const STAT_COLORS = ['hot', 'ora', 'grn', 'pur', 'blu', 'tel', 'pnk', 'gold'];
const STAT_FULL_NAMES = ['STRENGTH', 'ENDURANCE', 'AGILITY', 'MAGIC', 'INTELLIGENCE', 'WISDOM', 'CHARISMA', 'TENACITY'];
const DND_STATS = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
const DND_ABBR = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const TABS = ['Backstory', 'Personality', 'Combat', 'Relations', 'Story', 'Moments', 'World', 'Notes', 'Gallery'];

const TAB_COL_MAP = {
  Backstory: ['Backstory', 'Back Story', 'Background'],
  Personality: ['Personality Traits', 'Personality', 'MBTI'],
  Combat: ['Combat Abilities', 'Combat', 'Fighting Style', 'D&D Classes'],
  Relations: ['Relationships Detail', 'Bonds', 'Relations', 'Relationships', 'Family'],
  Story: ['Story Arc', 'Arc'],
  Moments: ['Key Moments', 'Moments', 'Timeline'],
  World: ['World Info', 'World', 'Lore', 'Origin'],
  Notes: ['Work Notes', 'Notes', 'Concept Refs'],
  Gallery: ['Gallery'],
};

const QUICK_FACT_FIELDS = ['Class', 'Affiliation', 'Weapon', 'Signature Move', 'Weakness', 'Goal', 'Fear'];

const FLAVOR_TEXT = {
  17: 'Transcendent', 16: 'Legendary', 15: 'Exceptional',
  14: 'Masterful', 13: 'Superior', 12: 'Advanced',
  11: 'Proficient', 10: 'Skilled', 9: 'Capable',
  8: 'Average', 7: 'Developing', 6: 'Modest',
  5: 'Below Average', 4: 'Weak', 3: 'Poor',
  2: 'Negligible', 1: 'Minimal', 0: 'None',
};

function dndValueColor(v) {
  if (v == null) return 't3';
  if (v >= 20) return 'hot';
  if (v >= 18) return 'gold';
  if (v >= 16) return 'pur';
  if (v >= 13) return 'blu';
  if (v >= 9) return 'text';
  return 't3';
}

/* ── Inline editable field ────────────────── */
function EditableText({ value, colId, rowId, editing, large }) {
  const ref = useRef(null);
  const [local, setLocal] = useState(value || '');
  useEffect(() => { setLocal(value || ''); }, [value]);

  if (!editing) return null; // caller renders children when not editing

  const save = () => { if (local !== (value || '')) setCellValue(rowId, colId, local); };

  if (large) {
    return (
      <textarea
        ref={ref}
        className={s.editTextarea}
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={save}
        rows={4}
        autoFocus
      />
    );
  }
  return (
    <input
      ref={ref}
      className={s.editInput}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') { save(); e.target.blur(); } if (e.key === 'Escape') { setLocal(value || ''); e.target.blur(); } }}
      autoFocus
    />
  );
}

function EditableNumber({ value, colId, rowId, editing }) {
  const [local, setLocal] = useState(value ?? '');
  useEffect(() => { setLocal(value ?? ''); }, [value]);
  if (!editing) return null;
  const save = () => { const n = local === '' ? null : Number(local); if (n !== value) setCellValue(rowId, colId, n); };
  return (
    <input
      className={s.editInput}
      type="number"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') { save(); e.target.blur(); } if (e.key === 'Escape') { setLocal(value ?? ''); e.target.blur(); } }}
      autoFocus
    />
  );
}

function EditableSelect({ value, column, rowId, editing, onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!editing) return;
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) onDone?.(); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [editing, onDone]);
  if (!editing) return null;
  return (
    <div ref={ref} className={s.editDropdown}>
      {(column.options || []).map(opt => (
        <button
          key={opt.id}
          className={`${s.editDropdownItem} ${value === opt.id ? s.editDropdownActive : ''}`}
          onClick={() => { setCellValue(rowId, column.id, value === opt.id ? null : opt.id); onDone?.(); }}
        >
          <span className={s.editDropdownDot} style={{ background: `var(--${opt.color || 'slv'})` }} />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function EditableGrade({ value, colId, rowId, editing, onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!editing) return;
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) onDone?.(); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [editing, onDone]);
  if (!editing) return null;
  return (
    <div ref={ref} className={s.editDropdown}>
      {GRADE_SCALE.map(grade => (
        <button
          key={grade}
          className={`${s.editDropdownItem} ${value === grade ? s.editDropdownActive : ''}`}
          onClick={() => { setCellValue(rowId, colId, value === grade ? null : grade); onDone?.(); }}
        >
          <span className={s.editDropdownDot} style={{ background: `var(--${gradeColor(grade)})` }} />
          <GradeBadge grade={grade} small />
        </button>
      ))}
    </div>
  );
}

/* ── Main component ───────────────────────── */
export default function CharacterShowcase({ row, columns, allRows, onSelectRow }) {
  const [activeTab, setActiveTab] = useState('Backstory');
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingField, setEditingField] = useState(null); // for dropdowns
  const [activeEra, setActiveEra] = useState(null); // null = Current
  const [collapsed, setCollapsed] = useState({});
  const [lightboxIdx, setLightboxIdx] = useState(null);

  const toggleSection = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    setMounted(false);
    setActiveEra(null);
    setLightboxIdx(null);
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, [row.id]);

  // Parse timeline eras
  const timelineRaw = row.cells?.['col-timeline'] ?? '';
  let eras = [];
  try { if (timelineRaw) eras = JSON.parse(timelineRaw); } catch {}

  // Merge era overrides with base cells
  const effectiveCells = useMemo(() => {
    if (!activeEra) return row.cells;
    const era = eras.find(e => e.id === activeEra);
    if (!era?.overrides) return row.cells;
    const merged = { ...row.cells };
    for (const [colName, val] of Object.entries(era.overrides)) {
      const col = columns.find(c => c.name.toLowerCase() === colName.toLowerCase());
      if (col) merged[col.id] = val;
    }
    return merged;
  }, [activeEra, row.cells, eras, columns]);

  // Era switch animation
  const sheetRef = useRef(null);
  useEffect(() => {
    if (sheetRef.current) {
      sheetRef.current.classList.remove(s.eraTransition);
      // Force reflow
      void sheetRef.current.offsetWidth;
      sheetRef.current.classList.add(s.eraTransition);
    }
  }, [activeEra]);

  // E hotkey to toggle edit mode
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      if (e.key === 'e' || e.key === 'E') { e.preventDefault(); setEditing(v => !v); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Helpers
  const getField = (name) => {
    const col = columns.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!col) return null;
    return { value: effectiveCells?.[col.id] ?? defaultForType(col.type), column: col };
  };
  const getVal = (name) => getField(name)?.value ?? null;
  const getCol = (name) => columns.find(c => c.name.toLowerCase() === name.toLowerCase());

  // Name
  const nameCol = columns.find(c => c.type === 'text') || columns[0];
  const name = effectiveCells?.[nameCol?.id] ?? 'Untitled';

  // Title / epithet
  const titleVal = getVal('Title');

  // Identity fields
  const identityFields = ['Race', 'Age', 'Gender', 'Alignment', 'MBTI', 'Status', 'Significance', 'Main Cast'];

  // Stat grades
  const statValues = STAT_AXES.map((axis, i) => {
    const val = getVal(axis);
    const col = getCol(axis);
    return { axis, fullName: STAT_FULL_NAMES[i], grade: val, num: val ? (val === 'GLITCH' ? 17 : gradeToNum(val)) : -1, color: STAT_COLORS[i], colId: col?.id };
  });
  const hasStats = statValues.some(sv => sv.num >= 0);

  // Power rating
  const statGradeMap = {};
  STAT_AXES.forEach(axis => { const v = getVal(axis); if (v) statGradeMap[axis] = v; });
  const power = computePowerRating(statGradeMap);

  // D&D stats
  const dndValues = DND_STATS.map((stat, i) => {
    const col = getCol(stat);
    return { stat, abbr: DND_ABBR[i], value: getVal(stat), colId: col?.id };
  });
  const hasDnd = dndValues.some(dv => dv.value != null);

  // Badges
  const sigField = getField('Significance');
  let sigLabel = null;
  if (sigField) {
    const { value, column } = sigField;
    if (column.type === 'select' && value) {
      const opt = (column.options || []).find(o => o.id === value);
      sigLabel = opt ? { label: opt.label, color: opt.color } : null;
    } else if (typeof value === 'string') {
      sigLabel = { label: value, color: 'gold' };
    }
  }
  const statusField = getField('Status');
  let statusLabel = null;
  if (statusField) {
    const { value, column } = statusField;
    if (column.type === 'select' && value) {
      const opt = (column.options || []).find(o => o.id === value);
      statusLabel = opt ? { label: opt.label, color: opt.color } : null;
    } else if (typeof value === 'string') {
      statusLabel = { label: value, color: 'slv' };
    }
  }

  const ratingVal = getVal('Rating');
  const ratingCol = getCol('Rating');

  // Portrait
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const dominantStat = statValues.reduce((best, sv) => sv.num > best.num ? sv : best, { num: -1, color: 'slv' });

  // Tab content
  const getTabContent = (tabName) => {
    const colNames = TAB_COL_MAP[tabName] || [tabName];
    for (const cn of colNames) {
      const val = getVal(cn);
      if (val && typeof val === 'string' && val.trim()) return { text: val, col: getCol(cn) };
    }
    return null;
  };

  // Relations
  const bondCol = columns.find(c => c.type === 'relation');
  const bondTargetIds = bondCol ? getRelationsSync(row.id, bondCol.id) : [];
  const bondTargets = bondTargetIds.map(tid => {
    const targetRow = (allRows || []).find(r => r.id === tid);
    if (!targetRow) return { id: tid, name: getRowName(tid), initials: '??', sig: null };
    const tName = targetRow.cells?.[nameCol?.id] || 'Untitled';
    const tInitials = tName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const sigColObj = columns.find(c => c.name.toLowerCase() === 'significance');
    let tSig = null;
    if (sigColObj) {
      const sv = targetRow.cells?.[sigColObj.id];
      if (sv) {
        const opt = (sigColObj.options || []).find(o => o.id === sv);
        tSig = opt ? opt.color : 'slv';
      }
    }
    return { id: tid, name: tName, initials: tInitials, sig: tSig || 'slv' };
  });

  // Story arc
  const storyArcVal = getVal('Story Arc');
  const storyArcCol = getCol('Story Arc');

  // Radar chart
  const RADAR_N = 8, RADAR_CX = 100, RADAR_CY = 100, RADAR_R = 80;
  function radarTip(i, scale = 1) {
    const angle = -Math.PI / 2 + (2 * Math.PI / RADAR_N) * i;
    return [RADAR_CX + scale * RADAR_R * Math.cos(angle), RADAR_CY + scale * RADAR_R * Math.sin(angle)];
  }
  function ringPts(scale) {
    return Array.from({ length: RADAR_N }, (_, i) => radarTip(i, scale).join(',')).join(' ');
  }
  const radarValues = statValues.map(sv => sv.num >= 0 ? sv.num / 17 : 0);
  const userPts = radarValues.map((v, i) => radarTip(i, Math.max(v, 0.03)).join(',')).join(' ');

  // Power gauge arc
  const gaugeR = 52, gaugeCx = 60, gaugeCy = 60;
  const gaugeCirc = 2 * Math.PI * gaugeR;
  const gaugeFill = (power.index / 100) * gaugeCirc;

  // Render a quick fact item
  const renderQuickFact = (fieldName) => {
    const field = getField(fieldName);
    if (!field) return null;
    const { value, column } = field;
    if (value == null || value === '') return null;
    let display;
    if (column.type === 'select' && value) {
      const opt = (column.options || []).find(o => o.id === value);
      display = opt ? <TagChip label={opt.label} color={opt.color} small /> : value;
    } else {
      display = String(value);
    }
    return (
      <div key={fieldName} className={s.quickFact}>
        <span className={s.quickFactLabel}>{fieldName}</span>
        <span className={s.quickFactValue}>
          {editing ? (
            column.type === 'select' ? (
              <span className={s.editFieldWrap} onClick={() => setEditingField(editingField === column.id ? null : column.id)}>
                {display}
                {editingField === column.id && <EditableSelect value={value} column={column} rowId={row.id} editing onDone={() => setEditingField(null)} />}
              </span>
            ) : (
              <EditableText value={value} colId={column.id} rowId={row.id} editing />
            )
          ) : display}
        </span>
      </div>
    );
  };

  // Render moments as bullet list
  const renderMoments = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    const hasBullets = lines.some(l => l.trim().startsWith('- '));
    if (hasBullets) {
      return (
        <ul className={s.momentsList}>
          {lines.map((line, i) => {
            const cleaned = line.replace(/^-\s*/, '');
            return <li key={i} className={s.momentsItem}>{cleaned}</li>;
          })}
        </ul>
      );
    }
    return <div className={s.tabText}>{text}</div>;
  };

  return (
    <div ref={sheetRef} className={`${s.sheet} ${editing ? s.sheetEditing : ''}`}>
      {/* ── Hero Banner ── */}
      <div className={s.heroBanner}>
        <button
          className={`${s.editBtn} ${editing ? s.editBtnActive : ''}`}
          onClick={() => setEditing(v => !v)}
          title={editing ? 'View mode (E)' : 'Edit mode (E)'}
        >
          {editing ? '✓' : '✎'}
        </button>
        <div className={s.heroContent}>
          <div className={s.heroInfo}>
            {editing ? (
              <EditableText value={name} colId={nameCol?.id} rowId={row.id} editing />
            ) : (
              <h1 className={s.heroName}>{name}</h1>
            )}
            {(titleVal || editing) && (
              editing ? (
                <EditableText value={titleVal} colId={getCol('Title')?.id} rowId={row.id} editing />
              ) : (
                <div className={s.heroTitle}>{titleVal}</div>
              )
            )}
            <div className={s.heroBadges}>
              {sigLabel && <TagChip label={sigLabel.label} color={sigLabel.color} />}
              {statusLabel && <TagChip label={statusLabel.label} color={statusLabel.color} />}
              {ratingVal != null && (
                editing ? <StarRating value={ratingVal} onChange={v => setCellValue(row.id, ratingCol?.id, v)} /> : <StarRating value={ratingVal} />
              )}
            </div>
            {hasStats && (
              <div className={s.heroTier}>
                <span className={s.heroTierLabel} style={{ color: `var(--${power.color})` }}>{power.tier}</span>
                <span className={s.heroTierIndex}>Power Index {power.index}</span>
              </div>
            )}
            {(getVal('Theme Song') || getVal('Voice Claim') || editing) && (
              <div className={s.heroMedia}>
                {(getVal('Theme Song') || editing) && (
                  <div className={s.mediaChip}>
                    <span className={s.mediaIcon}>♫</span>
                    {editing ? (
                      <EditableText value={getVal('Theme Song')} colId={getCol('Theme Song')?.id} rowId={row.id} editing />
                    ) : (
                      <span className={s.mediaText}>{getVal('Theme Song')}</span>
                    )}
                  </div>
                )}
                {(getVal('Voice Claim') || editing) && (
                  <div className={s.mediaChip}>
                    <span className={s.mediaIcon}>🎤</span>
                    {editing ? (
                      <EditableText value={getVal('Voice Claim')} colId={getCol('Voice Claim')?.id} rowId={row.id} editing />
                    ) : (
                      <span className={s.mediaText}>{getVal('Voice Claim')}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className={s.heroPortrait} style={{ boxShadow: `0 0 0 3px var(--${dominantStat.color}), 0 0 24px color-mix(in srgb, var(--${dominantStat.color}) 35%, transparent)` }}>
            {getVal('Profile Image') ? (
              <img className={s.heroPortraitImg} src={getVal('Profile Image')} alt={name} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = ''; }} />
            ) : null}
            <span className={s.heroInitials} style={getVal('Profile Image') ? { display: 'none' } : undefined}>{initials}</span>
          </div>
        </div>
        {activeEra && (
          <div className={s.eraIndicator}>Viewing: {eras.find(e => e.id === activeEra)?.label}</div>
        )}
        <div className={s.heroDivider} />
      </div>

      {/* ── Character Quote ── */}
      {(getVal('Featured Quote') || editing) && (
        <div className={s.quoteBlock}>
          {editing ? (
            <EditableText value={getVal('Featured Quote')} colId={getCol('Featured Quote')?.id} rowId={row.id} editing />
          ) : (
            <>
              <span className={s.quoteText}>{getVal('Featured Quote')}</span>
              <span className={s.quoteAttr}>— {name}</span>
            </>
          )}
        </div>
      )}

      {/* ── Era Selector ── */}
      {eras.length > 0 && (
        <div className={s.eraBar}>
          {eras.map(era => (
            <button
              key={era.id}
              className={`${s.eraBtn} ${activeEra === era.id ? s.eraBtnActive : ''}`}
              onClick={() => setActiveEra(activeEra === era.id ? null : era.id)}
            >
              {era.label}
            </button>
          ))}
          <button
            className={`${s.eraBtn} ${activeEra === null ? s.eraBtnActive : ''}`}
            onClick={() => setActiveEra(null)}
          >
            Current
          </button>
        </div>
      )}

      {/* ── Quick Facts Strip ── */}
      {(() => {
        const facts = QUICK_FACT_FIELDS.map(renderQuickFact).filter(Boolean);
        return facts.length > 0 ? (
          <div className={s.quickFacts}>{facts}</div>
        ) : null;
      })()}

      {/* ── Two-column body ── */}
      <div className={s.columns}>
        {/* Left column */}
        <div className={s.colLeft}>
          {/* Identity panel */}
          <div className={s.identityPanel}>
            <div className={s.panelCornerTL} /><div className={s.panelCornerTR} />
            <div className={s.panelCornerBL} /><div className={s.panelCornerBR} />
            <button className={s.sectionHeader} onClick={() => toggleSection('identity')}>
              <span className={`${s.chevron} ${collapsed.identity ? s.chevronCollapsed : ''}`}>▾</span>
              <span className={s.sectionHeaderText}>Identity</span>
            </button>
            {!collapsed.identity && <div className={s.identityGrid}>
              {identityFields.map(fieldName => {
                const field = getField(fieldName);
                if (!field) return null;
                const { value, column } = field;
                if (!editing && (value == null || value === '')) return null;
                let display;
                if (column.type === 'select' && value) {
                  const opt = (column.options || []).find(o => o.id === value);
                  display = opt ? <TagChip label={opt.label} color={opt.color} small /> : value;
                } else if (column.type === 'letter_grade') {
                  display = <GradeBadge grade={value} small />;
                } else if (column.type === 'checkbox') {
                  if (editing) {
                    display = <button className={s.editCheckbox} onClick={() => setCellValue(row.id, column.id, !value)}>{value ? '☑' : '☐'}</button>;
                  } else {
                    display = value ? <span style={{ color: 'var(--grn)' }}>Yes</span> : <span style={{ color: 'var(--t3)' }}>No</span>;
                  }
                } else if (editing) {
                  display = <EditableText value={value} colId={column.id} rowId={row.id} editing />;
                } else {
                  display = String(value);
                }
                return (
                  <div key={fieldName} className={s.idField}>
                    <span className={s.idLabel}>{fieldName}</span>
                    <span className={s.idValue}>
                      {editing && column.type === 'select' ? (
                        <span className={s.editFieldWrap} onClick={() => setEditingField(editingField === column.id ? null : column.id)}>
                          {display}
                          {editingField === column.id && <EditableSelect value={value} column={column} rowId={row.id} editing onDone={() => setEditingField(null)} />}
                        </span>
                      ) : display}
                    </span>
                  </div>
                );
              })}
            </div>}
          </div>

          {/* Radar chart */}
          {hasStats && (
            <div className={s.radarSection}>
              <button className={s.sectionHeader} onClick={() => toggleSection('radar')}>
                <span className={`${s.chevron} ${collapsed.radar ? s.chevronCollapsed : ''}`}>▾</span>
                <span className={s.sectionHeaderText}>Stat Profile</span>
              </button>
              {!collapsed.radar && <div className={s.radarWrap}>
                <svg className={s.radarSvg} viewBox="0 0 200 200">
                  <defs>
                    <linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="var(--ora)" stopOpacity="0.10" />
                    </linearGradient>
                    <filter id="radarGlow">
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <polygon className={s.radarRing} points={ringPts(1)} />
                  <polygon className={s.radarRing} points={ringPts(0.66)} />
                  <polygon className={s.radarRing} points={ringPts(0.33)} />
                  <polygon className={s.radarRef} points={ringPts(0.5)} />
                  {Array.from({ length: RADAR_N }, (_, i) => {
                    const [x, y] = radarTip(i, 1);
                    return <line key={i} className={s.radarAxis} x1={RADAR_CX} y1={RADAR_CY} x2={x} y2={y} />;
                  })}
                  <polygon className={s.radarGlow} points={userPts} filter="url(#radarGlow)" />
                  <polygon className={s.radarPoly} points={userPts} />
                  {radarValues.map((v, i) => {
                    const [x, y] = radarTip(i, Math.max(v, 0.03));
                    return <circle key={i} cx={x} cy={y} r={4} fill={`var(--${STAT_COLORS[i]})`} style={{ filter: `drop-shadow(0 0 6px var(--${STAT_COLORS[i]}))` }} />;
                  })}
                  {STAT_AXES.map((label, i) => {
                    const [lx, ly] = radarTip(i, 1.25);
                    const ta = lx < RADAR_CX - 2 ? 'end' : lx > RADAR_CX + 2 ? 'start' : 'middle';
                    const db = ly < RADAR_CY - 2 ? 'auto' : ly > RADAR_CY + 2 ? 'hanging' : 'middle';
                    return <text key={i} className={s.radarLabel} x={lx} y={ly} textAnchor={ta} dominantBaseline={db} fill={`var(--${STAT_COLORS[i]})`}>{label}</text>;
                  })}
                </svg>
              </div>}
            </div>
          )}

          {/* D&D stats */}
          {hasDnd && (
            <div className={s.dndSection}>
              <button className={s.sectionHeader} onClick={() => toggleSection('dnd')}>
                <span className={`${s.chevron} ${collapsed.dnd ? s.chevronCollapsed : ''}`}>▾</span>
                <span className={s.sectionHeaderText}>Attribute Scores</span>
              </button>
              {!collapsed.dnd && <div className={s.dndGrid}>
                {dndValues.map(dv => {
                  const mod = dv.value != null ? Math.floor((dv.value - 10) / 2) : null;
                  const valColor = dndValueColor(dv.value);
                  return (
                    <div key={dv.stat} className={s.dndCard}>
                      <div className={s.dndCardAccent} style={{ background: `var(--${valColor})` }} />
                      <span className={s.dndCardLabel}>{dv.abbr}</span>
                      {editing && dv.colId ? (
                        <EditableNumber value={dv.value} colId={dv.colId} rowId={row.id} editing />
                      ) : (
                        <span className={s.dndCardValue} style={{ color: `var(--${valColor})` }}>{dv.value ?? '—'}</span>
                      )}
                      {mod != null && !editing && <span className={s.dndCardMod}>{mod >= 0 ? `+${mod}` : mod}</span>}
                    </div>
                  );
                })}
              </div>}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className={s.colRight}>
          {/* Power gauge */}
          {hasStats && (
            <div className={s.powerSection}>
              <button className={s.sectionHeader} onClick={() => toggleSection('power')}>
                <span className={`${s.chevron} ${collapsed.power ? s.chevronCollapsed : ''}`}>▾</span>
                <span className={s.sectionHeaderText}>Power Rating</span>
              </button>
              {!collapsed.power && <>
              <div className={s.powerGauge}>
                <svg className={s.powerSvg} viewBox="0 0 120 120">
                  <circle className={s.powerRingBg} cx={gaugeCx} cy={gaugeCy} r={gaugeR} />
                  <circle
                    className={`${s.powerRingFill} ${power.index >= 96 ? s.powerPulse : ''}`}
                    cx={gaugeCx} cy={gaugeCy} r={gaugeR}
                    stroke={`var(--${power.color})`}
                    strokeDasharray={`${gaugeFill} ${gaugeCirc - gaugeFill}`}
                    strokeDashoffset={gaugeCirc * 0.25}
                    style={{ transition: mounted ? 'stroke-dasharray 1s cubic-bezier(0.23,1,0.32,1)' : 'none' }}
                  />
                </svg>
                <div className={s.powerCenter}>
                  <span className={s.powerNumber} style={{ color: `var(--${power.color})` }}>{mounted ? power.index : 0}</span>
                </div>
              </div>
              <div className={s.powerTierLabel} style={{ color: `var(--${power.color})` }}>{power.tier}</div>
              </>}
            </div>
          )}

          {/* Ability cards */}
          {hasStats && (
            <div className={s.abilitySection}>
              <button className={s.sectionHeader} onClick={() => toggleSection('abilities')}>
                <span className={`${s.chevron} ${collapsed.abilities ? s.chevronCollapsed : ''}`}>▾</span>
                <span className={s.sectionHeaderText}>Abilities</span>
              </button>
              {!collapsed.abilities && <div className={s.abilityGrid}>
                {statValues.filter(sv => sv.num >= 0).map(sv => {
                  const pct = (sv.num / 17) * 100;
                  const flavor = FLAVOR_TEXT[sv.num] || '';
                  return (
                    <div key={sv.axis} className={s.abilityCard}>
                      <div className={s.abilityAccent} style={{ background: `var(--${sv.color})` }} />
                      <div className={s.abilityHead}>
                        <span className={s.abilityName}>{sv.fullName}</span>
                        {sv.grade && <GradeBadge grade={sv.grade} small />}
                      </div>
                      <div className={s.abilityBarBg}>
                        <div className={s.abilityBarFill} style={{
                          width: mounted ? `${pct}%` : '0%',
                          background: `var(--${sv.color})`,
                        }} />
                      </div>
                      <span className={s.abilityFlavor}>{flavor}</span>
                    </div>
                  );
                })}
              </div>}
            </div>
          )}
        </div>
      </div>

      {/* ── Story Arc (full width) ── */}
      {(storyArcVal || editing) && (
        <div className={s.storyArcSection}>
          <div className={s.divider} />
          <button className={s.sectionHeader} onClick={() => toggleSection('storyArc')}>
            <span className={`${s.chevron} ${collapsed.storyArc ? s.chevronCollapsed : ''}`}>▾</span>
            <span className={s.sectionHeaderText}>Story Arc</span>
          </button>
          {!collapsed.storyArc && (editing ? (
            <div className={s.storyArcBlock}>
              <EditableText value={storyArcVal} colId={storyArcCol?.id} rowId={row.id} editing large />
            </div>
          ) : storyArcVal ? (
            <div className={s.storyArcBlock}>{storyArcVal}</div>
          ) : null)}
        </div>
      )}

      {/* ── Relations (full width) ── */}
      {bondTargets.length > 0 && (
        <div className={s.relationsSection}>
          <div className={s.divider} />
          <button className={s.sectionHeader} onClick={() => toggleSection('bonds')}>
            <span className={`${s.chevron} ${collapsed.bonds ? s.chevronCollapsed : ''}`}>▾</span>
            <span className={s.sectionHeaderText}>Bonds</span>
          </button>
          {!collapsed.bonds && <div className={s.relationsRow}>
            {bondTargets.map(bt => (
              <button
                key={bt.id}
                className={s.relationNode}
                onClick={() => onSelectRow && onSelectRow(bt.id)}
                title={bt.name}
              >
                <div className={s.relationCircle} style={{ borderColor: `var(--${bt.sig || 'slv'})` }}>
                  <span className={s.relationInitials}>{bt.initials}</span>
                </div>
                <span className={s.relationName}>{bt.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>}
        </div>
      )}

      {/* ── Tabs (full width) ── */}
      <div className={s.tabsSection}>
        <div className={s.divider} />
        <div className={s.tabs}>
          {TABS.map(tab => (
            <button
              key={tab}
              className={`${s.tab} ${activeTab === tab ? s.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className={s.tabContent}>
          {activeTab === 'Relations' && bondTargets.length > 0 ? (
            <div>
              {(() => {
                const detail = getTabContent('Relations');
                return detail ? <div className={s.tabText}>{detail.text}</div> : null;
              })()}
              <div className={s.tabRelations}>
                {bondTargets.map(bt => (
                  <div key={bt.id} className={s.tabRelationItem}>
                    <div className={s.tabRelCircle} style={{ borderColor: `var(--${bt.sig || 'slv'})` }}>
                      <span>{bt.initials}</span>
                    </div>
                    <span className={s.tabRelName}>{bt.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'Gallery' ? (
            (() => {
              const raw = getVal('Gallery');
              let imgs = [];
              try { if (raw) imgs = JSON.parse(raw); } catch {}
              if (!Array.isArray(imgs) || imgs.length === 0) {
                return <span className={s.tabEmpty}>No gallery images</span>;
              }
              return (
                <div className={s.galleryGrid}>
                  {imgs.map((url, i) => (
                    <button key={i} className={s.galleryThumb} onClick={() => setLightboxIdx(i)}>
                      <img src={url} alt={`Gallery ${i + 1}`} className={s.galleryImg} onError={(e) => { e.target.parentElement.style.display = 'none'; }} />
                    </button>
                  ))}
                </div>
              );
            })()
          ) : activeTab === 'Moments' ? (
            (() => {
              const content = getTabContent('Moments');
              if (!content) return <span className={s.tabEmpty}>No content yet</span>;
              if (editing) return <EditableText value={content.text} colId={content.col?.id} rowId={row.id} editing large />;
              return renderMoments(content.text);
            })()
          ) : (
            (() => {
              const content = getTabContent(activeTab);
              if (!content) return editing ? <span className={s.tabEmpty}>No column mapped for this tab</span> : <span className={s.tabEmpty}>No content yet</span>;
              if (editing) return <EditableText value={content.text} colId={content.col?.id} rowId={row.id} editing large />;
              return <div className={s.tabText}>{content.text}</div>;
            })()
          )}
        </div>
      </div>

      {/* ── Lightbox overlay ── */}
      {lightboxIdx !== null && (() => {
        const raw = getVal('Gallery');
        let imgs = [];
        try { if (raw) imgs = JSON.parse(raw); } catch {}
        if (!imgs[lightboxIdx]) return null;
        return (
          <div className={s.lightbox} onClick={() => setLightboxIdx(null)}>
            <img src={imgs[lightboxIdx]} alt="" className={s.lightboxImg} onClick={e => e.stopPropagation()} />
            <div className={s.lightboxNav}>
              {lightboxIdx > 0 && <button className={s.lightboxBtn} onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}>‹</button>}
              {lightboxIdx < imgs.length - 1 && <button className={s.lightboxBtn} onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}>›</button>}
            </div>
            <button className={s.lightboxClose} onClick={() => setLightboxIdx(null)}>✕</button>
          </div>
        );
      })()}
    </div>
  );
}
