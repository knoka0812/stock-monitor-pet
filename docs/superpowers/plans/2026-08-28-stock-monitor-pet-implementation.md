# 股票监测桌面宠物实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可在 Windows、macOS 和 Linux 运行的 Tauri 桌面宠物，支持 A 股与港股监控、10 秒行情刷新、条件提醒、右键切换股票、托盘和自定义猫咪素材。

**Architecture:** Rust 进程是唯一业务状态源，负责腾讯行情请求、GBK 解码、规则判断、本地配置、轮询、托盘和窗口；React 根据当前 Tauri 窗口标签渲染宠物窗口或设置窗口，并通过 command/event 与 Rust 通信。供应器、规则引擎和本地配置均通过清晰接口隔离，保证无网络或接口格式变化时不会产生错误提醒。

**Tech Stack:** Tauri 2、Rust、Tokio、Reqwest、encoding_rs、React、TypeScript、Vite、Vitest、Testing Library、pnpm、CSS Modules、Lucide React。

---

## 执行前提

- 当前机器已有 Node.js、pnpm 和 Apple Command Line Tools。
- 当前机器缺少 Rust；执行前安装 rustup，并确认 `rustc`、`cargo` 可用。
- 当前目录不是 Git 仓库。用户未要求创建提交，因此本计划不执行 `git init`、创建分支或提交。
- 所有手工文件修改使用 `apply_patch`；依赖安装和格式化命令允许生成锁文件。

## 文件结构

```text
.
├── package.json                         # 前端脚本与依赖
├── pnpm-lock.yaml                       # 锁定前端依赖
├── vite.config.ts                       # Vite 开发服务，固定 1420 端口
├── vitest.config.ts                     # jsdom 测试环境
├── index.html                           # React 入口
├── public/
│   └── pets/finance-cat/                # 内置猫咪四种状态素材
├── src/
│   ├── main.tsx                         # React 启动入口
│   ├── app/App.tsx                      # 根据窗口标签选择 PetView/SettingsView
│   ├── app/app.css                      # 全局颜色、排版与窗口基础样式
│   ├── shared/domain.ts                 # 与 Rust 序列化一致的 TS 类型
│   ├── shared/tauri.ts                  # invoke/listen 的类型安全封装
│   ├── features/pet/PetView.tsx         # 猫咪、气泡和交互
│   ├── features/pet/PetView.test.tsx
│   ├── features/pet/pet.css
│   ├── features/settings/SettingsView.tsx
│   ├── features/settings/SettingsView.test.tsx
│   ├── features/settings/settings.css
│   ├── features/stocks/StockEditor.tsx  # 添加、确认、编辑股票
│   ├── features/stocks/StockList.tsx
│   ├── features/rules/RuleEditor.tsx     # 提醒规则编辑
│   └── features/appearance/AppearanceEditor.tsx
└── src-tauri/
    ├── Cargo.toml                        # Rust/Tauri 依赖
    ├── build.rs                          # tauri-build
    ├── tauri.conf.json                   # 宠物窗口、构建与打包配置
    ├── capabilities/default.json         # 最小权限
    ├── icons/                            # Tauri 应用图标
    ├── fixtures/tencent_quotes_gbk.bin   # 固定供应器响应
    └── src/
        ├── main.rs                       # 桌面二进制入口
        ├── lib.rs                        # Tauri builder 与插件注册
        ├── domain/mod.rs
        ├── domain/models.rs              # Stock、Quote、Rule、AppConfig
        ├── domain/symbol.rs              # 股票代码识别和标准化
        ├── domain/rules.rs               # 纯函数提醒引擎
        ├── providers/mod.rs              # QuoteProvider trait
        ├── providers/tencent.rs          # 请求、GBK 解码、解析
        ├── services/mod.rs
        ├── services/poller.rs            # 10 秒轮询与退避
        ├── services/runtime.rs            # AppState 与事件发送
        ├── storage.rs                     # 版本化 JSON 配置
        ├── commands.rs                    # 前端可调用命令
        ├── tray.rs                        # 托盘和股票菜单
        └── windows.rs                     # 宠物/设置窗口行为
```

