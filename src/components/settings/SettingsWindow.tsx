import { useEffect, useRef, useState } from 'react';
import alertAsset from '../../assets/pet/alert.png';
import downAsset from '../../assets/pet/down.png';
import neutralAsset from '../../assets/pet/neutral.png';
import upAsset from '../../assets/pet/up.png';
import { api } from '../../services/api';
import type {
  AlertDirection,
  AlertRule,
  AlertRuleType,
  PetSettings,
  Stock,
} from '../../types';
import './settings.css';

type Tab = 'stocks' | 'alerts' | 'pet';
type AssetState = 'up' | 'down' | 'neutral' | 'alert';
type Feedback = { tone: 'success' | 'error'; message: string } | null;

const ASSET_SIZE_LIMIT = 3 * 1024 * 1024;

function readAssetFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (file.size > ASSET_SIZE_LIMIT) {
      reject(new Error('图片不能超过 3MB'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function SettingsWindow() {
  const [tab, setTab] = useState<Tab>('stocks');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [settings, setSettings] = useState<PetSettings | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyStock, setBusyStock] = useState<string | null>(null);
  const [savingRules, setSavingRules] = useState<string[]>([]);
  const [dirtyRules, setDirtyRules] = useState<string[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [stocksData, rulesData, settingsData] = await Promise.all([
      api.getStocks(),
      api.getRules(),
      api.getSettings(),
    ]);
    setStocks(stocksData);
    setRules(rulesData);
    setSettings(settingsData);
    setDirtyRules([]);
    setSettingsDirty(false);
  }

  function showFeedback(tone: 'success' | 'error', message: string) {
    setFeedback({ tone, message });
  }

  async function runStockAction(code: string, action: () => Promise<unknown>, success: string): Promise<boolean> {
    setBusyStock(code);
    try {
      await action();
      await loadAll();
      showFeedback('success', success);
      return true;
    } catch (error) {
      showFeedback('error', errorMessage(error));
      return false;
    } finally {
      setBusyStock(null);
    }
  }

  async function handleSearch() {
    const keyword = searchKeyword.trim();
    if (!keyword) return;

    setSearching(true);
    try {
      const results = await api.searchStock(keyword);
      setSearchResults(results);
      if (results.length === 0) showFeedback('error', '没有找到匹配的股票');
    } catch (error) {
      showFeedback('error', `搜索失败：${errorMessage(error)}`);
    } finally {
      setSearching(false);
    }
  }

  async function handleAddStock(stock: Stock) {
    const succeeded = await runStockAction(
      stock.code,
      () => api.addStock(stock.tencent_symbol),
      `已添加 ${stock.name}`,
    );
    if (!succeeded) return;
    setSearchKeyword('');
    setSearchResults([]);
  }

  function handleRemoveStock(code: string) {
    void runStockAction(code, () => api.removeStock(code), `已移除 ${code}`);
  }

  function handleSetCurrentStock(code: string) {
    void runStockAction(code, () => api.setCurrentStockCode(code), `气泡已切换到 ${code}`);
  }

  async function handleAddRule() {
    if (stocks.length === 0) {
      showFeedback('error', '请先添加一只监控股票');
      return;
    }

    try {
      await api.addRule({
        stock_code: stocks[0].code,
        rule_type: { kind: 'change_percent', threshold: 3, direction: 'both' },
        enabled: true,
        cooldown_seconds: 300,
        last_triggered: null,
      });
      await loadAll();
      showFeedback('success', '已创建规则，修改条件后请点击保存');
    } catch (error) {
      showFeedback('error', `创建规则失败：${errorMessage(error)}`);
    }
  }

  function handleRuleChange(rule: AlertRule) {
    setRules((current) => current.map((item) => (item.id === rule.id ? rule : item)));
    setDirtyRules((current) => (current.includes(rule.id) ? current : [...current, rule.id]));
  }

  async function handleSaveRule(rule: AlertRule) {
    setSavingRules((current) => [...current, rule.id]);
    try {
      await api.updateRule(rule);
      await loadAll();
      showFeedback('success', '提醒规则已保存');
    } catch (error) {
      showFeedback('error', `保存规则失败：${errorMessage(error)}`);
    } finally {
      setSavingRules((current) => current.filter((id) => id !== rule.id));
    }
  }

  async function handleDeleteRule(id: string) {
    try {
      await api.deleteRule(id);
      await loadAll();
      showFeedback('success', '提醒规则已删除');
    } catch (error) {
      showFeedback('error', `删除规则失败：${errorMessage(error)}`);
    }
  }

  function handleSettingsChange(patch: Partial<PetSettings>) {
    if (!settings) return;
    setSettings({ ...settings, ...patch });
    setSettingsDirty(true);
  }

  function handleAssetFile(state: AssetState, file?: File) {
    if (!file || !settings) return;

    readAssetFile(file)
      .then((dataUrl) => {
        handleSettingsChange({
          custom_assets: { ...settings.custom_assets, [state]: dataUrl },
        });
      })
      .catch((error) => showFeedback('error', errorMessage(error)));
  }

  async function handleSaveSettings() {
    if (!settings) return;

    setSavingSettings(true);
    try {
      await api.updateSettings(settings);
      setSettingsDirty(false);
      showFeedback('success', '宠物设置已保存');
    } catch (error) {
      showFeedback('error', `保存宠物设置失败：${errorMessage(error)}`);
    } finally {
      setSavingSettings(false);
    }
  }

  if (!settings) return <div className="settings-loading">加载中...</div>;

  return (
    <div className="settings-window">
      <aside className="settings-sidebar">
        <div className="settings-brand">
          <strong>Stock Pet</strong>
          <span>MONITOR STUDIO</span>
        </div>
        {(['stocks', 'alerts', 'pet'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`settings-tab ${tab === item ? 'active' : ''}`}
            onClick={() => setTab(item)}
          >
            {item === 'stocks' ? '股票管理' : item === 'alerts' ? '提醒规则' : '宠物外观'}
          </button>
        ))}
      </aside>

      <main className="settings-content">
        {feedback && (
          <button
            type="button"
            className={`feedback ${feedback.tone}`}
            onClick={() => setFeedback(null)}
          >
            {feedback.message}
          </button>
        )}

        {tab === 'stocks' && (
          <StocksTab
            stocks={stocks}
            currentCode={settings.current_stock_code}
            searchKeyword={searchKeyword}
            setSearchKeyword={setSearchKeyword}
            onSearch={handleSearch}
            searching={searching}
            searchResults={searchResults}
            busyStock={busyStock}
            onAdd={handleAddStock}
            onRemove={handleRemoveStock}
            onSelect={handleSetCurrentStock}
          />
        )}

        {tab === 'alerts' && (
          <AlertsTab
            stocks={stocks}
            rules={rules}
            dirtyRules={dirtyRules}
            savingRules={savingRules}
            onAdd={handleAddRule}
            onChange={handleRuleChange}
            onSave={handleSaveRule}
            onDelete={handleDeleteRule}
          />
        )}

        {tab === 'pet' && (
          <PetTab
            settings={settings}
            dirty={settingsDirty}
            saving={savingSettings}
            onChange={handleSettingsChange}
            onAssetFile={handleAssetFile}
            onSave={handleSaveSettings}
          />
        )}
      </main>
    </div>
  );
}

function StocksTab({
  stocks,
  currentCode,
  searchKeyword,
  setSearchKeyword,
  onSearch,
  searching,
  searchResults,
  busyStock,
  onAdd,
  onRemove,
  onSelect,
}: {
  stocks: Stock[];
  currentCode: string | null;
  searchKeyword: string;
  setSearchKeyword: (value: string) => void;
  onSearch: () => void;
  searching: boolean;
  searchResults: Stock[];
  busyStock: string | null;
  onAdd: (stock: Stock) => void;
  onRemove: (code: string) => void;
  onSelect: (code: string) => void;
}) {
  const monitoredCodes = new Set(stocks.map((stock) => stock.code));

  return (
    <div className="tab-content">
      <h2>股票管理</h2>
      <div className="search-bar">
        <input
          type="text"
          placeholder="输入股票代码或名称（如 600519、00700）"
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && onSearch()}
        />
        <button type="button" onClick={onSearch} disabled={searching}>
          {searching ? '搜索中' : '搜索'}
        </button>
      </div>

      {searchResults.length > 0 && (
        <section className="glass-list">
          <div className="section-title">搜索结果</div>
          {searchResults.map((stock) => {
            const added = monitoredCodes.has(stock.code);
            return (
              <div key={stock.tencent_symbol} className="stock-item">
                <StockLabel stock={stock} />
                <button type="button" onClick={() => onAdd(stock)} disabled={added || busyStock === stock.code}>
                  {added ? '已添加' : busyStock === stock.code ? '添加中' : '+ 添加'}
                </button>
              </div>
            );
          })}
        </section>
      )}

      <div className="section-title">已监控股票 ({stocks.length})</div>
      {stocks.length === 0 ? (
        <div className="empty-hint">暂无监控股票，输入代码搜索并添加</div>
      ) : (
        <section className="glass-list">
          {stocks.map((stock) => (
            <div key={stock.code} className="stock-item">
              <StockLabel stock={stock} />
              <div className="stock-actions">
                <button
                  type="button"
                  className="ghost"
                  disabled={busyStock === stock.code || stock.code === currentCode}
                  onClick={() => onSelect(stock.code)}
                >
                  {stock.code === currentCode ? '当前展示' : '设为当前'}
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busyStock === stock.code}
                  onClick={() => onRemove(stock.code)}
                >
                  {busyStock === stock.code ? '移除中' : '移除'}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function StockLabel({ stock }: { stock: Stock }) {
  return (
    <div>
      <span className="stock-name">{stock.name}</span>
      <span className="stock-code">{stock.code}</span>
      <span className="stock-market">
        {stock.market === 'ashare' ? 'A股' : stock.market === 'hk' ? '港股' : '美股'}
      </span>
    </div>
  );
}

function AlertsTab({
  stocks,
  rules,
  dirtyRules,
  savingRules,
  onAdd,
  onChange,
  onSave,
  onDelete,
}: {
  stocks: Stock[];
  rules: AlertRule[];
  dirtyRules: string[];
  savingRules: string[];
  onAdd: () => void;
  onChange: (rule: AlertRule) => void;
  onSave: (rule: AlertRule) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>提醒规则</h2>
        <button type="button" onClick={onAdd}>+ 新建规则</button>
      </div>

      {dirtyRules.length > 0 && (
        <div className="dirty-hint">{dirtyRules.length} 条规则有未保存修改</div>
      )}

      {rules.length === 0 ? (
        <div className="empty-hint">暂无提醒规则，点击“新建规则”添加</div>
      ) : (
        <div className="rule-list">
          {rules.map((rule) => (
            <RuleEditor
              key={rule.id}
              rule={rule}
              stocks={stocks}
              dirty={dirtyRules.includes(rule.id)}
              saving={savingRules.includes(rule.id)}
              onChange={onChange}
              onSave={onSave}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RuleEditor({
  rule,
  stocks,
  dirty,
  saving,
  onChange,
  onSave,
  onDelete,
}: {
  rule: AlertRule;
  stocks: Stock[];
  dirty: boolean;
  saving: boolean;
  onChange: (rule: AlertRule) => void;
  onSave: (rule: AlertRule) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
  }, []);

  const update = (patch: Partial<AlertRule>) => onChange({ ...rule, ...patch });

  const updateRuleType = (patch: Partial<AlertRuleType>) => {
    update({ rule_type: { ...rule.rule_type, ...patch } as AlertRuleType });
  };

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      confirmTimer.current = window.setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    onDelete(rule.id);
  }

  return (
    <article className={`rule-editor ${dirty ? 'dirty' : ''}`}>
      <div className="rule-header">
        <select value={rule.stock_code} onChange={(event) => update({ stock_code: event.target.value })}>
          {stocks.map((stock) => (
            <option key={stock.code} value={stock.code}>
              {stock.name} ({stock.code})
            </option>
          ))}
        </select>
        <label className="switch" title="启用或停用">
          <input type="checkbox" checked={rule.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
          <span className="slider" />
        </label>
        <button type="button" className={`btn-danger btn-sm ${confirmDelete ? 'confirming' : ''}`} onClick={handleDelete}>
          {confirmDelete ? '确认删除' : '删除'}
        </button>
      </div>

      <div className="rule-body">
        <div className="rule-row">
          <label>类型</label>
          <select
            value={rule.rule_type.kind}
            onChange={(event) => {
              const kind = event.target.value as AlertRuleType['kind'];
              if (kind === 'change_percent') {
                update({ rule_type: { kind, threshold: 3, direction: 'both' } });
              } else if (kind === 'price_cross') {
                update({ rule_type: { kind, target: 100, direction: 'up' } });
              } else {
                update({ rule_type: { kind, percent: 2, window_seconds: 60 } });
              }
            }}
          >
            <option value="change_percent">涨跌幅阈值</option>
            <option value="price_cross">价格上穿/下穿</option>
            <option value="fast_move">快速异动</option>
          </select>
        </div>

        {rule.rule_type.kind === 'change_percent' && (
          <>
            <div className="rule-row">
              <label>阈值 (%)</label>
              <input type="number" step="0.1" min="0" value={rule.rule_type.threshold} onChange={(event) => updateRuleType({ threshold: Number(event.target.value) || 0 })} />
            </div>
            <div className="rule-row">
              <label>方向</label>
              <select value={rule.rule_type.direction} onChange={(event) => updateRuleType({ direction: event.target.value as AlertDirection })}>
                <option value="both">涨跌都提醒</option>
                <option value="up">只涨</option>
                <option value="down">只跌</option>
              </select>
            </div>
          </>
        )}

        {rule.rule_type.kind === 'price_cross' && (
          <>
            <div className="rule-row">
              <label>目标价</label>
              <input type="number" step="0.01" min="0" value={rule.rule_type.target} onChange={(event) => updateRuleType({ target: Number(event.target.value) || 0 })} />
            </div>
            <div className="rule-row">
              <label>方向</label>
              <select value={rule.rule_type.direction} onChange={(event) => updateRuleType({ direction: event.target.value as AlertDirection })}>
                <option value="up">上穿</option>
                <option value="down">下穿</option>
                <option value="both">双向</option>
              </select>
            </div>
          </>
        )}

        {rule.rule_type.kind === 'fast_move' && (
          <>
            <div className="rule-row">
              <label>幅度 (%)</label>
              <input type="number" step="0.1" min="0" value={rule.rule_type.percent} onChange={(event) => updateRuleType({ percent: Number(event.target.value) || 0 })} />
            </div>
            <div className="rule-row">
              <label>窗口 (秒)</label>
              <input type="number" step="10" min="10" value={rule.rule_type.window_seconds} onChange={(event) => updateRuleType({ window_seconds: Number(event.target.value) || 60 })} />
            </div>
          </>
        )}

        <div className="rule-row">
          <label>冷却 (秒)</label>
          <input type="number" step="30" min="0" value={rule.cooldown_seconds} onChange={(event) => update({ cooldown_seconds: Number(event.target.value) || 0 })} />
        </div>

        <div className="rule-footer">
          <span>{dirty ? '有未保存修改' : '已保存'}</span>
          <button type="button" disabled={!dirty || saving} onClick={() => onSave(rule)}>
            {saving ? '保存中' : '保存修改'}
          </button>
        </div>
      </div>
    </article>
  );
}

function PetTab({
  settings,
  dirty,
  saving,
  onChange,
  onAssetFile,
  onSave,
}: {
  settings: PetSettings;
  dirty: boolean;
  saving: boolean;
  onChange: (patch: Partial<PetSettings>) => void;
  onAssetFile: (state: AssetState, file?: File) => void;
  onSave: () => void;
}) {
  const isCustom = settings.skin === 'custom';

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>宠物外观</h2>
        <button type="button" disabled={!dirty || saving} onClick={onSave}>
          {saving ? '保存中' : dirty ? '保存设置' : '已保存'}
        </button>
      </div>

      <section className="form-section">
        <div className="section-title">猫咪形象</div>
        <div className="skin-picker two-column">
          <button
            type="button"
            className={`skin-option ${!isCustom ? 'active' : ''}`}
            onClick={() => onChange({ skin: 'default' })}
          >
            <div className="skin-state-grid">
              <img src={neutralAsset} alt="横盘状态" />
              <img src={upAsset} alt="上涨状态" />
              <img src={downAsset} alt="下跌状态" />
              <img src={alertAsset} alt="提醒状态" />
            </div>
            <p>内置猫咪</p>
            <small>自动切换四种行情状态</small>
          </button>

          <button
            type="button"
            className={`skin-option ${isCustom ? 'active' : ''}`}
            onClick={() => onChange({ skin: 'custom' })}
          >
            <div className="skin-state-grid">
              {(['up', 'down', 'neutral', 'alert'] as AssetState[]).map((state) => {
                const asset = settings.custom_assets[state];
                return asset ? <img key={state} src={asset} alt="" /> : <span key={state}>空</span>;
              })}
            </div>
            <p>自定义猫咪</p>
            <small>为四种状态分别上传</small>
          </button>
        </div>
      </section>

      {isCustom && (
        <section className="form-section">
          <div className="section-title">自定义素材</div>
          {(['neutral', 'up', 'down', 'alert'] as AssetState[]).map((state) => (
            <div key={state} className="asset-row">
              <label>{state === 'up' ? '上涨' : state === 'down' ? '下跌' : state === 'neutral' ? '横盘' : '提醒'}</label>
              <div className="asset-preview">
                {settings.custom_assets[state] ? <img src={settings.custom_assets[state] ?? ''} alt="" /> : <span>未设置</span>}
              </div>
              <input
                type="file"
                accept="image/png,image/gif,image/webp,image/jpeg"
                onChange={(event) => onAssetFile(state, event.target.files?.[0])}
              />
              <button
                type="button"
                className="ghost"
                disabled={!settings.custom_assets[state]}
                onClick={() => onChange({ custom_assets: { ...settings.custom_assets, [state]: null } })}
              >
                清除
              </button>
            </div>
          ))}
          <small className="asset-hint">支持 PNG / GIF / WebP，单张最大 3MB。</small>
        </section>
      )}

      <section className="form-section">
        <div className="section-title">尺寸：{settings.size}px</div>
        <input type="range" min="48" max="256" value={settings.size} onChange={(event) => onChange({ size: Number(event.target.value) })} />
      </section>

      <section className="form-section">
        <div className="section-title">透明度：{Math.round(settings.opacity * 100)}%</div>
        <input type="range" min="30" max="100" value={settings.opacity * 100} onChange={(event) => onChange({ opacity: Number(event.target.value) / 100 })} />
      </section>

      <section className="form-section">
        <div className="section-title">刷新间隔：{settings.refresh_interval_secs} 秒</div>
        <input type="range" min="5" max="300" step="5" value={settings.refresh_interval_secs} onChange={(event) => onChange({ refresh_interval_secs: Number(event.target.value) })} />
      </section>

      <section className="form-section">
        <label className="checkbox-label">
          <input type="checkbox" checked={settings.always_on_top} onChange={(event) => onChange({ always_on_top: event.target.checked })} />
          窗口置顶
        </label>
      </section>
    </div>
  );
}
