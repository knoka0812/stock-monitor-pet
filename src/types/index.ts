export type Market = 'ashare' | 'hk' | 'us';

export interface Stock {
  code: string;
  name: string;
  market: Market;
  tencent_symbol: string;
}

export interface Quote {
  code: string;
  name: string;
  market: Market;
  price: number;
  prev_close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  change: number;
  change_percent: number;
  timestamp: number;
}

export type AlertDirection = 'up' | 'down' | 'both';

export type AlertRuleType =
  | { kind: 'change_percent'; threshold: number; direction: AlertDirection }
  | { kind: 'price_cross'; target: number; direction: AlertDirection }
  | { kind: 'fast_move'; percent: number; window_seconds: number };

export interface AlertRule {
  id: string;
  stock_code: string;
  rule_type: AlertRuleType;
  enabled: boolean;
  cooldown_seconds: number;
  last_triggered: number | null;
}

export interface AlertEvent {
  rule_id: string;
  stock_code: string;
  stock_name: string;
  message: string;
  price: number;
  change_percent: number;
  timestamp: number;
}

export type PetSkin = 'default' | 'dog' | 'custom';

export interface CustomPetAssets {
  up: string | null;
  down: string | null;
  neutral: string | null;
  alert: string | null;
}

export interface PetSettings {
  size: number;
  opacity: number;
  always_on_top: boolean;
  refresh_interval_secs: number;
  current_stock_code: string | null;
  skin: PetSkin;
  custom_assets: CustomPetAssets;
}
