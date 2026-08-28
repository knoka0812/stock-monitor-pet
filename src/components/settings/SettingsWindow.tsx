import { useEffect, useRef, useState } from 'react';
import alertAsset from '../../assets/pet/alert.png';
import downAsset from '../../assets/pet/down.png';
import neutralAsset from '../../assets/pet/neutral.png';
import upAsset from '../../assets/pet/up.png';
import dogAlertAsset from '../../assets/pet/dog-alert.png';
import dogDownAsset from '../../assets/pet/dog-down.png';
import dogNeutralAsset from '../../assets/pet/dog-neutral.png';
import dogUpAsset from '../../assets/pet/dog-up.png';
import { api, waitForAppReady } from '../../services/api';
import { applyTheme, createTranslator, localeFor, marketLabel } from '../../i18n';
import type { AppLanguage, AppTheme, Translator } from '../../i18n';
import type {
  AlertEvent,
  AlertDirection,
  AlertRule,
  AlertRuleType,
  PetSettings,
  Stock,
} from '../../types';
import './settings.css';

type Tab = 'stocks' | 'alerts' | 'pet' | 'backup' | 'history';
type AssetState = 'up' | 'down' | 'neutral' | 'alert';
type Feedback = { tone: 'success' | 'error'; message: string } | null;

function withTimeout<T>(promise: Promise<T>, milliseconds = 5000) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`后端响应超过 ${Math.round(milliseconds / 1000)} 秒`)), milliseconds);
    }),
  ]);
}

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

function readTextFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file, 'utf-8');
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function SettingsWindow() {
  const [tab, setTab] = useState<Tab>('stocks');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertEvent[]>([]);
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
  const [bootError, setBootError] = useState<string | null>(null);
  const language = settings?.language ?? 'zh';
  const theme = settings?.theme ?? 'dark';
  const translate = createTranslator(language);

  useEffect(() => {
    applyTheme(theme);
    document.documentElement.lang = localeFor(language);
  }, [language, theme]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await waitForAppReady();
        if (!cancelled) await loadAll();
      } catch (error) {
        if (!cancelled) setBootError(errorMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadAll() {
    try {
      const [stocksData, rulesData, settingsData, historyData] = await Promise.all([
        withTimeout(api.getStocks()),
        withTimeout(api.getRules()),
        withTimeout(api.getSettings()),
        withTimeout(api.getAlertHistory()),
      ]);
      setStocks(stocksData);
      setRules(rulesData);
      setHistory(historyData);
      setSettings(settingsData);
      setDirtyRules([]);
      setSettingsDirty(false);
      setBootError(null);
    } catch (error) {
      setBootError(errorMessage(error));
    }
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
      if (results.length === 0) showFeedback('error', translate('noMatches'));
    } catch (error) {
      showFeedback('error', `${translate('searchFailed')}：${errorMessage(error)}`);
    } finally {
      setSearching(false);
    }
  }

  async function handleAddStock(stock: Stock) {
    const succeeded = await runStockAction(
      stock.code,
      () => api.addStock(stock.tencent_symbol),
      translate('addedStock', { name: stock.name }),
    );
    if (!succeeded) return;
    setSearchKeyword('');
    setSearchResults([]);
  }

  function handleRemoveStock(code: string) {
    void runStockAction(code, () => api.removeStock(code), translate('removedStock', { code }));
  }

  function handleSetCurrentStock(code: string) {
    void runStockAction(code, () => api.setCurrentStockCode(code), translate('switchedStock', { code }));
  }

  async function handleAddRule() {
    if (stocks.length === 0) {
      showFeedback('error', translate('needStock'));
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
      showFeedback('success', translate('ruleCreated'));
    } catch (error) {
      showFeedback('error', `${translate('createFailed')}：${errorMessage(error)}`);
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
      showFeedback('success', translate('ruleSaved'));
    } catch (error) {
      showFeedback('error', `${translate('ruleSaveFailed')}：${errorMessage(error)}`);
    } finally {
      setSavingRules((current) => current.filter((id) => id !== rule.id));
    }
  }

  async function handleDeleteRule(id: string) {
    try {
      await api.deleteRule(id);
      await loadAll();
      showFeedback('success', translate('ruleDeleted'));
    } catch (error) {
      showFeedback('error', `${translate('ruleDeleteFailed')}：${errorMessage(error)}`);
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
      showFeedback('success', translate('settingsSaved'));
    } catch (error) {
      showFeedback('error', `${translate('settingsSaveFailed')}：${errorMessage(error)}`);
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleExportConfig() {
    try {
      const content = await api.exportConfig();
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'stock-monitor-pet-config.json',
          types: [
            {
              description: translate('jsonFiles'),
              accept: { 'application/json': ['.json'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        showFeedback('success', translate('exportSaved'));
      } else {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'stock-monitor-pet-config.json';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        showFeedback('success', translate('exportDownloaded'));
      }
    } catch (error) {
      showFeedback('error', `${translate('exportFailed')}：${errorMessage(error)}`);
    }
  }

  async function handleImportConfig(file?: File) {
    if (!file) return;
    try {
      const content = await readTextFile(file);
      await api.importConfig(content);
      await loadAll();
      showFeedback('success', translate('importSuccess'));
    } catch (error) {
      showFeedback('error', `${translate('importFailed')}：${errorMessage(error)}`);
    }
  }

  if (!settings) {
    return (
      <div className="settings-loading">
        {bootError ? `${translate('loadFailed')}：${bootError}` : translate('connecting')}
      </div>
    );
  }

  return (
    <div className="settings-window">
      <aside className="settings-sidebar">
        <div className="settings-brand">
          <strong>Stock Pet</strong>
          <span>MONITOR STUDIO</span>
        </div>
        {(['stocks', 'alerts', 'pet', 'backup', 'history'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`settings-tab ${tab === item ? 'active' : ''}`}
            onClick={() => setTab(item)}
          >
            {translate(item === 'pet' ? 'appearance' : item)}
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
            translate={translate}
            language={language}
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
            translate={translate}
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
            translate={translate}
            settings={settings}
            dirty={settingsDirty}
            saving={savingSettings}
            onChange={handleSettingsChange}
            onAssetFile={handleAssetFile}
            onSave={handleSaveSettings}
          />
        )}

        {tab === 'backup' && <BackupTab translate={translate} onExport={handleExportConfig} onImport={handleImportConfig} />}
        {tab === 'history' && <HistoryTab translate={translate} history={history} language={language} />}
      </main>
    </div>
  );
}

function StocksTab({
  translate,
  language,
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
  translate: Translator;
  language: AppLanguage;
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
      <h2>{translate('stocks')}</h2>
      <div className="search-bar">
        <input
          type="text"
          placeholder={translate('searchPlaceholder')}
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && onSearch()}
        />
        <button type="button" onClick={onSearch} disabled={searching}>
          {searching ? translate('searching') : translate('search')}
        </button>
      </div>

      {searchResults.length > 0 && (
        <section className="glass-list">
          <div className="section-title">{translate('searchResults')}</div>
          {searchResults.map((stock) => {
            const added = monitoredCodes.has(stock.code);
            return (
              <div key={stock.tencent_symbol} className="stock-item">
                <StockLabel stock={stock} language={language} />
                <button type="button" onClick={() => onAdd(stock)} disabled={added || busyStock === stock.code}>
                  {added ? translate('added') : busyStock === stock.code ? translate('adding') : translate('add')}
                </button>
              </div>
            );
          })}
        </section>
      )}

      <div className="section-title">{translate('monitoredStocks', { count: stocks.length })}</div>
      {stocks.length === 0 ? (
        <div className="empty-hint">{translate('noMonitoredStocks')}</div>
      ) : (
        <section className="glass-list">
          {stocks.map((stock) => (
            <div key={stock.code} className="stock-item">
              <StockLabel stock={stock} language={language} />
              <div className="stock-actions">
                <button
                  type="button"
                  className="ghost"
                  disabled={busyStock === stock.code || stock.code === currentCode}
                  onClick={() => onSelect(stock.code)}
                >
                  {stock.code === currentCode ? translate('current') : translate('setCurrent')}
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busyStock === stock.code}
                  onClick={() => onRemove(stock.code)}
                >
                  {busyStock === stock.code ? translate('removing') : translate('remove')}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function StockLabel({ stock, language }: { stock: Stock; language: AppLanguage }) {
  return (
    <div>
      <span className="stock-name">{stock.name}</span>
      <span className="stock-code">{stock.code}</span>
      <span className="stock-market">
        {marketLabel(language, stock.market)}
      </span>
    </div>
  );
}

function AlertsTab({
  translate,
  stocks,
  rules,
  dirtyRules,
  savingRules,
  onAdd,
  onChange,
  onSave,
  onDelete,
}: {
  translate: Translator;
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
        <h2>{translate('alerts')}</h2>
        <button type="button" onClick={onAdd}>{translate('newRule')}</button>
      </div>

      {dirtyRules.length > 0 && (
        <div className="dirty-hint">{translate('unsavedRules', { count: dirtyRules.length })}</div>
      )}

      {rules.length === 0 ? (
        <div className="empty-hint">{translate('noRules')}</div>
      ) : (
        <div className="rule-list">
          {rules.map((rule) => (
            <RuleEditor
              translate={translate}
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
  translate,
  rule,
  stocks,
  dirty,
  saving,
  onChange,
  onSave,
  onDelete,
}: {
  translate: Translator;
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
        <label className="switch" title={translate('toggleRule')}>
          <input type="checkbox" checked={rule.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
          <span className="slider" />
        </label>
        <button type="button" className={`btn-danger btn-sm ${confirmDelete ? 'confirming' : ''}`} onClick={handleDelete}>
          {confirmDelete ? translate('confirmDelete') : translate('delete')}
        </button>
      </div>

      <div className="rule-body">
        <div className="rule-row">
          <label>{translate('ruleType')}</label>
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
            <option value="change_percent">{translate('changePercent')}</option>
            <option value="price_cross">{translate('priceCross')}</option>
            <option value="fast_move">{translate('fastMove')}</option>
          </select>
        </div>

        {rule.rule_type.kind === 'change_percent' && (
          <>
            <div className="rule-row">
              <label>{translate('threshold')}</label>
              <input type="number" step="0.1" min="0" value={rule.rule_type.threshold} onChange={(event) => updateRuleType({ threshold: Number(event.target.value) || 0 })} />
            </div>
            <div className="rule-row">
              <label>{translate('direction')}</label>
              <select value={rule.rule_type.direction} onChange={(event) => updateRuleType({ direction: event.target.value as AlertDirection })}>
                <option value="both">{translate('bothDirections')}</option>
                <option value="up">{translate('upOnly')}</option>
                <option value="down">{translate('downOnly')}</option>
              </select>
            </div>
          </>
        )}

        {rule.rule_type.kind === 'price_cross' && (
          <>
            <div className="rule-row">
              <label>{translate('targetPrice')}</label>
              <input type="number" step="0.01" min="0" value={rule.rule_type.target} onChange={(event) => updateRuleType({ target: Number(event.target.value) || 0 })} />
            </div>
            <div className="rule-row">
              <label>{translate('direction')}</label>
              <select value={rule.rule_type.direction} onChange={(event) => updateRuleType({ direction: event.target.value as AlertDirection })}>
                <option value="up">{translate('crossUp')}</option>
                <option value="down">{translate('crossDown')}</option>
                <option value="both">{translate('bidirectional')}</option>
              </select>
            </div>
          </>
        )}

        {rule.rule_type.kind === 'fast_move' && (
          <>
            <div className="rule-row">
              <label>{translate('percent')}</label>
              <input type="number" step="0.1" min="0" value={rule.rule_type.percent} onChange={(event) => updateRuleType({ percent: Number(event.target.value) || 0 })} />
            </div>
            <div className="rule-row">
              <label>{translate('windowSeconds')}</label>
              <input type="number" step="10" min="10" value={rule.rule_type.window_seconds} onChange={(event) => updateRuleType({ window_seconds: Number(event.target.value) || 60 })} />
            </div>
          </>
        )}

        <div className="rule-row">
          <label>{translate('cooldownSeconds')}</label>
          <input type="number" step="30" min="0" value={rule.cooldown_seconds} onChange={(event) => update({ cooldown_seconds: Number(event.target.value) || 0 })} />
        </div>

        <div className="rule-footer">
          <span>{dirty ? translate('unsaved') : translate('saved')}</span>
          <button type="button" disabled={!dirty || saving} onClick={() => onSave(rule)}>
            {saving ? translate('saving') : translate('saveChanges')}
          </button>
        </div>
      </div>
    </article>
  );
}

function PetTab({
  translate,
  settings,
  dirty,
  saving,
  onChange,
  onAssetFile,
  onSave,
}: {
  translate: Translator;
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
        <h2>{translate('appearance')}</h2>
        <button type="button" disabled={!dirty || saving} onClick={onSave}>
          {saving ? translate('saving') : dirty ? translate('saveSettings') : translate('saved')}
        </button>
      </div>

      <section className="form-section">
        <div className="section-title">{translate('petImage')}</div>
        <div className="skin-picker three-column">
          <button
            type="button"
            className={`skin-option ${settings.skin === 'default' ? 'active' : ''}`}
            onClick={() => onChange({ skin: 'default' })}
          >
            <div className="skin-state-grid">
              <img src={neutralAsset} alt={translate('stateNeutral')} />
              <img src={upAsset} alt={translate('stateUp')} />
              <img src={downAsset} alt={translate('stateDown')} />
              <img src={alertAsset} alt={translate('stateAlert')} />
            </div>
            <p>{translate('builtInCat')}</p>
            <small>{translate('fourStates')}</small>
          </button>

          <button
            type="button"
            className={`skin-option ${settings.skin === 'dog' ? 'active' : ''}`}
            onClick={() => onChange({ skin: 'dog' })}
          >
            <div className="skin-state-grid">
              <img src={dogNeutralAsset} alt={translate('stateNeutral')} />
              <img src={dogUpAsset} alt={translate('stateUp')} />
              <img src={dogDownAsset} alt={translate('stateDown')} />
              <img src={dogAlertAsset} alt={translate('stateAlert')} />
            </div>
            <p>{translate('dog')}</p>
            <small>{translate('fourStates')}</small>
          </button>

          <button
            type="button"
            className={`skin-option ${isCustom ? 'active' : ''}`}
            onClick={() => onChange({ skin: 'custom' })}
          >
            <div className="skin-state-grid">
              {(['up', 'down', 'neutral', 'alert'] as AssetState[]).map((state) => {
                const asset = settings.custom_assets[state];
                return asset ? <img key={state} src={asset} alt="" /> : <span key={state}>{translate('empty')}</span>;
              })}
            </div>
            <p>{translate('customCat')}</p>
            <small>{translate('uploadFourStates')}</small>
          </button>
        </div>
      </section>

      {isCustom && (
        <section className="form-section">
          <div className="section-title">{translate('customAssets')}</div>
          {(['neutral', 'up', 'down', 'alert'] as AssetState[]).map((state) => (
            <div key={state} className="asset-row">
              <label>{translate(state === 'up' ? 'stateUp' : state === 'down' ? 'stateDown' : state === 'neutral' ? 'stateNeutral' : 'stateAlert')}</label>
              <div className="asset-preview">
                {settings.custom_assets[state] ? <img src={settings.custom_assets[state] ?? ''} alt="" /> : <span>{translate('unset')}</span>}
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
                {translate('clear')}
              </button>
            </div>
          ))}
          <small className="asset-hint">{translate('assetHint')}</small>
        </section>
      )}

      <section className="form-section">
        <div className="section-title">{translate('size')}：{settings.size}px</div>
        <input type="range" min="48" max="256" value={settings.size} onChange={(event) => onChange({ size: Number(event.target.value) })} />
      </section>

      <section className="form-section">
        <div className="section-title">{translate('opacity')}（{translate('realtime')}）</div>
        <div className="opacity-controls">
          <input
            type="number"
            min="10"
            max="100"
            value={Math.round(settings.opacity * 100)}
            onChange={(event) =>
              onChange({
                opacity: Math.min(100, Math.max(10, Number(event.target.value) || 100)) / 100,
              })
            }
          />
          <span>%</span>
          <input
            type="range"
            min="10"
            max="100"
            value={settings.opacity * 100}
            onChange={(event) => onChange({ opacity: Number(event.target.value) / 100 })}
          />
        </div>
      </section>

      <section className="form-section">
        <div className="section-title">{translate('refreshInterval')}：{settings.refresh_interval_secs} {translate('seconds')}</div>
        <input type="range" min="5" max="300" step="5" value={settings.refresh_interval_secs} onChange={(event) => onChange({ refresh_interval_secs: Number(event.target.value) })} />
      </section>

      <section className="form-section">
        <label className="checkbox-label">
          <input type="checkbox" checked={settings.always_on_top} onChange={(event) => onChange({ always_on_top: event.target.checked })} />
          {translate('alwaysOnTop')}
        </label>
      </section>

      <section className="form-section">
        <div className="section-title">{translate('language')}</div>
        <select
          className="language-select"
          value={settings.language}
          onChange={(event) => onChange({ language: event.target.value as AppLanguage })}
        >
          <option value="zh">{translate('chinese')}</option>
          <option value="en">{translate('english')}</option>
        </select>
      </section>

      <section className="form-section">
        <div className="section-title">{translate('theme')}</div>
        <select
          className="language-select"
          value={settings.theme}
          onChange={(event) => onChange({ theme: event.target.value as AppTheme })}
        >
          <option value="dark">{translate('dark')}</option>
          <option value="light">{translate('light')}</option>
        </select>
      </section>
    </div>
  );
}

function BackupTab({
  translate,
  onExport,
  onImport,
}: {
  translate: Translator;
  onExport: () => void;
  onImport: (file?: File) => void;
}) {
  return (
    <div className="tab-content">
      <h2>{translate('backup')}</h2>
      <p className="backup-desc">{translate('backupDesc')}</p>

      <section className="form-section">
        <div className="section-title">{translate('export')}</div>
        <button type="button" className="btn-primary" onClick={onExport}>
          {translate('downloadConfig')}
        </button>
      </section>

      <section className="form-section">
        <div className="section-title">{translate('import')}</div>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            onImport(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </section>
    </div>
  );
}

function HistoryTab({ translate, history, language }: { translate: Translator; history: AlertEvent[]; language: AppLanguage }) {
  return (
    <div className="tab-content">
      <h2>{translate('history')}</h2>
      {history.length === 0 ? (
        <div className="empty-hint">{translate('noHistory')}</div>
      ) : (
        <section className="glass-list">
          {history.map((event) => (
            <div key={`${event.timestamp}-${event.rule_id}`} className="history-item">
              <div className="history-item-head">
                <span className="history-item-name">{event.stock_name}</span>
                <span className="history-item-time">
                  {new Date(event.timestamp * 1000).toLocaleString(localeFor(language))}
                </span>
              </div>
              <div className="history-item-message">{event.message}</div>
              <div className="history-item-meta">
                {event.price.toFixed(2)} · {event.change_percent > 0 ? '+' : ''}
                {event.change_percent.toFixed(2)}%
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
