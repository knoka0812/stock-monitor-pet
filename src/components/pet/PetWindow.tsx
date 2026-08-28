import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import CatPet from './CatPet';
import QuoteBubble from './QuoteBubble';
import StockMenu from './StockMenu';
import { api, waitForAppReady } from '../../services/api';
import { applyTheme, createTranslator, localeFor } from '../../i18n';
import type { PetSettings, Quote, Stock, AlertEvent } from '../../types';
import { isTradingOpen } from '../../utils/trading';

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
  const [marketOpen, setMarketOpen] = useState(true);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const windowRef = useRef(getCurrentWindow());
  const lastNotifiedKey = useRef<string | null>(null);
  const language = settings?.language ?? 'zh';
  const theme = settings?.theme ?? 'dark';
  const translate = createTranslator(language);

  useEffect(() => {
    applyTheme(theme);
    document.documentElement.lang = localeFor(language);
  }, [language, theme]);

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
    const interval = setInterval(() => {
      const open = isTradingOpen(stocks.map((stock) => stock.market));
      setMarketOpen(open);
      if (open) void refreshQuotes();
    }, settings.refresh_interval_secs * 1000);
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey && event.shiftKey) || stocks.length === 0) return;
      const delta = event.key === 'ArrowLeft' ? -1 : 1;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key.toLowerCase() === 'p') {
        event.preventDefault();
        const code = settings?.current_stock_code ?? null;
        const index = stocks.findIndex((stock) => stock.code === code);
        const next = stocks[(index < 0 ? 0 : index + delta + stocks.length) % stocks.length];
        void api.setCurrentStockCode(next.code);
        setSettings((s) => (s ? { ...s, current_stock_code: next.code } : s));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stocks, settings?.current_stock_code]);

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
        const open = isTradingOpen(s.map((stock) => stock.market));
        setMarketOpen(open);
        if (open) await refreshQuotes();
        else await refreshQuotes(false);
      } else {
        setMarketOpen(true);
        setLoading(false);
      }
    } catch (e) {
      console.error('loadData error', e);
      setError(String(e));
      setLoading(false);
    }
  }

  async function refreshQuotes(evaluateAlerts = true) {
    try {
      const qs = await api.getQuotes();
      setQuotes(qs);
      setLoading(false);

      if (!evaluateAlerts) return;

      for (const q of qs) {
        try {
          const events = await api.evaluateAlerts(q.code);
          if (events.length > 0) {
            const notifyKey = `${events[0].rule_id}-${events[0].timestamp}`;
            if (lastNotifiedKey.current !== notifyKey) {
              lastNotifiedKey.current = notifyKey;
              playAlertSound();
              void notifyAlert(events[0]);
            }
            setAlerts((prev) => [...events, ...prev].slice(0, 20));
          }
        } catch {}
      }
    } catch (e) {
      console.error('refreshQuotes error', e);
      setLoading(false);
    }
  }

  function playAlertSound() {
    try {
      const AudioContext = window.AudioContext ?? (window as any).webkitAudioContext;
      const context = new AudioContext();
      const playTone = (startAt: number, frequency: number) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, context.currentTime + startAt);
        gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + startAt + 0.3);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(context.currentTime + startAt);
        oscillator.stop(context.currentTime + startAt + 0.32);
      };
      playTone(0, 880);
      playTone(0.18, 660);
      window.setTimeout(() => context.close(), 1200);
    } catch {}
  }

  async function notifyAlert(event: AlertEvent) {
    try {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission === 'granted') {
        new Notification(translate('notificationTitle'), {
          body: `${event.stock_name} ${event.message}`,
          icon: '/pet.png',
        });
      }
    } catch {}
  }

  const currentCode = settings?.current_stock_code ?? null;
  const currentQuote = quotes.find((q) => q.code === currentCode) ?? null;
  const activeAlert =
    alerts.find((alert) => Date.now() / 1000 - alert.timestamp < 30) ?? null;

  const mood = (() => {
    if (!currentQuote) return 'neutral' as const;
    if (!marketOpen) return 'neutral' as const;
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
          {translate('error')}: {error}
        </div>
      );
    }
    return <div className="pet-window">{translate('loading')}</div>;
  }

  const petSize = settings.size;
  const bubbleWidth = 198;
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
              language={language}
              translate={translate}
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
            <QuoteBubble
              quote={currentQuote}
              loading={loading && stocks.length > 0}
              alert={activeAlert}
              marketOpen={marketOpen}
              translate={translate}
            />
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
