import type { Market } from '../types';

const CN_HOLIDAYS_2026 = new Set([
  '2026-01-01',
  '2026-01-02',
  '2026-01-03',
  '2026-02-16',
  '2026-02-17',
  '2026-02-18',
  '2026-02-19',
  '2026-02-20',
  '2026-02-21',
  '2026-02-22',
  '2026-02-23',
  '2026-04-04',
  '2026-04-05',
  '2026-04-06',
  '2026-05-01',
  '2026-05-02',
  '2026-05-03',
  '2026-05-04',
  '2026-05-05',
  '2026-06-19',
  '2026-06-20',
  '2026-06-21',
  '2026-09-25',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
  '2026-10-08',
]);

function formatDateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function minutesOfDay(date: Date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function isMarketOpen(market: Market) {
  const asiaNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const asiaDay = asiaNow.getUTCDay();
  const asiaMinutes = minutesOfDay(asiaNow);
  const asiaHoliday = CN_HOLIDAYS_2026.has(formatDateKey(asiaNow));

  if (market === 'ashare' || market === 'hk') {
    if (asiaDay === 0 || asiaDay === 6 || asiaHoliday) return false;
    return (
      (asiaMinutes >= 9 * 60 + 30 && asiaMinutes <= 11 * 60 + 30) ||
      (asiaMinutes >= 13 * 60 && asiaMinutes <= 15 * 60)
    );
  }

  if (market === 'us') {
    const usNow = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const usDay = usNow.getUTCDay();
    const usMinutes = minutesOfDay(usNow);
    return (
      usDay !== 0 && usDay !== 6 && usMinutes >= 9 * 60 + 30 && usMinutes <= 16 * 60
    );
  }

  return asiaDay !== 0 && asiaDay !== 6;
}

export function isTradingOpen(markets: Market[]) {
  if (markets.length === 0) return true;
  return markets.some((market) => isMarketOpen(market));
}
