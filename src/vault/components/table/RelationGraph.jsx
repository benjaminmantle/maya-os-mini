import { useState, useEffect, useRef, useCallback } from 'react';
import { getRelationsSync, getAllRelations, defaultForType } from '../../store/vaultStore.js';
import { useVault } from '../../hooks/useVault.js';
import s from '../../styles/RelationGraph.module.css';

const REPULSION = 800;
const SPRING_K = 0.02;
const SPRING_LEN = 120;
const DAMPING = 0.85;
const MIN_V = 0.01;

export default function RelationGraph({ rows, columns, sectionId }) {
  const vault = useVault();
  const svgRef = useRef(null);
  const simRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragNode, setDragNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  // Find name column and relation columns
  const nameCol = columns.find(c => c.type === 'text') || columns[0];
  const relCols = columns.filter(c => c.type === 'relation');

  // Build graph data from rows + relations
  useEffect(() => {
    const nodeMap = {};
    rows.forEach((row, i) => {
      const name = row.cells?.[nameCol?.id] ?? 'Untitled';
      // Spread nodes in a circle initially
      const angle = (2 * Math.PI / Math.max(rows.length, 1)) * i;
      const cx = 300 + 150 * Math.cos(angle);
      const cy = 250 + 150 * Math.sin(angle);
      nodeMap[row.id] = { id: row.id, name, x: cx, y: cy, vx: 0, vy: 0 };
    });

    const edgeList = [];
    const allRels = getAllRelations();
    for (const relCol of relCols) {
      rows.forEach(row => {
        const key = `${row.id}:${relCol.id}`;
        const targets = allRels[key];
        if (targets) {
          for (const tid of targets) {
            if (nodeMap[tid]) {
              // Avoid duplicate edges
              const exists = edgeList.some(e =>
                (e.source === row.id && e.target === tid) ||
                (e.source === tid && e.target === row.id)
              );
              if (!exists) {
                edgeList.push({ source: row.id, target: tid, colId: relCol.id });
              }
            }
          }
        }
      });
    }

    setNodes(Object.values(nodeMap));
    setEdges(edgeList);
  }, [rows, columns, vault]);

  // Force simulation
  useEffect(() => {
    if (!nodes.length) return;
    let iteration = 0;
    const maxIter = 200;
    let settled = false;
    const nodeCopy = nodes.map(n => ({ ...n }));

    const tick = () => {
      if (settled || iteration >= maxIter) return;

      // Repulsion between all pairs
      for (let i = 0; i < nodeCopy.length; i++) {
        for (let j = i + 1; j < nodeCopy.length; j++) {
          const a = nodeCopy[i], b = nodeCopy[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }

      // Spring attraction for edges
      for (const edge of edges) {
        const a = nodeCopy.find(n => n.id === edge.source);
        const b = nodeCopy.find(n => n.id === edge.target);
        if (!a || !b) continue;
        let dx = b.x - a.x, dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = SPRING_K * (dist - SPRING_LEN);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Apply velocities + damping
      let maxV = 0;
      for (const n of nodeCopy) {
        if (dragNode && n.id === dragNode) continue; // Skip dragged node
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        maxV = Math.max(maxV, Math.abs(n.vx), Math.abs(n.vy));
      }

      iteration++;
      if (maxV < MIN_V) settled = true;

      setNodes([...nodeCopy]);

      if (!settled && iteration < maxIter) {
        simRef.current = requestAnimationFrame(tick);
      }
    };

    simRef.current = requestAnimationFrame(tick);
    return () => { if (simRef.current) cancelAnimationFrame(simRef.current); };
  }, [edges.length, nodes.length > 0 ? 'init' : 'empty']);

  // Mouse drag for nodes
  const handleNodeMouseDown = useCallback((e, nodeId) => {
    e.stopPropagation();
    setDragNode(nodeId);
    const handleMove = (me) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = (me.clientX - rect.left - transform.x) / transform.scale;
      const y = (me.clientY - rect.top - transform.y) / transform.scale;
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, x, y, vx: 0, vy: 0 } : n));
    };
    const handleUp = () => {
      setDragNode(null);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [transform]);

  // Zoom with wheel
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.3, Math.min(3, prev.scale * delta)),
    }));
  }, []);

  // Pan with mouse drag on background
  const handleBgMouseDown = useCallback((e) => {
    if (e.target !== svgRef.current) return;
    const startX = e.clientX, startY = e.clientY;
    const startTx = transform.x, startTy = transform.y;
    const handleMove = (me) => {
      setTransform(prev => ({
        ...prev,
        x: startTx + (me.clientX - startX),
        y: startTy + (me.clientY - startY),
      }));
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [transform]);

  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });

  if (!relCols.length) {
    return <div className={s.empty}>No relation columns found. Add a relation column to use the graph view.</div>;
  }

  if (!edges.length) {
    return <div className={s.empty}>No relationships defined. Add relations between rows to see the graph.</div>;
  }

  return (
    <div className={s.graphWrap}>
      <div className={s.controls}>
        <button className={s.controlBtn} onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) }))} title="Zoom in">+</button>
        <button className={s.controlBtn} onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.3, prev.scale * 0.8) }))} title="Zoom out">−</button>
        <button className={s.controlBtn} onClick={resetView} title="Reset view">⌂</button>
      </div>
      <svg
        ref={svgRef}
        className={s.graphSvg}
        onWheel={handleWheel}
        onMouseDown={handleBgMouseDown}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {edges.map((edge, i) => {
            const a = nodes.find(n => n.id === edge.source);
            const b = nodes.find(n => n.id === edge.target);
            if (!a || !b) return null;
            const isHovered = hoveredNode === edge.source || hoveredNode === edge.target;
            return (
              <line
                key={i}
                className={`${s.edge} ${isHovered ? s.edgeHighlight : ''}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              />
            );
          })}
          {/* Nodes */}
          {nodes.map(node => {
            const isHovered = hoveredNode === node.id;
            const isConnected = hoveredNode && edges.some(e =>
              (e.source === hoveredNode && e.target === node.id) ||
              (e.target === hoveredNode && e.source === node.id)
            );
            const dimmed = hoveredNode && !isHovered && !isConnected;
            return (
              <g
                key={node.id}
                className={s.node}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ opacity: dimmed ? 0.25 : 1 }}
              >
                <circle
                  className={`${s.nodeCircle} ${isHovered ? s.nodeCircleHover : ''}`}
                  cx={node.x} cy={node.y} r={isHovered ? 22 : 18}
                />
                <text
                  className={s.nodeLabel}
                  x={node.x} y={node.y + 30}
                  textAnchor="middle"
                >
                  {node.name}
                </text>
                {/* Initials inside circle */}
                <text
                  className={s.nodeInitials}
                  x={node.x} y={node.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {node.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
