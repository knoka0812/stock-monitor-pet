import type { Quote, Stock } from '../../types';
import { marketLabel } from '../../i18n';
import type { AppLanguage, Translator } from '../../i18n';

interface StockMenuProps {
  stocks: Stock[];
  quotes: Quote[];
  currentCode: string | null;
  onSelect: (code: string) => void;
  onOpenSettings: () => void;
  onQuit: () => void;
  translate: Translator;
  language: AppLanguage;
}

export default function StockMenu({
  stocks,
  quotes,
  currentCode,
  onSelect,
  onOpenSettings,
  onQuit,
  translate,
  language,
}: StockMenuProps) {
  const quoteMap = new Map(quotes.map((q) => [q.code, q]));

  return (
    <div className="stock-menu">
      <div className="stock-menu-header">{translate('monitored')}</div>
      <div className="stock-menu-list">
        {stocks.length === 0 ? (
          <div className="stock-menu-empty">{translate('noMonitored')}</div>
        ) : (
          stocks.map((stock) => {
            const q = quoteMap.get(stock.code);
            const isUp = q ? q.change > 0 : false;
            const isDown = q ? q.change < 0 : false;
            const colorClass = isUp ? 'up' : isDown ? 'down' : '';
            const isCurrent = stock.code === currentCode;
            return (
              <div
                key={stock.code}
                className={`stock-menu-item ${colorClass} ${isCurrent ? 'active' : ''}`}
                onClick={() => onSelect(stock.code)}
              >
                <div className="stock-menu-item-left">
                  <span className="stock-menu-name">{stock.name}</span>
                  <span className="stock-menu-code">{stock.code}</span>
                  <span className="stock-menu-market">{marketLabel(language, stock.market)}</span>
                </div>
                {q && (
                  <div className="stock-menu-item-right">
                    <span className="stock-menu-price">{q.price.toFixed(2)}</span>
                    <span className="stock-menu-pct">
                      {isUp ? '+' : ''}{q.change_percent.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="stock-menu-divider" />
      <div className="stock-menu-action" onClick={onOpenSettings}>
        {translate('settings')}
      </div>
      <div className="stock-menu-action danger" onClick={onQuit}>
        {translate('quit')}
      </div>
    </div>
  );
}
