import { useEffect, useState } from 'react';
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
  PetSkin,
  Stock,
} from '../../types';
import './settings.css';

type Tab = 'stocks' | 'alerts' | 'pet';

export default function SettingsWindow() {
  const [tab, setTab] = useState<Tab>('stocks');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [settings, setSettings] = useState<PetSettings | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [s, r, set] = await Promise.all([
      api.getStocks(),
      api.getRules(),
      api.getSettings(),
    ]);
    setStocks(s);
    setRules(r);
    setSettings(set);
  }

  async function handleSearch() {
    if (!searchKeyword.trim()) return;
    setSearching(true);
    try {
      const results = await api.searchStock(searchKeyword.trim());
      setSearchResults(results);
    } catch (e) {
      alert('搜索失败: ' + e);
    } finally {
      setSearching(false);
    }
  }

  async function handleAddStock(stock: Stock) {
    try {
      await api.addStock(stock.tencent_symbol);
      setSearchKeyword('');
      setSearchResults([]);
      await loadAll();
    } catch (e) {
      alert('添加失败: ' + e);
    }
  }

  async function handleRemoveStock(code: string) {
    if (!confirm(`确认移除 ${code} 吗？`)) return;
    await api.removeStock(code);
    await loadAll();
  }

  async function handleAddRule() {
    if (stocks.length === 0) {
      alert('请先添加股票');
      return;
    }
    const rule: Omit<AlertRule, 'id'> = {
      stock_code: stocks[0].code,
      rule_type: { kind: 'change_percent', threshold: 3, direction: 'both' },
      enabled: true,
      cooldown_seconds: 300,
      last_triggered: null,
    };
    await api.addRule(rule);
    await loadAll();
  }

  async function handleUpdateRule(rule: AlertRule) {
    await api.updateRule(rule);
    await loadAll();
  }

  async function handleDeleteRule(id: string) {
    if (!confirm('确认删除这条提醒规则？')) return;
    await api.deleteRule(id);
    await loadAll();
  }

  async function handleUpdateSettings(patch: Partial<PetSettings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await api.updateSettings(next);
  }

  if (!settings) return <div className="settings-loading">加载中...</div>;

  return (
    <div className="settings-window">
      <div className="settings-sidebar">
        <div className="settings-brand">
          <strong>Stock Pet</strong>
          <span>MONITOR STUDIO</span>
        </div>
        <div className={`settings-tab ${tab === 'stocks' ? 'active' : ''}`} onClick={() => setTab('stocks')}>
          股票管理
        </div>
        <div className={`settings-tab ${tab === 'alerts' ? 'active' : ''}`} onClick={() => setTab('alerts')}>
          提醒规则
        </div>
        <div className={`settings-tab ${tab === 'pet' ? 'active' : ''}`} onClick={() => setTab('pet')}>
          宠物外观
        </div>
      </div>
      <div className="settings-content">
        {tab === 'stocks' && (
          <StocksTab
            stocks={stocks}
            searchKeyword={searchKeyword}
            setSearchKeyword={setSearchKeyword}
            onSearch={handleSearch}
            searching={searching}
            searchResults={searchResults}
            onAdd={handleAddStock}
            onRemove={handleRemoveStock}
          />
        )}
        {tab === 'alerts' && (
          <AlertsTab
            stocks={stocks}
            rules={rules}
            onAdd={handleAddRule}
            onUpdate={handleUpdateRule}
            onDelete={handleDeleteRule}
          />
        )}
        {tab === 'pet' && <PetTab settings={settings} onChange={handleUpdateSettings} />}
      </div>
    </div>
  );
}

