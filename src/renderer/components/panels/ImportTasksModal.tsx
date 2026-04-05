import { useState, useRef, useCallback, DragEvent } from 'react';

const SAMPLE_CSV = `title,description,status,category
Set up auth middleware,Configure middleware for all protected routes,todo,Backend
Write password reset tests,Cover happy path + edge cases for token expiry,todo,Testing
Design landing page mockup,Create wireframes for the new landing page,ideas,Design
Connect Resend API,Wire up forgot password form to send reset emails,in_progress,Backend
Add rate limiting,Implement rate limiting on public API endpoints,todo,Backend
Update README,Document new API endpoints and environment variables,ideas,Docs`;

interface Props {
  onImport: (csvContent: string) => void;
  onCancel: () => void;
}

export default function ImportTasksModal({ onImport, onCancel }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please select a .csv file');
      return;
    }
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setCsvContent(text);
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback(() => {
    const file = fileInputRef.current?.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDownloadSample = useCallback(() => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const lineCount = csvContent ? csvContent.split('\n').filter((l) => l.trim()).length - 1 : 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--accent-green)', fontSize: 16 }}>+</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>import tasks from CSV</span>
          </div>
          <button
            onClick={onCancel}
            style={{ color: 'var(--text-muted)', fontSize: 16, background: 'transparent', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            ×
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent-green)' : csvContent ? 'var(--accent-green)' : 'var(--border)'}`,
            borderRadius: 8,
            padding: '32px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            background: dragOver ? 'rgba(16, 185, 129, 0.05)' : csvContent ? 'rgba(16, 185, 129, 0.03)' : 'transparent',
            transition: 'all 0.15s',
          }}
        >
          {csvContent ? (
            <>
              <span style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontSize: 20 }}>&#10003;</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}>
                {fileName}
              </span>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}>
                {lineCount} task{lineCount !== 1 ? 's' : ''} found
              </span>
            </>
          ) : (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: 24 }}>&#8593;</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}>
                drop CSV here or click to browse
              </span>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                .csv files only
              </span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {error && (
          <span style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}>
            {error}
          </span>
        )}

        {/* Sample CSV download */}
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Template
          </div>
          <button
            onClick={handleDownloadSample}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--text-muted)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <span>tasks-template.csv</span>
            <span style={{ color: 'var(--accent-cyan)' }}>&#8595; download</span>
          </button>
          <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10, marginTop: 6 }}>
            columns: title, description, status, category
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { if (csvContent) onImport(csvContent); }}
            disabled={!csvContent}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              background: csvContent ? 'var(--accent-green)' : 'var(--bg-tertiary)',
              color: csvContent ? '#000' : 'var(--text-muted)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              cursor: csvContent ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Import{lineCount > 0 ? ` ${lineCount} tasks` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
