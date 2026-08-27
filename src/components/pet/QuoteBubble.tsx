import type { Quote } from '../../types';

interface QuoteBubbleProps {
  quote: Quote | null;
  loading: boolean;
}

export default function QuoteBubble({ quote, loading }: QuoteBubbleProps) {
  if (loading) {
    return (
      <div className="bubble bubble-loading">
        <div className="bubble-text">加载中...</div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="bubble">
        <div className="bubble-text">暂无股票<br />右键添加</div>
      </div>
    );
  }

  const isUp = quote.change > 0;
  const isDown = quote.change < 0;
  const colorClass = isUp ? 'up' : isDown ? 'down' : 'neutral';
  const arrow = isUp ? '▲' : isDown ? '▼' : '—';
  const sign = isUp ? '+' : '';

  const timeStr = new Date(quote.timestamp * 1000).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`bubble ${colorClass}`}>
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
