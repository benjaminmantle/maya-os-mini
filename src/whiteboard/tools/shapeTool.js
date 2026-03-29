/* Shape tool — rectangle and ellipse creation */

import { createRectangle, createEllipse } from '../elements/types.js';
import { screenToWorld } from '../core/camera.js';
import { pushCommand } from '../core/history.js';
import { TOOL_IDS } from '../core/constants.js';

let startWorld = null;
let ghost = null;

export function createShapeTool(shapeType) {
  return {
    cursor: 'crosshair',

    onMouseDown(ctx, e) {
      const { camera, canvasEl } = ctx;
      const rect = canvasEl.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      startWorld = screenToWorld(sx, sy, camera);

      const factory = shapeType === TOOL_IDS.ELLIPSE ? createEllipse : createRectangle;
      ghost = factory(startWorld.x, startWorld.y, 0, 0);
      ctx.setGhost(ghost);
      ctx.setDirty();
    },

    onMouseMove(ctx, e) {
      if (!startWorld || !ghost) return;
      const { camera, canvasEl } = ctx;
      const rect = canvasEl.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const w = screenToWorld(sx, sy, camera);

      let x = startWorld.x, y = startWorld.y;
      let width = w.x - startWorld.x;
      let height = w.y - startWorld.y;

      // Alt = draw from center
      if (e.altKey) {
        x = startWorld.x - Math.abs(width);
        y = startWorld.y - Math.abs(height);
        width = Math.abs(width) * 2;
        height = Math.abs(height) * 2;
      } else {
        if (width < 0) { x += width; width = -width; }
        if (height < 0) { y += height; height = -height; }
      }

      // Shift = constrain to square/circle
      if (e.shiftKey) {
        const side = Math.max(width, height);
        width = side;
        height = side;
      }

      ghost.x = x;
      ghost.y = y;
      ghost.width = width;
      ghost.height = height;
      ctx.setGhost(ghost);
      ctx.setDirty();
    },

    onMouseUp(ctx, e) {
      if (!ghost) return;
      ctx.setGhost(null);

      // discard trivial shapes
      if (ghost.width < 5 && ghost.height < 5) {
        startWorld = null;
        ghost = null;
        ctx.setDirty();
        return;
      }

      ctx.addElement(ghost);
      pushCommand({
        type: 'create',
        elementIds: [ghost.id],
        before: [],
        after: [JSON.parse(JSON.stringify(ghost))],
      });

      // switch to select with new element selected
      ctx.setSelection(new Set([ghost.id]));
      ctx.setActiveTool(TOOL_IDS.SELECT);
      ctx.setDirty();

      startWorld = null;
      ghost = null;
    },
  };
}
