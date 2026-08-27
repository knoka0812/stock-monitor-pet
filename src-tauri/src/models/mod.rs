use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Market {
    AShare,
    HK,
    US,
}

impl Market {
    pub fn label(&self) -> &'static str {
        match self {
            Market::AShare => "A股",
            Market::HK => "港股",
            Market::US => "美股",
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
    pub id: String,
    pub stock_code: String,
    pub rule_type: AlertRuleType,
    pub enabled: bool,
    pub cooldown_seconds: u64,
    pub last_triggered: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertRuleType {
    ChangePercent { threshold: f64, direction: AlertDirection },
    PriceCross { target: f64, direction: AlertDirection },
    FastMove { percent: f64, window_seconds: u64 },
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
pub struct PetSettings {
    pub size: u32,
    pub opacity: f64,
    pub always_on_top: bool,
    pub refresh_interval_secs: u64,
    pub current_stock_code: Option<String>,
    pub skin: PetSkin,
    pub custom_assets: CustomPetAssets,
}

impl Default for PetSettings {
    fn default() -> Self {
        Self {
            size: 96,
            opacity: 0.95,
            always_on_top: true,
            refresh_interval_secs: 10,
            current_stock_code: None,
            skin: PetSkin::OrangeCat,
            custom_assets: CustomPetAssets::default(),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PetSkin {
    OrangeCat,
    GrayCat,
    CalicoCat,
    Custom,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CustomPetAssets {
    pub up: Option<String>,
    pub down: Option<String>,
    pub neutral: Option<String>,
    pub alert: Option<String>,
}
