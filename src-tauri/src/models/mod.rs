use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Market {
    AShare,
    HK,
    US,
    Gold,
}

impl Market {
    pub fn label(&self) -> &'static str {
        match self {
            Market::AShare => "A股",
            Market::HK => "港股",
            Market::US => "美股",
            Market::Gold => "国际黄金",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stock {
    pub code: String,
    pub name: String,
    pub market: Market,
    pub tencent_symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quote {
    pub code: String,
    pub name: String,
    pub market: Market,
    pub price: f64,
    pub prev_close: f64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub volume: u64,
    pub amount: f64,
    pub change: f64,
    pub change_percent: f64,
    pub timestamp: i64,
}

impl Quote {
    pub fn is_up(&self) -> bool {
        self.change > 0.0
    }

    pub fn is_down(&self) -> bool {
        self.change < 0.0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertRule {
    #[serde(default)]
    pub id: String,
    pub stock_code: String,
    pub rule_type: AlertRuleType,
    pub enabled: bool,
    pub cooldown_seconds: u64,
    pub last_triggered: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AlertRuleType {
    ChangePercent { threshold: f64, direction: AlertDirection },
    PriceCross { target: f64, direction: AlertDirection },
    FastMove { percent: f64, window_seconds: u64 },
}

impl<'de> Deserialize<'de> for AlertRuleType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(tag = "kind", rename_all = "snake_case")]
        enum Current {
            ChangePercent { threshold: f64, direction: AlertDirection },
            PriceCross { target: f64, direction: AlertDirection },
            FastMove { percent: f64, window_seconds: u64 },
        }

        #[derive(Deserialize)]
        #[serde(rename_all = "PascalCase")]
        enum Legacy {
            ChangePercent { threshold: f64, direction: AlertDirection },
            PriceCross { target: f64, direction: AlertDirection },
            FastMove { percent: f64, window_seconds: u64 },
        }

        if let Ok(value) = serde_json::Value::deserialize(deserializer) {
            if let Ok(rule_type) = Current::deserialize(&value) {
                return Ok(match rule_type {
                    Current::ChangePercent { threshold, direction } => {
                        AlertRuleType::ChangePercent { threshold, direction }
                    }
                    Current::PriceCross { target, direction } => {
                        AlertRuleType::PriceCross { target, direction }
                    }
                    Current::FastMove { percent, window_seconds } => {
                        AlertRuleType::FastMove { percent, window_seconds }
                    }
                });
            }

            if let Ok(rule_type) = Legacy::deserialize(&value) {
                return Ok(match rule_type {
                    Legacy::ChangePercent { threshold, direction } => {
                        AlertRuleType::ChangePercent { threshold, direction }
                    }
                    Legacy::PriceCross { target, direction } => {
                        AlertRuleType::PriceCross { target, direction }
                    }
                    Legacy::FastMove { percent, window_seconds } => {
                        AlertRuleType::FastMove { percent, window_seconds }
                    }
                });
            }

            return Err(serde::de::Error::custom("invalid alert rule type"));
        }

        Err(serde::de::Error::custom("invalid alert rule type"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alert_rule_accepts_frontend_payload_without_id() {
        let payload = r#"{
            "stock_code": "600519",
            "rule_type": {
                "kind": "change_percent",
                "threshold": 3,
                "direction": "both"
            },
            "enabled": true,
            "cooldown_seconds": 300,
            "last_triggered": null
        }"#;

        let rule: AlertRule = serde_json::from_str(payload).expect("frontend payload must deserialize");
        assert_eq!(rule.id, "");
        assert!(matches!(
            rule.rule_type,
            AlertRuleType::ChangePercent {
                threshold: 3.0,
                direction: AlertDirection::Both,
            }
        ));
    }

    #[test]
    fn alert_rule_round_trips_frontend_shape() {
        let rule = AlertRule {
            id: "rule_1".into(),
            stock_code: "00700".into(),
            rule_type: AlertRuleType::PriceCross {
                target: 350.0,
                direction: AlertDirection::Up,
            },
            enabled: true,
            cooldown_seconds: 60,
            last_triggered: None,
        };

        let json = serde_json::to_value(&rule).expect("rule must serialize");
        assert_eq!(json["rule_type"]["kind"], "price_cross");
        assert_eq!(json["rule_type"]["target"], 350.0);
        assert_eq!(json["rule_type"]["direction"], "up");
    }

    #[test]
    fn alert_rule_accepts_v1_pascal_case_shape() {
        let payload = r#"{
            "id": "rule_old",
            "stock_code": "600519",
            "rule_type": {
                "ChangePercent": {
                    "threshold": 3,
                    "direction": "both"
                }
            },
            "enabled": true,
            "cooldown_seconds": 300,
            "last_triggered": null
        }"#;

        let rule: AlertRule = serde_json::from_str(payload).expect("v1 rule must deserialize");
        assert!(matches!(
            rule.rule_type,
            AlertRuleType::ChangePercent {
                threshold: 3.0,
                direction: AlertDirection::Both,
            }
        ));
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertDirection {
    Up,
    Down,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertEvent {
    pub rule_id: String,
    pub stock_code: String,
    pub stock_name: String,
    pub message: String,
    pub price: f64,
    pub change_percent: f64,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct PetSettings {
    pub size: u32,
    pub opacity: f64,
    pub always_on_top: bool,
    pub refresh_interval_secs: u64,
    pub current_stock_code: Option<String>,
    pub skin: PetSkin,
    #[serde(default)]
    pub custom_assets: CustomPetAssets,
    pub language: Language,
    pub theme: Theme,
}

impl Default for PetSettings {
    fn default() -> Self {
        Self {
            size: 96,
            opacity: 0.95,
            always_on_top: true,
            refresh_interval_secs: 10,
            current_stock_code: None,
            skin: PetSkin::Default,
            custom_assets: CustomPetAssets::default(),
            language: Language::Zh,
            theme: Theme::Dark,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PetSkin {
    #[serde(alias = "orange_cat", alias = "gray_cat", alias = "calico_cat")]
    Default,
    Dog,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Zh,
    En,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Dark,
    Light,
}

#[cfg(test)]
mod pet_skin_tests {
    use super::*;

    #[test]
    fn pet_skin_migrates_v1_variants() {
        for value in ["orange_cat", "gray_cat", "calico_cat"] {
            let skin: PetSkin = serde_json::from_value(serde_json::json!(value)).unwrap();
            assert_eq!(skin, PetSkin::Default);
        }
    }

    #[test]
    fn pet_skin_accepts_dog() {
        let skin: PetSkin = serde_json::from_value(serde_json::json!("dog")).unwrap();
        assert_eq!(skin, PetSkin::Dog);
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CustomPetAssets {
    pub up: Option<String>,
    pub down: Option<String>,
    pub neutral: Option<String>,
    pub alert: Option<String>,
}
