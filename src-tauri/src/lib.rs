mod alert;
mod models;
mod quote;
mod storage;

use alert::AlertEngine;
use models::*;
use parking_lot::Mutex;
use quote::{FallbackProvider, QuoteProvider, detect_market_and_symbol};
use storage::{AppData, Storage};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

pub struct AppState {
    pub storage: Storage,
    pub quote_provider: FallbackProvider,
    pub alert_engine: Mutex<AlertEngine>,
    pub data: Mutex<AppData>,
    pub app: Option<AppHandle>,
}

#[tauri::command]
fn get_stocks(state: State<AppState>) -> Result<Vec<Stock>, String> {
    Ok(state.data.lock().stocks.clone())
}

#[tauri::command]
async fn add_stock(code: String, state: State<'_, AppState>) -> Result<Stock, String> {
    let (market, symbol) = detect_market_and_symbol(&code)
        .ok_or_else(|| format!("无法识别股票代码: {}", code))?;

    // 拉一次行情验证并获取名称
    let provider = state.quote_provider.clone();
    let symbol_for_task = symbol.clone();
    let quote = tokio::task::spawn_blocking(move || provider.fetch_quote(&symbol_for_task))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;

    let stock = Stock {
        code: quote.code.clone(),
        name: quote.name.clone(),
        market,
        tencent_symbol: symbol,
    };

    let mut data = state.data.lock();
    if data.stocks.iter().any(|s| s.code == stock.code) {
        return Err(format!("股票 {} 已在监控列表中", stock.code));
    }
    if data.settings.current_stock_code.is_none() {
        data.settings.current_stock_code = Some(stock.code.clone());
    }
    data.stocks.push(stock.clone());
    state.storage.save(&data).map_err(|e| e.to_string())?;
    if let Some(app) = state.app.as_ref() {
        let _ = app.emit("data-changed", ());
    }
    Ok(stock)
}

#[tauri::command]
fn remove_stock(code: String, state: State<AppState>) -> Result<(), String> {
    let mut data = state.data.lock();
    data.stocks.retain(|s| s.code != code);
    data.rules.retain(|r| r.stock_code != code);
    if data.settings.current_stock_code.as_deref() == Some(&code) {
        data.settings.current_stock_code = data.stocks.first().map(|s| s.code.clone());
    }
    state.storage.save(&data).map_err(|e| e.to_string())?;
    if let Some(app) = state.app.as_ref() {
        let _ = app.emit("data-changed", ());
    }
    Ok(())
}

