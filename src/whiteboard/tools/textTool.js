/* Text tool — click to place, textarea overlay for editing */

import { createText } from '../elements/types.js';
import { screenToWorld, worldToScreen } from '../core/camera.js';
import { pushCommand } from '../core/history.js';
import { TOOL_IDS } from '../core/constants.js';

export const textTool = {
  cursor: 'text',

  onMouseDown(ctx, e) {
    const { camera, canvasEl } = ctx;
    const rect = canvasEl.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy, camera);

    // create text element
    const el = createText(w.x, w.y, '');
    ctx.addElement(el);

    // open text editor overlay
    const screenPos = worldToScreen(w.x, w.y, camera);
    ctx.openTextEditor({
      elementId: el.id,
      screenX: screenPos.x + rect.left,
      screenY: screenPos.y + rect.top,
      fontSize: el.fontSize,
      isNew: true,
    });
  },

  onMouseMove() {},
  onMouseUp() {},
};

/** Called when text editor commits */
export function commitText(ctx, elementId, text) {
  const el = ctx.elements.find(e => e.id === elementId);
  if (!el) return;

  if (!text.trim()) {
    // empty text — delete the element
    ctx.deleteElements([elementId]);
    ctx.setDirty();
    return;
  }

  // measure text width roughly
  const lines = text.split('\n');
  const maxLen = Math.max(...lines.map(l => l.length));
  const width = Math.max(20, maxLen * el.fontSize * 0.6);
  const height = lines.length * el.fontSize * 1.4;

  ctx.updateElement(elementId, { text, width, height });
  pushCommand({
    type: 'create',
    elementIds: [elementId],
    before: [],
    after: [JSON.parse(JSON.stringify({ ...el, text, width, height }))],
  });

  ctx.setSelection(new Set([elementId]));
  ctx.setActiveTool(TOOL_IDS.SELECT);
  ctx.setDirty();
}

/** Called when editing existing text (double-click) */
export function editExistingText(ctx, elementId) {
  const el = ctx.elements.find(e => e.id === elementId);
  if (!el || el.type !== 'text') return;
  const { camera, canvasEl } = ctx;
  const rect = canvasEl.getBoundingClientRect();
  const screenPos = worldToScreen(el.x, el.y, camera);
  ctx.openTextEditor({
    elementId: el.id,
    screenX: screenPos.x + rect.left,
    screenY: screenPos.y + rect.top,
    fontSize: el.fontSize,
    text: el.text,
    isNew: false,
  });
}
