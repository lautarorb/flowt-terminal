import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';

interface Props {
  left: ReactNode;
  right: ReactNode;
  defaultRightWidth?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
}

export default function SplitLayout({
  left,
  right,
  defaultRightWidth = 400,
  minLeftWidth = 400,
  minRightWidth = 300,
}: Props) {
  const [rightWidth, setRightWidth] = useState(defaultRightWidth);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Sync layout to main process so it can position WebContentsView
  useEffect(() => {
    window.vibeAPI.preview.syncLayout(rightWidth, 80, 0); // 0 = don't override footerHeight (owned by LogDrawer)
  }, [rightWidth]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;

      const startX = e.clientX;
      const startWidth = rightWidth;

      const handleMouseMove = (e: MouseEvent) => {
        if (!dragging.current || !containerRef.current) return;
        const delta = startX - e.clientX;
        const containerWidth = containerRef.current.clientWidth;
        const newRightWidth = Math.max(minRightWidth, Math.min(containerWidth - minLeftWidth, startWidth + delta));
        setRightWidth(newRightWidth);
      };

      const handleMouseUp = () => {
        dragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [rightWidth, minLeftWidth, minRightWidth],
  );

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Left panel */}
      <div style={{ flex: 1, minWidth: minLeftWidth, overflow: 'hidden' }}>
        {left}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: 4,
          cursor: 'col-resize',
          background: 'var(--border)',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-green)')}
        onMouseLeave={(e) => {
          if (!dragging.current) e.currentTarget.style.background = 'var(--border)';
        }}
      />

      {/* Right panel */}
      <div style={{ width: rightWidth, flexShrink: 0, overflow: 'hidden' }}>
        {right}
      </div>
    </div>
  );
}
