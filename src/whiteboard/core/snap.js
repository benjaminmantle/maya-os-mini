/* Snap-to-grid logic */

const GRID_SIZE = 20; // matches dot grid spacing

/**
 * Snap a value to the nearest grid point.
 */
export function snapToGrid(val, gridSize = GRID_SIZE) {
  return Math.round(val / gridSize) * gridSize;
}

/**
 * Snap a point { x, y } to the grid.
 */
export function snapPoint(x, y, gridSize = GRID_SIZE) {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
  };
}

/**
 * Snap element dimensions (width, height) to grid.
 */
export function snapSize(w, h, gridSize = GRID_SIZE) {
  return {
    w: Math.max(gridSize, snapToGrid(w, gridSize)),
    h: Math.max(gridSize, snapToGrid(h, gridSize)),
  };
}
