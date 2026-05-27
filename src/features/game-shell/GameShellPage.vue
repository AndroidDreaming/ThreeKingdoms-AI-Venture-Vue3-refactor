<template>
  <div class="game-shell-page">
    <div class="game-shell-page__backdrop"></div>
    <div class="game-shell-page__noise"></div>
    <div v-if="runtimeError" class="game-shell-page__error">
      <div class="game-shell-page__error-kicker">界面运行异常</div>
      <div class="game-shell-page__error-title">前端在渲染时发生错误</div>
      <div class="game-shell-page__error-text">{{ runtimeError.message }}</div>
      <div v-if="runtimeError.info" class="game-shell-page__error-meta">{{ runtimeError.info }}</div>
    </div>
    <GamePageHanmoChronicleV2 v-else />
  </div>
</template>

<script>
import GamePageHanmoChronicleV2 from '@/views/game/GamePageHanmoChronicleV2.vue';

export default {
  name: 'GameShellPage',
  components: {
    GamePageHanmoChronicleV2
  },
  data() {
    return {
      runtimeError: null
    };
  },
  errorCaptured(error, instance, info) {
    this.runtimeError = {
      message: error && error.message ? error.message : String(error || '未知错误'),
      info: info || ''
    };
    if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
      console.error('[GameShellPage errorCaptured]', error, info, instance);
    }
    return false;
  }
};
</script>

<style scoped lang="less">
.game-shell-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(219, 184, 133, 0.1), transparent 24%),
    radial-gradient(circle at bottom right, rgba(86, 117, 88, 0.09), transparent 20%),
    linear-gradient(180deg, #120f0e, #1b1412 45%, #0e0b0b);
}

.game-shell-page__backdrop,
.game-shell-page__noise {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.game-shell-page__backdrop {
  background:
    linear-gradient(90deg, rgba(215, 173, 120, 0.04), transparent 16%, transparent 84%, rgba(215, 173, 120, 0.04)),
    linear-gradient(180deg, rgba(255, 247, 229, 0.03), transparent 20%);
}

.game-shell-page__noise {
  opacity: .08;
  background-image:
    radial-gradient(circle at 1px 1px, rgba(255,255,255,.55) 1px, transparent 0);
  background-size: 22px 22px;
}

.game-shell-page__error {
  position: relative;
  z-index: 1;
  max-width: 860px;
  margin: 48px auto;
  padding: 28px;
  border: 1px solid rgba(212, 175, 55, 0.24);
  border-radius: 16px;
  background: rgba(26, 20, 17, 0.94);
  color: #e6dfd1;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.28);
}

.game-shell-page__error-kicker {
  color: #c7a76a;
  font-size: 12px;
  letter-spacing: .18em;
  text-transform: uppercase;
}

.game-shell-page__error-title {
  margin-top: 10px;
  font-size: 28px;
  line-height: 1.15;
}

.game-shell-page__error-text,
.game-shell-page__error-meta {
  margin-top: 12px;
  color: rgba(230, 223, 209, 0.88);
  line-height: 1.7;
  word-break: break-word;
}

.game-shell-page__error-meta {
  color: rgba(199, 167, 106, 0.86);
  font-size: 13px;
}
</style>
