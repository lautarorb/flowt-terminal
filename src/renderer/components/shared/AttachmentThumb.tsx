import { useState } from 'react';
import ImageAnnotator from './ImageAnnotator';

interface Props {
  src: string;
  onRemove: () => void;
  onUpdate?: (dataUrl: string) => void;
}

export default function AttachmentThumb({ src, onRemove, onUpdate }: Props) {
  const [annotating, setAnnotating] = useState(false);

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
        onClick={() => setAnnotating(true)}
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

      {annotating && (
        <ImageAnnotator
          src={src}
          onSave={(dataUrl) => {
            onUpdate?.(dataUrl);
            setAnnotating(false);
          }}
          onCancel={() => setAnnotating(false)}
        />
      )}
    </>
  );
}
