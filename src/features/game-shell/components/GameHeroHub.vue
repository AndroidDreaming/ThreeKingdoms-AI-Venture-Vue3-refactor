<template>
  <div class="hero-hub">
    <section
      v-if="view.showAccessStrip"
      class="access-strip card"
      :class="{ 'access-strip--guest': !view.currentUser }"
    >
      <div class="access-strip__main">
        <div class="access-strip__identity">
          <div class="section-kicker">{{ view.currentUser ? '军帐权限' : '试玩权限' }}</div>
          <div class="panel-title panel-title--small">{{ view.accessIdentityTitle }}</div>
          <div class="panel-text access-summary-text">{{ view.accessIdentityText }}</div>
        </div>

        <div class="access-strip__status">
          <span class="access-chip access-chip--emphasis">{{ view.currentUser ? '已登录' : '试玩中' }}</span>
          <span class="access-chip">试玩 {{ view.trialRemainingTurns > 0 ? `${view.trialRemainingTurns} 回` : '已耗尽' }}</span>
          <span class="access-chip">储备 {{ view.paidTurnCredits > 0 ? `${view.paidTurnCredits} 回` : '0 回' }}</span>
          <span
            class="access-chip"
            :class="view.hasMonthCard ? 'access-chip--month-live' : 'access-chip--month-idle'"
          >
            {{ view.hasMonthCard ? view.monthCardStatusText : '月卡未开启' }}
          </span>
        </div>
      </div>

      <div class="access-strip__actions">
        <template v-if="view.currentUser">
          <div class="purchase-group" @click.stop>
            <button
              type="button"
              class="tool-button purchase-chip purchase-chip--product"
              :class="{ 'purchase-chip--product-active': view.activePurchaseSku === 'turn30' }"
              :disabled="view.purchaseLoading"
              @click="view.togglePurchaseSku('turn30')"
            >
              {{ view.purchaseLoading && view.activePurchaseSku === 'turn30' ? '处理中' : '购入 30 回合' }}
            </button>
            <div v-if="view.activePurchaseSku === 'turn30'" class="purchase-methods">
              <div class="purchase-methods__title">选择支付方式</div>
              <button
                type="button"
                class="tool-button purchase-chip purchase-chip--wechat purchase-chip--method"
                :disabled="view.purchaseLoading"
                @click="view.purchaseTurnPack('wechat', 30)"
              >
                微信支付
              </button>
              <button
                type="button"
                class="tool-button purchase-chip purchase-chip--alipay purchase-chip--method"
                :disabled="view.purchaseLoading"
                @click="view.purchaseTurnPack('alipay', 30)"
              >
                支付宝支付
              </button>
            </div>
          </div>

          <div class="purchase-group" @click.stop>
            <button
              type="button"
              class="tool-button purchase-chip purchase-chip--product"
              :class="{ 'purchase-chip--product-active': view.activePurchaseSku === 'turn100' }"
              :disabled="view.purchaseLoading"
              @click="view.togglePurchaseSku('turn100')"
            >
              {{ view.purchaseLoading && view.activePurchaseSku === 'turn100' ? '处理中' : '购入 100 回合' }}
            </button>
            <div v-if="view.activePurchaseSku === 'turn100'" class="purchase-methods">
              <div class="purchase-methods__title">选择支付方式</div>
              <button
                type="button"
                class="tool-button purchase-chip purchase-chip--wechat purchase-chip--method"
                :disabled="view.purchaseLoading"
                @click="view.purchaseTurnPack('wechat', 100)"
              >
                微信支付
              </button>
              <button
                type="button"
                class="tool-button purchase-chip purchase-chip--alipay purchase-chip--method"
                :disabled="view.purchaseLoading"
                @click="view.purchaseTurnPack('alipay', 100)"
              >
                支付宝支付
              </button>
            </div>
          </div>

          <div v-if="!view.hasMonthCard" class="purchase-group" @click.stop>
            <button
              type="button"
              class="tool-button purchase-chip purchase-chip--product purchase-chip--month-trigger"
              :class="{ 'purchase-chip--product-active': view.activePurchaseSku === 'month30' }"
              :disabled="view.purchaseLoading"
              @click="view.togglePurchaseSku('month30')"
            >
              {{ view.purchaseLoading && view.activePurchaseSku === 'month30' ? '处理中' : '开启月卡' }}
            </button>
            <div v-if="view.activePurchaseSku === 'month30'" class="purchase-methods">
              <div class="purchase-methods__title">选择支付方式</div>
              <button
                type="button"
                class="tool-button purchase-chip purchase-chip--wechat purchase-chip--method"
                :disabled="view.purchaseLoading"
                @click="view.purchaseMonthCard('wechat', 30)"
              >
                微信支付
              </button>
              <button
                type="button"
                class="tool-button purchase-chip purchase-chip--alipay purchase-chip--method"
                :disabled="view.purchaseLoading"
                @click="view.purchaseMonthCard('alipay', 30)"
              >
                支付宝支付
              </button>
            </div>
          </div>

          <span v-else class="access-chip access-chip--month-live">月卡生效中</span>
          <button
            type="button"
            class="tool-button tool-button--subtle purchase-chip purchase-chip--logout"
            @click="view.logout"
          >
            退出登录
          </button>
        </template>

        <div v-else class="status-tip access-foot-note">{{ view.accessFootText }}</div>
      </div>
    </section>

    <header class="title-zone hero-stage card">
      <div class="hero-stage__backdrop" aria-hidden="true">
        <div class="hero-stage__banner"></div>
        <svg viewBox="0 0 960 400" class="hero-stage__sigil">
          <defs>
            <linearGradient id="heroLine" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="rgba(245,219,180,0.78)" />
              <stop offset="100%" stop-color="rgba(145,97,49,0.06)" />
            </linearGradient>
          </defs>
          <path d="M88 268c104-25 133-145 230-165 70-15 122 25 190 25 88 0 134-78 220-76 46 1 86 25 144 72" fill="none" stroke="url(#heroLine)" stroke-width="4" stroke-linecap="round" />
          <path d="M132 100c55 18 96 64 132 126M332 58c44 31 73 78 80 136M534 70c47 17 90 61 123 126M704 138c50 12 98 43 140 96" fill="none" stroke="rgba(245,219,180,0.14)" stroke-width="2.2" stroke-linecap="round" />
          <circle cx="132" cy="100" r="7" fill="rgba(255,222,173,0.82)" />
          <circle cx="332" cy="58" r="7" fill="rgba(255,222,173,0.66)" />
          <circle cx="534" cy="70" r="7" fill="rgba(255,222,173,0.78)" />
          <circle cx="704" cy="138" r="7" fill="rgba(255,222,173,0.6)" />
        </svg>
      </div>

      <div class="title-copy hero-stage__copy">
        <div class="eyebrow">乱世卷册</div>
        <div class="title-chapter-strip">
          <span class="title-chapter-strip__label">卷首</span>
          <span class="title-chapter-strip__line"></span>
          <span class="title-chapter-strip__text">{{ view.snapshot.world.dateLabel || '建安元年' }} · {{ view.snapshot.world.currentCityName || '乱世未定' }}</span>
        </div>
        <h1>{{ view.gameTitle }}</h1>
        <p class="title-desc">{{ view.heroDescription }}</p>
        <div class="title-tags">
          <span v-for="item in view.displayTitleTags" :key="item">{{ item }}</span>
        </div>

        <div class="title-crest-strip">
          <div v-for="item in view.titleCrestStats" :key="item.key" class="title-crest-strip__item">
            <span class="title-crest-strip__icon" v-html="item.icon"></span>
            <div class="title-crest-strip__copy">
              <small>{{ item.label }}</small>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="title-tools hero-stage__aside">
        <div class="hero-stage__aside-kicker">军令台</div>

        <div class="title-utility title-utility--top hero-stage__actions">
          <div class="title-utility-row">
            <button
              type="button"
              class="tool-button tool-button--subtle title-action-button title-action-button--danger"
              :disabled="view.aiLoading"
              @click="view.resetGame"
            >
              重开此卷
            </button>

            <div
              v-if="view.donationEntry.enabled"
              class="purchase-group purchase-group--donation purchase-group--title"
              @click.stop
            >
              <button
                type="button"
                class="tool-button purchase-chip purchase-chip--donation purchase-chip--donation-hero title-action-button title-action-button--support"
                :class="{ 'purchase-chip--product-active': view.activePurchaseSku === 'donate' }"
                :aria-expanded="view.activePurchaseSku === 'donate'"
                @click="view.togglePurchaseSku('donate')"
              >
                <span v-if="view.activePurchaseSku !== 'donate'" class="title-action-button__nudge">愿意再点</span>
                <span class="support-entry__spark" aria-hidden="true"></span>
                <span class="support-entry__copy">
                  <span class="support-entry__title">{{ view.activePurchaseSku === 'donate' ? '收起茶案' : view.donationEntry.triggerLabel }}</span>
                  <span class="support-entry__sub">{{ view.activePurchaseSku === 'donate' ? '二维码已展开' : '若喜此卷，请饮残茶' }}</span>
                </span>
                <span class="support-entry__arrow" aria-hidden="true">{{ view.activePurchaseSku === 'donate' ? '↑' : '↓' }}</span>
              </button>
              <div
                v-if="view.activePurchaseSku === 'donate'"
                class="purchase-methods purchase-methods--donation purchase-methods--title-donation"
              >
                <div class="purchase-methods__title">{{ view.donationEntry.title }}</div>
                <div class="donation-panel">
                  <div class="donation-panel__intro">
                    <strong>不影响游玩，只是给愿意递茶的人留个入口。</strong>
                    <span>选择一个收款码扫码，或先查看说明再决定。</span>
                  </div>
                  <div class="donation-panel__head">
                    <div class="donation-panel__channel-tabs">
                      <button
                        v-for="channel in view.donationChannels"
                        :key="channel.key"
                        type="button"
                        class="donation-panel__channel-tab"
                        :class="{ 'donation-panel__channel-tab--active': view.activeDonationChannel === channel.key }"
                        @click="view.setActiveDonationChannel(channel.key)"
                      >
                        {{ channel.label }}
                      </button>
                    </div>
                    <button
                      type="button"
                      class="tool-button tool-button--subtle donation-panel__guide-trigger"
                      @click="view.openDonationGuide"
                    >
                      茶案说明
                    </button>
                  </div>

                  <div v-if="view.activeDonationQrAvailable" class="donation-panel__image-wrap">
                    <img
                      class="donation-panel__image"
                      :src="view.activeDonationConfig.image"
                      :alt="view.activeDonationConfig.alt"
                      @error="view.handleDonationQrError(view.activeDonationChannel)"
                    >
                  </div>
                  <div v-else class="donation-panel__fallback">
                    <div class="donation-panel__fallback-title">尚未放入 {{ view.activeDonationConfig.label }} 收款码</div>
                    <div class="donation-panel__fallback-line">请将图片放到 <code>{{ view.activeDonationConfig.expectedPath }}</code></div>
                  </div>

                  <div class="donation-panel__desc">{{ view.donationEntry.description }}</div>
                  <div class="donation-panel__note">{{ view.donationEntry.note }}</div>
                  <button
                    type="button"
                    class="tool-button tool-button--subtle donation-panel__soft-cta"
                    @click="view.openDonationGuide"
                  >
                    查看用途和完整二维码
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            v-if="view.endingCanInherit"
            type="button"
            class="tool-button tool-button--accent"
            :disabled="view.aiLoading"
            @click="view.inheritGame"
          >
            继承余韵重开
          </button>
        </div>

        <div class="title-command-deck hero-stage__aside-card">
          <div class="title-command-deck__head">
            <div class="section-kicker">当前盘面</div>
            <div class="title-command-deck__title">{{ view.titleDeckTitle }}</div>
          </div>
          <div class="title-command-deck__body">{{ view.titleDeckSummary }}</div>
          <div class="title-command-deck__meta">
            <span v-for="item in view.titleDeckMeta" :key="item.key">{{ item.label }} · {{ item.value }}</span>
          </div>
        </div>

        <div v-if="view.showTurnOverview" class="war-status-bar">
          <div class="war-status-bar__head">
            <div>
              <div class="section-kicker">战局引导</div>
              <div class="panel-title panel-title--small">{{ view.snapshot.scene.title || '盘面未定' }}</div>
            </div>
            <button
              v-if="view.canRenamePlayer"
              type="button"
              class="tool-button tool-button--subtle war-status-bar__rename"
              :disabled="view.interactionBlocked"
              @click="view.renamePlayerOnce"
            >
              {{ view.playerRenameLabel }}
            </button>
          </div>

          <div class="panel-text war-status-bar__summary">{{ view.topOverviewSummary }}</div>

          <div class="war-status-grid">
            <div v-for="item in view.topVitalStats" :key="item.key" class="war-status-grid__item">
              <span class="war-status-grid__icon" v-html="item.icon"></span>
              <div class="war-status-grid__copy">
                <small>{{ item.label }}</small>
                <strong>{{ item.value }}</strong>
                <span>{{ item.short }}</span>
              </div>
            </div>
          </div>

          <div v-if="view.turnOverviewOracleLine" class="war-status-bar__oracle">{{ view.turnOverviewOracleLine }}</div>
        </div>
      </div>
    </header>

    <section v-if="view.showMobileStarterCard" class="mobile-starter card hero-hub__mobile-starter">
      <div class="section-kicker">开始这卷</div>
      <div class="panel-title panel-title--small">{{ view.mobileStarterTitle }}</div>
      <div class="panel-text">{{ view.mobileStarterSummary }}</div>
      <div class="mobile-starter__steps">
        <div v-for="item in view.mobileStarterSteps" :key="item.title" class="mobile-starter__step">
          <strong>{{ item.title }}</strong>
          <span>{{ item.text }}</span>
        </div>
      </div>
      <div class="mobile-starter__actions">
        <button type="button" class="tool-button tool-button--accent" @click="view.jumpToMobileSection('action')">先去落子</button>
        <button type="button" class="tool-button tool-button--subtle" @click="view.scrollToAuthZone">查看账号与试玩</button>
      </div>
      <div v-if="view.setupPhaseChoices.length" class="mobile-starter__choices">
        <button
          v-for="choice in view.setupPhaseChoices"
          :key="`starter-${choice.id}`"
          type="button"
          class="choice-card choice-card--setup mobile-starter__choice"
          :class="{ 'choice-card--disabled': choice.disabled }"
          :disabled="view.interactionBlocked || choice.disabled"
          @click="view.submitChoice(choice)"
        >
          <div class="choice-top">
            <span class="choice-name">{{ choice.text }}</span>
            <div class="choice-tags">
              <span class="choice-source">{{ view.setupChoiceBadge }}</span>
              <span class="choice-category">{{ choice.category || view.setupChoiceCategory }}</span>
            </div>
          </div>
          <div class="choice-hint">{{ choice.hint || '先把这一手定下来。' }}</div>
        </button>
      </div>
    </section>

    <section v-if="view.showMobileStageSwitch" class="mobile-status-strip hero-hub__status-strip">
      <div v-for="item in view.mobileStatusItems" :key="item.key" class="mobile-status-strip__item">
        <span>{{ item.label }}:</span>
        <strong>{{ item.value }}</strong>
      </div>
    </section>

    <section v-if="view.showMobileStageSwitch" class="mobile-stage-switch mobile-stage-switch--compact card">
      <div class="mobile-stage-switch__head">
        <div>
          <div class="section-kicker">手机视图</div>
          <div class="panel-title panel-title--small">{{ view.activeMobileViewMeta.label }}</div>
        </div>
        <div class="panel-text">{{ view.activeMobileViewMeta.summary }}</div>
      </div>
      <div class="mobile-stage-switch__tabs" role="tablist" aria-label="手机工作区切换">
        <button
          v-for="item in view.mobileViewOptions"
          :key="`switch-${item.key}`"
          type="button"
          class="mobile-stage-switch__tab"
          :class="{ active: view.activeMobileView === item.key }"
          @click="view.jumpToMobileSection(item.key)"
        >
          <span>{{ item.label }}</span>
          <small>{{ item.note }}</small>
        </button>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'GameHeroHub',
  props: {
    view: {
      type: Object,
      required: true
    }
  }
};
</script>

