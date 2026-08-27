use crate::models::{AlertDirection, AlertEvent, AlertRule, AlertRuleType, Quote};
use std::collections::HashMap;

pub struct AlertEngine {
    price_history: HashMap<String, Vec<(i64, f64)>>,
}

impl AlertEngine {
    pub fn new() -> Self {
        Self {
            price_history: HashMap::new(),
        }
    }

    pub fn evaluate(
        &mut self,
        rules: &mut [AlertRule],
        quote: &Quote,
    ) -> Vec<AlertEvent> {
        let mut events = Vec::new();

        // 更新价格历史
        let history = self.price_history.entry(quote.code.clone()).or_default();
        history.push((quote.timestamp, quote.price));
        // 只保留最近 1 小时
        let cutoff = quote.timestamp - 3600;
        history.retain(|(t, _)| *t >= cutoff);

        let now = quote.timestamp;

        for rule in rules.iter_mut() {
            if !rule.enabled {
                continue;
            }
            if rule.stock_code != quote.code {
                continue;
            }

            // 冷却检查
            if let Some(last) = rule.last_triggered {
                if now - last < rule.cooldown_seconds as i64 {
                    continue;
                }
            }

            let triggered = match &rule.rule_type {
                AlertRuleType::ChangePercent {
                    threshold,
                    direction,
                } => Self::check_change_percent(quote, *threshold, *direction),
                AlertRuleType::PriceCross { target, direction } => {
                    Self::check_price_cross(quote, *target, *direction, history.as_slice())
                }
                AlertRuleType::FastMove {
                    percent,
                    window_seconds,
                } => Self::check_fast_move(quote, *percent, *window_seconds, history.as_slice()),
            };

            if let Some(message) = triggered {
                rule.last_triggered = Some(now);
                events.push(AlertEvent {
                    rule_id: rule.id.clone(),
                    stock_code: quote.code.clone(),
                    stock_name: quote.name.clone(),
                    message,
                    price: quote.price,
                    change_percent: quote.change_percent,
                    timestamp: now,
                });
            }
        }

        events
    }

    fn check_change_percent(
        quote: &Quote,
        threshold: f64,
        direction: AlertDirection,
    ) -> Option<String> {
        let abs_pct = quote.change_percent.abs();
        if abs_pct < threshold {
            return None;
        }

        match direction {
            AlertDirection::Up => {
                if quote.change_percent > 0.0 {
                    Some(format!(
                        "{} 涨跌幅达 {:.2}%",
                        quote.name, quote.change_percent
                    ))
                } else {
                    None
                }
            }
            AlertDirection::Down => {
                if quote.change_percent < 0.0 {
                    Some(format!(
                        "{} 跌幅达 {:.2}%",
                        quote.name, quote.change_percent
                    ))
                } else {
                    None
                }
            }
            AlertDirection::Both => Some(format!(
                "{} 涨跌幅达 {:.2}%",
                quote.name, quote.change_percent
            )),
        }
    }

    fn check_price_cross(
        quote: &Quote,
        target: f64,
        direction: AlertDirection,
        history: &[(i64, f64)],
    ) -> Option<String> {
        if history.len() < 2 {
            return None;
        }

        let prev_price = history[history.len() - 2].1;
        let curr_price = quote.price;

        let crosses_up = prev_price < target && curr_price >= target;
        let crosses_down = prev_price > target && curr_price <= target;

        match direction {
            AlertDirection::Up => {
                if crosses_up {
                    Some(format!("{} 上穿目标价 {:.2}", quote.name, target))
                } else {
                    None
                }
            }
            AlertDirection::Down => {
                if crosses_down {
                    Some(format!("{} 下穿目标价 {:.2}", quote.name, target))
                } else {
                    None
                }
            }
            AlertDirection::Both => {
                if crosses_up {
                    Some(format!("{} 上穿目标价 {:.2}", quote.name, target))
                } else if crosses_down {
                    Some(format!("{} 下穿目标价 {:.2}", quote.name, target))
                } else {
                    None
                }
            }
        }
    }

    fn check_fast_move(
        quote: &Quote,
        percent: f64,
        window_seconds: u64,
        history: &[(i64, f64)],
    ) -> Option<String> {
        if history.is_empty() {
            return None;
        }

        let cutoff = quote.timestamp - window_seconds as i64;
        let window_start_price = history
            .iter()
            .find(|(t, _)| *t >= cutoff)
            .map(|(_, p)| *p)
            .unwrap_or(history[0].1);

        if window_start_price <= 0.0 {
            return None;
        }

        let change_pct = (quote.price - window_start_price) / window_start_price * 100.0;
        if change_pct.abs() >= percent {
            Some(format!(
                "{} {}秒内快速波动 {:.2}%",
                quote.name, window_seconds, change_pct
            ))
        } else {
            None
        }
    }
}