### Task 1: 安装工具链并建立可测试工程骨架

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`

- [ ] **Step 1: 安装并验证 Rust 工具链**

Run:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o /private/tmp/rustup-init.sh
sh /private/tmp/rustup-init.sh -y --profile minimal
source /Users/knoka/.cargo/env
rustc --version
cargo --version
```

Expected: `rustc` 和 `cargo` 均输出版本号并以 0 退出。

- [ ] **Step 2: 创建最小 package.json 并安装依赖**

`package.json` 必须包含：

```json
{
  "name": "stock-monitor-pet",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "tauri": "tauri"
  }
}
```

Run:

```bash
pnpm add react react-dom @tauri-apps/api @tauri-apps/plugin-autostart @tauri-apps/plugin-dialog @tauri-apps/plugin-notification @tauri-apps/plugin-store lucide-react
pnpm add -D typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @types/react @types/react-dom @tauri-apps/cli
```

Expected: `pnpm-lock.yaml` 创建成功，无依赖解析错误。

- [ ] **Step 3: 创建会失败的前端和 Rust 冒烟测试**

Create `src/app/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the settings shell outside Tauri', () => {
    render(<App windowLabel="settings" />);
    expect(screen.getByRole('heading', { name: '股票宠物设置' })).toBeInTheDocument();
  });
});
```

Add to `src-tauri/src/lib.rs`:

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn application_name_is_stable() {
        assert_eq!(super::APP_NAME, "股票监测宠物");
    }
}
```

- [ ] **Step 4: 运行测试并确认按预期失败**

Run:

```bash
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: 前端因 `App` 尚未实现而失败；Rust 因 `APP_NAME` 尚未定义而失败。

- [ ] **Step 5: 写入最小 App、Tauri builder 和配置**

`src/app/App.tsx` 先提供带标题的设置壳；`src-tauri/src/lib.rs` 定义 `pub const APP_NAME: &str = "股票监测宠物"` 和 `run()`；`main.rs` 调用 `stock_monitor_pet_lib::run()`。Tauri 配置创建透明、无边框、固定大小、置顶、跳过任务栏的 `pet` 窗口，并让 Vite 使用 `1420` 端口。

- [ ] **Step 6: 验证骨架通过测试和构建**

Run:

```bash
pnpm test
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: 四条命令均以 0 退出。

### Task 2: 股票代码识别与共享领域模型

**Files:**
- Create: `src-tauri/src/domain/mod.rs`
- Create: `src-tauri/src/domain/models.rs`
- Create: `src-tauri/src/domain/symbol.rs`
- Create: `src/shared/domain.ts`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 写股票代码标准化失败测试**

Tests in `src-tauri/src/domain/symbol.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_a_share_and_hong_kong_symbols() {
        assert_eq!(normalize_symbol("600519").unwrap().provider_symbol, "sh600519");
        assert_eq!(normalize_symbol("000001").unwrap().provider_symbol, "sz000001");
        assert_eq!(normalize_symbol("00700").unwrap().provider_symbol, "hk00700");
        assert_eq!(normalize_symbol("hk700").unwrap().provider_symbol, "hk00700");
    }

    #[test]
    fn rejects_ambiguous_or_invalid_symbols() {
        assert!(matches!(normalize_symbol("700"), Err(SymbolError::Ambiguous)));
        assert!(matches!(normalize_symbol("ABC"), Err(SymbolError::Unsupported)));
    }
}
```

- [ ] **Step 2: 运行单元测试并确认失败**

Run: `cargo test --manifest-path src-tauri/Cargo.toml domain::symbol`

Expected: FAIL，原因是 `normalize_symbol` 和类型尚未定义。

- [ ] **Step 3: 实现领域类型和标准化函数**

Rust 统一使用以下序列化形状：

```rust
#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedSymbol {
    pub code: String,
    pub provider_symbol: String,
    pub market: Market,
    pub currency: Currency,
}

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Market { Shanghai, Shenzhen, HongKong }
```

`src/shared/domain.ts` 使用同名 camelCase 字段，并定义 `Stock`、`Quote`、`AlertRule`、`AppConfig`、`PetAppearance`、`AppSnapshot`。

- [ ] **Step 4: 验证标准化测试与 TypeScript 构建**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml domain::symbol
pnpm build
```