<style scoped lang="less">
.hero-hub {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hero-stage {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.92fr);
  gap: 24px;
  overflow: hidden;
}

.hero-stage__backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hero-stage__banner {
  position: absolute;
  inset: 14px;
  border: 1px solid rgba(211, 168, 106, 0.1);
  border-radius: 28px;
  background:
    linear-gradient(135deg, rgba(156, 42, 28, 0.14), transparent 32%),
    linear-gradient(180deg, rgba(222, 187, 130, 0.05), transparent 42%);
}

.hero-stage__sigil {
  position: absolute;
  right: 14px;
  bottom: -10px;
  width: 48%;
  max-width: 420px;
  opacity: 0.84;
  filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.28));
}

.hero-stage__copy,
.hero-stage__aside {
  position: relative;
  z-index: 1;
}

.hero-stage__copy {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hero-stage__aside {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.hero-stage__aside-kicker {
  color: rgba(237, 214, 180, 0.72);
  font-size: 11px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

.title-command-deck__body,
.war-status-bar__summary,
.mobile-starter .panel-text {
  font-size: 13px;
  line-height: 1.7;
}

.title-command-deck__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 12px;
  color: #d6b792;
}

.war-status-bar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(214, 171, 107, 0.14);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.05), rgba(255, 244, 227, 0.02)),
    rgba(19, 16, 16, 0.9);
}

