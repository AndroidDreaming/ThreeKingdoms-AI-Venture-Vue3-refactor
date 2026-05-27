const fs = require('fs');
const path = require('path');
const { DEFAULT_MODEL } = require('../game/constants');

const CONFIG_FILE = path.join(__dirname, 'provider.config.json');

function readJsonConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    return content ? JSON.parse(content) : {};
  } catch (error) {
    throw new Error(`无法读取模型配置文件 ${CONFIG_FILE}: ${error.message}`);
  }
}

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function resolveStringValue(raw, envKey, fallback = '') {
  const envValue = process.env[envKey];
  if (envValue !== undefined && envValue !== null && String(envValue).trim() !== '') {
    return {
      value: String(envValue).trim(),
      source: 'env'
    };
  }

  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    return {
      value: String(raw).trim(),
      source: 'file'
    };
  }

  return {
    value: fallback,
    source: 'default'
  };
}

function resolveNumberValue(raw, envKey, fallback) {
  const envValue = process.env[envKey];
  if (envValue !== undefined && envValue !== null && String(envValue).trim() !== '') {
    return {
      value: toNumber(envValue, fallback),
      source: 'env'
    };
  }

  if (raw !== undefined && raw !== null && raw !== '') {
    return {
      value: toNumber(raw, fallback),
      source: 'file'
    };
  }

  return {
    value: fallback,
    source: 'default'
  };
}

function resolveBooleanValue(raw, envKey, fallback = false) {
  const envValue = process.env[envKey];
  if (envValue !== undefined && envValue !== null && String(envValue).trim() !== '') {
    return {
      value: toBoolean(envValue, fallback),
      source: 'env'
    };
  }

  if (raw !== undefined && raw !== null && raw !== '') {
    return {
      value: toBoolean(raw, fallback),
      source: 'file'
    };
  }

  return {
    value: fallback,
    source: 'default'
  };
}

function buildSharedConfig(raw) {
  const providerName = resolveStringValue(raw.providerName, 'TK_PROVIDER_NAME', 'Local Fallback');
  const apiBaseUrl = resolveStringValue(raw.apiBaseUrl, 'TK_API_BASE_URL', '');
  const apiKey = resolveStringValue(raw.apiKey, 'TK_API_KEY', '');
  const model = resolveStringValue(raw.model, 'TK_MODEL', DEFAULT_MODEL);
  const endpointStrategy = resolveStringValue(raw.endpointStrategy, 'TK_ENDPOINT_STRATEGY', 'auto');
  const temperature = resolveNumberValue(raw.temperature, 'TK_TEMPERATURE', 0.8);
  const connectTimeoutMs = resolveNumberValue(raw.connectTimeoutMs, 'TK_CONNECT_TIMEOUT_MS', 15000);
  const streamIdleTimeoutMs = resolveNumberValue(raw.streamIdleTimeoutMs, 'TK_STREAM_IDLE_TIMEOUT_MS', 20000);
  const maxStreamDurationMs = resolveNumberValue(raw.maxStreamDurationMs, 'TK_MAX_STREAM_DURATION_MS', 120000);
  const firstContentTimeoutMs = resolveNumberValue(raw.firstContentTimeoutMs, 'TK_FIRST_CONTENT_TIMEOUT_MS', 30000);
  const nonStreamBodyTimeoutMs = resolveNumberValue(raw.nonStreamBodyTimeoutMs, 'TK_NONSTREAM_BODY_TIMEOUT_MS', 90000);
  const unifiedBundleTimeoutMs = resolveNumberValue(raw.unifiedBundleTimeoutMs, 'TK_UNIFIED_BUNDLE_TIMEOUT_MS', 35000);
  const useUnifiedBundle = resolveBooleanValue(raw.useUnifiedBundle, 'TK_USE_UNIFIED_BUNDLE', false);
  const dynamicChoiceMode = resolveStringValue(raw.dynamicChoiceMode, 'TK_DYNAMIC_CHOICE_MODE', 'batch_first');

  return {
    primary: {
      providerName,
      apiBaseUrl,
      apiKey,
      model,
      endpointStrategy
    },
    shared: {
      temperature,
      connectTimeoutMs,
      streamIdleTimeoutMs,
      maxStreamDurationMs,
      firstContentTimeoutMs,
      nonStreamBodyTimeoutMs,
      unifiedBundleTimeoutMs,
      useUnifiedBundle,
      dynamicChoiceMode
    }
  };
}

