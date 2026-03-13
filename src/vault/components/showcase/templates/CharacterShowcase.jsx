import { useState } from 'react';
import { defaultForType, gradeToNum, gradeColor, GRADE_SCALE } from '../../../store/vaultStore.js';
import GradeBadge from '../../shared/GradeBadge.jsx';
import TagChip from '../../shared/TagChip.jsx';
import s from '../../../styles/CharacterShowcase.module.css';

const STAT_AXES = ['STR', 'END', 'AGI', 'MAG', 'INT', 'WIS', 'CHA', 'TAR'];
const STAT_COLORS = ['var(--hot)', 'var(--ora)', 'var(--grn)', 'var(--pur)', 'var(--blu)', 'var(--tel)', 'var(--pnk)', 'var(--gold)'];
const DND_STATS = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
const TABS = ['Backstory', 'Personality', 'Combat', 'Relations', 'World', 'Notes'];

// Tab → column name mappings (try multiple variants)
const TAB_COL_MAP = {
  Backstory: ['Backstory', 'Back Story', 'Background'],
  Personality: ['Personality Traits', 'Personality', 'MBTI'],
  Combat: ['Combat Abilities', 'Combat', 'Fighting Style', 'D&D Classes'],
  Relations: ['Bonds', 'Relations', 'Relationships', 'Family'],
  World: ['World Info', 'World', 'Lore', 'Origin'],
  Notes: ['Work Notes', 'Notes', 'Concept Refs'],
};

