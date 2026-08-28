use crate::models::{AlertEvent, AlertRule, PetSettings, Stock};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct AppData {
    pub stocks: Vec<Stock>,
    pub rules: Vec<AlertRule>,
    pub alert_history: Vec<AlertEvent>,
    pub settings: PetSettings,
}

pub struct Storage {
    path: PathBuf,
}

impl Storage {
    pub fn new(app_dir: PathBuf) -> Self {
        let path = app_dir.join("stock-pet-data.json");
        Self { path }
    }

    pub fn load(&self) -> AppData {
        if !self.path.exists() {
            return AppData::default();
        }
        match fs::read_to_string(&self.path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => AppData::default(),
        }
    }

    pub fn save(&self, data: &AppData) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let content = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
        fs::write(&self.path, content).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Market;
    use std::env;

    fn temp_storage() -> (Storage, PathBuf) {
        let dir = env::temp_dir().join(format!("stock_pet_test_{}", rand::random::<u64>()));
        let storage = Storage::new(dir.clone());
        (storage, dir)
    }

    #[test]
    fn test_save_and_load() {
        let (storage, _dir) = temp_storage();
        let mut data = AppData::default();
        data.stocks.push(Stock {
            code: "600519".into(),
            name: "贵州茅台".into(),
            market: Market::AShare,
            tencent_symbol: "sh600519".into(),
        });
        data.settings.refresh_interval_secs = 15;
        data.settings.language = crate::models::Language::En;
        data.settings.theme = crate::models::Theme::Light;

        storage.save(&data).unwrap();
        let loaded = storage.load();
        assert_eq!(loaded.stocks.len(), 1);
        assert_eq!(loaded.stocks[0].code, "600519");
        assert_eq!(loaded.settings.refresh_interval_secs, 15);
        assert_eq!(loaded.settings.language, crate::models::Language::En);
        assert_eq!(loaded.settings.theme, crate::models::Theme::Light);
    }

    #[test]
    fn test_load_missing_file_returns_default() {
        let (storage, _dir) = temp_storage();
        let loaded = storage.load();
        assert!(loaded.stocks.is_empty());
        assert_eq!(loaded.settings.size, 96);
    }
}