Expected: 两条命令通过。

### Task 3: 腾讯行情供应器与 GBK 解析

**Files:**
- Create: `src-tauri/src/providers/mod.rs`
- Create: `src-tauri/src/providers/tencent.rs`
- Create: `src-tauri/fixtures/tencent_quotes_gbk.bin`
- Modify: `src-tauri/src/domain/models.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 保存真实响应为固定测试样本**

Run:

```bash
curl -sS --connect-timeout 8 --max-time 15 'https://qt.gtimg.cn/q=sh600519,hk00700' -o src-tauri/fixtures/tencent_quotes_gbk.bin
```

Expected: 文件非空，并包含 `v_sh600519=` 与 `v_hk00700=`。

- [ ] **Step 2: 写供应器解析失败测试**

```rust
#[test]
fn parses_a_share_and_hong_kong_fixture() {
    let bytes = include_bytes!("../../fixtures/tencent_quotes_gbk.bin");
    let quotes = parse_response(bytes).unwrap();
    assert_eq!(quotes.len(), 2);
    assert_eq!(quotes[0].symbol, "sh600519");
    assert!(quotes[0].last_price > 0.0);
    assert_eq!(quotes[1].symbol, "hk00700");
    assert_eq!(quotes[1].currency, Currency::Hkd);
}

#[test]
fn rejects_missing_or_malformed_price() {
    assert!(parse_response(b"v_sh600519=\"broken\";").is_err());
}
```

- [ ] **Step 3: 运行测试并确认失败**

Run: `cargo test --manifest-path src-tauri/Cargo.toml providers::tencent`

Expected: FAIL，原因是 `parse_response` 尚未实现。

- [ ] **Step 4: 实现供应器 trait、请求与解析**

```rust
#[async_trait::async_trait]
pub trait QuoteProvider: Send + Sync {
    async fn fetch_quotes(&self, symbols: &[NormalizedSymbol]) -> Result<Vec<Quote>, ProviderError>;
}
```

`TencentQuoteProvider` 使用一个复用的 `reqwest::Client`，请求 `https://qt.gtimg.cn/q=<comma-separated symbols>`；使用 `encoding_rs::GBK.decode_without_bom_handling_and_without_replacement`，按行和 `~` 字段解析。字段数量不足、价格无效、代码与请求不匹配时返回错误。

- [ ] **Step 5: 验证固定样本和全量 Rust 测试**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml providers::tencent
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: 全部通过，测试期间不访问网络。

### Task 4: 提醒规则引擎

**Files:**
- Create: `src-tauri/src/domain/rules.rs`
- Modify: `src-tauri/src/domain/models.rs`
- Modify: `src-tauri/src/domain/mod.rs`

- [ ] **Step 1: 写价格穿越、涨跌幅和冷却失败测试**

```rust
#[test]
fn triggers_cross_up_only_on_the_crossing_tick() {
    let rule = AlertRule::price_above(630.0, 15);
    let mut state = RuleState::default();
    assert!(evaluate(&rule, quote(629.0), &mut state, at(9, 30)).is_none());
    assert!(evaluate(&rule, quote(631.0), &mut state, at(9, 31)).is_some());
    assert!(evaluate(&rule, quote(632.0), &mut state, at(9, 32)).is_none());
}

#[test]
fn suppresses_stale_data_and_respects_cooldown() {
    let rule = AlertRule::rise_percent(2.0, 15);
    let mut state = RuleState::default();
    assert!(evaluate(&rule, stale_quote(3.0), &mut state, at(9, 30)).is_none());
    assert!(evaluate(&rule, percent_quote(3.0), &mut state, at(9, 31)).is_some());
    assert!(evaluate(&rule, percent_quote(3.2), &mut state, at(9, 35)).is_none());
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cargo test --manifest-path src-tauri/Cargo.toml domain::rules`

Expected: FAIL，规则构造器和 `evaluate` 尚未定义。

