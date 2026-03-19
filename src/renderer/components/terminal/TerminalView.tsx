import { useTerminal } from '../../hooks/useTerminal';

interface Props {
  tabId: string;
  isActive: boolean;
  onData?: (tabId: string, data: string) => void;
}

export default function TerminalView({ tabId, isActive, onData }: Props) {
  const { containerRef } = useTerminal({ tabId, isActive, onData });

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: isActive ? 'block' : 'none',
        padding: '4px 8px',
        overflow: 'hidden',
      }}
    />
  );
}
