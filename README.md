# Stock Monitor Pet · 股票监测桌面宠物

一款跨平台桌面宠物，让一只小猫帮你盯盘。它常驻桌面，按你设置的间隔刷新股票行情，用气泡展示涨跌，并在满足条件时提醒你。

![GitHub release](https://img.shields.io/github/v/release/knoka0812/stock-monitor-pet?sort=semver)
![GitHub Actions](https://github.com/knoka0812/stock-monitor-pet/actions/workflows/build.yml/badge.svg)
![GitHub license](https://img.shields.io/github/license/knoka0812/stock-monitor-pet)

## 功能特性

- 🐱 桌面小猫常驻，随行情自动切换「横盘 / 上涨 / 下跌 / 提醒」四种状态，还会偶尔散步
- 📊 支持 A 股、港股、美股代码搜索与添加，气泡展示当前股票价格与涨跌幅
- 🖱️ 右键宠物打开监控列表，一键切换气泡展示的股票
- 🔔 提醒规则：涨跌幅阈值、价格上穿/下穿、短时快速异动，支持冷却时间
- 🎨 暗色玻璃拟态界面，内置猫咪皮肤，也支持为四种状态分别上传自定义素材
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

> 未做代码签名，Windows SmartScreen 和 macOS Gatekeeper 可能提示“未知开发者”，选择“仍要运行”即可。

## 快速使用

1. 右键宠物打开监控列表，选择「设置」
2. 在「股票管理」输入代码或名称搜索并添加，例如 `600519`、`00700`、`AAPL`
3. 在「提醒规则」新建规则，修改条件后点击「保存修改」
4. 在「宠物外观」调整大小、透明度、刷新间隔、置顶，或切换到自定义素材
5. 回到桌面，右键宠物即可切换气泡展示的股票

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

- 当前使用腾讯公开行情接口（`qt.gtimg.cn` / `smartbox.gtimg.cn`），不需要 API Key，个人小规模使用免费
- 请求由每个用户的电脑直连行情接口，**每个用户使用自己的网络出口 IP，不存在共享额度**
- 该接口不是面向第三方商业或大规模使用的官方 API，不提供 SLA；高频请求可能被限流或封 IP
- 建议将刷新间隔保持在 15 秒以上，不要同时监控过多股票
- 行情可能不是逐笔成交或交易所级别实时数据，仅用于个人看盘，**不构成任何投资建议**

## 项目结构

```text
.
├── src/                  # React 前端
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

## 常见问题

### Windows 打开设置是黑屏/卡死？

请先退出旧版本进程（任务管理器里结束 `Stock Monitor Pet`），再安装 `v0.2.5+`。设置窗口改为独立页面、异步命令创建，避免 Windows 主线程卡死和 `state not managed` 时序问题。

### 自定义素材支持什么格式？

支持 PNG / GIF / WebP，单张不超过 3MB；建议使用透明背景图片，并分别上传四种状态。

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
