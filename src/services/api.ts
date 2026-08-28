import { invoke } from '@tauri-apps/api/core';
import type {
  Stock,
  Quote,
  AlertRule,
  AlertEvent,
  PetSettings,
} from '../types';

export async function waitForAppReady(timeoutMs = 15000) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await invoke('get_stocks');
      return;
    } catch (error) {
      lastError = error;
      const message = String(error);
      if (!/state not managed|not managed|not ready/i.test(message)) {
        throw error;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
  }

  throw lastError ?? new Error('后端服务未就绪');
}

export const api = {
  getStocks: (): Promise<Stock[]> => invoke('get_stocks'),
  addStock: (code: string): Promise<Stock> => invoke('add_stock', { code }),
  removeStock: (code: string): Promise<void> => invoke('remove_stock', { code }),
  searchStock: (keyword: string): Promise<Stock[]> =>
    invoke('search_stock', { keyword }),
  getQuotes: (): Promise<Quote[]> => invoke('get_quotes'),
  getQuote: (code: string): Promise<Quote> => invoke('get_quote', { code }),
  getRules: (): Promise<AlertRule[]> => invoke('get_rules'),
  addRule: (rule: Omit<AlertRule, 'id'>): Promise<AlertRule> =>
    invoke('add_rule', { rule }),
  updateRule: (rule: AlertRule): Promise<void> => invoke('update_rule', { rule }),
  deleteRule: (ruleId: string): Promise<void> => invoke('delete_rule', { ruleId }),
  exportConfig: (): Promise<string> => invoke('export_config'),
  importConfig: (payload: string): Promise<void> => invoke('import_config', { payload }),
  getSettings: (): Promise<PetSettings> => invoke('get_settings'),
  updateSettings: (settings: PetSettings): Promise<void> =>
    invoke('update_settings', { settings }),
  getCurrentStockCode: (): Promise<string | null> =>
    invoke('get_current_stock_code'),
  setCurrentStockCode: (code: string | null): Promise<void> =>
    invoke('set_current_stock_code', { code }),
  evaluateAlertsForQuotes: (quotes: Quote[]): Promise<AlertEvent[]> =>
    invoke('evaluate_alerts_for_quotes', { quotes }),
  getAlertHistory: (): Promise<AlertEvent[]> => invoke('get_alert_history'),
};
