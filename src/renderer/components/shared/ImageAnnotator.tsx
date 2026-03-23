import { useRef, useEffect, useState, useCallback } from 'react';

const COLORS = ['#EF4444', '#10B981', '#F59E0B', '#06B6D4', '#FFFFFF'];
type Tool = 'move' | 'pen' | 'rect' | 'circle' | 'line' | 'arrow' | 'text';
type Handle = 'tl' | 'tr' | 'bl' | 'br' | null;

interface Point { x: number; y: number }

interface Shape {
  tool: Tool;
  color: string;
  lineWidth: number;
  points?: Point[];
  start?: Point;
  end?: Point;
  text?: string;
}

interface Props {
  src: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

const TOOLS: { key: Tool; label: string }[] = [
  { key: 'move', label: '⇥' },
  { key: 'pen', label: '✎' },
  { key: 'line', label: '╱' },
  { key: 'arrow', label: '→' },
  { key: 'rect', label: '▭' },
  { key: 'circle', label: '○' },
  { key: 'text', label: 'T' },
];

const HANDLE_SIZE = 10;

function drawArrowHead(ctx: CanvasRenderingContext2D, from: Point, to: Point, size: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.lineWidth = shape.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (shape.tool === 'pen' && shape.points && shape.points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i++) ctx.lineTo(shape.points[i].x, shape.points[i].y);
    ctx.stroke();
  } else if (shape.tool === 'line' && shape.start && shape.end) {
    ctx.beginPath();
    ctx.moveTo(shape.start.x, shape.start.y);
    ctx.lineTo(shape.end.x, shape.end.y);
    ctx.stroke();
  } else if (shape.tool === 'arrow' && shape.start && shape.end) {
    ctx.beginPath();
    ctx.moveTo(shape.start.x, shape.start.y);
    ctx.lineTo(shape.end.x, shape.end.y);
    ctx.stroke();
    drawArrowHead(ctx, shape.start, shape.end, shape.lineWidth * 5);
  } else if (shape.tool === 'rect' && shape.start && shape.end) {
    ctx.strokeRect(shape.start.x, shape.start.y, shape.end.x - shape.start.x, shape.end.y - shape.start.y);
  } else if (shape.tool === 'circle' && shape.start && shape.end) {
    const rx = (shape.end.x - shape.start.x) / 2;
    const ry = (shape.end.y - shape.start.y) / 2;
    ctx.beginPath();
    ctx.ellipse(shape.start.x + rx, shape.start.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape.tool === 'text' && shape.start && shape.text) {
    ctx.font = `bold ${shape.lineWidth * 8}px 'JetBrains Mono', monospace`;
    ctx.fillText(shape.text, shape.start.x, shape.start.y);
  }
}

function getShapeBounds(shape: Shape): { x: number; y: number; w: number; h: number } | null {
  if (shape.tool === 'pen' && shape.points && shape.points.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of shape.points) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, w: maxX - minX || 1, h: maxY - minY || 1 };
  }
  if ((shape.tool === 'rect' || shape.tool === 'circle' || shape.tool === 'line' || shape.tool === 'arrow') && shape.start && shape.end) {
    const x = Math.min(shape.start.x, shape.end.x);
    const y = Math.min(shape.start.y, shape.end.y);
    return { x, y, w: Math.abs(shape.end.x - shape.start.x) || 1, h: Math.abs(shape.end.y - shape.start.y) || 1 };
  }
  if (shape.tool === 'text' && shape.start) {
    const w = (shape.text?.length || 1) * shape.lineWidth * 5;
    return { x: shape.start.x, y: shape.start.y - shape.lineWidth * 8, w, h: shape.lineWidth * 10 };
  }
  return null;
}

function drawSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
  const bounds = getShapeBounds(shape);
  if (!bounds) return;
  const pad = 8;
  const x = bounds.x - pad, y = bounds.y - pad, w = bounds.w + pad * 2, h = bounds.h + pad * 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  // Corner handles
  ctx.fillStyle = '#06B6D4';
  for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
    ctx.fillRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
  }
  ctx.restore();
}

function hitTestHandle(shape: Shape, pos: Point): Handle {
  const bounds = getShapeBounds(shape);
  if (!bounds) return null;
  const pad = 8;
  const x = bounds.x - pad, y = bounds.y - pad, w = bounds.w + pad * 2, h = bounds.h + pad * 2;
  const t = HANDLE_SIZE + 4;
  if (Math.abs(pos.x - x) < t && Math.abs(pos.y - y) < t) return 'tl';
  if (Math.abs(pos.x - (x + w)) < t && Math.abs(pos.y - y) < t) return 'tr';
  if (Math.abs(pos.x - x) < t && Math.abs(pos.y - (y + h)) < t) return 'bl';
  if (Math.abs(pos.x - (x + w)) < t && Math.abs(pos.y - (y + h)) < t) return 'br';
  return null;
}