- [ ] **Step 3: 实现纯函数规则引擎**

`evaluate(rule, quote, state, now)` 返回 `Option<TriggeredAlert>`，更新 `last_price`、`last_triggered_at` 和短时滚动样本。规则变体固定为 `RisePercent`、`FallPercent`、`PriceAbove`、`PriceBelow`、`RapidMove`。所有阈值必须大于零，过期行情直接返回 `None`。

- [ ] **Step 4: 增加快速异动滚动窗口测试并实现**

添加 5 分钟内变化超过 2% 时触发、窗口外样本被丢弃的测试；使用 `VecDeque<PriceSample>` 保持按时间排序的最小样本集合。

- [ ] **Step 5: 验证规则测试和格式**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml domain::rules
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

Expected: 全部通过且无格式差异。

### Task 5: 版本化配置与轮询运行时

**Files:**
- Create: `src-tauri/src/storage.rs`
- Create: `src-tauri/src/services/mod.rs`
- Create: `src-tauri/src/services/poller.rs`
- Create: `src-tauri/src/services/runtime.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 写默认配置和迁移失败测试**

```rust
#[test]
fn creates_a_valid_default_config() {
    let config = AppConfig::default();
    assert_eq!(config.schema_version, 1);
    assert_eq!(config.refresh_interval_seconds, 10);
    assert_eq!(config.alert_cooldown_minutes, 15);
}

#[test]
fn rejects_unknown_future_schema() {
    let value = serde_json::json!({ "schemaVersion": 99 });
    assert!(migrate_config(value).is_err());
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cargo test --manifest-path src-tauri/Cargo.toml storage`

Expected: FAIL，默认配置和迁移尚未实现。

- [ ] **Step 3: 实现配置读写和 AppRuntime**

`AppRuntime` 持有 `RwLock<AppConfig>`、最新行情映射、规则状态映射、供应器和轮询取消句柄。配置写入采用先写临时文件再原子替换，任何反序列化错误回退默认值并保留坏文件供诊断。

- [ ] **Step 4: 写轮询退避测试并实现 PollSchedule**

测试连续成功返回 10 秒，失败后依次返回 10、20、40、60 秒，成功后恢复 10 秒。`PollSchedule` 必须是无 I/O 的纯状态类型，真实异步循环只消费它的结果。

- [ ] **Step 5: 验证存储和轮询测试**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml storage
cargo test --manifest-path src-tauri/Cargo.toml services
```

Expected: 全部通过。

### Task 6: Tauri 命令、窗口、托盘和单实例

**Files:**
- Create: `src-tauri/src/commands.rs`
- Create: `src-tauri/src/windows.rs`
- Create: `src-tauri/src/tray.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: 定义前端命令契约并写序列化测试**

命令固定为：

```rust
#[tauri::command] async fn get_snapshot(...) -> Result<AppSnapshot, CommandError>;
#[tauri::command] async fn resolve_stock(input: String, ...) -> Result<Vec<StockCandidate>, CommandError>;
#[tauri::command] async fn save_stock(input: SaveStockInput, ...) -> Result<AppSnapshot, CommandError>;
#[tauri::command] async fn delete_stock(stock_id: String, ...) -> Result<AppSnapshot, CommandError>;
#[tauri::command] async fn select_stock(stock_id: String, ...) -> Result<AppSnapshot, CommandError>;
#[tauri::command] async fn save_rules(input: SaveRulesInput, ...) -> Result<AppSnapshot, CommandError>;
#[tauri::command] async fn save_preferences(input: PreferencesInput, ...) -> Result<AppSnapshot, CommandError>;
#[tauri::command] async fn import_pet_asset(state: PetState, ...) -> Result<String, CommandError>;
```

测试每个输入和输出都使用 camelCase JSON 字段。

- [ ] **Step 2: 实现命令并注册最小权限**

命令只调用 `AppRuntime`，不重复业务逻辑。`capabilities/default.json` 仅开放当前窗口所需的 event、window、store、dialog、notification 和 autostart 权限。

- [ ] **Step 3: 实现窗口和托盘行为**

`windows.rs` 提供打开设置、隐藏/显示宠物、置顶切换、恢复可见屏幕位置。`tray.rs` 根据最新快照重建股票菜单，并处理选择股票、打开设置、暂停、隐藏和退出。

- [ ] **Step 4: 注册单实例和后台轮询**

第二次启动时显示宠物并打开设置。`setup` 阶段加载配置、创建托盘、启动轮询；退出前停止轮询并保存配置。

- [ ] **Step 5: 验证 Rust 测试和编译**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: 全部通过，无未使用导入或 dead-code 警告。

### Task 7: 前端桥接、股票列表和提醒设置

**Files:**
- Create: `src/shared/tauri.ts`
- Create: `src/features/settings/SettingsView.tsx`
- Create: `src/features/settings/SettingsView.test.tsx`
- Create: `src/features/settings/settings.css`
- Create: `src/features/stocks/StockEditor.tsx`
- Create: `src/features/stocks/StockList.tsx`
- Create: `src/features/rules/RuleEditor.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/shared/domain.ts`

- [ ] **Step 1: 写设置页失败测试**

```tsx
it('resolves and confirms a Hong Kong stock before saving', async () => {
  const api = fakeApi();
  render(<SettingsView api={api} />);
  await userEvent.click(screen.getByRole('button', { name: '添加股票' }));
  await userEvent.type(screen.getByLabelText('股票代码'), '00700');
  await userEvent.click(screen.getByRole('button', { name: '查询' }));
  expect(await screen.findByText('腾讯控股')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '确认添加' }));
  expect(api.saveStock).toHaveBeenCalledWith(expect.objectContaining({ code: '00700' }));
});
```

另写测试确保切换股票、删除确认、阈值小于等于零时显示校验错误。

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test -- SettingsView`

