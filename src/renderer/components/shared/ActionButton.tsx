import { CSSProperties, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'green' | 'red';
  style?: CSSProperties;
}

const VARIANT_STYLES: Record<string, CSSProperties> = {
  default: { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' },
  green: { background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-green)' },
  red: { background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red)' },
};

export default function ActionButton({ children, onClick, variant = 'default', style }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px',
        borderRadius: '9999px',
        fontSize: 'var(--font-size-sm)',
        border: '1px solid var(--border)',
        transition: 'opacity 0.15s',
        whiteSpace: 'nowrap',
        ...VARIANT_STYLES[variant],
        ...style,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
    >
      {children}
    </button>
  );
}
