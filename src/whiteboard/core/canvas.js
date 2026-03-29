/* Canvas setup: rAF loop, DPR scaling, resize */

import { createRenderer } from '../render/renderer.js';
import { createSpatialIndex } from './spatialIndex.js';

export function setupCanvas(canvasEl) {
  const renderer = createRenderer(canvasEl);
  const spatialIdx = createSpatialIndex();
  let dirty = true;
  let rafId = null;
  let destroyed = false;

  // state getters — set by the caller
  let _getElements = () => [];
  let _getCamera   = () => ({ x: 0, y: 0, zoom: 1 });
  let _getSelection = () => new Set();
  let _getHoveredId = () => null;
  let _getRenderStyle = () => 'sketch';
  let _getGhost    = () => null;
  let _getMarquee  = () => null;

  function setGetters(g) {
    if (g.elements)    _getElements    = g.elements;
    if (g.camera)      _getCamera      = g.camera;
    if (g.selection)   _getSelection   = g.selection;
    if (g.hoveredId)   _getHoveredId   = g.hoveredId;
    if (g.renderStyle) _getRenderStyle = g.renderStyle;
    if (g.ghost)       _getGhost       = g.ghost;
    if (g.marquee)     _getMarquee     = g.marquee;
    dirty = true; // re-render with new getters
  }

  /* ---- sizing ---- */
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const parent = canvasEl.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    canvasEl.width = w * dpr;
    canvasEl.height = h * dpr;
    canvasEl.style.width  = w + 'px';
    canvasEl.style.height = h + 'px';
    dirty = true;
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvasEl.parentElement);
  resize();

  /* ---- render loop ---- */
  function frame() {
    if (destroyed) return;
    if (dirty) {
      dirty = false;
      const elements = _getElements();
      spatialIdx.rebuild(elements);
      renderer.render(
        elements,
        _getCamera(),
        _getSelection(),
        _getHoveredId(),
        _getRenderStyle(),
        spatialIdx,
        _getGhost(),
        _getMarquee(),
      );
    }
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  /* ---- API ---- */
  function setDirty() { dirty = true; }

  function destroy() {
    destroyed = true;
    cancelAnimationFrame(rafId);
    ro.disconnect();
  }

  return { setDirty, destroy, resize, setGetters, renderer, spatialIdx };
}
