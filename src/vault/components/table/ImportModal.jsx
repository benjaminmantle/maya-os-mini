import { useState, useRef, useCallback } from 'react';
import { parseCSV, detectColumnType, importSectionCSV, getColumns, GRADE_SCALE } from '../../store/vaultStore.js';
import GradeBadge from '../shared/GradeBadge.jsx';
import s from '../../styles/ImportModal.module.css';

const COL_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
  { value: 'rating', label: 'Rating' },
  { value: 'letter_grade', label: 'Letter Grade' },
];

export default function ImportModal({ sectionId, onClose }) {
  const [step, setStep] = useState('drop'); // 'drop' | 'preview' | 'done'
  const [csvData, setCsvData] = useState(null); // { headers, rows, rawCSV }
  const [columnTypes, setColumnTypes] = useState([]); // detected type per column
  const [columnEnabled, setColumnEnabled] = useState([]); // boolean per column
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const panelRef = useRef(null);

  const processCSV = useCallback((text) => {
    const parsed = parseCSV(text);
    if (parsed.length < 2) return;
    const headers = parsed[0];
    const dataRows = parsed.slice(1);
    const existingCols = getColumns(sectionId);

    // Detect types + check existing matches
    const types = [];
    const enabled = [];
    for (let i = 0; i < headers.length; i++) {
      const name = headers[i].trim();
      const values = dataRows.map(r => r[i] || '');
      const existing = existingCols.find(c => c.name.toLowerCase() === name.toLowerCase());
      types.push({
        name,
        detected: existing ? existing.type : detectColumnType(values),
        existing: !!existing,
      });
      // Enable by default if column has any data
      enabled.push(values.some(v => v.trim()));
    }

    setCsvData({ headers, rows: dataRows, rawCSV: text });
    setColumnTypes(types);
    setColumnEnabled(enabled);
    setStep('preview');
  }, [sectionId]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) readFile(file);
  };

  const readFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => processCSV(e.target.result);
    reader.readAsText(file);
  };

  const toggleColumn = (idx) => {
    setColumnEnabled(prev => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const setType = (idx, type) => {
    setColumnTypes(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], detected: type };
      return next;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    const excludeColumns = new Set();
    columnEnabled.forEach((en, i) => {
      if (!en) excludeColumns.add(csvData.headers[i].trim());
    });

    const res = await importSectionCSV(sectionId, csvData.rawCSV, { excludeColumns });
    setResult(res);
    setImporting(false);
    setStep('done');
  };

  const previewRows = csvData?.rows.slice(0, 5) || [];

  return (
    <div className={s.overlay} onMouseDown={(e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    }}>
      <div className={s.panel} ref={panelRef}>
        <button className={s.closeBtn} onClick={onClose} title="Close">✕</button>
        <h2 className={s.title}>Import CSV</h2>

        {step === 'drop' && (
          <div
            className={`${s.dropZone} ${dragOver ? s.dropZoneActive : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <span className={s.dropIcon}>📥</span>
            <p className={s.dropText}>Drop a CSV file here or click to browse</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </div>
        )}

        {step === 'preview' && csvData && (
          <>
            <p className={s.previewInfo}>
              {csvData.rows.length} rows, {columnTypes.filter((_, i) => columnEnabled[i]).length} of {columnTypes.length} columns selected
            </p>
            <div className={s.previewWrap}>
              <table className={s.previewTable}>
                <thead>
                  <tr>
                    {columnTypes.map((ct, i) => (
                      <th key={i} className={`${s.previewTh} ${!columnEnabled[i] ? s.disabledCol : ''}`}>
                        <div className={s.colHeader}>
                          <label className={s.colToggle}>
                            <input
                              type="checkbox"
                              checked={columnEnabled[i]}
                              onChange={() => toggleColumn(i)}
                            />
                          </label>
                          <span className={s.colHeaderName}>{ct.name}</span>
                          <span className={`${s.colMatch} ${ct.existing ? s.matchYes : s.matchNew}`}>
                            {ct.existing ? '✓' : '+'}
                          </span>
                        </div>
                        <select
                          className={s.typeSelect}
                          value={ct.detected}
                          onChange={(e) => setType(i, e.target.value)}
                          disabled={!columnEnabled[i]}
                        >
                          {COL_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri}>
                      {columnTypes.map((ct, ci) => (
                        <td key={ci} className={`${s.previewTd} ${!columnEnabled[ci] ? s.disabledCol : ''}`}>
                          {row[ci] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvData.rows.length > 5 && (
              <p className={s.previewMore}>…and {csvData.rows.length - 5} more rows</p>
            )}
            <div className={s.actions}>
              <button className={s.backBtn} onClick={() => setStep('drop')}>← Back</button>
              <button
                className={s.importBtn}
                onClick={handleImport}
                disabled={importing || !columnEnabled.some(Boolean)}
              >
                {importing ? 'Importing…' : `Import ${csvData.rows.length} rows`}
              </button>
            </div>
          </>
        )}

        {step === 'done' && result && (
          <div className={s.doneState}>
            <span className={s.doneIcon}>✓</span>
            <p className={s.doneText}>
              Imported {result.rowsAdded} rows{result.columnsCreated > 0 ? ` and created ${result.columnsCreated} new columns` : ''}
            </p>
            <button className={s.importBtn} onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