.war-status-bar__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.war-status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.war-status-grid__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: flex-start;
  padding: 12px 12px 11px;
  border: 1px solid rgba(214, 171, 107, 0.12);
  border-radius: 16px;
  background: rgba(255, 244, 227, 0.03);
}

.war-status-grid__icon {
  width: 18px;
  height: 18px;
  color: #e6c38f;
}

.war-status-grid__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.war-status-grid__copy small {
  color: #bda688;
  font-size: 11px;
  letter-spacing: 0.08em;
}

.war-status-grid__copy strong {
  color: #f2dfc2;
  font-size: 15px;
  line-height: 1.35;
}

.war-status-grid__copy span {
  color: #cfb18a;
  font-size: 12px;
  line-height: 1.45;
}

.war-status-bar__oracle {
  padding-left: 12px;
  border-left: 2px solid rgba(214, 171, 107, 0.42);
  color: #dbc19d;
  font-size: 12px;
  line-height: 1.7;
}

.title-utility--top {
  gap: 12px;
}

.title-action-button {
  min-height: 46px;
  font-size: 14px;
  font-weight: 700;
}

.title-action-button--danger {
  border-color: rgba(170, 81, 63, 0.26);
}

.title-action-button--support {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 10px;
  min-height: 54px;
  padding: 9px 12px;
  overflow: visible;
  text-align: left;
}