function hitTest(shape: Shape, pos: Point, threshold = 15): boolean {
  const bounds = getShapeBounds(shape);
  if (!bounds) return false;
  return pos.x >= bounds.x - threshold && pos.x <= bounds.x + bounds.w + threshold &&
         pos.y >= bounds.y - threshold && pos.y <= bounds.y + bounds.h + threshold;
}

function moveShape(shape: Shape, dx: number, dy: number): Shape {
  const moved = { ...shape };
  if (moved.points) moved.points = moved.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  if (moved.start) moved.start = { x: moved.start.x + dx, y: moved.start.y + dy };
  if (moved.end) moved.end = { x: moved.end.x + dx, y: moved.end.y + dy };
  return moved;
}

function resizeShape(shape: Shape, handle: Handle, pos: Point): Shape {
  const bounds = getShapeBounds(shape);
  if (!bounds || !handle) return shape;

  const pad = 8;
  const oldX = bounds.x - pad, oldY = bounds.y - pad;
  const oldW = bounds.w + pad * 2, oldH = bounds.h + pad * 2;

  let newX = oldX, newY = oldY, newW = oldW, newH = oldH;
  if (handle === 'tl') { newX = pos.x; newY = pos.y; newW = oldX + oldW - pos.x; newH = oldY + oldH - pos.y; }
  if (handle === 'tr') { newY = pos.y; newW = pos.x - oldX; newH = oldY + oldH - pos.y; }
  if (handle === 'bl') { newX = pos.x; newW = oldX + oldW - pos.x; newH = pos.y - oldY; }
  if (handle === 'br') { newW = pos.x - oldX; newH = pos.y - oldY; }

  if (newW < 20 || newH < 20) return shape;

  const scaleX = newW / oldW;
  const scaleY = newH / oldH;
  const originX = newX + pad;
  const originY = newY + pad;

  const resized = { ...shape };

  const transformPoint = (p: Point): Point => ({
    x: originX + (p.x - bounds.x) * scaleX,
    y: originY + (p.y - bounds.y) * scaleY,
  });

  if (resized.points) resized.points = resized.points.map(transformPoint);
  if (resized.start) resized.start = transformPoint(resized.start);
  if (resized.end) resized.end = transformPoint(resized.end);

  return resized;
}

