import { PreviewStatus } from '../../../shared/types';

interface Props {
  url: string;
  status: PreviewStatus;
}

export default function PreviewFrame({ url, status }: Props) {
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {!url && (
        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-ui)', textAlign: 'center', padding: 20 }}>
          <p style={{ marginBottom: 8 }}>Preview</p>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>Start a dev server or enter a URL above</p>
        </div>
      )}
      {status === 'loading' && url && (
        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Loading...</div>
      )}
      {status === 'error' && url && (
        <div style={{ color: 'var(--accent-red)', fontSize: 'var(--font-size-sm)' }}>Failed to load {url}</div>
      )}
    </div>
  );
}
