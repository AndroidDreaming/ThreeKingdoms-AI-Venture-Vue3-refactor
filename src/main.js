import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

function shouldEnableDebugBeacon() {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search || '');
    return params.get('debug') === '1' || window.localStorage.getItem('chronicle_debug') === '1';
  } catch (error) {
    return false;
  }
}

function createDebugBeacon() {
  if (typeof document === 'undefined') return null;
  if (!shouldEnableDebugBeacon()) return null;
  const panel = document.createElement('div');
  const pre = document.createElement('pre');
  panel.id = 'chronicle-debug-beacon';
  panel.style.position = 'fixed';
  panel.style.right = '12px';
  panel.style.bottom = '12px';
  panel.style.zIndex = '2147483647';
  panel.style.width = 'min(420px, calc(100vw - 24px))';
  panel.style.maxHeight = '48vh';
  panel.style.overflow = 'auto';
  panel.style.padding = '10px 12px';
  panel.style.border = '1px solid rgba(212, 175, 55, 0.32)';
  panel.style.borderRadius = '10px';
  panel.style.background = 'rgba(20, 16, 14, 0.96)';
  panel.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.35)';
  panel.style.color = '#f1e7d6';
  panel.style.font = '12px/1.5 Consolas, Monaco, monospace';
  panel.style.whiteSpace = 'pre-wrap';
  panel.style.wordBreak = 'break-word';
  panel.style.pointerEvents = 'none';
  pre.style.margin = '0';
  panel.appendChild(pre);
  document.body.appendChild(panel);

  const state = {
    stage: 'boot:init',
    route: '',
    notes: [],
    extra: {}
  };

  const render = () => {
    pre.textContent = [
      '[Chronicle Debug]',
      `stage: ${state.stage || ''}`,
      `route: ${state.route || ''}`,
      ...state.notes.slice(-6),
      ...Object.keys(state.extra)
        .sort()
        .map((key) => `${key}: ${state.extra[key]}`)
    ].join('\n');
  };

  render();

  return {
    mark(stage, extra = {}) {
      state.stage = stage;
      state.extra = Object.assign({}, state.extra, extra || {});
      render();
    },
    note(text) {
      state.notes.push(String(text || ''));
      render();
    },
    route(text) {
      state.route = String(text || '');
      render();
    }
  };
}

const debugBeacon = createDebugBeacon();

if (typeof window !== 'undefined') {
  window.__chronicleDebug = debugBeacon;
  if (debugBeacon) debugBeacon.mark('boot:modules-loaded');

  window.addEventListener('error', (event) => {
    if (!debugBeacon) return;
    debugBeacon.mark('window:error', {
      error_message: event && event.message ? event.message : 'unknown'
    });
    debugBeacon.note(event && event.filename ? `${event.filename}:${event.lineno || 0}` : 'window error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (!debugBeacon) return;
    const reason = event && event.reason;
    debugBeacon.mark('window:unhandledrejection', {
      rejection: reason && reason.message ? reason.message : String(reason || 'unknown')
    });
  });
}

const app = createApp(App);

app.config.globalProperties.$gameVision = '2.0.0';
app.config.globalProperties.$gameTitle = '汉末·往昔之影';
app.config.globalProperties.$gameSubtitle = '沉浸式三国经营叙事';

if (debugBeacon) debugBeacon.mark('boot:app-created');

app.use(router);

if (debugBeacon) debugBeacon.mark('boot:router-installed');

router.isReady().then(() => {
  if (!debugBeacon) return;
  const fullPath = router.currentRoute.value.fullPath || '/';
  debugBeacon.mark('boot:router-ready', {
    current_route: fullPath
  });
  debugBeacon.route(fullPath);
});

app.mount('#app');

if (debugBeacon) debugBeacon.mark('boot:app-mounted');