#[tauri::command]
async fn search_stock(keyword: String, state: State<'_, AppState>) -> Result<Vec<Stock>, String> {
    let provider = state.quote_provider.clone();
    tokio::task::spawn_blocking(move || provider.search(&keyword))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_quotes(state: State<'_, AppState>) -> Result<Vec<Quote>, String> {
    let symbols: Vec<String> = state
        .data
        .lock()
        .stocks
        .iter()
        .map(|s| s.tencent_symbol.clone())
        .collect();
    if symbols.is_empty() {
        return Ok(vec![]);
    }
    let provider = state.quote_provider.clone();
    tokio::task::spawn_blocking(move || provider.fetch_quotes(&symbols))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_quote(code: String, state: State<'_, AppState>) -> Result<Quote, String> {
    let (_, symbol) = detect_market_and_symbol(&code)
        .ok_or_else(|| format!("无法识别股票代码: {}", code))?;
    let provider = state.quote_provider.clone();
    tokio::task::spawn_blocking(move || provider.fetch_quote(&symbol))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_rules(state: State<AppState>) -> Result<Vec<AlertRule>, String> {
    Ok(state.data.lock().rules.clone())
}

#[tauri::command]
fn add_rule(rule: AlertRule, state: State<AppState>) -> Result<AlertRule, String> {
    let mut data = state.data.lock();
    let id = format!("rule_{}", chrono::Utc::now().timestamp_millis());
    let mut new_rule = rule;
    new_rule.id = id;
    data.rules.push(new_rule.clone());
    state.storage.save(&data).map_err(|e| e.to_string())?;
    if let Some(app) = state.app.as_ref() {
        let _ = app.emit("data-changed", ());
    }
    Ok(new_rule)
}

#[tauri::command]
fn update_rule(rule: AlertRule, state: State<AppState>) -> Result<(), String> {
    let mut data = state.data.lock();
    if let Some(existing) = data.rules.iter_mut().find(|r| r.id == rule.id) {
        *existing = rule;
    }
    state.storage.save(&data).map_err(|e| e.to_string())?;
    if let Some(app) = state.app.as_ref() {
        let _ = app.emit("data-changed", ());
    }
    Ok(())
}

#[tauri::command]
fn delete_rule(rule_id: String, state: State<AppState>) -> Result<(), String> {
    let mut data = state.data.lock();
    data.rules.retain(|r| r.id != rule_id);
    state.storage.save(&data).map_err(|e| e.to_string())?;
    if let Some(app) = state.app.as_ref() {
        let _ = app.emit("data-changed", ());
    }
    Ok(())
}

#[tauri::command]
fn export_config(state: State<AppState>) -> Result<String, String> {
    let data = state.data.lock();
    serde_json::to_string_pretty(&*data).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_config(payload: String, state: State<AppState>) -> Result<(), String> {
    let imported: AppData = serde_json::from_str(&payload)
        .map_err(|e| format!("配置文件无效：{e}"))?;

    let mut data = state.data.lock();
    *data = imported;
    state.storage.save(&data).map_err(|e| e.to_string())?;
    if let Some(app) = state.app.as_ref() {
        let _ = app.emit("data-changed", ());
    }
    Ok(())
}

#[tauri::command]
fn get_settings(state: State<AppState>) -> Result<PetSettings, String> {
    Ok(state.data.lock().settings.clone())
}

#[tauri::command]
fn update_settings(settings: PetSettings, state: State<AppState>) -> Result<(), String> {
    let mut data = state.data.lock();
    data.settings = settings;
    state.storage.save(&data).map_err(|e| e.to_string())?;
    if let Some(app) = state.app.as_ref() {
        let _ = app.emit("data-changed", ());
    }
    Ok(())
}

#[tauri::command]
fn get_current_stock_code(state: State<AppState>) -> Result<Option<String>, String> {
    Ok(state.data.lock().settings.current_stock_code.clone())
}

#[tauri::command]
fn set_current_stock_code(code: Option<String>, state: State<AppState>) -> Result<(), String> {
    let mut data = state.data.lock();
    data.settings.current_stock_code = code;
    state.storage.save(&data).map_err(|e| e.to_string())?;
    if let Some(app) = state.app.as_ref() {
        let _ = app.emit("data-changed", ());
    }
    Ok(())
}

#[tauri::command]
async fn evaluate_alerts(code: String, state: State<'_, AppState>) -> Result<Vec<AlertEvent>, String> {
    let (_, symbol) = detect_market_and_symbol(&code)
        .ok_or_else(|| format!("无法识别股票代码: {}", code))?;
    let provider = state.quote_provider.clone();
    let quote = tokio::task::spawn_blocking(move || provider.fetch_quote(&symbol))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;

    let mut data = state.data.lock();
    let mut alert_engine = state.alert_engine.lock();
    let events = alert_engine.evaluate(&mut data.rules, &quote);
    for event in &events {
        data.alert_history.insert(0, event.clone());
    }
    data.alert_history.truncate(200);
    state.storage.save(&data).map_err(|e| e.to_string())?;
    Ok(events)
}

#[tauri::command]
fn get_alert_history(state: State<AppState>) -> Result<Vec<AlertEvent>, String> {
    Ok(state.data.lock().alert_history.clone())
}

#[tauri::command]
async fn open_settings(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("settings") {
        let _ = existing.show();
        let _ = existing.unminimize();
        let _ = existing.set_focus();
        return Ok(());
    }

    use tauri::WebviewWindowBuilder;
    WebviewWindowBuilder::new(
        &app,
        "settings",
        tauri::WebviewUrl::App("settings.html".into()),
    )
    .title("股票监测宠物 - 设置")
    .inner_size(820.0, 620.0)
    .min_inner_size(620.0, 500.0)
    .resizable(true)
    .decorations(true)
    .closable(true)
    .background_color(tauri::utils::config::Color(7, 13, 20, 255))
    .always_on_top(false)
    .skip_taskbar(false)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn setup_state(app: &AppHandle) -> AppState {
    let app_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    let storage = Storage::new(app_dir);
    let data = storage.load();
    AppState {
        storage,
        quote_provider: FallbackProvider::new(),
        alert_engine: Mutex::new(AlertEngine::new()),
        data: Mutex::new(data),
        app: Some(app.clone()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            } else {
                use tauri::WebviewWindowBuilder;
                let _ = WebviewWindowBuilder::new(
                    app,
                    "main",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("股票监测宠物")
                .inner_size(320.0, 280.0)
                .resizable(false)
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .focused(false)
                .shadow(false)
                .background_color(tauri::utils::config::Color(0, 0, 0, 0))
                .build();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let state = setup_state(&app.handle());
            app.manage(state);

            // 设置透明背景
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_background_color(Some(tauri::utils::config::Color(0, 0, 0, 0)));
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "settings" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_stocks,
            add_stock,
            remove_stock,
            search_stock,
            get_quotes,
            get_quote,
            get_rules,
            add_rule,
            update_rule,
            delete_rule,
            export_config,
            import_config,
            get_settings,
            update_settings,
            get_current_stock_code,
            set_current_stock_code,
            evaluate_alerts,
            get_alert_history,
            open_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running stock pet application");
}