.title-action-button--support::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(120deg, rgba(255, 226, 179, 0.22), transparent 40%, rgba(255, 226, 179, 0.22));
  opacity: .7;
  pointer-events: none;
}

.title-action-button--support::after {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: inherit;
  border: 1px solid rgba(255, 230, 181, 0.42);
  opacity: 0;
  pointer-events: none;
  animation: supportPulse 2.4s ease-out infinite;
}

.title-action-button__nudge {
  position: absolute;
  top: -11px;
  right: 10px;
  padding: 2px 7px;
  border-radius: 999px;
  color: #724015;
  background: #fff3d5;
  border: 1px solid rgba(221, 160, 81, 0.42);
  font-size: 10px;
  font-weight: 800;
  line-height: 1.5;
  box-shadow: 0 8px 16px rgba(87, 47, 16, 0.16);
}

.support-entry__spark {
  position: relative;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 45% 42%, rgba(255, 255, 255, 0.95) 0 3px, transparent 4px),
    radial-gradient(circle, rgba(80, 185, 111, 0.95), rgba(21, 108, 55, 0.96));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.62),
    0 0 0 5px rgba(75, 190, 115, 0.14),
    0 10px 18px rgba(45, 142, 83, 0.22);
}

.support-entry__spark::after {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: inherit;
  border: 1px solid rgba(79, 209, 129, 0.36);
  animation: supportSpark 2.1s ease-out infinite;
}

