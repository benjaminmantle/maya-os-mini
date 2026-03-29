/* Quadtree spatial index for hit-testing and viewport culling */

class QuadNode {
  constructor(x, y, w, h, depth, maxDepth, maxItems) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.depth = depth;
    this.maxDepth = maxDepth;
    this.maxItems = maxItems;
    this.items = [];
    this.children = null; // [NW, NE, SW, SE] when subdivided
  }

  _subdivide() {
    const hw = this.w / 2, hh = this.h / 2;
    const d = this.depth + 1;
    this.children = [
      new QuadNode(this.x,      this.y,      hw, hh, d, this.maxDepth, this.maxItems),
      new QuadNode(this.x + hw, this.y,      hw, hh, d, this.maxDepth, this.maxItems),
      new QuadNode(this.x,      this.y + hh, hw, hh, d, this.maxDepth, this.maxItems),
      new QuadNode(this.x + hw, this.y + hh, hw, hh, d, this.maxDepth, this.maxItems),
    ];
    // re-insert existing items
    for (const item of this.items) {
      for (const c of this.children) {
        if (_intersects(item, c)) c.insert(item);
      }
    }
    this.items = [];
  }

  insert(item) {
    if (!_intersects(item, this)) return;
    if (this.children) {
      for (const c of this.children) c.insert(item);
      return;
    }
    this.items.push(item);
    if (this.items.length > this.maxItems && this.depth < this.maxDepth) {
      this._subdivide();
    }
  }

  query(rect, out) {
    if (!_intersects(rect, this)) return;
    if (this.children) {
      for (const c of this.children) c.query(rect, out);
      return;
    }
    for (const item of this.items) {
      if (_intersects(item, rect)) out.add(item);
    }
  }
}

function _intersects(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x ||
           a.y + a.h < b.y || b.y + b.h < a.y);
}

export function createSpatialIndex() {
  let root = null;

  function rebuild(items) {
    if (!items || items.length === 0) { root = null; return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const rects = [];
    for (const el of items) {
      const r = _elRect(el);
      rects.push(r);
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    }
    const pad = 100;
    root = new QuadNode(minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2, 0, 8, 8);
    for (const r of rects) root.insert(r);
  }

  function query(rect) {
    if (!root) return [];
    const set = new Set();
    root.query({ x: rect.x, y: rect.y, w: rect.width, h: rect.height }, set);
    return [...set].map(r => r._el);
  }

  function queryPoint(wx, wy) {
    return query({ x: wx - 1, y: wy - 1, width: 2, height: 2 });
  }

  return { rebuild, query, queryPoint };
}

function _elRect(el) {
  let x = el.x ?? 0, y = el.y ?? 0;
  let w = el.width ?? 0, h = el.height ?? 0;
  if (el.points && el.points.length) {
    let mx = 0, my = 0, Mx = 0, My = 0;
    for (const p of el.points) {
      mx = Math.min(mx, p.x); my = Math.min(my, p.y);
      Mx = Math.max(Mx, p.x); My = Math.max(My, p.y);
    }
    x += mx; y += my;
    w = Mx - mx || 1; h = My - my || 1;
  }
  if (w === 0) w = 1;
  if (h === 0) h = 1;
  return { x, y, w, h, _el: el };
}
