# Stock Monitor Pet · 股票监测桌面宠物

一款跨平台桌面宠物，让一只小猫帮你盯盘。它常驻桌面，按你设置的间隔刷新股票行情，用气泡展示涨跌，并在满足条件时提醒你。

![GitHub release](https://img.shields.io/github/v/release/knoka0812/stock-monitor-pet?sort=semver)
![GitHub Actions](https://github.com/knoka0812/stock-monitor-pet/actions/workflows/build.yml/badge.svg)
![GitHub license](https://img.shields.io/github/license/knoka0812/stock-monitor-pet)

## 功能特性

- 🐱 桌面小猫常驻，随行情自动切换「横盘 / 上涨 / 下跌 / 提醒」四种状态，还会偶尔散步
- 📊 支持 A 股、港股、美股、国际黄金（XAUUSD）搜索与添加，并支持场内基金/ETF（如 `159142`、`510300`）
- 🖱️ 右键宠物打开监控列表，一键切换气泡展示的股票
- 🔔 提醒规则：涨跌幅阈值、价格上穿/下穿、短时快速异动，支持冷却时间
- 🔕 A 股 / 港股 / 美股 / 国际黄金休市、周末与 2026 年中国节假日自动暂停轮询
- 🔔 触发提醒时显示系统通知、播放提示音，并保留「提醒记录」
- 🌐 行情请求自动重试，腾讯失败后自动切换新浪财经备用源
- 🎨 暗色 / 浅色玻璃拟态界面，内置中英文显示，支持猫咪、小狗皮肤与自定义素材
- 💾 一键导出/导入完整配置（股票、规则、宠物设置），方便重装与跨版本迁移
- 💾 所有数据只保存在本机，无账号、无云服务
- 🪟 同一套代码构建 Windows / macOS / Linux 安装包

## 下载安装

到 [Releases 页面](https://github.com/knoka0812/stock-monitor-pet/releases) 下载最新版本：

| 平台 | 安装包 |
| --- | --- |
| Windows x64 | `Stock.Monitor.Pet_x64-setup.exe` |
| macOS (Apple Silicon) | `Stock.Monitor.Pet_aarch64.dmg` |
| macOS (Intel) | `Stock.Monitor.Pet_x64.dmg` |
| Linux | `.AppImage` / `.deb` / `.rpm` |

> 提醒触发时，宠物会切换到「提醒」状态，气泡顶部会显示提醒消息，同时播放提示音并发送系统通知。

> 未做代码签名，Windows SmartScreen 和 macOS Gatekeeper 可能提示“未知开发者”，选择“仍要运行”即可。

## 快速使用

1. 右键宠物打开监控列表，选择「设置」
2. 在「股票管理」输入代码或名称搜索并添加，例如 `600519`、`00700`、`AAPL`、`XAUUSD`
3. 在「提醒规则」新建规则，修改条件后点击「保存修改」
4. 在「宠物外观」调整大小、透明度、刷新间隔、置顶，或切换到自定义素材
5. 回到桌面，右键宠物即可切换气泡展示的股票

## 快捷键

| 快捷键 | 作用 |
| --- | --- |
| `Ctrl+Shift+←` | 切换上一只股票 |
| `Ctrl+Shift+→` | 切换下一只股票 |
| `Ctrl+Shift+P` | 切换下一只股票 |

> 快捷键目前作用于宠物窗口焦点内；系统级全局快捷键将在后续版本通过 Tauri global shortcut 插件提供。

## 本地开发

环境要求：

- Node.js 22+
- Rust stable（含 `cargo`）
- 各平台 Tauri 2 系统依赖（Windows 需 WebView2，Linux 需 webkit2gtk-4.1 等）

```bash
npm install
npm run tauri dev      # 开发运行
npm run tauri build    # 打包当前平台安装包
```

项目使用 pnpm/npm 均可，锁文件已包含完整依赖。

## 行情来源与使用限制

- 主源使用腾讯公开行情接口（`qt.gtimg.cn`），备源使用新浪财经行情接口（`hq.sinajs.cn`），均不需要 API Key，个人小规模使用免费
- 腾讯请求失败时，会自动重试并在 HTTPS / HTTP 间回退；仍失败则自动切换新浪源，双源都失败才提示错误
- 请求由每个用户的电脑直连行情接口，**每个用户使用自己的网络出口 IP，不存在共享额度**
- 该接口不是面向第三方商业或大规模使用的官方 API，不提供 SLA；高频请求可能被限流或封 IP
- 建议将刷新间隔保持在 15 秒以上，不要同时监控过多股票
- 行情可能不是逐笔成交或交易所级别实时数据，仅用于个人看盘，**不构成任何投资建议**

## 项目结构

```text
.
├── src/                  # React 前端
│   ├── i18n/             # 中英文翻译
│   ├── components/pet/   # 宠物窗口、气泡、右键菜单
│   ├── components/settings/  # 设置界面
│   ├── assets/pet/       # 内置猫咪四种状态素材
│   └── services/         # Tauri 命令封装
├── src-tauri/            # Rust 桌面端
│   ├── src/quote/        # 腾讯行情请求与解析
│   ├── src/alert/        # 提醒规则引擎
│   ├── src/models/       # 数据模型
│   └── src/storage/      # 本地持久化
├── settings.html         # 设置窗口独立入口
├── .github/workflows/    # 三平台构建与发布
└── README.md
```

## 技术栈

- [Tauri 2](https://tauri.app/) + Rust：原生窗口、透明置顶、单实例、系统集成
- React 19 + TypeScript + Vite：界面与交互
- 腾讯行情接口 + Reqwest：行情拉取与 GBK 解码

## 发布路线

- [ ] 系统级全局快捷键（Tauri global shortcut plugin）
- [ ] 自动更新（Tauri updater + 发布签名）
- [ ] Windows EV 代码签名与 macOS Developer ID 签名 / 公证

## 常见问题

### Windows 打开设置是黑屏/卡死？

请先退出旧版本进程（任务管理器里结束 `Stock Monitor Pet`），再安装 `v0.4.0+`。设置窗口改为独立页面、异步命令创建，避免 Windows 主线程卡死和 `state not managed` 时序问题。

### 自定义素材支持什么格式？

支持 PNG / GIF / WebP，单张不超过 3MB；建议使用透明背景图片，并分别上传四种状态。

### 重装或升级后怎么保留配置？

在「备份配置」页导出 JSON 文件；重装后打开同样位置导入即可。新版会尽量兼容旧版配置格式。

### 数据存在哪里？

保存在系统应用数据目录（`AppData` / `~/Library/Application Support` / `~/.local/share`）下的 `com.knoka.stockpet`，卸载后如需彻底删除可手动清除该目录。

## 贡献

欢迎提 Issue、PR 和优化建议。提交前请保证：

```bash
npm run build
cd src-tauri && cargo test
```

## License

[MIT](LICENSE)
