import { useState, useEffect, useCallback } from 'react';
import { PreviewStatus, DevicePreset } from '../../shared/types';
import { DEVICE_PRESETS } from '../components/preview/device-presets';

export function usePreview() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [activeDevice, setActiveDevice] = useState<DevicePreset | null>(null);

  useEffect(() => {
    const cleanupStatus = window.vibeAPI.preview.onStatus((s) => {
      setStatus(s as PreviewStatus);
    });
    const cleanupUrl = window.vibeAPI.preview.onUrlChanged((u) => {
      setUrl(u);
    });

    return () => {
      cleanupStatus();
      cleanupUrl();
    };
  }, []);

  const navigate = useCallback(async (targetUrl: string) => {
    if (!targetUrl) return;
    let normalized = targetUrl;
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://') && !normalized.startsWith('file://')) {
      normalized = 'https://' + normalized;
    }
    setUrl(normalized);
    await window.vibeAPI.preview.navigate(normalized);
  }, []);

  const selectDevice = useCallback((deviceName: string | null) => {
    if (!deviceName) {
      setActiveDevice(null);
      window.vibeAPI.preview.setDevice(null);
      return;
    }
    const preset = DEVICE_PRESETS.find((d) => d.name === deviceName) || null;
    setActiveDevice(preset);
    window.vibeAPI.preview.setDevice(preset);
  }, []);

  const updateBounds = useCallback((bounds: { x: number; y: number; width: number; height: number }) => {
    window.vibeAPI.preview.setBounds(bounds);
  }, []);

  return { url, status, activeDevice, navigate, selectDevice, updateBounds, setUrl };
}
