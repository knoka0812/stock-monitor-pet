import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import CatPet from './CatPet';
import QuoteBubble from './QuoteBubble';
import StockMenu from './StockMenu';
import { api, waitForAppReady } from '../../services/api';
import type { PetSettings, Quote, Stock, AlertEvent } from '../../types';

interface PetWindowProps {
  onOpenSettings: () => void;
}

export default function PetWindow({ onOpenSettings }: PetWindowProps) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [settings, setSettings] = useState<PetSettings | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [walking, setWalking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const windowRef = useRef(getCurrentWindow());

  useEffect(() => {
    loadData();

    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen('data-changed', () => {
          loadData();
        });
      } catch (e) {
        console.error('listen error', e);
      }
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    windowRef.current.setAlwaysOnTop(settings.always_on_top).catch((e) => {
      console.error('setAlwaysOnTop error', e);
    });
  }, [settings?.always_on_top]);

  useEffect(() => {
    if (!settings) return;
    const interval = setInterval(refreshQuotes, settings.refresh_interval_secs * 1000);
    return () => clearInterval(interval);
  }, [settings?.refresh_interval_secs, stocks.length]);

  useEffect(() => {
    let disposed = false;
    let walkTimer: number | undefined;
    let restTimer: number | undefined;

    function scheduleWalk() {
      if (disposed) return;
      restTimer = window.setTimeout(() => {
        if (disposed) return;
        setWalking(true);
        walkTimer = window.setTimeout(() => {
          if (disposed) return;
          setWalking(false);
          scheduleWalk();
        }, 3200 + Math.random() * 3200);
      }, 12000 + Math.random() * 18000);
    }

    scheduleWalk();

    return () => {
      disposed = true;
      if (walkTimer) window.clearTimeout(walkTimer);
      if (restTimer) window.clearTimeout(restTimer);
    };
  }, []);

  async function loadData() {
    try {
      await waitForAppReady();
      const [s, settingsData] = await Promise.all([
        api.getStocks(),
        api.getSettings(),
      ]);
      setStocks(s);
      setSettings(settingsData);
      if (s.length > 0) {
        await refreshQuotes();
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error('loadData error', e);
      setError(String(e));
      setLoading(false);
    }
  }

  async function refreshQuotes() {
    try {
      const qs = await api.getQuotes();
      setQuotes(qs);
      setLoading(false);

      for (const q of qs) {
        try {
          const events = await api.evaluateAlerts(q.code);
          if (events.length > 0) {
            setAlerts((prev) => [...events, ...prev].slice(0, 20));
          }
        } catch {}
      }
    } catch (e) {
      console.error('refreshQuotes error', e);
    }
  }

  const currentCode = settings?.current_stock_code ?? null;
  const currentQuote = quotes.find((q) => q.code === currentCode) ?? null;
  const activeAlert =
    alerts.find((alert) => Date.now() / 1000 - alert.timestamp < 30) ?? null;

  const mood = (() => {
    if (!currentQuote) return 'neutral' as const;
    if (alerts.length > 0 && Date.now() / 1000 - alerts[0].timestamp < 30) return 'alert' as const;
    if (currentQuote.change > 0) return 'up' as const;
    if (currentQuote.change < 0) return 'down' as const;
    return 'neutral' as const;
  })();

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0 || menuOpen) return;
    windowRef.current.startDragging();
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setMenuOpen((v) => !v);
  }

  function handleSelectStock(code: string) {
    api.setCurrentStockCode(code);
    setSettings((s) => (s ? { ...s, current_stock_code: code } : s));
    setMenuOpen(false);
  }

  async function handleQuit() {
    try {
      const { exit } = await import('@tauri-apps/plugin-process');
      await exit(0);
    } catch {
      windowRef.current.close();
    }
  }

  if (!settings) {
    if (error) {
      return (
        <div style={{ color: '#e74c3c', fontSize: 12, padding: 8 }}>
          错误: {error}
        </div>
      );
    }
    return <div className="pet-window">加载中...</div>;
  }

  const petSize = settings.size;
  const bubbleWidth = 176;
  const menuWidth = 280;

  return (
    <div
      className="pet-window"
      style={{ opacity: settings.opacity }}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    >
      <div
        className="pet-layout"
        style={{
          width: Math.max(petSize, bubbleWidth, menuWidth),
        }}
      >
        {menuOpen && (
          <div className="menu-container" style={{ width: menuWidth }}>
            <StockMenu
              stocks={stocks}
              quotes={quotes}
              currentCode={currentCode}
              onSelect={handleSelectStock}
              onOpenSettings={() => {
                setMenuOpen(false);
                onOpenSettings();
              }}
              onQuit={handleQuit}
            />
          </div>
        )}

        {!menuOpen && (
          <div className="bubble-container" style={{ width: bubbleWidth }}>
            <QuoteBubble quote={currentQuote} loading={loading && stocks.length > 0} alert={activeAlert} />
          </div>
        )}

        <div className={`pet-container ${walking ? 'walking' : ''}`} style={{ width: petSize, height: petSize }}>
          <CatPet
            size={petSize}
            mood={mood}
            skin={settings.skin}
            customAsset={
              mood === 'up'
                ? settings.custom_assets.up
                : mood === 'down'
                ? settings.custom_assets.down
                : mood === 'alert'
                ? settings.custom_assets.alert
                : settings.custom_assets.neutral
            }
          />
        </div>
      </div>
    </div>
  );
}
