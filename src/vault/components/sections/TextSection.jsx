import { useState, useRef, useEffect, useCallback } from 'react';
import SectionShell from './SectionShell.jsx';
import { loadTextContent, getTextContent, setTextContent } from '../../store/vaultStore.js';
import { useVault } from '../../hooks/useVault.js';
import s from '../../styles/TextSection.module.css';

export default function TextSection({ section }) {
  const vault = useVault();
  const content = getTextContent(section.id);
  const editorRef = useRef(null);
  const debounceRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(!content);
  const [focused, setFocused] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const savedSelectionRef = useRef(null);

  useEffect(() => { loadTextContent(section.id); }, [section.id]);

  // Sync editor content when store changes externally
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }
    setIsEmpty(!content);
  }, [content]);

  const handleInput = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? '';
    setIsEmpty(!html || html === '<br>');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setTextContent(section.id, html);
    }, 500);
  }, [section.id]);

  const handleFocus = () => {
    setFocused(true);
    setIsEmpty(false);
  };

  const handleBlur = (e) => {
    // Don't blur if clicking toolbar
    if (e.relatedTarget && e.relatedTarget.closest(`.${s.toolbar}`)) return;
    const html = editorRef.current?.innerHTML ?? '';
    clearTimeout(debounceRef.current);
    setTextContent(section.id, html);
    setIsEmpty(!html || html === '<br>');
    setFocused(false);
    setLinkMode(false);
  };

  const execFormat = (cmd) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, null);
    handleInput();
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
  };

  const handleLinkClick = () => {
    if (linkMode) {
      setLinkMode(false);
      setLinkUrl('');
      return;
    }
    saveSelection();
    setLinkMode(true);
    setLinkUrl('');
  };

  const commitLink = () => {
    if (linkUrl.trim()) {
      editorRef.current?.focus();
      restoreSelection();
      const url = linkUrl.trim().startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`;
      document.execCommand('createLink', false, url);
      handleInput();
    }
    setLinkMode(false);
    setLinkUrl('');
  };

  return (
    <SectionShell section={section}>
      <div className={s.wrapper}>
        <div className={`${s.toolbar} ${focused ? s.toolbarVisible : ''}`}>
          <button
            className={s.toolbarBtn}
            onMouseDown={e => { e.preventDefault(); execFormat('bold'); }}
            title="Bold"
          ><strong>B</strong></button>
          <button
            className={s.toolbarBtn}
            onMouseDown={e => { e.preventDefault(); execFormat('italic'); }}
            title="Italic"
          ><em>I</em></button>
          <button
            className={s.toolbarBtn}
            onMouseDown={e => { e.preventDefault(); execFormat('underline'); }}
            title="Underline"
          ><u>U</u></button>
          <button
            className={`${s.toolbarBtn} ${linkMode ? s.toolbarBtnActive : ''}`}
            onMouseDown={e => { e.preventDefault(); handleLinkClick(); }}
            title="Link"
          >🔗</button>
          {linkMode && (
            <input
              className={s.linkInput}
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitLink(); if (e.key === 'Escape') { setLinkMode(false); setLinkUrl(''); } }}
              placeholder="https://..."
              autoFocus
            />
          )}
        </div>
        {isEmpty && (
          <span className={s.placeholder} onClick={() => editorRef.current?.focus()}>
            Start writing…
          </span>
        )}
        <div
          ref={editorRef}
          className={s.editor}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </SectionShell>
  );
}