Expected: FAIL，设置组件尚未实现。

- [ ] **Step 3: 实现类型安全 Tauri API 和设置界面**

`src/shared/tauri.ts` 仅导出 `StockPetApi` 接口和默认 Tauri 实现，组件接收可替换 API 以便测试。设置页使用左侧导航，股票列表采用紧凑表格样式，不使用嵌套卡片。

- [ ] **Step 4: 实现提醒规则编辑与即时校验**

使用复选框启用规则、数字输入设置阈值和冷却时间。保存按钮在存在非法值时禁用并显示字段级错误。

- [ ] **Step 5: 验证前端测试和构建**

Run:

```bash
pnpm test -- SettingsView
pnpm build
```

Expected: 全部通过。

### Task 8: 宠物、气泡、右键股票切换和内置猫咪素材

**Files:**
- Create: `public/pets/finance-cat/idle.png`
- Create: `public/pets/finance-cat/rising.png`
- Create: `public/pets/finance-cat/falling.png`
- Create: `public/pets/finance-cat/alert.png`
- Create: `src/features/pet/PetView.tsx`
- Create: `src/features/pet/PetView.test.tsx`
- Create: `src/features/pet/pet.css`
- Modify: `src/app/App.tsx`
- Modify: `src/app/app.css`

- [ ] **Step 1: 生成并检查四种透明猫咪状态**

四张素材使用同一只财经小猫、相同构图、透明背景和 `1024x1024` 尺寸。状态分别为休息、上涨开心、下跌担心和提醒关注；缩放到 160px 时表情仍清楚，素材不包含文字、股票代码或品牌标志。

- [ ] **Step 2: 写宠物交互失败测试**

```tsx
it('switches the bubble stock from the context menu', async () => {
  const api = fakePetApiWithTwoStocks();
  render(<PetView api={api} />);
  fireEvent.contextMenu(screen.getByRole('img', { name: '财经小猫' }));
  await userEvent.click(screen.getByRole('menuitem', { name: /贵州茅台/ }));
  expect(screen.getByText('600519')).toBeInTheDocument();
  expect(api.selectStock).toHaveBeenCalled();
});
```

另写测试覆盖左键显示/隐藏气泡、行情事件更新、提醒事件切换 `alert` 素材以及过期标签。

- [ ] **Step 3: 运行测试并确认失败**

Run: `pnpm test -- PetView`

