import type { AlertEvent, Quote } from '../../types';
import type { Translator } from '../../i18n';

interface QuoteBubbleProps {
  quote: Quote | null;
  loading: boolean;
  alert?: AlertEvent | null;
  marketOpen?: boolean;
  translate: Translator;
}

export default function QuoteBubble({ quote, loading, alert, marketOpen = true, translate }: QuoteBubbleProps) {
  if (loading) {
    return (
      <div className="bubble bubble-loading">
        <div className="bubble-text">{translate('loading')}</div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="bubble">
        <div className="bubble-text">{translate('noStock')}<br />{translate('rightClickToAdd')}</div>
      </div>
    );
  }

  const isUp = quote.change > 0;
  const isDown = quote.change < 0;
  const colorClass = isUp ? 'up' : isDown ? 'down' : 'neutral';
  const arrow = isUp ? '▲' : isDown ? '▼' : '—';
  const sign = isUp ? '+' : '';

  const timeStr = new Date(quote.timestamp * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`bubble ${colorClass}`}>
      {!marketOpen && <div className="bubble-closed">{translate('marketClosed')}</div>}
      {alert && (
        <div className="bubble-alert">
          <span className="bubble-alert-icon">!</span>
          <span>{alert.message}</span>
        </div>
      )}
      <div className="bubble-header">
        <span className="bubble-name">{quote.name}</span>
        <span className="bubble-code">{quote.code}</span>
      </div>
      <div className="bubble-price">{quote.price.toFixed(2)}</div>
      <div className="bubble-change">
        <span className="bubble-arrow">{arrow}</span>
        <span>{sign}{quote.change.toFixed(2)}</span>
        <span>{sign}{quote.change_percent.toFixed(2)}%</span>
      </div>
      <div className="bubble-footer">{timeStr}</div>
      <div className="bubble-tail" />
    </div>
  );
}
