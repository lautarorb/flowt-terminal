import { useRef, useEffect, useState, useCallback } from 'react';

const COLORS = ['#EF4444', '#10B981', '#F59E0B', '#06B6D4', '#FFFFFF'];

interface Props {
  src: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function ImageAnnotator({ src, onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState(COLORS[0]);
  // Size canvas to match the displayed image once it loads
  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const onLoad = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    };
    if (img.complete && img.naturalWidth > 0) onLoad();
    else img.addEventListener('load', onLoad);
    return () => img.removeEventListener('load', onLoad);
  }, []);

  const getPos = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }, []);

  const handleDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, canvasRef.current!.width / 200);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [color, getPos]);

  const handleMove = useCallback((e: React.MouseEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, [getPos]);

  const handleUp = useCallback(() => {
    drawing.current = false;
  }, []);

  const handleSave = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    // Composite: draw image first, then annotations on top
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(canvas, 0, 0);
    onSave(out.toDataURL('image/png'));
  }, [onSave]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: '8px 16px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: c,
              border: color === c ? '2px solid #fff' : '2px solid transparent',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
        ))}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
        <button
          onClick={handleSave}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            background: 'var(--accent-green)',
            color: '#000',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.1)',
            color: 'var(--text-primary)',
            fontSize: 12,
          }}
        >
          Cancel
        </button>
      </div>

      {/* Image + canvas overlay */}
      <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '80vh' }}>
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, display: 'block', pointerEvents: 'none', userSelect: 'none' }}
        />
        <canvas
          ref={canvasRef}
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={handleUp}
          onMouseLeave={handleUp}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            cursor: 'crosshair',
            borderRadius: 8,
          }}
        />
      </div>
    </div>
  );
}