Expected: FAIL，`PetView` 尚未实现。

- [ ] **Step 4: 实现透明宠物界面**

宠物区域尺寸稳定，图片使用 `object-fit: contain`，气泡限制宽度并根据窗口边缘切换方向。上涨使用红色、下跌使用绿色，同时保留 `+/-` 文本符号。右键菜单展示全部启用股票和应用操作，菜单项使用原生按钮与可访问角色。

- [ ] **Step 5: 验证交互、构建和透明像素**

Run:

```bash
pnpm test -- PetView
pnpm build
```

Expected: 测试通过；四张 PNG 的四角 alpha 均为 0，构建成功。

### Task 9: 自定义素材、外观和常规设置

**Files:**
- Create: `src/features/appearance/AppearanceEditor.tsx`
- Create: `src/features/appearance/AppearanceEditor.test.tsx`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/storage.rs`
- Modify: `src/features/settings/SettingsView.tsx`

- [ ] **Step 1: 写导入校验和设置失败测试**

Rust 测试覆盖允许 PNG/GIF/APNG、拒绝其他扩展名、拒绝空文件、拒绝超过 10 MiB 文件，并保证失败后保留旧素材路径。React 测试覆盖状态选择、预览、大小、透明度、置顶和开机启动设置。

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml import_pet_asset
pnpm test -- AppearanceEditor
```

Expected: 两组测试按缺少实现失败。

- [ ] **Step 3: 实现安全导入和原子配置更新**

Rust 使用对话框返回的真实路径读取文件头校验格式，将文件复制到应用数据目录的 `pets/custom/<state>.<ext>`；写入成功后才更新配置。前端只显示 Rust 返回的资产 URL，不直接持有任意本地路径。

- [ ] **Step 4: 实现外观和常规设置界面**

提供四状态素材选择、即时预览、大小滑块、透明度滑块、动画开关、置顶开关、开机启动开关、系统通知开关和默认 10 秒刷新间隔显示。

- [ ] **Step 5: 验证导入与前端测试**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml import_pet_asset
pnpm test -- AppearanceEditor
pnpm build
```

Expected: 全部通过。

### Task 10: 联调、恢复能力、文档和发布构建

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `.gitignore`
- Create: `.github/workflows/build.yml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/src/services/poller.rs`
- Modify: `src-tauri/src/windows.rs`
- Modify: `src/features/pet/PetView.tsx`

- [ ] **Step 1: 增加恢复能力集成测试**

本地模拟供应器按顺序返回成功、超时、格式错误、恢复成功。断言失败期间保持旧行情并标记过期、不触发规则，恢复后清除过期状态并恢复 10 秒调度。

- [ ] **Step 2: 运行集成测试并确认失败**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test provider_recovery`

Expected: FAIL，恢复联调尚未完成。

- [ ] **Step 3: 完成生命周期和恢复逻辑**

处理系统唤醒后的立即刷新、窗口位置越界修正、休市状态、隐藏到托盘后继续轮询、退出前保存和取消任务。确保第二实例只恢复现有窗口。

- [ ] **Step 4: 添加构建工作流和使用文档**

GitHub Actions 建立 Windows、macOS、Ubuntu 三平台矩阵，分别运行前端测试、Rust 测试和 `pnpm tauri build`，上传 NSIS、DMG/App 和 AppImage/deb 产物。README 说明功能、数据源限制、开发依赖、运行、打包、未签名程序提示和自定义素材要求；许可证使用 MIT 正文。

- [ ] **Step 5: 执行完整验证**

Run:

```bash
pnpm test
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri build
```

Expected: 所有命令以 0 退出，并在 `src-tauri/target/release/bundle/` 产生当前 macOS 平台安装产物。

- [ ] **Step 6: 手工平台冒烟检查**

在当前 macOS 检查透明窗口、拖动、左键气泡、右键全部股票、设置窗口、托盘隐藏恢复、自定义 PNG/GIF/APNG、休眠恢复和退出。Windows 与 Linux 由 CI 构建后，在对应系统完成同一检查清单；没有实际执行的平台不能声称已验证运行效果。