.support-entry__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.support-entry__title {
  color: #0f4d2c;
  font-size: 13px;
  font-weight: 850;
  line-height: 1.25;
}

.support-entry__sub {
  color: rgba(29, 95, 57, 0.78);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.35;
  white-space: normal;
}

.support-entry__arrow {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  color: #175d37;
  background: rgba(255,255,255,.58);
  border: 1px solid rgba(87, 177, 119, 0.28);
  font-size: 14px;
  font-weight: 900;
  transition: transform .18s ease, background .18s ease;
}

.title-action-button--support:hover .support-entry__arrow {
  transform: translateY(2px);
  background: rgba(255,255,255,.82);
}

.title-action-button--support.purchase-chip--product-active .support-entry__arrow {
  transform: translateY(-1px);
}

@keyframes supportPulse {
  0% {
    transform: scale(0.98);
    opacity: 0.72;
  }
  70% {
    transform: scale(1.06);
    opacity: 0;
  }
  100% {
    transform: scale(1.06);
    opacity: 0;
  }
}

@keyframes supportSpark {
  0% {
    transform: scale(0.82);
    opacity: 0.66;
  }
  80% {
    transform: scale(1.35);
    opacity: 0;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .title-action-button--support::after,
  .support-entry__spark::after {
    animation: none;
  }
}

@media (max-width: 1024px) {
  .hero-stage {
    grid-template-columns: 1fr;
  }

  .hero-stage__sigil {
    width: 72%;
    max-width: 380px;
  }
}

@media (max-width: 640px) {
  .war-status-grid {
    grid-template-columns: 1fr;
  }

  .hero-stage__sigil {
    width: 82%;
    right: -24px;
    bottom: -18px;
    opacity: 0.76;
  }
}
</style>
