import { useState, useRef, useEffect } from 'react';
import { DEVICE_PRESETS, DEVICE_CATEGORIES } from './device-presets';

interface Props {
  active: string | null;
  onSelect: (name: string | null) => void;
  onOpenChange: (open: boolean) => void;
}

export default function DeviceSelector({ active, onSelect, onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onOpenChange(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (name: string | null) => {
    setOpen(false);
    onSelect(name);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '3px 8px',
          borderRadius: 4,
          fontSize: 'var(--font-size-sm)',
          color: active ? 'var(--accent-cyan)' : 'var(--text-muted)',
          background: active ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
          border: '1px solid var(--border)',
          whiteSpace: 'nowrap',
        }}
      >
        {active || 'Responsive'}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 4,
            zIndex: 9999,
            minWidth: 200,
            maxHeight: 400,
            overflowY: 'auto',
          }}
        >
          <button
            onClick={() => handleSelect(null)}
            style={{
              display: 'block',
              width: '100%',
              padding: '6px 10px',
              textAlign: 'left',
              borderRadius: 4,
              color: !active ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontSize: 'var(--font-size-sm)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Responsive
          </button>

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          {DEVICE_CATEGORIES.map((category) => {
            const devices = DEVICE_PRESETS.filter((d) => d.category === category);
            const isExpanded = expandedCategory === category;
            const hasActive = devices.some((d) => d.name === active);

            return (
              <div key={category}>
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '6px 10px',
                    textAlign: 'left',
                    borderRadius: 4,
                    color: hasActive ? 'var(--accent-cyan)' : 'var(--text-primary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    marginTop: 2,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>{category}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </button>

                {isExpanded && devices.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handleSelect(preset.name)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '4px 10px 4px 20px',
                      textAlign: 'left',
                      borderRadius: 4,
                      color: active === preset.name ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {preset.name}
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                      {preset.width}×{preset.height}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