function sharedValue(shared, key, fallback) {
  return shared && shared[key] && shared[key].value !== undefined
    ? shared[key].value
    : fallback;
}

function sharedSource(shared, key) {
  return shared && shared[key] && shared[key].source
    ? shared[key].source
    : 'default';
}

function normalizeProviderEntry(rawProvider, sharedConfig, index) {
  const sourceTag = `file.providers[${index}]`;
  const source = rawProvider && typeof rawProvider === 'object' ? rawProvider : {};
  const primary = sharedConfig && sharedConfig.primary ? sharedConfig.primary : {};
  const shared = sharedConfig && sharedConfig.shared ? sharedConfig.shared : {};

  const providerName = String(source.providerName || (primary.providerName && primary.providerName.value) || `Provider ${index + 1}`).trim() || `Provider ${index + 1}`;
  const apiBaseUrl = String(source.apiBaseUrl || '').trim();
  const apiKey = String(source.apiKey || '').trim();
  const model = String(source.model || (primary.model && primary.model.value) || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const endpointStrategy = String(source.endpointStrategy || (primary.endpointStrategy && primary.endpointStrategy.value) || 'auto').trim().toLowerCase() || 'auto';
  const temperature = Number.isFinite(Number(source.temperature)) ? Number(source.temperature) : Number(sharedValue(shared, 'temperature', 0.8));
  const connectTimeoutMs = Number.isFinite(Number(source.connectTimeoutMs)) ? Number(source.connectTimeoutMs) : Number(sharedValue(shared, 'connectTimeoutMs', 15000));
  const streamIdleTimeoutMs = Number.isFinite(Number(source.streamIdleTimeoutMs)) ? Number(source.streamIdleTimeoutMs) : Number(sharedValue(shared, 'streamIdleTimeoutMs', 20000));
  const maxStreamDurationMs = Number.isFinite(Number(source.maxStreamDurationMs)) ? Number(source.maxStreamDurationMs) : Number(sharedValue(shared, 'maxStreamDurationMs', 120000));
  const firstContentTimeoutMs = Number.isFinite(Number(source.firstContentTimeoutMs)) ? Number(source.firstContentTimeoutMs) : Number(sharedValue(shared, 'firstContentTimeoutMs', 30000));
  const nonStreamBodyTimeoutMs = Number.isFinite(Number(source.nonStreamBodyTimeoutMs)) ? Number(source.nonStreamBodyTimeoutMs) : Number(sharedValue(shared, 'nonStreamBodyTimeoutMs', 90000));
  const unifiedBundleTimeoutMs = Number.isFinite(Number(source.unifiedBundleTimeoutMs)) ? Number(source.unifiedBundleTimeoutMs) : Number(sharedValue(shared, 'unifiedBundleTimeoutMs', 35000));
  const useUnifiedBundle = source.useUnifiedBundle !== undefined
    ? toBoolean(source.useUnifiedBundle, Boolean(sharedValue(shared, 'useUnifiedBundle', false)))
    : Boolean(sharedValue(shared, 'useUnifiedBundle', false));
  const dynamicChoiceMode = String(source.dynamicChoiceMode || sharedValue(shared, 'dynamicChoiceMode', 'batch_first')).trim().toLowerCase() || 'batch_first';

  return {
    providerName,
    apiBaseUrl,
    apiKey,
    model,
    endpointStrategy,
    temperature,
    connectTimeoutMs,
    streamIdleTimeoutMs,
    maxStreamDurationMs,
    firstContentTimeoutMs,
    nonStreamBodyTimeoutMs,
    unifiedBundleTimeoutMs,
    useUnifiedBundle,
    dynamicChoiceMode,
    source: {
      providerName: sourceTag,
      apiBaseUrl: sourceTag,
      apiKey: sourceTag,
      model: sourceTag,
      endpointStrategy: source.endpointStrategy !== undefined ? sourceTag : (primary.endpointStrategy ? primary.endpointStrategy.source : 'default'),
      temperature: source.temperature !== undefined ? sourceTag : sharedSource(shared, 'temperature'),
      connectTimeoutMs: source.connectTimeoutMs !== undefined ? sourceTag : sharedSource(shared, 'connectTimeoutMs'),
      streamIdleTimeoutMs: source.streamIdleTimeoutMs !== undefined ? sourceTag : sharedSource(shared, 'streamIdleTimeoutMs'),
      maxStreamDurationMs: source.maxStreamDurationMs !== undefined ? sourceTag : sharedSource(shared, 'maxStreamDurationMs'),
      firstContentTimeoutMs: source.firstContentTimeoutMs !== undefined ? sourceTag : sharedSource(shared, 'firstContentTimeoutMs'),
      nonStreamBodyTimeoutMs: source.nonStreamBodyTimeoutMs !== undefined ? sourceTag : sharedSource(shared, 'nonStreamBodyTimeoutMs'),
      unifiedBundleTimeoutMs: source.unifiedBundleTimeoutMs !== undefined ? sourceTag : sharedSource(shared, 'unifiedBundleTimeoutMs'),
      useUnifiedBundle: source.useUnifiedBundle !== undefined ? sourceTag : sharedSource(shared, 'useUnifiedBundle'),
      dynamicChoiceMode: source.dynamicChoiceMode !== undefined ? sourceTag : sharedSource(shared, 'dynamicChoiceMode')
    }
  };
}

function normalizeLegacyPrimary(sharedConfig) {
  const primary = sharedConfig && sharedConfig.primary ? sharedConfig.primary : {};
  const shared = sharedConfig && sharedConfig.shared ? sharedConfig.shared : {};
  return {
    providerName: primary.providerName && primary.providerName.value ? primary.providerName.value : 'Local Fallback',
    apiBaseUrl: primary.apiBaseUrl && primary.apiBaseUrl.value ? primary.apiBaseUrl.value : '',
    apiKey: primary.apiKey && primary.apiKey.value ? primary.apiKey.value : '',
    model: primary.model && primary.model.value ? primary.model.value : DEFAULT_MODEL,
    endpointStrategy: primary.endpointStrategy && primary.endpointStrategy.value ? primary.endpointStrategy.value.toLowerCase() : 'auto',
    temperature: sharedValue(shared, 'temperature', 0.8),
    connectTimeoutMs: sharedValue(shared, 'connectTimeoutMs', 15000),
    streamIdleTimeoutMs: sharedValue(shared, 'streamIdleTimeoutMs', 20000),
    maxStreamDurationMs: sharedValue(shared, 'maxStreamDurationMs', 120000),
    firstContentTimeoutMs: sharedValue(shared, 'firstContentTimeoutMs', 30000),
    nonStreamBodyTimeoutMs: sharedValue(shared, 'nonStreamBodyTimeoutMs', 90000),
    unifiedBundleTimeoutMs: sharedValue(shared, 'unifiedBundleTimeoutMs', 35000),
    useUnifiedBundle: sharedValue(shared, 'useUnifiedBundle', false),
    dynamicChoiceMode: String(sharedValue(shared, 'dynamicChoiceMode', 'batch_first')).trim().toLowerCase() || 'batch_first',
    source: {
      providerName: primary.providerName ? primary.providerName.source : 'default',
      apiBaseUrl: primary.apiBaseUrl ? primary.apiBaseUrl.source : 'default',
      apiKey: primary.apiKey ? primary.apiKey.source : 'default',
      model: primary.model ? primary.model.source : 'default',
      endpointStrategy: primary.endpointStrategy ? primary.endpointStrategy.source : 'default',
      temperature: sharedSource(shared, 'temperature'),
      connectTimeoutMs: sharedSource(shared, 'connectTimeoutMs'),
      streamIdleTimeoutMs: sharedSource(shared, 'streamIdleTimeoutMs'),
      maxStreamDurationMs: sharedSource(shared, 'maxStreamDurationMs'),
      firstContentTimeoutMs: sharedSource(shared, 'firstContentTimeoutMs'),
      nonStreamBodyTimeoutMs: sharedSource(shared, 'nonStreamBodyTimeoutMs'),
      unifiedBundleTimeoutMs: sharedSource(shared, 'unifiedBundleTimeoutMs'),
      useUnifiedBundle: sharedSource(shared, 'useUnifiedBundle'),
      dynamicChoiceMode: sharedSource(shared, 'dynamicChoiceMode')
    }
  };
}

function isProviderEntryEnabled(provider) {
  return Boolean(
    provider &&
    provider.apiBaseUrl &&
    provider.apiKey &&
    provider.model &&
    provider.model !== DEFAULT_MODEL
  );
}

function normalizeConfig(raw) {
  const sharedConfig = buildSharedConfig(raw);
  const legacyPrimary = normalizeLegacyPrimary(sharedConfig);
  const fileProviders = Array.isArray(raw && raw.providers)
    ? raw.providers.map((item, index) => normalizeProviderEntry(item, sharedConfig, index))
    : [];
  const providers = fileProviders.length ? fileProviders : [legacyPrimary];
  const enabledProviders = providers.filter((item) => isProviderEntryEnabled(item));
  const primaryProvider = enabledProviders[0] || providers[0] || legacyPrimary;

  return {
    providerName: primaryProvider.providerName,
    apiBaseUrl: primaryProvider.apiBaseUrl,
    apiKey: primaryProvider.apiKey,
    model: primaryProvider.model,
    endpointStrategy: primaryProvider.endpointStrategy,
    temperature: primaryProvider.temperature,
    connectTimeoutMs: primaryProvider.connectTimeoutMs,
    streamIdleTimeoutMs: primaryProvider.streamIdleTimeoutMs,
    maxStreamDurationMs: primaryProvider.maxStreamDurationMs,
    firstContentTimeoutMs: primaryProvider.firstContentTimeoutMs,
    nonStreamBodyTimeoutMs: primaryProvider.nonStreamBodyTimeoutMs,
    unifiedBundleTimeoutMs: primaryProvider.unifiedBundleTimeoutMs,
    useUnifiedBundle: primaryProvider.useUnifiedBundle,
    dynamicChoiceMode: primaryProvider.dynamicChoiceMode,
    providers,
    providerCount: providers.length,
    activeProviderNames: enabledProviders.map((item) => item.providerName),
    source: primaryProvider.source
  };
}

function getProviderRuntimeConfig() {
  return normalizeConfig(readJsonConfig());
}

function isProviderEnabled(config) {
  return getProviderCandidates(config).length > 0;
}

function getProviderCandidates(config) {
  if (!config || typeof config !== 'object') return [];
  if (Array.isArray(config.providers) && config.providers.length) {
    return config.providers.filter((item) => isProviderEntryEnabled(item));
  }
  return isProviderEntryEnabled(config) ? [config] : [];
}

function getPublicRuntimeConfig() {
  const config = getProviderRuntimeConfig();
  const enabled = isProviderEnabled(config);
  const candidates = getProviderCandidates(config);
  const allProviders = Array.isArray(config.providers) ? config.providers : [];

  return {
    managedByServer: true,
    providerName: enabled ? config.providerName : 'Local Fallback',
    model: enabled ? config.model : DEFAULT_MODEL,
    enabled,
    apiBaseUrl: config.apiBaseUrl || '',
    apiKeyConfigured: Boolean(config.apiKey),
    endpointStrategy: config.endpointStrategy || 'auto',
    dynamicChoiceMode: config.dynamicChoiceMode || 'batch_first',
    providerCount: allProviders.length,
    activeProviderNames: candidates.map((item) => item.providerName || ''),
    providers: allProviders.map((item, index) => ({
      index,
      enabled: isProviderEntryEnabled(item),
      providerName: item.providerName || `Provider ${index + 1}`,
      model: item.model || DEFAULT_MODEL,
      apiBaseUrl: item.apiBaseUrl || '',
      apiKeyConfigured: Boolean(item.apiKey)
    })),
    configSource: Object.assign({}, config.source || {}),
    configFile: 'server/config/provider.config.json'
  };
}

module.exports = {
  CONFIG_FILE,
  getProviderRuntimeConfig,
  getProviderCandidates,
  getPublicRuntimeConfig,
  isProviderEnabled
};
