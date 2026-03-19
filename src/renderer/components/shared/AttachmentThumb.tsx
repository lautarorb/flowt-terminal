import { useState } from 'react';

interface Props {
  src: string;
  onRemove: () => void;
}

export default function AttachmentThumb({ src, onRemove }: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div
        style={{
          position: 'relative',
          width: 72,
          height: 56,
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--bg-tertiary)',
          overflow: 'hidden',
          flexShrink: 0,
          cursor: 'pointer',
        }}
        onClick={() => setFullscreen(true)}
      >
        <img
          src={src}
          alt="attachment"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.7)',
            color: 'var(--text-primary)',
            fontSize: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          x
        </button>
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div
          onClick={() => setFullscreen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <img
            src={src}
            alt="attachment full"
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 8,
            }}
          />
          <button
            onClick={() => setFullscreen(false)}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              color: 'var(--text-primary)',
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