function StocksTab({
  stocks,
  searchKeyword,
  setSearchKeyword,
  onSearch,
  searching,
  searchResults,
  onAdd,
  onRemove,
}: {
  stocks: Stock[];
  searchKeyword: string;
  setSearchKeyword: (v: string) => void;
  onSearch: () => void;
  searching: boolean;
  searchResults: Stock[];
  onAdd: (s: Stock) => void;
  onRemove: (code: string) => void;
}) {
  return (
    <div className="tab-content">
      <h2>股票管理</h2>
      <div className="search-bar">
        <input
          type="text"
          placeholder="输入股票代码或名称（如 600519、00700）"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        />
        <button onClick={onSearch} disabled={searching}>
          {searching ? '搜索中...' : '搜索'}
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className="search-results">
          <div className="section-title">搜索结果</div>
          {searchResults.map((s) => (
            <div key={s.tencent_symbol} className="search-item">
              <div>
                <span className="stock-name">{s.name}</span>
                <span className="stock-code">{s.code}</span>
                <span className="stock-market">
                  {s.market === 'ashare' ? 'A股' : s.market === 'hk' ? '港股' : '美股'}
                </span>
              </div>
              <button onClick={() => onAdd(s)}>+ 添加</button>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">已监控股票 ({stocks.length})</div>
      {stocks.length === 0 ? (
        <div className="empty-hint">暂无监控股票，输入代码搜索并添加</div>
      ) : (
        <div className="stock-list">
          {stocks.map((s) => (
            <div key={s.code} className="stock-item">
              <div>
                <span className="stock-name">{s.name}</span>
                <span className="stock-code">{s.code}</span>
                <span className="stock-market">
                  {s.market === 'ashare' ? 'A股' : s.market === 'hk' ? '港股' : '美股'}
                </span>
              </div>
              <button className="btn-danger" onClick={() => onRemove(s.code)}>
                移除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertsTab({
  stocks,
  rules,
  onAdd,
  onUpdate,
  onDelete,
}: {
  stocks: Stock[];
  rules: AlertRule[];
  onAdd: () => void;
  onUpdate: (r: AlertRule) => void;
  onDelete: (id: string) => void;
}) {

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>提醒规则</h2>
        <button className="btn-primary" onClick={onAdd}>+ 新建规则</button>
      </div>

      {rules.length === 0 ? (
        <div className="empty-hint">暂无提醒规则，点击"新建规则"添加</div>
      ) : (
        <div className="rule-list">
          {rules.map((rule) => (
            <RuleEditor
              key={rule.id}
              rule={rule}
              stocks={stocks}
              onChange={onUpdate}
              onDelete={() => onDelete(rule.id)}
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
  onChange,
  onDelete,
}: {
  rule: AlertRule;
  stocks: Stock[];
  onChange: (r: AlertRule) => void;
  onDelete: () => void;
}) {
  const update = (patch: Partial<AlertRule>) => onChange({ ...rule, ...patch });

  const updateRuleType = (patch: Partial<AlertRuleType>) => {
    const current = rule.rule_type;
    let next: AlertRuleType;
    if (current.kind === 'change_percent' && 'threshold' in (patch as any)) {
      next = { ...current, ...patch } as AlertRuleType;
    } else if (current.kind === 'price_cross' && 'target' in (patch as any)) {
      next = { ...current, ...patch } as AlertRuleType;
    } else if (current.kind === 'fast_move') {
      next = { ...current, ...patch } as AlertRuleType;
    } else {
      next = current;
    }
    update({ rule_type: next });
  };

  return (
    <div className="rule-editor">
      <div className="rule-header">
        <select
          value={rule.stock_code}
          onChange={(e) => update({ stock_code: e.target.value })}
        >
          {stocks.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
        <label className="switch">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          <span className="slider" />
        </label>
        <button className="btn-danger btn-sm" onClick={onDelete}>删除</button>
      </div>
      <div className="rule-body">
        <div className="rule-row">
          <label>类型</label>
          <select
            value={rule.rule_type.kind}
            onChange={(e) => {
              const kind = e.target.value as AlertRuleType['kind'];
              let next: AlertRuleType;
              if (kind === 'change_percent') {
                next = { kind, threshold: 3, direction: 'both' };
              } else if (kind === 'price_cross') {
                next = { kind, target: 100, direction: 'up' };
              } else {
                next = { kind, percent: 2, window_seconds: 60 };
              }
              update({ rule_type: next });
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
              <input
                type="number"
                step="0.1"
                min="0"
                value={rule.rule_type.threshold}
                onChange={(e) =>
                  updateRuleType({ threshold: parseFloat(e.target.value) || 0 } as any)
                }
              />
            </div>
            <div className="rule-row">
              <label>方向</label>
              <select
                value={rule.rule_type.direction}
                onChange={(e) =>
                  updateRuleType({ direction: e.target.value as AlertDirection } as any)
                }
              >
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
              <input
                type="number"
                step="0.01"
                min="0"
                value={rule.rule_type.target}
                onChange={(e) =>
                  updateRuleType({ target: parseFloat(e.target.value) || 0 } as any)
                }
              />
            </div>
            <div className="rule-row">
              <label>方向</label>
              <select
                value={rule.rule_type.direction}
                onChange={(e) =>
                  updateRuleType({ direction: e.target.value as AlertDirection } as any)
                }
              >
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
              <label>波动幅度 (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={rule.rule_type.percent}
                onChange={(e) =>
                  updateRuleType({ percent: parseFloat(e.target.value) || 0 } as any)
                }
              />
            </div>
            <div className="rule-row">
              <label>时间窗口 (秒)</label>
              <input
                type="number"
                step="10"
                min="10"
                value={rule.rule_type.window_seconds}
                onChange={(e) =>
                  updateRuleType({
                    window_seconds: parseInt(e.target.value) || 60,
                  } as any)
                }
              />
            </div>
          </>
        )}

        <div className="rule-row">
          <label>冷却时间 (秒)</label>
          <input
            type="number"
            step="30"
            min="0"
            value={rule.cooldown_seconds}
            onChange={(e) => update({ cooldown_seconds: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>
    </div>
  );
}

function PetTab({
  settings,
  onChange,
}: {
  settings: PetSettings;
  onChange: (patch: Partial<PetSettings>) => void;
}) {
  return (
    <div className="tab-content">
      <h2>宠物外观</h2>

      <div className="form-section">
        <div className="section-title">皮肤</div>
        <div className="skin-picker">
          {(['orange_cat', 'gray_cat', 'calico_cat', 'custom'] as PetSkin[]).map((skin) => (
            <div
              key={skin}
              className={`skin-option ${settings.skin === skin ? 'active' : ''}`}
              onClick={() => onChange({ skin })}
            >
              <div className="skin-preview">
                {skin === 'orange_cat' ? (
                  <img src={neutralAsset} alt="" />
                ) : skin === 'gray_cat' ? (
                  <img src={upAsset} alt="" />
                ) : skin === 'calico_cat' ? (
                  <img src={downAsset} alt="" />
                ) : (
                  <img src={alertAsset} alt="" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="form-section">
        <div className="section-title">尺寸: {settings.size}px</div>
        <input
          type="range"
          min="48"
          max="256"
          value={settings.size}
          onChange={(e) => onChange({ size: parseInt(e.target.value) })}
        />
      </div>

      <div className="form-section">
        <div className="section-title">
          透明度: {Math.round(settings.opacity * 100)}%
        </div>
        <input
          type="range"
          min="30"
          max="100"
          value={settings.opacity * 100}
          onChange={(e) => onChange({ opacity: parseInt(e.target.value) / 100 })}
        />
      </div>

      <div className="form-section">
        <div className="section-title">
          刷新间隔: {settings.refresh_interval_secs} 秒
        </div>
        <input
          type="range"
          min="5"
          max="300"
          step="5"
          value={settings.refresh_interval_secs}
          onChange={(e) =>
            onChange({ refresh_interval_secs: parseInt(e.target.value) })
          }
        />
      </div>

      <div className="form-section">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.always_on_top}
            onChange={(e) => onChange({ always_on_top: e.target.checked })}
          />
          窗口置顶
        </label>
      </div>

      {settings.skin === 'custom' && (
        <div className="form-section">
          <div className="section-title">自定义素材</div>
          <div className="custom-assets-hint">
            支持透明 PNG / GIF / APNG。分别设置四种状态的图片。
          </div>
          {(['up', 'down', 'neutral', 'alert'] as const).map((state) => (
            <div key={state} className="rule-row">
              <label>{state === 'up' ? '上涨' : state === 'down' ? '下跌' : state === 'neutral' ? '横盘' : '提醒'}</label>
              <input
                type="text"
                placeholder="输入图片路径或 asset:// 路径"
                value={settings.custom_assets[state] ?? ''}
                onChange={(e) =>
                  onChange({
                    custom_assets: {
                      ...settings.custom_assets,
                      [state]: e.target.value || null,
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