export default function CharacterShowcase({ row, columns }) {
  const [activeTab, setActiveTab] = useState('Backstory');

  // Helper: find column by name (case-insensitive) and get value
  const getField = (name) => {
    const col = columns.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!col) return null;
    return { value: row.cells?.[col.id] ?? defaultForType(col.type), column: col };
  };

  const getVal = (name) => getField(name)?.value ?? null;

  // Name
  const nameCol = columns.find(c => c.type === 'text') || columns[0];
  const name = row.cells?.[nameCol?.id] ?? 'Untitled';

  // Identity fields
  const identityFields = [
    'Race', 'Race1', 'Race2', 'Age', 'Gender', 'Alignment',
    'Soul Signature', 'Def Color', 'MBTI', 'MTG Colors',
    'Height', 'Weight', 'Birthday', 'Status', 'Significance',
  ];

  // Stat grades
  const statValues = STAT_AXES.map(axis => {
    const val = getVal(axis);
    return { axis, grade: val, num: val ? gradeToNum(val) : -1 };
  });
  const hasStats = statValues.some(sv => sv.num >= 0);

  // D&D stats
  const dndValues = DND_STATS.map(stat => ({
    stat,
    value: getVal(stat),
  }));
  const hasDnd = dndValues.some(dv => dv.value != null);

  // Significance badge
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

  // Status badge
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

  // Profile initials
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // Tab content
  const getTabContent = (tabName) => {
    const colNames = TAB_COL_MAP[tabName] || [tabName];
    for (const cn of colNames) {
      const val = getVal(cn);
      if (val && typeof val === 'string' && val.trim()) return val;
    }
    return null;
  };

  // Radar chart
  const RADAR_N = 8, RADAR_CX = 100, RADAR_CY = 100, RADAR_R = 75;
  function radarTip(i, scale = 1) {
    const angle = -Math.PI / 2 + (2 * Math.PI / RADAR_N) * i;
    return [RADAR_CX + scale * RADAR_R * Math.cos(angle), RADAR_CY + scale * RADAR_R * Math.sin(angle)];
  }
  function ringPts(scale) {
    return Array.from({ length: RADAR_N }, (_, i) => radarTip(i, scale).join(',')).join(' ');
  }
  const radarValues = statValues.map(sv => sv.num >= 0 ? sv.num / 17 : 0);
  const userPts = radarValues.map((v, i) => radarTip(i, Math.max(v, 0.03)).join(',')).join(' ');

  return (
    <div className={s.sheet}>
      {/* Header */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <h1 className={s.charName}>{name}</h1>
          <div className={s.badges}>
            {sigLabel && <TagChip label={sigLabel.label} color={sigLabel.color} />}
            {statusLabel && <TagChip label={statusLabel.label} color={statusLabel.color} />}
          </div>
        </div>
        <div className={s.portrait}>
          <span className={s.portraitInitials}>{initials}</span>
        </div>
      </div>

      {/* Identity grid */}
      <div className={s.identityGrid}>
        {identityFields.map(fieldName => {
          const field = getField(fieldName);
          if (!field) return null;
          const { value, column } = field;
          if (value == null || value === '') return null;

          let display;
          if (column.type === 'select' && value) {
            const opt = (column.options || []).find(o => o.id === value);
            display = opt ? <TagChip label={opt.label} color={opt.color} small /> : value;
          } else if (column.type === 'letter_grade') {
            display = <GradeBadge grade={value} small />;
          } else if (column.type === 'checkbox') {
            display = value ? '✓' : '✗';
          } else {
            display = String(value);
          }

          return (
            <div key={fieldName} className={s.idField}>
              <span className={s.idLabel}>{fieldName}</span>
              <span className={s.idValue}>{display}</span>
            </div>
          );
        })}
      </div>

      {/* Stat radar + badges */}
      {hasStats && (
        <div className={s.statsSection}>
          <h3 className={s.sectionTitle}>Stats</h3>
          <div className={s.statsLayout}>
            <div className={s.radarWrap}>
              <svg className={s.radarSvg} viewBox="0 0 200 200">
                {/* Grid rings */}
                <polygon className={s.radarRing} points={ringPts(1)} />
                <polygon className={s.radarRing} points={ringPts(0.66)} />
                <polygon className={s.radarRing} points={ringPts(0.33)} />
                {/* Axis lines */}
                {Array.from({ length: RADAR_N }, (_, i) => {
                  const [x, y] = radarTip(i, 1);
                  return <line key={i} className={s.radarAxis} x1={RADAR_CX} y1={RADAR_CY} x2={x} y2={y} />;
                })}
                {/* User polygon */}
                <polygon className={s.radarPoly} points={userPts} />
                {/* Dots */}
                {radarValues.map((v, i) => {
                  const [x, y] = radarTip(i, Math.max(v, 0.03));
                  return <circle key={i} cx={x} cy={y} r={3.5} fill={STAT_COLORS[i]} style={{ filter: `drop-shadow(0 0 3px ${STAT_COLORS[i]})` }} />;
                })}
                {/* Labels */}
                {STAT_AXES.map((label, i) => {
                  const [lx, ly] = radarTip(i, 1.2);
                  const ta = lx < RADAR_CX - 2 ? 'end' : lx > RADAR_CX + 2 ? 'start' : 'middle';
                  const db = ly < RADAR_CY - 2 ? 'auto' : ly > RADAR_CY + 2 ? 'hanging' : 'middle';
                  return <text key={i} className={s.radarLabel} x={lx} y={ly} textAnchor={ta} dominantBaseline={db}>{label}</text>;
                })}
              </svg>
            </div>
            <div className={s.statBadges}>
              {statValues.map(sv => (
                <div key={sv.axis} className={s.statBadgeItem}>
                  <span className={s.statBadgeLabel}>{sv.axis}</span>
                  {sv.grade ? <GradeBadge grade={sv.grade} /> : <span className={s.statEmpty}>—</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* D&D stat block */}
      {hasDnd && (
        <div className={s.dndSection}>
          <h3 className={s.sectionTitle}>D&D Stats</h3>
          <div className={s.dndBlock}>
            {dndValues.map(dv => (
              <div key={dv.stat} className={s.dndStat}>
                <span className={s.dndValue}>{dv.value ?? '—'}</span>
                <span className={s.dndLabel}>{dv.stat.slice(0, 3).toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabbed content */}
      <div className={s.tabsSection}>
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
          {getTabContent(activeTab) || (
            <span className={s.tabEmpty}>No content yet</span>
          )}
        </div>
      </div>
    </div>
  );
}