impl Default for AlertEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Market;

    fn make_quote(code: &str, price: f64, prev_close: f64, ts: i64) -> Quote {
        let change = price - prev_close;
        let change_percent = if prev_close > 0.0 {
            change / prev_close * 100.0
        } else {
            0.0
        };
        Quote {
            code: code.to_string(),
            name: code.to_string(),
            market: Market::AShare,
            price,
            prev_close,
            open: prev_close,
            high: price.max(prev_close),
            low: price.min(prev_close),
            volume: 0,
            amount: 0.0,
            change,
            change_percent,
            timestamp: ts,
        }
    }

    #[test]
    fn test_change_percent_up_triggers() {
        let mut engine = AlertEngine::new();
        let mut rules = vec![AlertRule {
            id: "r1".into(),
            stock_code: "600519".into(),
            rule_type: AlertRuleType::ChangePercent {
                threshold: 3.0,
                direction: AlertDirection::Up,
            },
            enabled: true,
            cooldown_seconds: 60,
            last_triggered: None,
        }];

        // 涨 5%，应触发
        let q = make_quote("600519", 105.0, 100.0, 1000);
        let events = engine.evaluate(&mut rules, &q);
        assert_eq!(events.len(), 1);
        assert!(events[0].message.contains("涨"));
    }

    #[test]
    fn test_change_percent_down_no_trigger_for_up_rule() {
        let mut engine = AlertEngine::new();
        let mut rules = vec![AlertRule {
            id: "r1".into(),
            stock_code: "600519".into(),
            rule_type: AlertRuleType::ChangePercent {
                threshold: 3.0,
                direction: AlertDirection::Up,
            },
            enabled: true,
            cooldown_seconds: 60,
            last_triggered: None,
        }];

        let q = make_quote("600519", 95.0, 100.0, 1000);
        let events = engine.evaluate(&mut rules, &q);
        assert_eq!(events.len(), 0);
    }

    #[test]
    fn test_cooldown_prevents_repeat() {
        let mut engine = AlertEngine::new();
        let mut rules = vec![AlertRule {
            id: "r1".into(),
            stock_code: "600519".into(),
            rule_type: AlertRuleType::ChangePercent {
                threshold: 3.0,
                direction: AlertDirection::Up,
            },
            enabled: true,
            cooldown_seconds: 60,
            last_triggered: None,
        }];

        let q1 = make_quote("600519", 105.0, 100.0, 1000);
        let events1 = engine.evaluate(&mut rules, &q1);
        assert_eq!(events1.len(), 1);

        // 10秒后，仍在冷却内
        let q2 = make_quote("600519", 106.0, 100.0, 1010);
        let events2 = engine.evaluate(&mut rules, &q2);
        assert_eq!(events2.len(), 0);

        // 70秒后，超出冷却
        let q3 = make_quote("600519", 107.0, 100.0, 1070);
        let events3 = engine.evaluate(&mut rules, &q3);
        assert_eq!(events3.len(), 1);
    }

    #[test]
    fn test_price_cross_up() {
        let mut engine = AlertEngine::new();
        let mut rules = vec![AlertRule {
            id: "r1".into(),
            stock_code: "600519".into(),
            rule_type: AlertRuleType::PriceCross {
                target: 102.0,
                direction: AlertDirection::Up,
            },
            enabled: true,
            cooldown_seconds: 0,
            last_triggered: None,
        }];

        let q1 = make_quote("600519", 100.0, 100.0, 1000);
        engine.evaluate(&mut rules, &q1);

        let q2 = make_quote("600519", 103.0, 100.0, 1010);
        let events = engine.evaluate(&mut rules, &q2);
        assert_eq!(events.len(), 1);
        assert!(events[0].message.contains("上穿"));
    }

    #[test]
    fn test_fast_move_triggers() {
        let mut engine = AlertEngine::new();
        let mut rules = vec![AlertRule {
            id: "r1".into(),
            stock_code: "600519".into(),
            rule_type: AlertRuleType::FastMove {
                percent: 3.0,
                window_seconds: 60,
            },
            enabled: true,
            cooldown_seconds: 0,
            last_triggered: None,
        }];

        let q1 = make_quote("600519", 100.0, 100.0, 1000);
        engine.evaluate(&mut rules, &q1);

        // 30秒内涨了5%
        let q2 = make_quote("600519", 105.0, 100.0, 1030);
        let events = engine.evaluate(&mut rules, &q2);
        assert_eq!(events.len(), 1);
        assert!(events[0].message.contains("快速波动"));
    }

    #[test]
    fn test_disabled_rule_no_trigger() {
        let mut engine = AlertEngine::new();
        let mut rules = vec![AlertRule {
            id: "r1".into(),
            stock_code: "600519".into(),
            rule_type: AlertRuleType::ChangePercent {
                threshold: 1.0,
                direction: AlertDirection::Both,
            },
            enabled: false,
            cooldown_seconds: 0,
            last_triggered: None,
        }];

        let q = make_quote("600519", 105.0, 100.0, 1000);
        let events = engine.evaluate(&mut rules, &q);
        assert_eq!(events.len(), 0);
    }

    #[test]
    fn test_different_stock_no_trigger() {
        let mut engine = AlertEngine::new();
        let mut rules = vec![AlertRule {
            id: "r1".into(),
            stock_code: "000001".into(),
            rule_type: AlertRuleType::ChangePercent {
                threshold: 1.0,
                direction: AlertDirection::Both,
            },
            enabled: true,
            cooldown_seconds: 0,
            last_triggered: None,
        }];

        let q = make_quote("600519", 105.0, 100.0, 1000);
        let events = engine.evaluate(&mut rules, &q);
        assert_eq!(events.len(), 0);
    }
}