export default function ImageAnnotator({ src, onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [tool, setTool] = useState<Tool>('pen');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const currentShape = useRef<Shape | null>(null);
  const drawing = useRef(false);
  const moving = useRef<{ idx: number; startPos: Point } | null>(null);
  const resizing = useRef<{ idx: number; handle: Handle } | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; screenX: number; screenY: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.vibeAPI.preview.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    window.vibeAPI.claude.hide();
    return () => { window.vibeAPI.preview.setBounds({ x: 1, y: 1, width: 1, height: 1 }); };
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const onLoad = () => { canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; };
    if (img.complete && img.naturalWidth > 0) onLoad();
    else img.addEventListener('load', onLoad);
    return () => img.removeEventListener('load', onLoad);
  }, []);

  const lw = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas ? Math.max(3, canvas.width / 200) : 3;
  }, []);

  const getPos = useCallback((e: React.MouseEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  }, []);

  const redraw = useCallback((extra?: Shape) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    shapes.forEach((s, i) => {
      drawShape(ctx, s);
      if (i === selectedIdx) drawSelection(ctx, s);
    });
    if (extra) drawShape(ctx, extra);
  }, [shapes, selectedIdx]);

  const handleDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getPos(e);

    if (tool === 'move') {
      // Check resize handles first
      if (selectedIdx !== null) {
        const handle = hitTestHandle(shapes[selectedIdx], pos);
        if (handle) {
          resizing.current = { idx: selectedIdx, handle };
          return;
        }
      }
      // Check shape hit
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (hitTest(shapes[i], pos)) {
          setSelectedIdx(i);
          moving.current = { idx: i, startPos: pos };
          return;
        }
      }
      setSelectedIdx(null);
      return;
    }

    if (tool === 'text') {
      setTextInput({ x: pos.x, y: pos.y, screenX: e.clientX, screenY: e.clientY });
      setTextValue('');
      setSelectedIdx(null);
      setTimeout(() => textRef.current?.focus(), 0);
      return;
    }

    setSelectedIdx(null);
    drawing.current = true;
    const w = lw();
    currentShape.current = tool === 'pen'
      ? { tool, color, lineWidth: w, points: [pos] }
      : { tool, color, lineWidth: w, start: pos, end: pos };
  }, [tool, color, getPos, lw, shapes, selectedIdx]);

  const handleMove = useCallback((e: React.MouseEvent) => {
    const pos = getPos(e);

    if (resizing.current) {
      const { idx, handle } = resizing.current;
      setShapes((prev) => prev.map((s, i) => i === idx ? resizeShape(s, handle, pos) : s));
      return;
    }

    if (moving.current) {
      const { idx, startPos } = moving.current;
      const dx = pos.x - startPos.x;
      const dy = pos.y - startPos.y;
      setShapes((prev) => prev.map((s, i) => i === idx ? moveShape(s, dx, dy) : s));
      moving.current.startPos = pos;
      return;
    }

    if (!drawing.current || !currentShape.current) return;
    if (currentShape.current.tool === 'pen') currentShape.current.points!.push(pos);
    else currentShape.current.end = pos;
    redraw(currentShape.current);
  }, [getPos, redraw]);

  const handleUp = useCallback(() => {
    if (resizing.current) { resizing.current = null; return; }
    if (moving.current) { moving.current = null; return; }
    if (!drawing.current || !currentShape.current) return;
    drawing.current = false;
    setShapes((prev) => [...prev, currentShape.current!]);
    currentShape.current = null;
  }, []);

  const handleTextSubmit = useCallback(() => {
    if (!textInput || !textValue.trim()) { setTextInput(null); return; }
    setShapes((prev) => [...prev, { tool: 'text', color, lineWidth: lw(), start: textInput, text: textValue }]);
    setTextInput(null);
    setTextValue('');
  }, [textInput, textValue, color, lw]);

  useEffect(() => { redraw(); }, [shapes, selectedIdx, redraw]);

  const handleUndo = useCallback(() => { setShapes((prev) => prev.slice(0, -1)); setSelectedIdx(null); }, []);
  const handleDelete = useCallback(() => {
    if (selectedIdx === null) return;
    setShapes((prev) => prev.filter((_, i) => i !== selectedIdx));
    setSelectedIdx(null);
  }, [selectedIdx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (textInput) return;
      if (e.key === 'Delete' || e.key === 'Backspace') handleDelete();
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleDelete, handleUndo, textInput]);

  const handleSave = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of shapes) drawShape(ctx, s);
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const outCtx = out.getContext('2d')!;
    outCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
    outCtx.drawImage(canvas, 0, 0);
    onSave(out.toDataURL('image/png'));
  }, [onSave, shapes]);

  const getCursor = () => {
    if (tool === 'move') {
      if (selectedIdx !== null) return 'grab';
      return 'default';
    }
    if (tool === 'text') return 'text';
    return 'crosshair';
  };

  const tb = (t: Tool): React.CSSProperties => ({
    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 6, fontSize: 15, cursor: 'pointer',
    background: tool === t ? 'rgba(255,255,255,0.15)' : 'transparent',
    color: tool === t ? '#fff' : 'rgba(255,255,255,0.5)',
    border: tool === t ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 16px', background: 'rgba(255,255,255,0.08)', borderRadius: 8, marginBottom: 12 }}>
        {TOOLS.map(({ key, label }) => (
          <button key={key} onClick={() => { setTool(key); if (key !== 'move') setSelectedIdx(null); }} style={tb(key)} title={key}>{label}</button>
        ))}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
        {COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
        ))}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
        <button onClick={handleUndo} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Undo</button>
        {selectedIdx !== null && <button onClick={handleDelete} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.2)', color: '#EF4444', fontSize: 11 }}>Delete</button>}
        <button onClick={handleSave} style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--accent-green)', color: '#000', fontSize: 12, fontWeight: 700 }}>Save</button>
        <button onClick={onCancel} style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: 12 }}>Cancel</button>
      </div>

      <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '80vh' }}>
        <img ref={imgRef} src={src} alt="" draggable={false} style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, display: 'block', pointerEvents: 'none', userSelect: 'none' }} />
        <canvas ref={canvasRef} onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: getCursor(), borderRadius: 8 }} />
        {textInput && (
          <input ref={textRef} value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleTextSubmit(); if (e.key === 'Escape') setTextInput(null); }}
            onBlur={handleTextSubmit}
            style={{
              position: 'absolute',
              left: textInput.screenX - (canvasRef.current?.getBoundingClientRect().left || 0),
              top: textInput.screenY - (canvasRef.current?.getBoundingClientRect().top || 0) - 16,
              background: 'rgba(0,0,0,0.7)', border: `1px solid ${color}`, borderRadius: 4,
              padding: '2px 6px', color, fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700, outline: 'none', minWidth: 80, zIndex: 10,
            }} />
        )}
      </div>
    </div>
  );
}
