/* CosmiCanvas constants */

export const TOOL_IDS = {
  SELECT:   'select',
  RECT:     'rectangle',
  ELLIPSE:  'ellipse',
  LINE:     'line',
  ARROW:    'arrow',
  FREEHAND: 'freehand',
  TEXT:     'text',
};

export const DEFAULTS = {
  strokeColor: '#ddd9d6',
  fillColor:   'transparent',
  strokeWidth: 2,
  fillStyle:   'solid',      // solid | hachure | cross-hatch | none
  opacity:     1,
  fontSize:    20,
  fontFamily:  'hand',       // hand | mono | sans
  textAlign:   'left',
};

export const ZOOM_MIN  = 0.05;
export const ZOOM_MAX  = 64;
export const ZOOM_STEP = 0.1;

export const DEBOUNCE_MS  = 200;
export const MAX_HISTORY  = 200;

export const COLOR_PALETTE = [
  '#ddd9d6', // --text
  '#f0b030', // --gold
  '#ff3060', // --hot
  '#22ee80', // --grn
  '#4488ff', // --blu
  '#9955ff', // --pur
  '#ff7030', // --ora
  '#20c8d8', // --tel
  '#ff80b0', // --pnk
  '#ffffff',
  '#000000',
  'transparent',
];

/* id helpers */
const _uid = () => Math.random().toString(36).slice(2, 10);
export const elId    = () => 'el_'  + _uid();
export const boardId = () => 'brd_' + _uid();
export const blobId  = () => 'img_' + _uid();
