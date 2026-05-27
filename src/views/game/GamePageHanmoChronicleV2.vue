<template>
  <div class="chronicle-page" :class="{ 'chronicle-page--crpg-desktop': !isMobileLayout }">
    <div class="page-shell">
      <ui-modal
        :model-value="donationGuideVisible"
        title="支持作者"
        width="680px"
        @update:modelValue="donationGuideVisible = $event"
      >
        <div class="donation-guide">
          <div class="donation-guide__lead">{{ donationEntry.guideLead }}</div>
          <div class="donation-guide__section">
            <div class="donation-guide__title">打赏会用于</div>
            <div class="donation-guide__list">
              <div v-for="item in donationEntry.usageLines" :key="item" class="donation-guide__item">{{ item }}</div>
            </div>
          </div>
          <div class="donation-guide__section">
            <div class="donation-guide__title">当前支持方式</div>
            <div class="donation-guide__qr-grid">
              <button
                v-for="channel in donationChannels"
                :key="`guide-${channel.key}`"
                type="button"
                class="donation-guide__qr-card"
                @click="setActiveDonationChannel(channel.key)"
              >
                <span class="donation-guide__qr-label">{{ channel.label }}</span>
                <span class="donation-guide__qr-frame">
                  <img
                    v-if="!donationQrLoadFailed[channel.key]"
                    class="donation-guide__qr-image"
                    :src="channel.image"
                    :alt="channel.alt"
                    @error="handleDonationQrError(channel.key)"
                  >
                  <span v-else class="donation-guide__qr-missing">
                    未读取到图片<br>
                    <code>{{ channel.expectedPath }}</code>
                  </span>
                </span>
                <span class="donation-guide__qr-hint">点击切换到{{ channel.label }}收款码</span>
              </button>
            </div>
            <div class="donation-guide__scroll-hint">
              <span>可上下滑动查看完整说明与收款码</span>
              <span>点击任一二维码卡片会同步切换外层打赏面板</span>
            </div>
          </div>
          <div class="donation-guide__section">
            <div class="donation-guide__title">支持前请确认</div>
            <div class="donation-guide__list">
              <div class="donation-guide__item">
                打赏完全自愿，不影响存档、剧情、数值或账号权益。
              </div>
            </div>
          </div>
          <div class="donation-guide__foot">{{ donationEntry.guideFoot }}</div>
        </div>
      </ui-modal>
      <ui-modal
        :model-value="desktopCharacterStatsVisible"
        title="角色属性"
        width="640px"
        @update:modelValue="desktopCharacterStatsVisible = $event"
      >
        <div class="character-stats-dialog">
          <div class="character-stats-dialog__hero">
            <div>
              <div class="character-stats-dialog__name">{{ desktopCharacterStats.name }}</div>
              <div class="character-stats-dialog__meta">{{ desktopCharacterStats.summary }}</div>
            </div>
            <div class="character-stats-dialog__badge">{{ desktopCharacterStats.realm }}</div>
          </div>
          <div class="character-stats-dialog__grid">
            <div
              v-for="item in desktopCharacterStats.items"
              :key="item.key"
              class="character-stats-dialog__item"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <small>{{ item.tip }}</small>
            </div>
          </div>
        </div>
      </ui-modal>
      <ui-modal
        :model-value="authDialogVisible"
        :title="currentUser ? '账号状态' : authActionTitle"
        width="520px"
        @update:modelValue="authDialogVisible = $event"
      >
        <div class="auth-dialog">
          <template v-if="currentUser">
            <div class="auth-dialog__identity">
              <div class="section-kicker">当前账号</div>
              <div class="panel-title panel-title--small">{{ currentUser.displayName || currentUser.username }}</div>
              <div class="panel-text">{{ accessStatusText }}</div>
            </div>
            <div class="auth-dialog__actions">
              <button type="button" class="tool-button tool-button--subtle" @click="authDialogVisible = false">继续游戏</button>
              <button type="button" class="tool-button tool-button--danger" @click="logout">退出登录</button>
            </div>
          </template>
          <template v-else>
            <div class="panel-text">{{ authActionSummary }}</div>
            <input v-model.trim="authForm.username" class="native-auth-input native-auth-input--dialog" type="text" placeholder="用户名，3-24 位字母数字下划线">
            <input v-if="authMode === 'register'" v-model.trim="authForm.displayName" class="native-auth-input native-auth-input--dialog" type="text" placeholder="显示名称，可留空">
            <input v-model="authForm.password" class="native-auth-input native-auth-input--dialog" type="password" placeholder="密码，至少 6 位" @keyup.enter="submitAuth">
            <div class="auth-dialog__actions">
              <button type="button" class="tool-button tool-button--accent" :disabled="authLoading" @click="submitAuth">
                {{ authLoading ? '提交中…' : (authMode === 'login' ? '登录并进入游戏' : '注册并开始试玩') }}
              </button>
              <button type="button" class="tool-button tool-button--subtle" :disabled="authLoading" @click="authMode = authMode === 'login' ? 'register' : 'login'">
                {{ authMode === 'login' ? '切到注册' : '切到登录' }}
              </button>
            </div>
          </template>
        </div>
      </ui-modal>
      <game-hero-hub v-if="isMobileLayout" :view="heroHubViewModel" />

      <div
        v-if="!isMobileLayout && desktopRenderError"
        class="desktop-render-fallback card"
      >
        <div class="section-kicker">桌面布局异常</div>
        <div class="zone-title">CRPG 布局渲染失败</div>
        <div class="panel-text">{{ desktopRenderError.message }}</div>
        <div v-if="desktopRenderError.info" class="status-tip">{{ desktopRenderError.info }}</div>
      </div>

      <crpg-layout
        v-else-if="!isMobileLayout"
        :title="crpgDesktopBridge.title"
        chapter-label="乱世卷册"
        :time-label="crpgDesktopBridge.timeLabel"
        :turn-label="crpgDesktopBridge.turnLabel"
        :system-items="crpgDesktopBridge.systemItems"
        :support-entry="crpgDesktopBridge.supportEntry"
        command-title="军令簿"
        :command-subtitle="crpgDesktopBridge.commandSubtitle"
        :command-groups="crpgDesktopBridge.commandGroups"
        :active-group-key="crpgDesktopBridge.activeGroupKey"
        :narrative="crpgDesktopBridge.narrative"
        :character="crpgDesktopBridge.character"
        :is-narrative-loading="crpgDesktopBridge.isNarrativeLoading"
        @system-action="handleCrpgSystemAction"
        @group-toggle="handleCrpgGroupToggle"
        @action-select="handleCrpgActionSelect"
        @story-click="handleStoryBodyClick"
      />

      <section v-if="!currentUser" ref="authZone" class="auth-entry card">
        <div class="zone-head">
          <div>
            <div class="section-kicker">账号与解锁</div>
            <div class="zone-title">{{ authActionTitle }}</div>
            <div class="story-meta">{{ authActionSummary }}</div>
          </div>
        </div>

        <div class="auth-entry-grid">
          <div class="auth-entry-card">
            <div class="panel-title panel-title--small">进入方式</div>
            <div class="panel-text">{{ authReady ? '不登录也能直接游玩；需要续接更多试玩回合时再登录或注册。' : '正在尝试恢复本地登录态，同时你也可以直接手动登录。' }}</div>
            <div class="panel-text" v-if="snapshot.playAccess && snapshot.playAccess.isGuest">{{ accessStatusText }}</div>
            <input v-model.trim="authForm.username" class="native-auth-input" type="text" placeholder="用户名，3-24 位字母数字下划线">
            <input v-if="authMode === 'register'" v-model.trim="authForm.displayName" class="native-auth-input" type="text" placeholder="显示名称，可留空">
            <input v-model="authForm.password" class="native-auth-input" type="password" placeholder="密码，至少 6 位" @keyup.enter="submitAuth">
            <div class="auth-actions">
              <button type="button" class="tool-button auth-native-btn" :disabled="authLoading" @click="submitAuth">
                {{ authLoading ? '提交中…' : (authMode === 'login' ? '登录并进入游戏' : '注册并开始试玩') }}
              </button>
              <button type="button" class="tool-button auth-native-btn" @click="authMode = authMode === 'login' ? 'register' : 'login'">
                {{ authMode === 'login' ? '切到注册' : '切到登录' }}
              </button>
            </div>
          </div>

          <div v-if="!isMobileLayout" class="auth-entry-card auth-entry-card--guide">
            <div class="panel-title panel-title--small">试玩与权益节奏</div>
            <div class="auth-benefit-list">
              <div class="auth-benefit">
                <span>匿名试玩</span>
                <strong>先走 10 回</strong>
              </div>
              <div class="auth-benefit">
                <span>注册账号</span>
                <strong>累计 30 回</strong>
              </div>
              <div class="auth-benefit">
                <span>测试账号</span>
                <strong>{{ adminSeed.username }} / {{ adminSeed.password }}</strong>
              </div>
            </div>
            <div class="panel-text">普通账号和测试账号登录后都走同一套前台界面，不再分出独立管理页。</div>
            <div class="panel-text">付费回合包与月卡入口统一收进顶部权益舱，账号状态、续玩和开卡放在同一块里处理。</div>
            <div class="status-tip">如果这里能看到，说明页面本身已经加载成功；完成登录后会自动创建或接续当前存档并进入可操作状态。</div>
          </div>
        </div>
        <button
          v-if="isMobileLayout"
          type="button"
          class="tool-button tool-button--subtle auth-guide-toggle"
          @click="mobileAuthGuideExpanded = true"
        >
          展开试玩说明
        </button>
      </section>

      <div v-if="isMobileLayout" class="main-grid" :class="{ 'main-grid--mobile-staged': isMobileLayout }">
        <div class="primary-column">
          <transition name="mobile-view" mode="out-in" @after-enter="handleMobileViewAfterEnter('story')">
          <section v-if="showStorySection" ref="storyZone" key="story-view" class="story-zone card" :class="{ 'story-zone--immersive': storyChromeHidden }">
            <div class="zone-head story-zone__head">
              <div>
                <div class="section-kicker">剧情演绎区</div>
                <div class="story-timehead">{{ snapshot.world.dateLabel || '建安元年 春 二月' }}</div>
                <div class="zone-title">{{ snapshot.scene.title || '正文未起' }}</div>
                <div class="story-meta">{{ snapshot.scene.statusLine || '局势正在等待我落下下一步。' }}</div>
              </div>
            </div>

            <div v-if="isMobileLayout" class="story-briefing story-briefing--mobile">
              <div class="story-briefing__tabs">
                <button
                  v-for="item in mobileStoryPanelOptions"
                  :key="item.key"
                  type="button"
                  class="story-briefing__tab"
                  :class="{ active: activeMobileStoryPanel === item.key }"
                  @click="activeMobileStoryPanel = item.key"
                >
                  <span>{{ item.label }}</span>
                  <small>{{ item.note }}</small>
                </button>
              </div>
              <div class="story-briefing__summary-ribbon">
                <div v-for="item in storySummaryRibbon" :key="item.key" class="story-briefing__summary-pill">
                  <small>{{ item.label }}</small>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
              <div v-if="activeMobileStoryPanel === 'mainline'" class="story-briefing__card">
                <div class="story-briefing__card-head">
                  <div>
                    <div class="section-kicker">主线态势</div>
                    <div class="panel-title panel-title--small">{{ currentMainline.title }}</div>
                  </div>
                  <button type="button" class="story-briefing__card-toggle" @click="toggleStoryPanelExpanded('mainline')">
                    {{ storyPanelExpanded.mainline ? '收起' : '展开' }}
                  </button>
                </div>
                <div class="story-briefing__hero-copy">{{ currentMainline.summary }}</div>
                <div class="story-briefing__inline-facts">
                  <span v-for="item in mainlineInlineFacts" :key="item.label">{{ item.label }} {{ item.value }}</span>
                </div>
                <div v-if="storyPanelExpanded.mainline" class="story-briefing__foldout">
                  <div class="story-briefing__fact-list">
                    <div v-for="item in mainlineExpandedFacts" :key="item.key" class="story-briefing__fact-line">
                      <span>{{ item.label }}</span>
                      <strong>{{ item.value }}</strong>
                    </div>
                  </div>
                  <div class="story-briefing__status-ribbon">眼下隐患：{{ currentMainline.crisis }}</div>
                </div>
              </div>
              <div v-else class="story-briefing__card">
                <div class="story-briefing__card-head">
                  <div>
                    <div class="section-kicker">此刻局势</div>
                    <div class="panel-title panel-title--small">{{ currentMomentPanel.title }}</div>
                  </div>
                  <button type="button" class="story-briefing__card-toggle" @click="toggleStoryPanelExpanded('status')">
                    {{ storyPanelExpanded.status ? '收起' : '展开' }}
                  </button>
                </div>
                <div class="story-briefing__hero-copy">{{ currentMomentPanel.summary }}</div>
                <div class="story-briefing__inline-facts story-briefing__inline-facts--status">
                  <span v-for="item in currentMomentInlineFacts" :key="item.label">{{ item.label }} {{ item.value }}</span>
                </div>
                <div v-if="storyPanelExpanded.status" class="story-briefing__foldout">
                  <div class="story-briefing__moment-grid">
                    <div v-for="item in currentMomentPanel.items" :key="item.key" class="story-briefing__moment-card">
                      <span>{{ item.label }}</span>
                      <strong>{{ item.value }}</strong>
                      <small>{{ item.note }}</small>
                    </div>
                  </div>
                  <div class="story-briefing__status-ribbon story-briefing__status-ribbon--status">{{ currentMomentPanel.note }}</div>
                </div>
                <div class="status-notes" v-if="quickHints.length">
                  <span v-for="item in quickHints" :key="item">{{ item }}</span>
                </div>
                <div v-if="showCondensedSnapshot" class="story-briefing__summary-strip">
                  <div class="story-briefing__summary-head">
                    <strong>{{ stageSnapshotTitle }}</strong>
                    <span>{{ stageSnapshotMetaLabel }}</span>
                  </div>
                  <div class="panel-text">{{ stageSnapshotSummary }}</div>
                  <div class="status-notes">
                    <span v-for="item in stageSnapshotNotes" :key="item">{{ item }}</span>
                  </div>
                </div>
                <div v-else-if="!quickHints.length" class="status-tip">暂无额外风险提示</div>
              </div>
            </div>

            <div v-else class="story-briefing">
              <div class="story-briefing__card story-briefing__card--mainline">
                <div class="story-briefing__card-head">
                  <div>
                    <div class="section-kicker">主线态势</div>
                    <div class="panel-title panel-title--small">{{ currentMainline.title }}</div>
                  </div>
                  <button type="button" class="story-briefing__card-toggle" @click="toggleStoryPanelExpanded('mainline')">
                    {{ storyPanelExpanded.mainline ? '收起' : '展开' }}
                  </button>
                </div>
                <div class="story-briefing__hero-copy">{{ currentMainline.summary }}</div>
                <div class="story-briefing__inline-facts">
                  <span v-for="item in mainlineInlineFacts" :key="item.label">{{ item.label }} {{ item.value }}</span>
                </div>
                <div v-if="storyPanelExpanded.mainline" class="story-briefing__foldout">
                  <div class="story-briefing__fact-list">
                    <div v-for="item in mainlineExpandedFacts" :key="item.key" class="story-briefing__fact-line">
                      <span>{{ item.label }}</span>
                      <strong>{{ item.value }}</strong>
                    </div>
                  </div>
                  <div class="story-briefing__status-ribbon">眼下隐患：{{ currentMainline.crisis }}</div>
                </div>
              </div>
              <div class="story-briefing__card story-briefing__card--status">
                <div class="story-briefing__card-head">
                  <div>
                    <div class="section-kicker">此刻局势</div>
                    <div class="panel-title panel-title--small">{{ currentMomentPanel.title }}</div>
                  </div>
                  <button type="button" class="story-briefing__card-toggle" @click="toggleStoryPanelExpanded('status')">
                    {{ storyPanelExpanded.status ? '收起' : '展开' }}
                  </button>
                </div>
                <div class="story-briefing__hero-copy">{{ currentMomentPanel.summary }}</div>
                <div class="story-briefing__inline-facts story-briefing__inline-facts--status">
                  <span v-for="item in currentMomentInlineFacts" :key="item.label">{{ item.label }} {{ item.value }}</span>
                </div>
                <div v-if="storyPanelExpanded.status" class="story-briefing__foldout">
                  <div class="story-briefing__moment-grid">
                    <div v-for="item in currentMomentPanel.items" :key="item.key" class="story-briefing__moment-card">
                      <span>{{ item.label }}</span>
                      <strong>{{ item.value }}</strong>
                      <small>{{ item.note }}</small>
                    </div>
                  </div>
                  <div class="story-briefing__status-ribbon story-briefing__status-ribbon--status">{{ currentMomentPanel.note }}</div>
                </div>
                <div class="status-notes" v-if="quickHints.length">
                  <span v-for="item in quickHints" :key="item">{{ item }}</span>
                </div>
                <div v-else class="status-tip">局势眼下没有额外枝节提醒。</div>
              </div>
            </div>

            <div v-if="showCondensedSnapshot" class="story-briefing-summary card">
              <div class="story-briefing-summary__head">
                <div>
                  <div class="section-kicker">局面摘记</div>
                  <div class="panel-title panel-title--small">{{ stageSnapshotTitle }}</div>
                </div>
                <div class="story-briefing-summary__badge">{{ stageSnapshotMetaLabel }}</div>
              </div>
              <div class="panel-text">{{ stageSnapshotSummary }}</div>
              <div class="status-notes story-briefing-summary__notes">
                <span v-for="item in stageSnapshotNotes" :key="item">{{ item }}</span>
              </div>
            </div>

            <div v-if="recentBattleReturnCard" class="battle-return-card">
              <div class="battle-return-card__head">
                <div>
                  <div class="section-kicker">战局回流</div>
                  <div class="panel-title panel-title--small">{{ recentBattleReturnCard.title }}</div>
                </div>
                <div class="choice-category">{{ recentBattleReturnCard.mode }}</div>
              </div>
              <div class="panel-text">{{ recentBattleReturnCard.summary }}</div>
              <div class="battle-return-card__meta">
                <span>{{ recentBattleReturnCard.scale }}</span>
                <span>我方战力 {{ recentBattleReturnCard.playerStrength }}</span>
                <span>敌方战力 {{ recentBattleReturnCard.enemyStrength }}</span>
                <span>折损 {{ recentBattleReturnCard.casualties }}</span>
                <span>耗粮 {{ recentBattleReturnCard.supplyCost }}</span>
              </div>
            </div>

            <div
              ref="storyScroll"
              class="story-scroll"
              :class="{ 'is-dragging': storyDragging }"
              @scroll.passive="handleStoryScroll"
              @mousedown="beginStoryDrag"
              @mousemove="onStoryDrag"
              @mouseup="endStoryDrag"
              @mouseleave="endStoryDrag"
              @touchstart="beginStoryTouchDrag"
              @touchmove.prevent="onStoryTouchDrag"
              @touchend="endStoryDrag"
            >
              <div v-if="narrationStreaming && waitingForNarration" class="story-waiting">
                <span class="story-waiting-dot"></span>
                <span class="story-waiting-dot"></span>
                <span class="story-waiting-dot"></span>
                <span>正在等待正文起笔…</span>
              </div>
              <div class="story-body story-body--enhanced" v-html="renderedStoryHtml" @click="handleStoryBodyClick"></div>
              <span class="story-type-caret" :class="{ 'story-type-caret--active': aiLoading || typewriterStoryText !== displayedStoryText }"></span>
              <div v-if="showStoryStreamTail" class="story-stream-tail">
                <span class="story-waiting-dot"></span>
                <span class="story-waiting-dot"></span>
                <span class="story-waiting-dot"></span>
                <span>{{ waitingForNarration ? '仍在等待正文首段…' : '正文仍在继续落下，后面还有内容。' }}</span>
              </div>
            </div>

            <button
              v-if="isMobileLayout"
              type="button"
              class="tool-button tool-button--subtle story-tools-toggle"
              :disabled="interactionBlocked"
              @click="mobileStoryToolsExpanded = !mobileStoryToolsExpanded"
            >
              {{ mobileStoryToolsExpanded ? '收起卷册工具' : '展开卷册工具' }}
            </button>

            <div v-if="!isMobileLayout || mobileStoryToolsExpanded" class="story-tools">
              <button class="tool-button story-tool" :disabled="interactionBlocked" @click="openOverlay('map')">文字地图</button>
              <button class="tool-button story-tool" :disabled="interactionBlocked" @click="openOverlay('relations')">人物关系簿</button>
              <button class="tool-button story-tool" :disabled="interactionBlocked" @click="openOverlay('skills')">技能簿</button>
              <button class="tool-button story-tool" :disabled="interactionBlocked" @click="openOverlay('factions')">势力版图</button>
              <button class="tool-button story-tool" :disabled="interactionBlocked" @click="openOverlay('memo')">局势备忘</button>
            </div>

            <div v-if="showStoryArchiveCard" class="story-archive">
              <div class="story-archive-head">
                <div>
                  <div class="section-kicker">上一回归档</div>
                  <div class="panel-title panel-title--small">{{ latestArchivedStory.title || '上一回' }}</div>
                  <div class="status-tip">{{ latestArchivedStory.statusLine || latestArchivedStory.dateLabel || '上一回正文已归档' }}</div>
                </div>
              </div>
              <div class="story-archive-body">{{ latestArchivedStory.text }}</div>
            </div>

            <div v-if="isMobileLayout && activeMobileView === 'story'" class="mobile-story-actions">
              <button
                v-if="snapshot.world.phase === 'playing'"
                type="button"
                class="mobile-continue-button"
                :disabled="interactionBlocked"
                @click="jumpToMobileSection('action')"
              >
                继续
              </button>
              <button
                v-else
                type="button"
                class="mobile-continue-button mobile-continue-button--secondary"
                :disabled="interactionBlocked"
                @click="jumpToMobileSection('action')"
              >
                去落子
              </button>
            </div>
          </section>
          </transition>

          <transition name="mobile-view" mode="out-in" @after-enter="handleMobileViewAfterEnter('action')">
          <section v-if="showOperationSection" ref="operationZone" key="action-view" class="operation-zone card">
            <div class="zone-head">
              <div>
                <div class="section-kicker">落子</div>
                <div class="zone-title">{{ phasePrompt }}</div>
                <div v-if="phaseDescription" class="story-meta">{{ phaseDescription }}</div>
              </div>
            </div>
            <div v-if="showOperationHeadStrip" ref="operationSuggestionAnchor" class="operation-head-strip">
              <div class="operation-head-strip__lead">
                <span class="operation-head-strip__badge">当前建议</span>
                <strong>{{ operationHeadTitle }}</strong>
              </div>
              <div class="operation-head-strip__meta">{{ operationHeadSummary }}</div>
            </div>

            <div v-if="interactionLocked" class="ending-panel">
              <div class="ending-grid">
                <div class="ending-card ending-card--tree">
                  <div class="section-kicker">胜利结局树</div>
                  <div class="panel-title panel-title--small">{{ endingTreeLabel }}</div>
                  <div class="panel-text">{{ snapshot.gameState.endingSummary || '这一卷已经收束。' }}</div>
                  <div class="status-notes">
                    <span v-for="tag in endingTags" :key="tag">{{ tag }}</span>
                    <span v-if="!endingTags.length">结局已定</span>
                  </div>
                </div>
                <div class="ending-card">
                  <div class="section-kicker">生平总结</div>
                  <div class="panel-text">{{ endingBiography }}</div>
                </div>
                <div class="ending-card">
                  <div class="section-kicker">结局点评</div>
                  <div class="panel-text">{{ endingCommentary }}</div>
                </div>
                <div v-if="endingRouteAuditCard" class="ending-card">
                  <div class="section-kicker">终局回看</div>
                  <div class="panel-title panel-title--small">{{ endingRouteAuditCard.title }}</div>
                  <div class="panel-text">{{ endingRouteAuditCard.summary }}</div>
                  <div v-if="endingRouteAuditCard.noteLines && endingRouteAuditCard.noteLines.length" class="status-notes gate-card-notes">
                    <span v-for="item in endingRouteAuditCard.noteLines" :key="`ending-gate-note-${item}`">{{ item }}</span>
                  </div>
                  <div class="gate-checklist">
                    <div
                      v-for="item in endingRouteAuditCard.items"
                      :key="`ending-gate-${item.key}`"
                      class="gate-checklist__item"
                      :class="{ 'gate-checklist__item--done': item.done }"
                    >
                      <div class="gate-checklist__head">
                        <strong>{{ item.done ? '已达成' : '未达成' }}</strong>
                        <span>{{ item.label }}</span>
                      </div>
                      <small>{{ item.status }}</small>
                    </div>
                  </div>
                </div>
                <div v-if="martialApexEndingAuditCard" class="ending-card">
                  <div class="section-kicker">巅峰危机回看</div>
                  <div class="panel-title panel-title--small">{{ martialApexEndingAuditCard.title }}</div>
                  <div class="panel-text">{{ martialApexEndingAuditCard.summary }}</div>
                  <div class="status-notes">
                    <span>威胁 {{ martialApexState.threat }}</span>
                    <span>暴露 {{ martialApexState.exposure }}</span>
                    <span>负担 {{ martialApexState.burden }}</span>
                  </div>
                  <div class="gate-checklist">
                    <div
                      v-for="item in martialApexEndingAuditCard.items"
                      :key="`ending-apex-${item.key}`"
                      class="gate-checklist__item"
                      :class="{ 'gate-checklist__item--done': item.done }"
                    >
                      <strong>{{ item.done ? '已接住' : '未接住' }}</strong>
                      <span>{{ item.label }}</span>
                      <small>{{ item.status }}</small>
                    </div>
                  </div>
                </div>
                <div class="ending-card ending-card--inherit">
                  <div class="section-kicker">余韵继承</div>
                  <div class="panel-text">{{ endingInheritanceSummary }}</div>
                  <div class="ending-actions">
                    <ui-button variant="warning" :disabled="aiLoading" @click="resetGame">重开此卷</ui-button>
                    <ui-button variant="primary" :disabled="aiLoading || !endingCanInherit" @click="inheritGame">继承余韵重开</ui-button>
                  </div>
                </div>
              </div>
            </div>

            <template v-else>
              <div v-if="turnProcessingState" class="turn-processing-banner" :class="{ 'turn-processing-banner--battle': turnProcessingState.kind === 'battle' }">
                <div class="turn-processing-banner__head">
                  <div>
                    <div class="section-kicker">处理中</div>
                    <div class="panel-title panel-title--small">{{ turnProcessingState.title }}</div>
                  </div>
                  <div class="choice-category">{{ turnProcessingState.badge }}</div>
                </div>
                <div class="panel-text">{{ turnProcessingState.detail }}</div>
                <div class="status-notes">
                  <span v-for="item in turnProcessingState.notes" :key="item">{{ item }}</span>
                </div>
              </div>
              <div class="choice-stack" :class="{ 'choice-stack--locked': interactionBlocked }">
                <div v-if="inBattle" class="choice-group battle-group">
                  <div class="choice-group-head choice-group-head--stacked">
                    <div>
                      <div class="section-kicker">战斗操作区</div>
                      <div class="panel-title panel-title--small">{{ battleModeLabel }}</div>
                    </div>
                    <div class="choice-group-note">{{ battleModeSummary }}</div>
                  </div>

                  <div class="battle-stage">
                    <div class="battle-stage__overview">
                      <div class="battle-side battle-side--player">
                        <div class="section-kicker">我方</div>
                        <div class="panel-title panel-title--small">{{ activeBattle.mode === 'duel' ? (snapshot.gameState.name || '我') : '我方军阵' }}</div>
                        <div class="battle-meters">
                          <div v-for="row in battlePlayerRows" :key="`player-${row.key}`" class="battle-meter">
                            <div class="battle-meter__head">
                              <span>{{ row.label }}</span>
                              <strong>{{ row.value }}</strong>
                            </div>
                            <div class="progress-track mini-track">
                              <div class="progress-bar" :class="row.barClass" :style="{ width: row.percent + '%' }"></div>
                            </div>
                            <div v-if="row.tip" class="status-tip">{{ row.tip }}</div>
                          </div>
                        </div>
                      </div>

                      <div class="battle-center">
                        <div class="section-kicker">{{ activeBattle.variant === 'sparring' ? '主界面切磋' : '主界面战局' }}</div>
                        <div class="panel-title panel-title--small">{{ activeBattle.targetName || '未知对手' }}</div>
                        <div class="status-tip">第 {{ activeBattle.round }} 回合 / 最多 {{ activeBattle.maxRounds }} 回合</div>
                        <div class="status-tip" v-if="activeBattle.scaleLabel">{{ activeBattle.scaleLabel }}</div>
                        <div class="battle-center__tip">{{ battleCenterTip }}</div>
                      </div>

                      <div class="battle-side battle-side--enemy">
                        <div class="section-kicker">敌方</div>
                        <div class="panel-title panel-title--small">{{ activeBattle.targetName || '未知对手' }}</div>
                        <div class="battle-meters">
                          <div v-for="row in battleEnemyRows" :key="`enemy-${row.key}`" class="battle-meter">
                            <div class="battle-meter__head">
                              <span>{{ row.label }}</span>
                              <strong>{{ row.value }}</strong>
                            </div>
                            <div class="progress-track mini-track">
                              <div class="progress-bar" :class="row.barClass" :style="{ width: row.percent + '%' }"></div>
                            </div>
                            <div v-if="row.tip" class="status-tip">{{ row.tip }}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="battle-stage__body">
                      <div ref="battleRoundZone" class="battle-log-card battle-round-card">
                        <div class="battle-round-card__head">
                          <div>
                            <div class="section-kicker">{{ activeBattle.mode === 'duel' ? '回合演绎' : '战场演绎' }}</div>
                            <div class="panel-title panel-title--small">{{ activeBattle.mode === 'duel' ? '这一招拆成了什么样' : '这一道军令在场上掀起了什么' }}</div>
                          </div>
                          <div class="choice-category">{{ activeBattle.mode === 'duel' ? '逐招结算' : '逐回合推进' }}</div>
                        </div>
                        <div v-if="activeBattle.lastRoundSummary" class="panel-text battle-round-highlight">{{ activeBattle.lastRoundSummary }}</div>
                        <div v-else class="panel-text">战局刚刚拉开，第一手还没真正落下。</div>
                        <div v-if="battleLogEntries.length" class="battle-log-list">
                          <div v-for="entry in battleLogEntries" :key="`battle-log-${entry.round}`" class="battle-log-row">
                            <div class="battle-log-head">
                              <strong>第 {{ entry.round }} 回合</strong>
                              <span>{{ entry.playerLabel }} / {{ entry.enemyLabel }}</span>
                            </div>
                            <div class="status-tip">{{ entry.summary }}</div>
                          </div>
                        </div>
                      </div>

                      <div class="battle-command-card">
                        <div class="panel-title panel-title--small">在这里继续出手</div>
                        <div class="choice-group-note">{{ activeBattle.mode === 'duel' ? '点一手就会立刻在主界面结算这一回合；切磋结束前不会跳回剧情。' : '阵型、军令、计策和主将动作都会在这里逐回合结算，战局结束后才会回到剧情演绎。' }}</div>
                        <div class="battle-command-grid">
                          <button
                            v-for="choice in battleCommandChoices"
                            :key="`${choice.source || 'fixed'}::${choice.id}`"
                            class="choice-card battle-command-button"
                            :class="{ 'choice-card--disabled': choice.disabled }"
                            :disabled="interactionBlocked || choice.disabled"
                            @click="submitChoice(choice)"
                          >
                            <div class="choice-top">
                              <span class="choice-name">{{ choice.text }}</span>
                              <div class="choice-tags">
                                <span class="choice-category">{{ choice.category || '战斗' }}</span>
                              </div>
                            </div>
                            <div class="choice-hint">{{ choice.hint || '直接执行这一手。' }}</div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <action-deck ref="actionDeck" :view="actionDeckViewModel" />
              </div>
            </template>
          </section>
          </transition>
        </div>

        <transition name="sheet-fade">
          <div
            v-if="isMobileLayout && (showIntelSection || mobileAuthGuideExpanded)"
            class="mobile-sheet-mask"
            @click="closeMobileSheet"
          ></div>
        </transition>

        <aside v-show="showIntelSection" ref="intelZone" class="ability-zone" :class="{ 'ability-zone--sheet': isMobileLayout }">
          <section v-if="!isMobileLayout" class="side-dashboard">
            <div class="side-dashboard__hero">
              <div class="side-dashboard__hero-copy">
                <div class="section-kicker">状态总览</div>
                <div class="side-dashboard__hero-title">{{ snapshot.gameState.martialRealm || '未入流' }} · {{ currentCityAuthorityLabel }}</div>
                <div class="side-dashboard__hero-text">{{ snapshot.gameState.strategyRouteSummary || snapshot.gameState.martialRouteSummary || currentCityAuthoritySummary }}</div>
              </div>
              <div class="side-dashboard__hero-badges">
                <span>{{ snapshot.world.currentCityName || '城池未定' }}</span>
                <span>第 {{ snapshot.world.turn || 0 }} 回</span>
                <span>{{ snapshot.gameState.identity || '布衣' }}</span>
              </div>
            </div>
            <div v-for="group in sideStatusGroups" :key="group.key" class="side-dashboard__group">
              <div class="side-dashboard__group-head">
                <div class="side-dashboard__title">{{ group.title }}</div>
                <div class="side-dashboard__group-count">{{ group.items.length }} 项</div>
              </div>
              <div class="side-dashboard__metric-grid">
                <div v-for="item in group.items" :key="`${group.key}-${item.key}`" class="side-dashboard__metric-card">
                  <div class="side-dashboard__metric-top">
                    <div class="side-dashboard__label">{{ item.label }}</div>
                    <div
                      v-if="item.delta"
                      class="side-dashboard__delta"
                      :class="{ 'side-dashboard__delta--positive': item.delta.positive, 'side-dashboard__delta--negative': !item.delta.positive }"
                    >
                      {{ item.delta.value }}
                    </div>
                  </div>
                  <div class="side-dashboard__value-row">
                    <div class="side-dashboard__value">{{ item.value }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="side-dashboard__group side-dashboard__group--industry">
              <div class="side-dashboard__group-head">
                <div class="side-dashboard__title">{{ sideIndustrySummary.title }}</div>
                <div class="side-dashboard__group-count">{{ sideIndustrySummary.headline }}</div>
              </div>
              <div class="side-dashboard__industry-intro">{{ sideIndustrySummary.tone }}</div>
              <div class="side-dashboard__industry-list">
                <div
                  v-for="metric in sideIndustrySummary.metrics"
                  :key="metric.key"
                  class="side-dashboard__industry-row"
                >
                  <div class="side-dashboard__industry-copy">
                    <strong>{{ metric.label }}</strong>
                    <span>{{ metric.note }}</span>
                  </div>
                  <div class="side-dashboard__industry-value">{{ metric.value }}</div>
                </div>
              </div>
            </div>
          </section>

          <section v-if="isMobileLayout" class="card intel-hub">
            <div class="mobile-sheet-handle"></div>
            <div class="zone-head">
              <div>
                <div class="section-kicker">情报舱</div>
                <div class="zone-title">{{ activeIntelMeta.label }}</div>
                <div class="story-meta">{{ activeIntelMeta.summary }}</div>
              </div>
              <button type="button" class="tool-button tool-button--subtle mobile-sheet-close" @click="closeMobileSheet">收起</button>
            </div>

            <div class="intel-tabs" :class="{ 'intel-tabs--mobile-text': isMobileLayout }">
              <button
                v-for="tab in intelTabs"
                :key="tab.key"
                class="intel-tab"
                :class="{ active: activeIntelTab === tab.key }"
                @click="activeIntelTab = tab.key"
              >
                {{ tab.label }}
              </button>
            </div>

            <div class="intel-scroll">
              <template v-if="activeIntelTab === 'people'">
                <div class="intel-card">
                  <div class="section-kicker">史势线索</div>
                  <div class="panel-title panel-title--small">{{ historicalClueSummary }}</div>
                  <div v-if="historicalClueCards.length" class="intel-list">
                    <div v-for="item in historicalClueCards" :key="item.id" class="intel-list__item">
                      <strong>{{ item.name }} · {{ item.title }} · {{ item.stageLabel }}</strong>
                      <span>{{ item.summary }}</span>
                      <span class="status-tip">{{ item.recommendation }}</span>
                    </div>
                  </div>
                  <div v-else class="panel-text">{{ historicalClueEmptyText }}</div>
                </div>
                <div class="intel-card">
                  <div class="section-kicker">已入接触面人物</div>
                  <div v-if="relationBookEntries.length" class="intel-list">
                    <div v-for="relation in relationBookEntries.slice(0, 6)" :key="relation.id || relation.name" class="intel-list__item">
                      <strong>{{ relation.name }} · {{ relation.title || '人物' }}</strong>
                      <span>{{ relationVisibilityLabel(relation) }} · 好感 {{ relation.favorScore !== undefined ? relation.favorScore : deriveFavorScore(relation) }} · 信 {{ relation.trust || 0 }} · 忠 {{ relation.loyalty || 0 }}</span>
                      <span class="status-tip">{{ relation.summary || relation.status || '这一页还没有更多记录。' }}</span>
                    </div>
                  </div>
                  <div v-else class="panel-text">眼下我还没有真正掌住谁的线索。</div>
                </div>
                <div v-if="romanceProgressCard" class="intel-card">
                  <div class="section-kicker">恋爱线</div>
                  <div class="panel-title panel-title--small">{{ romanceProgressCard.headline }}</div>
                  <div class="panel-text">{{ romanceProgressCard.summary }}</div>
                  <div class="panel-text">{{ romanceProgressCard.progressLine }}</div>
                  <div class="panel-text">{{ romanceProgressCard.nextLine }}</div>
                  <div v-if="romanceProgressCard.riskLine" class="status-tip">{{ romanceProgressCard.riskLine }}</div>
                </div>
              </template>

              <template v-else-if="activeIntelTab === 'factions'">
                <div v-if="worldPerceptionCard" class="intel-card">
                  <div class="section-kicker">众生解读</div>
                  <div class="panel-title panel-title--small">{{ worldPerceptionCard.headline }}</div>
                  <div class="panel-text">{{ worldPerceptionCard.summary }}</div>
                  <div v-for="line in worldPerceptionCard.signalLines" :key="line" class="panel-text">{{ line }}</div>
                  <div v-for="line in worldPerceptionCard.beatLines" :key="line" class="status-tip">{{ line }}</div>
                  <div class="status-tip">{{ worldPerceptionCard.intensityLine }}</div>
                </div>
                <div v-if="worldFermentationCard" class="intel-card">
                  <div class="section-kicker">幕后发酵</div>
                  <div class="panel-title panel-title--small">{{ worldFermentationCard.headline }}</div>
                  <div class="panel-text">{{ worldFermentationCard.summary }}</div>
                  <div v-for="line in worldFermentationCard.signalLines" :key="line" class="panel-text">{{ line }}</div>
                  <div class="status-tip">{{ worldFermentationCard.heatLine }}</div>
                </div>
                <div v-if="dramaticMemoCard" class="intel-card">
                  <div class="section-kicker">戏剧余波</div>
                  <div class="panel-title panel-title--small">当前戏眼</div>
                  <div class="panel-text">{{ dramaticMemoCard.question }}</div>
                  <div v-if="dramaticMemoCard.planLine" class="panel-text">{{ dramaticMemoCard.planLine }}</div>
                  <div v-for="line in dramaticMemoCard.residueLines" :key="line" class="status-tip">{{ line }}</div>
                </div>
                <div v-if="martialApexDisplayCard" class="intel-card intel-card--apex">
                  <div class="section-kicker">武力巅峰</div>
                  <div class="panel-title panel-title--small">{{ martialApexDisplayCard.title }}</div>
                  <div class="panel-text">{{ martialApexDisplayCard.summary }}</div>
                  <div class="status-notes">
                    <span>威胁 {{ martialApexState.threat }}</span>
                    <span>暴露 {{ martialApexState.exposure }}</span>
                    <span>负担 {{ martialApexState.burden }}</span>
                    <span>{{ martialApexRouteLabel }}</span>
                  </div>
                  <div v-if="martialApexDisplayCard.note" class="status-tip">{{ martialApexDisplayCard.note }}</div>
                  <div v-if="martialApexCrisisChecklist.length" class="gate-checklist">
                    <div
                      v-for="item in martialApexCrisisChecklist"
                      :key="`apex-live-${item.key}`"
                      class="gate-checklist__item"
                      :class="{ 'gate-checklist__item--done': item.done }"
                    >
                      <strong>{{ item.done ? '已接住' : '待处理' }}</strong>
                      <span>{{ item.label }}</span>
                      <small>{{ item.status }}</small>
                    </div>
                  </div>
                </div>
                <div class="intel-card">
                  <div class="section-kicker">势力盘面</div>
                  <div v-if="sortedFactions.length" class="intel-list">
                    <div v-for="faction in sortedFactions.slice(0, 5)" :key="faction.id || faction.name" class="intel-list__item">
                      <strong>{{ faction.name }} · {{ faction.stance || '中立' }}</strong>
                      <span>{{ faction.summary || '这一势力的轮廓还不够清晰。' }}</span>
                      <span class="status-tip">好感 {{ faction.favor || 0 }} · 敌意 {{ faction.hostility || 0 }} · 筹码 {{ faction.leverage || 0 }} · 势力 {{ faction.power || 0 }}</span>
                    </div>
                  </div>
                  <div v-else class="panel-text">眼下我还没有与主要势力形成足够清晰的互动记录。</div>
                </div>
                <div class="intel-card">
                  <div class="section-kicker">待续暗线</div>
                  <div v-if="pendingThreads.length" class="intel-list">
                    <div v-for="thread in pendingThreads" :key="thread.key || thread.title" class="intel-list__item">
                      <strong>{{ thread.title }}</strong>
                      <span>{{ threadPressureText(thread) }}</span>
                    </div>
                  </div>
                  <div v-else class="panel-text">当前没有新的紧急暗线。</div>
                </div>
              </template>

              <template v-else-if="activeIntelTab === 'cities'">
                <div class="intel-card">
                  <div class="section-kicker">当前城池</div>
                  <div class="panel-title panel-title--small">{{ currentCityEconomyCard ? `${currentCityEconomyCard.cityName} · ${currentCityEconomyCard.authorityLabel}` : '尚未立住地盘' }}</div>
                  <div v-if="currentCityEconomyCard" class="panel-text">{{ currentCityEconomyCard.region }} · 秩序{{ currentCityEconomyCard.order }} · 民生{{ currentCityEconomyCard.prosperity }} · 治安{{ currentCityEconomyCard.security }}</div>
                  <div v-if="currentCityEconomyCard" class="status-tip">每回合约 {{ currentCityEconomyCard.yieldCoins }}钱 / {{ currentCityEconomyCard.yieldSupplies }}粮 / {{ currentCityEconomyCard.yieldTroops }}部曲</div>
                  <div class="panel-text">{{ territorySummaryLine }}</div>
                </div>
                <div class="intel-card">
                  <div class="section-kicker">已纳入城池</div>
                  <div v-if="territoryCards.length" class="intel-list">
                    <div v-for="item in territoryCards" :key="item.cityId" class="intel-list__item">
                      <strong>{{ item.cityName }} · {{ item.authorityLabel || '无根基' }}</strong>
                      <span>{{ item.region || '未知地域' }} · 秩序{{ item.order || 0 }} · 民生{{ item.prosperity || 0 }} · 治安{{ item.security || 0 }}</span>
                      <span class="status-tip">收益 {{ item.yieldCoins || 0 }}钱 / {{ item.yieldSupplies || 0 }}粮 / {{ item.yieldTroops || 0 }}部曲</span>
                    </div>
                  </div>
                  <div v-else class="panel-text">眼下只是先在这座城站脚，还没有真正纳入可持续出账的城池。</div>
                </div>
                <div class="intel-card">
                  <div class="section-kicker">版图扩张</div>
                  <div class="panel-title panel-title--small">{{ territoryExpansionSummary }}</div>
                  <div v-if="territoryExpansionCards.length" class="intel-list">
                    <div v-for="item in territoryExpansionCards" :key="item.id" class="intel-list__item">
                      <strong>{{ item.text }}</strong>
                      <span>{{ item.hint }}</span>
                      <span class="status-tip">{{ item.status }}</span>
                    </div>
                  </div>
                  <div v-else class="panel-text">{{ territoryExpansionEmptyText }}</div>
                </div>
              </template>

              <template v-else-if="activeIntelTab === 'team'">
                <div class="intel-card">
                  <div class="section-kicker">班底总况</div>
                  <div class="panel-title panel-title--small">{{ retinueOverview ? retinueOverview.readiness : '仍是单打独斗' }}</div>
                  <div v-if="retinueOverview" class="status-notes">
                    <span>成员 {{ retinueOverview.memberCount }}/{{ retinueOverview.capacity }}</span>
                    <span>任命 {{ retinueOverview.assignmentCount }}</span>
                    <span>空位 {{ retinueOverview.vacancyCount }}</span>
                    <span v-if="retinueOverview.companionName">同行 {{ retinueOverview.companionName }}</span>
                  </div>
                  <div v-else class="panel-text">队伍还没有真正成形，先从人物关系和招募线把熟人拉进来。</div>
                </div>
                <div v-if="retinueOverview" class="intel-card">
                  <div class="section-kicker">招募进度</div>
                  <div v-if="retinueOverview.recruitTracks.length" class="intel-list">
                    <div v-for="item in retinueOverview.recruitTracks" :key="item.id" class="intel-list__item">
                      <strong>{{ item.text }} · {{ item.stageLabel }}</strong>
                      <span>{{ item.summary }}</span>
                      <span class="status-tip">{{ item.statsLine }}</span>
                      <span v-if="item.gapText" class="status-tip">{{ item.gapText }}</span>
                    </div>
                  </div>
                  <div v-else class="panel-text">眼下没有新的可推进招募线，先把人物关系做深。</div>
                </div>
                <div v-if="retinueOverview" class="intel-card">
                  <div class="section-kicker">任命与队伍动作</div>
                  <div v-if="retinueOverview.assignments.length" class="intel-list">
                    <div v-for="item in retinueOverview.assignments" :key="item.roleId" class="intel-list__item">
                      <strong>{{ item.slotLabel }} · {{ item.memberName }}</strong>
                      <span>{{ item.roleName }}{{ item.yieldText ? `，${item.yieldText}` : '' }}</span>
                    </div>
                  </div>
                  <div v-if="retinueOverview.teamActions.length" class="intel-list">
                    <div v-for="item in retinueOverview.teamActions" :key="item.id" class="intel-list__item">
                      <strong>{{ item.text }}</strong>
                      <span>{{ item.requiredRoles.join('、') || '无' }}</span>
                    </div>
                  </div>
                  <div v-if="retinueOverview.teamLocked.length" class="intel-list">
                    <div v-for="item in retinueOverview.teamLocked" :key="item.id" class="intel-list__item">
                      <strong>{{ item.text }}</strong>
                      <span>{{ item.lockedReason }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="intel-card intel-card--self-summary">
                  <div class="section-kicker">状态总览</div>
                  <div class="panel-title panel-title--small">{{ snapshot.gameState.martialRealm || '未入流' }} · {{ currentCityAuthorityLabel }}</div>
                  <div class="panel-text">{{ snapshot.gameState.strategyRouteSummary || snapshot.gameState.martialRouteSummary || '眼下还在乱世里攒底子、定路数。' }}</div>
                  <div class="status-notes">
                    <span>武名 {{ snapshot.gameState.martialTitle || snapshot.gameState.martialRealm || '未定' }}</span>
                    <span>志向 {{ snapshot.gameState.martialFocusName || '未定志向' }}</span>
                    <span>门派 {{ snapshot.gameState.sectName || '无门无派' }}</span>
                  </div>
                </div>
                <div v-if="martialApexDisplayCard" class="intel-card intel-card--apex">
                  <div class="section-kicker">巅峰危机</div>
                  <div class="panel-title panel-title--small">{{ martialApexDisplayCard.title }}</div>
                  <div class="panel-text">{{ martialApexDisplayCard.summary }}</div>
                  <div class="status-notes">
                    <span>威胁 {{ martialApexState.threat }}</span>
                    <span>暴露 {{ martialApexState.exposure }}</span>
                    <span>负担 {{ martialApexState.burden }}</span>
                  </div>
                  <div v-if="martialApexDisplayCard.note" class="status-tip">{{ martialApexDisplayCard.note }}</div>
                </div>
                <div v-if="activeEndgameGateCard" class="intel-card">
                  <div class="section-kicker">终局进度</div>
                  <div class="panel-title panel-title--small">{{ activeEndgameGateCard.title }}</div>
                  <div class="panel-text">{{ activeEndgameGateCard.summary }}</div>
                  <div v-if="activeEndgameGateCard.noteLines && activeEndgameGateCard.noteLines.length" class="status-notes gate-card-notes">
                    <span v-for="item in activeEndgameGateCard.noteLines" :key="`live-gate-note-${item}`">{{ item }}</span>
                  </div>
                  <div class="gate-checklist">
                    <div
                      v-for="item in activeEndgameGateCard.items"
                      :key="`live-gate-${item.key}`"
                      class="gate-checklist__item"
                      :class="{ 'gate-checklist__item--done': item.done }"
                    >
                      <div class="gate-checklist__head">
                        <strong>{{ item.done ? '已具备' : '待补' }}</strong>
                        <span>{{ item.label }}</span>
                      </div>
                      <small>{{ item.status }}</small>
                    </div>
                  </div>
                </div>
                <div class="intel-card intel-card--self-pinned">
                  <div class="section-kicker">常看数值</div>
                  <div class="self-pinned-grid">
                  <div v-for="row in visibleSelfPinnedRows" :key="row.key" class="self-pinned-item">
                      <span>{{ row.label }}</span>
                      <strong>{{ row.value }}</strong>
                      <small>{{ row.tip }}</small>
                    </div>
                  </div>
                </div>
                <button
                  v-if="isMobileLayout"
                  type="button"
                  class="tool-button tool-button--subtle mobile-self-toggle"
                  @click="mobileSelfDetailsExpanded = !mobileSelfDetailsExpanded"
                >
                  {{ mobileSelfDetailsExpanded ? '收起详细属性' : '展开详细属性' }}
                </button>
                <div v-if="showExpandedSelfDetails" class="self-section-tabs">
                  <button
                    v-for="section in selfStatusSections"
                    :key="section.key"
                    type="button"
                    class="self-section-tab"
                    :class="{ active: activeSelfSection === section.key }"
                    @click="activeSelfSection = section.key"
                  >
                    {{ section.kicker }}
                  </button>
                </div>
                <div v-if="showExpandedSelfDetails && activeSelfStatusSection" class="intel-card">
                  <div class="section-kicker">{{ activeSelfStatusSection.kicker }}</div>
                  <div class="panel-title panel-title--small">{{ activeSelfStatusSection.title }}</div>
                  <div class="panel-text">{{ activeSelfStatusSection.summary }}</div>
                  <div v-if="activeSelfStatusSection.key === 'footing'" class="footing-self">
                    <div class="footing-self__hero">
                      <div class="footing-self__hero-main">
                        <div class="section-kicker">当前立足</div>
                        <div class="panel-title panel-title--small">{{ footingLeadCard.title }}</div>
                        <div class="panel-text">{{ footingLeadCard.summary }}</div>
                      </div>
                      <div class="status-notes">
                        <span v-for="item in footingLeadCard.notes" :key="item">{{ item }}</span>
                      </div>
                    </div>
                    <div class="footing-self__grid">
                      <div v-for="card in footingStatusCards" :key="card.key" class="footing-self-card">
                        <div class="section-kicker">{{ card.kicker }}</div>
                        <div class="panel-title panel-title--small">{{ card.title }}</div>
                        <div class="footing-self-card__stats">
                          <span v-for="item in card.stats" :key="`${card.key}-${item}`">{{ item }}</span>
                        </div>
                        <div class="status-tip">{{ card.summary }}</div>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="activeSelfStatusSection.key === 'survival' && foodSelfCard" class="food-self-card">
                    <div class="section-kicker">食味</div>
                    <div class="panel-title panel-title--small">{{ foodSelfCard.title }}</div>
                    <div class="panel-text">{{ foodSelfCard.summary }}</div>
                    <div v-if="foodSelfCard.buffLine" class="status-tip">{{ foodSelfCard.buffLine }}</div>
                    <div v-if="foodSelfCard.soulLine" class="status-tip">“{{ foodSelfCard.soulLine }}”</div>
                  </div>
                  <div v-else class="status-detail-board status-detail-board--plain">
                    <div v-for="row in visibleSelfStatusRows" :key="row.key" class="status-detail-row">
                      <div class="status-detail-copy">
                        <strong>{{ row.label }}</strong>
                        <div class="status-tip">{{ row.tip }}</div>
                      </div>
                      <div class="status-detail-values">
                        <div class="status-detail-value">{{ row.value }}</div>
                        <div v-if="row.extra" class="status-detail-extra">{{ row.extra }}</div>
                      </div>
                    </div>
                    <div v-if="activeStatusPanel === 'resources' && foodStatusCard" class="food-status-board">
                      <div class="food-status-board__head">
                        <div>
                          <div class="section-kicker">养成入口</div>
                          <div class="panel-title panel-title--small">{{ foodStatusCard.title }}</div>
                        </div>
                        <div class="status-tip">{{ foodStatusCard.countLine }}</div>
                      </div>
                      <div class="panel-text">{{ foodStatusCard.summary }}</div>
                      <div v-if="foodStatusCard.buffLine" class="status-tip">{{ foodStatusCard.buffLine }}</div>
                      <div v-if="foodStatusCard.items.length" class="food-pill-list">
                        <button
                          v-for="item in foodStatusCard.items"
                          :key="item.id"
                          type="button"
                          class="food-pill"
                          :disabled="interactionBlocked || item.disabled"
                          @click="submitChoice(item)"
                        >
                          <strong>{{ item.text }}</strong>
                          <span>{{ item.hint }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </section>
        </aside>

        <transition name="sheet-slide">
          <aside v-if="isMobileLayout && mobileAuthGuideExpanded" class="auth-guide-sheet" role="dialog" aria-modal="true">
            <div class="mobile-sheet-handle"></div>
            <div class="auth-entry-card auth-entry-card--guide">
              <div class="panel-title panel-title--small">试玩与权益节奏</div>
              <div class="auth-benefit-list">
                <div class="auth-benefit">
                  <span>匿名试玩</span>
                  <strong>先走 10 回</strong>
                </div>
                <div class="auth-benefit">
                  <span>注册账号</span>
                  <strong>累计 30 回</strong>
                </div>
                <div class="auth-benefit">
                  <span>测试账号</span>
                  <strong>{{ adminSeed.username }} / {{ adminSeed.password }}</strong>
                </div>
              </div>
              <div class="panel-text">普通账号和测试账号登录后都走同一套前台界面，不再分出独立管理页。</div>
              <div class="panel-text">付费回合包与月卡入口统一收进顶部权益舱，账号状态、续玩和开卡放在同一块里处理。</div>
              <div class="status-tip">完成登录后会自动创建或接续当前存档并进入可操作状态。</div>
              <button type="button" class="tool-button tool-button--subtle auth-guide-close" @click="mobileAuthGuideExpanded = false">收起</button>
            </div>
          </aside>
        </transition>
      </div>
    </div>

    <div v-if="glossarySheetVisible && activeGlossaryEntry" class="glossary-sheet-mask" @click.self="closeGlossary">
      <div class="glossary-sheet">
        <button type="button" class="glossary-sheet__close" @click="closeGlossary">关闭</button>
        <div class="glossary-sheet__title">{{ activeGlossaryEntry.title }}</div>
        <div class="glossary-sheet__body">{{ activeGlossaryEntry.body }}</div>
      </div>
    </div>

    <div v-if="activeOverlay" class="overlay-mask" @click.self="closeOverlay">
      <div class="overlay-panel">
        <div class="overlay-head">
          <div>
            <div class="section-kicker">卷册展开</div>
            <div class="zone-title">{{ overlayTitle }}</div>
          </div>
          <button class="tool-button" @click="closeOverlay">关闭</button>
        </div>

        <div v-if="activeOverlay === 'relations'" class="overlay-content">
          <div v-if="!relationBookEntries.length" class="overlay-card">眼下我还没有真正掌住谁的线索，关系簿还是空的。</div>
          <div v-for="relation in relationBookEntries" :key="relation.id || relation.name" class="overlay-card">
            <div class="status-top">
              <div>
                <div class="panel-title panel-title--small">{{ relation.name }}</div>
                <div class="panel-text">{{ relation.title || '人物' }} · {{ relationVisibilityLabel(relation) }} · {{ relation.bondLabel || relation.intimacyTag || '未定' }} · {{ relation.isHistorical ? '史实人物' : '随机人物' }} · 恋爱阶段 {{ relation.romanceStage || deriveRomanceStage(relation) }}</div>
              </div>
              <div class="status-tip">好感 {{ relation.favorScore !== undefined ? relation.favorScore : deriveFavorScore(relation) }} · 信 {{ relation.trust || 0 }} · 情 {{ relation.affection || 0 }} · 忠 {{ relation.loyalty || 0 }} · 怨 {{ relation.rivalry || 0 }}</div>
            </div>
            <div class="panel-text">{{ relation.status || '尚未形成稳定关系。' }}</div>
            <div v-if="relation.isHistorical && ['rumor', 'met'].includes(relationVisibilityOf(relation))" class="panel-text">{{ historicalLeadRecommendation(relation) }}</div>
            <div v-if="relation.bondSummary" class="panel-text">{{ relation.bondSummary }}</div>
            <div v-if="relation.isHistorical" class="panel-text">阶段 {{ historicalRelationStageLabel(relation) }} · 武艺 {{ relation.martialRating || 0 }} · 智谋 {{ relation.strategyRating || 0 }}</div>
            <div v-if="relation.isHistorical && relation.signatureSkills && relation.signatureSkills.length" class="panel-text">拿手本事：{{ relation.signatureSkills.join('、') }}</div>
            <div class="panel-text">{{ relation.summary || relation.description || '这一页还没有更多记录。' }}</div>
          </div>
        </div>

        <div v-else-if="activeOverlay === 'skills'" class="overlay-grid">
          <div v-if="!skillList.length" class="overlay-card">眼下我还没有成体系的技能记录。</div>
          <div v-for="skill in skillList" :key="skill.id || skill.name" class="overlay-card">
            <div class="status-top">
              <div>
                <div class="panel-title panel-title--small">{{ skill.name }}</div>
                <div class="panel-text">{{ skill.type || '通用' }} · {{ skill.passiveType || '被动' }}</div>
              </div>
              <div class="choice-category">{{ skill.level || '基础' }}</div>
            </div>
            <div class="panel-text">{{ skill.effect || skill.description || '暂无补充说明。' }}</div>
            <div v-if="skill.triggerHint" class="panel-text">生效场景：{{ skill.triggerHint }}</div>
            <div v-if="skill.scopeTags && skill.scopeTags.length" class="status-notes">
              <span v-for="tag in skill.scopeTags" :key="tag">{{ tag }}</span>
            </div>
          </div>
        </div>

        <div v-else-if="activeOverlay === 'factions'" class="overlay-grid">
          <div v-if="!sortedFactions.length" class="overlay-card">眼下我还没有与主要势力形成足够清晰的互动记录。</div>
          <div v-for="faction in sortedFactions" :key="faction.id || faction.name" class="overlay-card">
            <div class="status-top">
              <div>
                <div class="panel-title panel-title--small">{{ faction.name }}</div>
                <div class="panel-text">{{ faction.role || '势力' }}</div>
              </div>
              <div class="choice-category">{{ faction.stance || '中立' }}</div>
            </div>
            <div class="panel-text">{{ faction.summary || '这一势力的轮廓还不够清晰。' }}</div>
            <div class="status-tip">好感 {{ faction.favor || 0 }} · 敌意 {{ faction.hostility || 0 }} · 筹码 {{ faction.leverage || 0 }} · 势力 {{ faction.power || 0 }}</div>
          </div>
        </div>

        <div v-else-if="activeOverlay === 'memo'" class="overlay-content">
          <div v-if="snapshot.gameState.lastResolutionSummary" class="overlay-card">
            <div class="panel-title panel-title--small">上回裁定</div>
            <div class="panel-text">{{ snapshot.gameState.lastResolutionSummary }}</div>
            <div v-if="snapshot.gameState.lastRuleSummary" class="panel-text">{{ snapshot.gameState.lastRuleSummary }}</div>
            <div v-if="snapshot.gameState.lastDeltaLine" class="panel-text">{{ snapshot.gameState.lastDeltaLine }}</div>
          </div>
          <div v-if="lastRetinueFeedbackCard" class="overlay-card">
            <div class="panel-title panel-title--small">协同回响</div>
            <div class="panel-text">{{ lastRetinueFeedbackCard.summaryLine || lastRetinueFeedbackCard.participantLine }}</div>
            <div v-if="lastRetinueFeedbackCard.totalLine" class="panel-text">协同收益：{{ lastRetinueFeedbackCard.totalLine }}</div>
            <div v-for="line in lastRetinueFeedbackCard.supportLines" :key="line" class="panel-text">{{ line }}</div>
          </div>
          <div v-if="lastSkillFeedbackCard" class="overlay-card">
            <div class="panel-title panel-title--small">技能回响</div>
            <div class="panel-text">{{ lastSkillFeedbackCard.summaryLine }}</div>
            <div v-if="lastSkillFeedbackCard.totalLine" class="panel-text">技能收益：{{ lastSkillFeedbackCard.totalLine }}</div>
            <div v-for="line in lastSkillFeedbackCard.detailLines" :key="line" class="panel-text">{{ line }}</div>
          </div>
          <div v-if="lastCityReportCard" class="overlay-card">
            <div class="panel-title panel-title--small">城池回响</div>
            <div class="panel-text">{{ lastCityReportCard.cityName }} · {{ lastCityReportCard.authorityLabel }} · 权柄 {{ lastCityReportCard.authorityScore }}</div>
            <div class="panel-text">{{ lastCityReportCard.summary }}</div>
            <div class="panel-text">本回结算：{{ lastCityReportCard.yieldLine }}</div>
            <div v-if="lastCityReportCard.scaleLine" class="status-tip">{{ lastCityReportCard.scaleLine }}</div>
          </div>
          <div v-if="dramaticMemoCard" class="overlay-card">
            <div class="panel-title panel-title--small">戏剧余波</div>
            <div class="panel-text">{{ dramaticMemoCard.question }}</div>
            <div v-if="dramaticMemoCard.planLine" class="panel-text">{{ dramaticMemoCard.planLine }}</div>
            <div v-for="line in dramaticMemoCard.residueLines" :key="line" class="panel-text">{{ line }}</div>
            <div class="status-tip">{{ dramaticMemoCard.actorLine }}</div>
          </div>
          <div v-if="worldPerceptionCard" class="overlay-card">
            <div class="panel-title panel-title--small">众生解读</div>
            <div class="panel-text">{{ worldPerceptionCard.headline }}</div>
            <div class="panel-text">{{ worldPerceptionCard.summary }}</div>
            <div v-for="line in worldPerceptionCard.signalLines" :key="line" class="panel-text">{{ line }}</div>
            <div v-for="line in worldPerceptionCard.beatLines" :key="line" class="panel-text">{{ line }}</div>
            <div class="status-tip">{{ worldPerceptionCard.intensityLine }}</div>
          </div>
          <div v-if="worldFermentationCard" class="overlay-card">
            <div class="panel-title panel-title--small">幕后发酵</div>
            <div class="panel-text">{{ worldFermentationCard.headline }}</div>
            <div class="panel-text">{{ worldFermentationCard.summary }}</div>
            <div v-for="line in worldFermentationCard.signalLines" :key="line" class="panel-text">{{ line }}</div>
            <div class="status-tip">{{ worldFermentationCard.heatLine }}</div>
          </div>
          <div v-if="snapshot.gameState.lastBattleReport" class="overlay-card">
            <div class="panel-title panel-title--small">战局回看</div>
            <div class="panel-text">战况：{{ snapshot.gameState.lastBattleReport.mode }}</div>
            <div class="panel-text">规模：{{ snapshot.gameState.lastBattleReport.scaleLabel || '未定' }} · 我方约 {{ snapshot.gameState.lastBattleReport.playerCommittedTroops || 0 }} 人 · 对手约 {{ snapshot.gameState.lastBattleReport.enemyTroops || 0 }} 人</div>
            <div class="panel-text">我方战力 {{ snapshot.gameState.lastBattleReport.playerStrength }} · 敌方战力 {{ snapshot.gameState.lastBattleReport.enemyStrength }}</div>
            <div class="panel-text">折损 {{ snapshot.gameState.lastBattleReport.casualties }} · 粮秣消耗 {{ snapshot.gameState.lastBattleReport.supplyCost }}</div>
          </div>
          <div v-if="advisoryList.length" class="overlay-card">
            <div class="panel-title panel-title--small">风险提示</div>
            <div v-for="item in advisoryList" :key="item" class="panel-text">{{ item }}</div>
          </div>
          <div class="overlay-card">
            <div class="panel-title panel-title--small">待续暗线</div>
            <div v-if="!pendingThreads.length" class="panel-text">当前没有新的紧急暗线。</div>
            <div v-for="thread in pendingThreads" :key="thread.key || thread.title" class="thread-row">
              <span>{{ thread.title }}</span>
              <strong>{{ threadPressureText(thread) }}</strong>
            </div>
          </div>
        </div>

        <div v-else-if="activeOverlay === 'map'" class="overlay-content">
          <div class="overlay-card">
            <div class="status-top">
              <div>
                <div class="panel-title panel-title--small">{{ snapshot.world.currentCityName || '未定' }}</div>
                <div class="panel-text">{{ snapshot.world.currentRegion || '未知地域' }} · 籍贯 {{ snapshot.world.originCityName || '未定' }}</div>
              </div>
              <div class="choice-category">{{ snapshot.world.weather || '阴' }}</div>
            </div>
            <div class="panel-text">这是文字地图，不画地形，只说明哪里与哪里相连、代价如何、风向往哪边吹。</div>
            <div class="panel-text">当前权柄：{{ currentCityAuthorityLabel }} · {{ currentCityAuthoritySummary }}</div>
            <div class="status-tip">{{ territorySummaryLine }}</div>
          </div>
          <div class="overlay-card">
            <div class="panel-title panel-title--small">城池纳入与收益</div>
            <div v-if="!territoryCards.length" class="panel-text">眼下只是先在这座城站脚，还没有真正纳入可持续出账的城池。</div>
            <div v-else class="retinue-overview__list">
              <div v-for="item in territoryCards" :key="item.cityId" class="retinue-overview__item">
                <strong>{{ item.cityName }} · {{ item.authorityLabel }}</strong>
                <span>{{ item.region }} · 秩序{{ item.order }} · 民生{{ item.prosperity }} · 治安{{ item.security }}</span>
                <span class="retinue-overview__stats">每回合约 {{ item.yieldCoins }}钱 / {{ item.yieldSupplies }}粮 / {{ item.yieldTroops }}部曲</span>
              </div>
            </div>
          </div>
          <div class="overlay-card">
            <div class="panel-title panel-title--small">当前可行路线</div>
            <div v-if="!mapRoutes.length" class="panel-text">籍贯未定之前，行路图还不会真正展开。</div>
            <button v-for="route in mapRoutes" :key="route.cityId" class="text-route" :disabled="aiLoading || interactionLocked" @click="travelFromOverlay(route.cityId)">
              <span>{{ snapshot.world.currentCityName || '当前所在' }} → {{ route.cityName }}</span>
              <span>{{ route.region }} · {{ route.routeTypeLabel || '路线' }} · {{ route.routeLabel || '行路' }} · 路程 {{ route.distance }} · 风险{{ route.risk || '中' }} · {{ route.coinCost }}钱 {{ route.supplyCost }}粮</span>
            </button>
          </div>
          <div class="overlay-card">
            <div class="panel-title panel-title--small">远行规划</div>
            <div v-if="!longMapRoutes.length" class="panel-text">眼下还没有值得一口气走完的远行规划。</div>
            <button v-for="route in longMapRoutes" :key="'long-' + route.cityId" class="text-route text-route--long" :disabled="aiLoading || interactionLocked" @click="travelFromOverlay(route.cityId)">
              <span>{{ snapshot.world.currentCityName || '当前所在' }} ⇒ {{ route.cityName }}</span>
              <span>{{ route.region }} · {{ route.legCount }}段 · {{ route.monthsCost }}月程 · 途经{{ (route.stopovers || []).join('、') || '无' }} · {{ route.coinCost }}钱 {{ route.supplyCost }}粮</span>
            </button>
          </div>
          <div class="overlay-card">
            <div class="panel-title panel-title--small">天下分区</div>
            <div v-for="group in textMapGroups" :key="group.region" class="panel-text">{{ group.region }}：{{ group.cities.join('、') }}</div>
        </div>
      </div>
    </div>
    </div>

    <div v-if="namePromptVisible" class="overlay-mask overlay-mask--dialog" @click.self="cancelNamePrompt">
      <div class="overlay-panel overlay-panel--dialog">
        <div class="overlay-head">
          <div>
            <div class="section-kicker">主角姓名</div>
            <div class="zone-title">{{ namePromptTitle }}</div>
          </div>
          <button class="tool-button tool-button--subtle" type="button" @click="cancelNamePrompt">{{ namePromptCancelLabel }}</button>
        </div>
        <div class="overlay-content">
          <div class="panel-text">{{ namePromptSummary }}</div>
          <input
            v-model.trim="namePromptInput"
            class="native-auth-input native-auth-input--dialog"
            type="text"
            :placeholder="namePromptPlaceholder"
            @keyup.enter="confirmNamePrompt"
          >
          <div v-if="namePromptError" class="status-tip status-tip--danger">{{ namePromptError }}</div>
          <div class="mobile-starter__actions">
            <button type="button" class="tool-button tool-button--accent" @click="confirmNamePrompt">{{ namePromptConfirmLabel }}</button>
            <button type="button" class="tool-button tool-button--subtle" @click="cancelNamePrompt">{{ namePromptCancelLabel }}</button>
          </div>
        </div>
      </div>
    </div>

      <mobile-workbench-dock
        v-if="isMobileLayout"
        :active-key="activeMobileView"
        :items="mobileViewOptions"
        :on-select="jumpToMobileSection"
      />

  </div>
  <ui-toast-stack :items="toastItems" />
</template>

<script>
import sessionApi from '@/api/sessionApiServerManaged';
import authApi from '@/api/authApi';
import { getStoredAuthToken, setStoredAuthToken } from '@/api/httpClient';
import CrpgLayout from '@/features/game-shell/crpg/Layout.vue';
import ActionDeck from '@/features/game-shell/components/ActionDeck.vue';
import GameHeroHub from '@/features/game-shell/components/GameHeroHub.vue';
import MobileWorkbenchDock from '@/features/game-shell/components/MobileWorkbenchDock.vue';
import UiButton from '@/shared/ui/UiButton.vue';
import UiModal from '@/shared/ui/UiModal.vue';
import UiToastStack from '@/shared/ui/UiToastStack.vue';

const SESSION_STORAGE_KEY = 'tk_refactor_session_id_v5';
const LOADING_COPY = [
  '先把这一手带来的因果理清，再让它落成正文。',
  '人物、势力、城池和门派的状态正在重新咬合。',
  '如果上游模型迟迟不给正文，本地续写会先把这一回接住。',
  '不是卡住，是在等正文首段。'
];
const DRAFT_PLACEHOLDER_TITLE = '这一手正在浮现';
const DRAFT_PLACEHOLDER_HINT = '正文和局势刚咬合起来，这一步很快会定形。';
const DRAFT_TYPING_INTERVAL = 22;
const DYNAMIC_SLOT_ROLE_META = {
  0: { role: 'followup', label: '来人', title: '有人先找上门', hint: '这一格偏向邀约、求见、递话、托付，适合先接人物线。', note: '人物' },
  1: { role: 'mainline', label: '紧线', title: '眼前这手最要紧', hint: '这一格偏向再拖就会变坏的硬压力，适合先按住主麻烦。', note: '主压' },
  2: { role: 'wildcard', label: '偏手', title: '旁线忽然能抢', hint: '这一格偏向偏门、截胡、奇遇、抢人或绕路偷步。', note: '偏门' }
};
const ACTION_DIRECTION_META = {
  governance: { key: 'governance', label: '经营', summary: '先补根基、钱粮与地盘运转。' },
  network: { key: 'network', label: '人脉', summary: '把人情、结盟与关系往前推。' },
  strategy: { key: 'strategy', label: '谋略', summary: '看暗线、问后手、主动布子。' },
  martial: { key: 'martial', label: '武学', summary: '练本事、走门派、补实战见识。' },
  military: { key: 'military', label: '军旅', summary: '先接军旅门路、整军试锋，再决定何时真正开战。' },
  jianghu: { key: 'jianghu', label: '江湖', summary: '问剑、扬名、走奇遇与仇怨线。' },
  growth: { key: 'growth', label: '养成', summary: '回气、养伤、稳住状态。' },
  world: { key: 'world', label: '行路', summary: '转场换局，去新的城池接新的盘面。' }
};
const FIXED_GROUP_META = {
  personal: { key: 'personal', label: '个人动作', summary: '不依赖队友，眼下我一个人就能做的推进。', order: 10 },
  recruit: { key: 'recruit', label: '招募', summary: '把已经熟到位的人拉进编制，补班底。', order: 20 },
  appoint: { key: 'appoint', label: '任命', summary: '把已经入队的人安到对应职司，形成长期收益。', order: 30 },
  retinue_interaction: { key: 'retinue_interaction', label: '幕下往来', summary: '点名找幕下某人谈事、问策或指定同行。', order: 35 },
  team: { key: 'team', label: '队伍动作', summary: '用已成形的班底协同推进，不再只是单人硬扛。', order: 40 },
  sect_outer: { key: 'sect_outer', label: '门派外缘', summary: '不改换门庭，先借外缘、人情和演武摸别门路数。', order: 50 },
  sect_inner: { key: 'sect_inner', label: '门派内修', summary: '在已入门的师承里深修传承、人情与门中势力。', order: 60 },
  travel: { key: 'travel', label: '行路', summary: '换城换局，把剧情盘面直接切到新的地方。', order: 70 }
};
const STAGE_PACKAGE_META = {
  opening: {
    key: 'opening',
    label: '起局期',
    summary: '先定来路与落脚，让身份、城池和第一层人物线真正开出来。',
    objective: '完成出身与落脚，确保故事正式入局。',
    nextLabel: '立足期',
    directions: ['governance', 'network', 'world'],
    safety: [
      '起局不会要求任何高阶属性，只需要先做出身与落脚选择。',
      '如果当前城没有后续机会，行路入口必须继续给出换城口子。',
      '人物线至少以传闻形式露出，不允许关键人物完全不可见。'
    ]
  },
  footing: {
    key: 'footing',
    label: '立足期',
    summary: '先活下来，再站稳脚。核心是根基、人脉和连续行动余量。',
    objective: '拿到第一块稳定立足面，并攒出能连续推进的余量。',
    nextLabel: '成长期',
    directions: ['governance', 'network', 'growth', 'world'],
    safety: [
      '根基值不能只靠经营获取，人脉与换城也必须能补。',
      '没有钱粮时，养成和低风险动态动作必须给恢复空间。',
      '若当前城空转，系统必须给人物传闻、地方关系或转场机会。'
    ]
  },
  growth: {
    key: 'growth',
    label: '成长期',
    summary: '把单人推进变成体系推进。核心是班底、任命、路数与稳定收益。',
    objective: '形成第一层班底与任命，让收益、人物和能力出现正反馈。',
    nextLabel: '扩张期',
    directions: ['governance', 'network', 'strategy', 'martial', 'growth'],
    safety: [
      '班底不足时，招募、人脉和经营三路里至少一路必须能补人。',
      '路数成长不能只锁在门派内，江湖、军旅或问策都要能提供替代突破。',
      '收益不足时，可通过任命、商路或控城中的任一路重新起循环。'
    ]
  },
  expansion: {
    key: 'expansion',
    label: '扩张期',
    summary: '从站稳走向控盘。核心是控城、影响、协同与中程目标兑现。',
    objective: '把城池、班底与声势连成能自我放大的中盘。',
    nextLabel: '战时期',
    directions: ['governance', 'strategy', 'military', 'network', 'world'],
    safety: [
      '扩张不只靠攻城，游说、接管、势力倒向也必须算有效路径。',
      '影响不足时，人脉、谋略、江湖声望都必须能回流到扩张门槛。',
      '若近线没有可压城池，系统要投放远行、暗线或内政加固替代手。'
    ]
  },
  wartime: {
    key: 'wartime',
    label: '战时期',
    summary: '围绕战局运转。核心是士气、补给、后手和战场执行力。',
    objective: '让战斗推进不靠单一战力，而是靠补给、班底和后手共同支撑。',
    nextLabel: '定局期',
    directions: ['military', 'strategy', 'governance', 'network', 'growth'],
    safety: [
      '部曲不足时，经营和人脉必须能继续补兵补粮，不能只靠赢战。',
      '战斗后一定要回流剧情和固定入口，避免战场成为独立死循环。',
      '高压战局下，养成入口必须保留回气和止损动作。'
    ]
  },
  endgame: {
    key: 'endgame',
    label: '定局期',
    summary: '把前面积累的路数、地盘、人手与名望收束成可兑现的终局。',
    objective: '不让终局只认单一路线，而是允许多条已成形的积累方式达标。',
    nextLabel: '余韵',
    directions: ['governance', 'strategy', 'military', 'martial', 'network'],
    safety: [
      '终局门槛必须存在多解，不允许只能靠单一属性冲线。',
      '若主路线不足，副路线积累也应能转化为通关条件。',
      '结局前仍需保留一到两手补关键缺口的收束动作。'
    ]
  }
};
const STATUS_PANEL_META = {
  resources: { key: 'resources', label: '资源', summary: '直接能调动的钱粮、人手与当前状态。' },
  abilities: { key: 'abilities', label: '能力', summary: '内政、经商、外交、军务与谋略的硬数值。' },
  martial: { key: 'martial', label: '武学军旅', summary: '武学路线、军旅志向、门派与声望积累。' },
  footing: { key: 'footing', label: '根基', summary: '城池、队伍与当前立足面的整体盘面。' }
};
const INTEL_TAB_META = {
  people: { key: 'people', label: '人物', summary: '史实人物线索、已接触人物与关系深浅。' },
  factions: { key: 'factions', label: '势力', summary: '势力态度、幕后发酵与待续暗线。' },
  cities: { key: 'cities', label: '城池', summary: '当前城池、已纳入版图与扩张入口。' },
  team: { key: 'team', label: '队伍', summary: '班底规模、任命分工与队伍动作。' },
  self: { key: 'self', label: '自身', summary: '完整状态、能力数值、武学与根基。' }
};
const MOBILE_LAYOUT_BREAKPOINT = 820;
const MOBILE_VIEW_META = {
  story: { key: 'story', label: '剧情', summary: '先把这一回的正文看明白，再决定要押哪一手。', note: '正文' },
  action: { key: 'action', label: '落子', summary: '把当回最值得点的动作先摆出来，优先做决策。', note: '行动' },
  intel: { key: 'intel', label: '情报', summary: '把人物、势力、自身和队伍盘面集中查阅。', note: '盘面' }
};
const MOBILE_STORY_PANEL_META = {
  mainline: { key: 'mainline', label: '主线', note: '主线态势' },
  status: { key: 'status', label: '此刻', note: '此刻局势' }
};
const UI_ICON_MAP = {
  city: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V8l8-4 8 4v12h-4v-5H8v5H4zm6-8h4v-2h-4v2z" fill="currentColor"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18q-1.25 0-2.125-.875T3 15q0-1.25.875-2.125T6 12h5V9H9q-1.25 0-2.125-.875T6 6q0-1.25.875-2.125T9 3q1.25 0 2.125.875T12 6v12q0 1.25-.875 2.125T9 21q-1.25 0-2.125-.875T6 18zm9 3q-1.25 0-2.125-.875T12 18v-3h2v3h2q.425 0 .713-.288T17 17q0-.425-.288-.713T16 16h-2q-1.25 0-2.125-.875T11 13q0-1.25.875-2.125T14 10h1V6q0-1.25.875-2.125T18 3q1.25 0 2.125.875T21 6q0 1.25-.875 2.125T18 9h-1v4h1q1.25 0 2.125.875T21 16q0 1.25-.875 2.125T18 19h-3z" fill="currentColor"/></svg>',
  seal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.2 4.45L19 7.2l-3.5 3.4.85 4.8L12 13.55 7.65 15.4l.85-4.8L5 7.2l4.8-.75L12 2zm-6 17h12v2H6v-2z" fill="currentColor"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.75A10.25 10.25 0 1 0 22.25 12 10.262 10.262 0 0 0 12 1.75zm.75 5.5h-1.5v5.36l4.49 2.69.76-1.28-3.75-2.22z" fill="currentColor"/></svg>',
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c-4.97 0-8 1.79-8 4v10c0 2.21 3.03 4 8 4s8-1.79 8-4V7c0-2.21-3.03-4-8-4zm0 2c3.86 0 6 .99 6 2s-2.14 2-6 2-6-.99-6-2 2.14-2 6-2zm0 12c-3.86 0-6-.99-6-2V9.97C7.35 10.63 9.53 11 12 11s4.65-.37 6-1.03V15c0 1.01-2.14 2-6 2z" fill="currentColor"/></svg>',
  banner: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h11l-2 4 2 4H8v10H6V3z" fill="currentColor"/></svg>',
  influence: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.1 6.29L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.9-.98L12 2z" fill="currentColor"/></svg>',
  governance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20h18v-2H3v2zm2-4h3V8H5v8zm5 0h4V4h-4v12zm6 0h3V11h-3v5z" fill="currentColor"/></svg>',
  network: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11c1.66 0 2.99-1.57 2.99-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11zm-8 0c1.66 0 2.99-1.57 2.99-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11zm0 2c-2.33 0-7 1.17-7 3.5V20h14v-3.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.95 1.97 3.45V20h6v-3.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor"/></svg>',
  strategy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6c-1.1 0-2 .9-2 2v16l4-3 4 3 4-3 4 3V8l-6-6zm0 2.5L18.5 9H14V4.5z" fill="currentColor"/></svg>',
  martial: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.71 11.29l-9-9a1 1 0 0 0-1.42 0l-9 9 1.42 1.42L7 9.41V21h10V9.41l3.29 3.3 1.42-1.42z" fill="currentColor"/></svg>',
  military: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 4v6c0 5-3.41 9.74-8 10-4.59-.26-8-5-8-10V6l8-4zm0 4.18L7 8.5V12c0 3.53 2.24 6.95 5 7.78 2.76-.83 5-4.25 5-7.78V8.5l-5-2.32z" fill="currentColor"/></svg>',
  jianghu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.43 12.98l1.77-1.77-2.12-2.12-1.77 1.77-2.83-2.83 1.77-1.77-2.12-2.12-1.77 1.77L8.83 2.39 2.39 8.83l3.53 3.53-1.77 1.77 2.12 2.12 1.77-1.77 2.83 2.83-1.77 1.77 2.12 2.12 1.77-1.77 3.53 3.53 6.44-6.44-3.53-3.53z" fill="currentColor"/></svg>',
  growth: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22C7 22 3 18 3 13c0-4.97 3.58-9.12 8.3-9.88.48-.08.94.23 1.03.71.08.48-.23.94-.71 1.03C7.7 5.48 4.75 8.93 4.75 13c0 4.04 3.21 7.25 7.25 7.25 3.96 0 7.17-3.21 7.25-7.17.01-.48.41-.87.89-.86.48.01.87.41.86.89C20.9 18 16.89 22 12 22zm-.5-4.5V8.75h1.5v8h4v1.5h-5.5z" fill="currentColor"/></svg>',
  world: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm6.93 6h-3.01a15.8 15.8 0 0 0-1.38-3.32A8.03 8.03 0 0 1 18.93 8zM12 4c.83 1.2 1.53 2.54 2.05 4H9.95A13.9 13.9 0 0 1 12 4zM4.26 14A8.2 8.2 0 0 1 4 12c0-.69.09-1.36.26-2h3.42a16.7 16.7 0 0 0 0 4H4.26zm.81 2h3.01c.34 1.18.8 2.3 1.38 3.32A8.03 8.03 0 0 1 5.07 16zM8.68 14a14.8 14.8 0 0 1 0-4h6.64c.17.65.26 1.32.26 2s-.09 1.35-.26 2H8.68zM12 20c-.83-1.2-1.53-2.54-2.05-4h4.11A13.9 13.9 0 0 1 12 20zm2.54-.68c.58-1.02 1.04-2.14 1.38-3.32h3.01a8.03 8.03 0 0 1-4.39 3.32zM16.32 14a16.7 16.7 0 0 0 0-4h3.42A8.2 8.2 0 0 1 20 12c0 .69-.09 1.36-.26 2h-3.42z" fill="currentColor"/></svg>'
};
const STORY_GLOSSARY = {
  '汉末': {
    key: '汉末',
    title: '汉末',
    body: '通常指东汉晚期到三国形成前的动荡阶段。朝廷权威衰退，州郡、豪强、军阀与门阀并起，人物命运和地盘秩序都高度不稳定。'
  },
  '建安': {
    key: '建安',
    title: '建安',
    body: '东汉献帝年号之一。游戏里出现“建安元年”“建安五年”这类写法时，本质是在提示当前回合所处的历史时间坐标。'
  },
  '部曲': {
    key: '部曲',
    title: '部曲',
    body: '可理解为你当前能直接调动、基本听令的人手与私属武装，是行动力和战场执行力的重要来源。'
  },
  '门派': {
    key: '门派',
    title: '门派',
    body: '不仅是学武的地方，也是一套人情、传承、规矩与势力网络。加入后得到的不只是招式，还包括立场与约束。'
  },
  '粮秣': {
    key: '粮秣',
    title: '粮秣',
    body: '广义上指军旅、远行和长期经营所依赖的粮食与补给。它直接影响你能否持续调兵、攻城、远行和养队伍。'
  },
  '士气': {
    key: '士气',
    title: '士气',
    body: '反映队伍和个人是否还愿意继续压上。士气低时，很多高风险行动虽然还能点，但实际后果更容易失控。'
  }
};
const RETINUE_ROLE_META = {
  steward: { name: '内务主事', slotLabel: '内务', yieldText: '让经营与后勤动作更稳，更容易把钱粮落到实处。' },
  quartermaster: { name: '军需总管', slotLabel: '军需', yieldText: '能把经营收益转成部曲可用的补给与士气。' },
  counselor: { name: '帐前参议', slotLabel: '参议', yieldText: '让谋略与交涉类动作更容易拿到清晰收益。' },
  spymaster: { name: '暗线统筹', slotLabel: '暗线', yieldText: '能把探查和布局做深，减少空转。' },
  scout: { name: '江湖耳目', slotLabel: '耳目', yieldText: '能把江湖线与奇遇线更快接起来。' },
  escort: { name: '护行客卿', slotLabel: '护行', yieldText: '让江湖与武学动作更稳，不容易被反噬。' },
  drillmaster: { name: '部曲教头', slotLabel: '教头', yieldText: '能把军旅动作更稳定地转成士气与可用战力。' },
  vanguard: { name: '亲卫先锋', slotLabel: '先锋', yieldText: '能把军功、威望与阵前气势更快打出来。' }
};
const TEXT_MAP_GROUPS = [
  { region: '司隶与关中', cities: ['洛阳', '长安', '汉中'] },
  { region: '河北与幽州', cities: ['邺城', '平原', '北平'] },
  { region: '豫州与徐淮', cities: ['许昌', '寿春', '彭城', '下邳', '小沛', '广陵'] },
  { region: '荆襄与荆南', cities: ['宛城', '新野', '襄阳', '江陵', '长沙', '武陵'] },
  { region: '江东与江夏', cities: ['合肥', '建业', '吴', '会稽', '柴桑'] },
  { region: '巴蜀', cities: ['成都'] }
];
const DONATION_ENTRY = {
  enabled: true,
  triggerLabel: '自愿打赏',
  title: '扫码随喜支持',
  description: '如果你愿意支持这个项目的服务器、模型调用和后续更新，可以任选微信或支付宝扫码打赏。',
  note: '这是自愿支持入口，不影响正常游玩，也不替代现有的试玩与账号机制。',
  guideLead: '如果你喜欢现在这套玩法、叙事和持续迭代节奏，这个入口就是给愿意随喜支持的人留的。',
  guideFoot: '支持完全出于自愿，不会影响存档、剧情分支、账号权益或任何玩法数值。',
  usageLines: [
    'VPS 与域名等基础运行成本',
    '大模型接口调用与流式演绎消耗',
    '后续内容扩写、UI 调整和玩法迭代'
  ],
  channels: {
    wechat: {
      key: 'wechat',
      label: '微信',
      image: '/donation/wechat-pay.png',
      expectedPath: 'static/donation/wechat-pay.png',
      alt: '微信收款码'
    },
    alipay: {
      key: 'alipay',
      label: '支付宝',
      image: '/donation/alipay-pay.png',
      expectedPath: 'static/donation/alipay-pay.png',
      alt: '支付宝收款码'
    }
  }
};

function createEmptySnapshot() {
  return {
    sessionId: '',
    ownerUserId: '',
    playAccess: null,
    pendingThreads: [],
    world: {
      gameTitle: '汉末·往昔之影',
      phase: 'choose_background',
      dateLabel: '建安元年二月',
      turn: 0,
      maxTurns: 144,
      currentCityName: '',
      currentRegion: '',
      originCityName: '',
      weather: '阴',
      pressure: 0,
      map: { routes: [], longRoutes: [], atlas: { regions: TEXT_MAP_GROUPS } },
      territory: {
        stationedCityIds: [],
        governedCityIds: [],
        controlledCityIds: [],
        currentAuthority: 'none',
        currentAuthorityLabel: '无根基',
        currentAuthoritySummary: '只是路过此地，谈不上在城里站稳。',
        currentAuthorityScore: 0,
        cityCount: 0,
        governedCount: 0,
        controlledCount: 0,
        incomePerTurn: 0,
        supplyPerTurn: 0,
        troopSupportPerTurn: 0,
        warningCityIds: [],
        cityCards: [],
        summaryLine: '眼下还没有真正纳入名下的城池。'
      },
      mainline: { title: '先立住脚', summary: '先让自己有块能站住的地方。', crisis: '根基未稳。', progress: 0 }
    },
    gameState: {
      name: '无名之人', gender: '', genderLabel: '未定', pronoun: '',
      nameSource: 'generated', renameCount: 0, renameLimit: 1,
      age: 22, alive: true, endingTier: '', endingTitle: '', endingSummary: '', endingBiography: '', endingCommentary: '', endingTree: [], endingTags: [], canInherit: false, inheritancePreview: null, inheritanceSummary: '',
      identity: '布衣', health: 100, maxHealth: 100, fatigue: 0, coins: 0, supplies: 0, troops: 0, morale: 0,
      influence: 0, renown: 0, governance: 8, diplomacy: 8, commerce: 8, military: 8, strategy: 8,
      martialRealm: '未入流', martialLevel: 0, martialExp: 0, martialPower: 2, martialRouteId: 'wild', martialRouteName: '乱世野修', martialRouteSummary: '没有完整传承，只能先活下来再谈路数。',
      martialFocusId: 'unbound', martialFocusName: '未定志向', martialFocusSummary: '还在摸索这一身武学最后是压进军阵，还是压进江湖。', martialTitle: '未入流', battlefieldPrestige: 0, jianghuPrestige: 0, martialLimitBroken: false, martialTrainingCap: 90, martialBreakthroughState: '未破限', martialBreakthroughHint: '常规修炼最高止于90。想再往上，只能靠真正的奇遇、绝境或宗师点拨破限。',
      martialApex: {
        unlockedAtTurn: 0, threat: 0, exposure: 0, burden: 0, sideEffectStage: 0, lastSideEffectTurn: 0, lastCrisisTurn: 0, lastBurdenNote: '', triggeredCrisisKeys: [], resolvedCrisisKeys: []
      },
      strategyLevel: 0, strategyExp: 0, strategyRouteName: '乱世求生', strategyRouteSummary: '先攒底子，再决定怎么改局。',
      sectName: '无门无派', sectPower: 0, sectFavor: 0,
      relationships: [], skills: [], factions: [], advisory: [], lastResolutionSummary: '', lastRuleSummary: '', lastDeltaLine: '', lastCityReport: null, lastRetinueFeedback: null, lastSkillFeedback: null, lastBattleReport: null, activeBattle: null,
      historical: { eventStates: {}, activeEventIds: [], historyMomentum: 0, lastEventTitle: '', lastEventSummary: '' },
      dramaticLayer: {
        activeQuestion: '',
        sceneResidue: [],
        latestScenePlan: { surfaceGoal: '', obstacle: '', turnPoint: '', emotionalShift: '', closingBeat: '', tone: '', pace: '' },
        softState: { actor: { pressure: 0, desire: 0, composure: 0 }, relations: {}, factions: {} },
        lastMeta: { turn: 0, source: '', actionKind: '', actionMode: '', summary: '' }
      }
    },
    scene: { title: '汉末·往昔之影', text: '', statusLine: '' },
    choices: [],
    settings: {
      managedByServer: true,
      providerName: 'Local Fallback',
      model: 'local-fallback',
      enabled: false,
      apiBaseUrl: '',
      apiKeyConfigured: false,
      endpointStrategy: 'auto',
      dynamicChoiceMode: 'batch_first',
      configSource: {},
      configFile: 'server/config/provider.config.json'
    }
  };
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeGameStateShape(source, fallback) {
  const gameState = source && typeof source === 'object' ? source : {};
  const empty = fallback || {};
  const retinue = gameState.retinue && typeof gameState.retinue === 'object' ? gameState.retinue : {};
  const historical = gameState.historical && typeof gameState.historical === 'object' ? gameState.historical : {};

  return Object.assign({}, empty, gameState, {
    relationships: ensureArray(gameState.relationships),
    skills: ensureArray(gameState.skills),
    factions: ensureArray(gameState.factions),
    advisory: ensureArray(gameState.advisory),
    endingTree: ensureArray(gameState.endingTree),
    endingTags: ensureArray(gameState.endingTags),
    retinue: Object.assign({}, retinue, {
      members: ensureArray(retinue.members),
      assignments: ensureArray(retinue.assignments),
      recruitTracks: ensureArray(retinue.recruitTracks)
    }),
    historical: Object.assign({}, empty.historical || {}, historical, {
      activeEventIds: ensureArray(historical.activeEventIds)
    }),
    dramaticLayer: Object.assign({}, empty.dramaticLayer || {}, gameState.dramaticLayer || {}, {
      sceneResidue: ensureArray((((gameState.dramaticLayer || {}).sceneResidue))),
      latestScenePlan: Object.assign({}, ((empty.dramaticLayer || {}).latestScenePlan || {}), ((gameState.dramaticLayer || {}).latestScenePlan || {})),
      softState: Object.assign({}, ((empty.dramaticLayer || {}).softState || {}), ((gameState.dramaticLayer || {}).softState || {}), {
        relations: Object.assign({}, (((empty.dramaticLayer || {}).softState || {}).relations || {}), (((gameState.dramaticLayer || {}).softState || {}).relations || {})),
        factions: Object.assign({}, (((empty.dramaticLayer || {}).softState || {}).factions || {}), (((gameState.dramaticLayer || {}).softState || {}).factions || {}))
      }),
      lastMeta: Object.assign({}, ((empty.dramaticLayer || {}).lastMeta || {}), ((gameState.dramaticLayer || {}).lastMeta || {}))
    }),
    martialApex: Object.assign({}, empty.martialApex || {}, gameState.martialApex || {}, {
      triggeredCrisisKeys: ensureArray(((gameState.martialApex || {}).triggeredCrisisKeys)),
      resolvedCrisisKeys: ensureArray(((gameState.martialApex || {}).resolvedCrisisKeys))
    })
  });
}

function normalizeSnapshotShape(snapshot, preservedStoryText = '') {
  const empty = createEmptySnapshot();
  const safeSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const world = safeSnapshot.world && typeof safeSnapshot.world === 'object' ? safeSnapshot.world : {};
  const worldMap = world.map && typeof world.map === 'object' ? world.map : {};
  const atlas = worldMap.atlas && typeof worldMap.atlas === 'object' ? worldMap.atlas : {};
  const scene = safeSnapshot.scene && typeof safeSnapshot.scene === 'object' ? safeSnapshot.scene : {};

  return Object.assign({}, empty, safeSnapshot, {
    ownerUserId: safeSnapshot.ownerUserId || '',
    playAccess: safeSnapshot.playAccess || null,
    settings: Object.assign({}, empty.settings, safeSnapshot.settings || {}),
    world: Object.assign({}, empty.world, world, {
      map: Object.assign({}, empty.world.map, worldMap, {
        routes: ensureArray(worldMap.routes),
        longRoutes: ensureArray(worldMap.longRoutes),
        atlas: Object.assign({}, empty.world.map.atlas, atlas, {
          regions: ensureArray(atlas.regions).length ? ensureArray(atlas.regions) : empty.world.map.atlas.regions
        })
      }),
      mainline: Object.assign({}, empty.world.mainline, world.mainline || {})
    }),
    gameState: normalizeGameStateShape(safeSnapshot.gameState, empty.gameState),
    scene: Object.assign({}, empty.scene, scene, {
      text: preservedStoryText || (scene.text || '')
    }),
    pendingThreads: ensureArray(safeSnapshot.pendingThreads),
    choices: ensureArray(safeSnapshot.choices)
  });
}

export default {
  name: 'GamePageHanmoChronicleV2',
  components: {
    CrpgLayout,
    ActionDeck,
    GameHeroHub,
    MobileWorkbenchDock,
    UiButton,
    UiModal,
    UiToastStack
  },
  data() {
    return {
      sessionId: '',
      snapshot: createEmptySnapshot(),
      isMobileLayout: false,
      activeMobileView: 'story',
      activeMobileStoryPanel: 'mainline',
      activeMobileDynamicSlot: 0,
      activeMobileFixedSection: '',
      storyPanelExpanded: {
        mainline: false,
        status: false
      },
      mobileSelfDetailsExpanded: false,
      mobileStoryToolsExpanded: false,
      mobileAuthGuideExpanded: false,
      storyChromeHidden: false,
      lastStoryScrollTop: 0,
      storyAutoFollow: true,
      storyAutoScrolling: false,
      aiLoading: false,
      playerInput: '',
      showCustomActionInput: false,
      systemStatus: '',
      streamingText: '',
      typedStoryText: '',
      storyTypingTimer: null,
      storyArchive: [],
      storyStageCleared: false,
      activeOverlay: '',
      loadingTimer: null,
      loadingStartedAt: 0,
      placeholderStreaming: false,
      narrationDoneReceived: false,
      streamDoneReceived: false,
      pendingPhaseOverride: '',
      activeAbilityPage: 'martial',
      activeIntelTab: 'self',
      activeSelfSection: 'survival',
      abilityCollapsed: false,
      storyDragging: false,
      storyDragStartY: 0,
      storyDragStartScrollTop: 0,
      retinuePanelHeight: 304,
      retinueResizing: false,
      retinueResizeStartY: 0,
      retinueResizeStartHeight: 304,
      liveChoices: [],
      liveChoiceDrafts: [],
      battleUiReleased: false,
      pendingBattleAction: false,
      choiceDraftTimers: {},
      activeStatusPanel: 'resources',
      activeChoiceDirection: '',
      crpgCommandGroupKey: '',
      activeFixedGroupFilter: '',
      fixedDirectionExpanded: false,
      relationChoiceTargets: {},
      authReady: false,
      authMode: 'login',
      authLoading: false,
      purchaseLoading: false,
      activePurchaseSku: '',
      activeDonationChannel: 'wechat',
      donationGuideVisible: false,
      authDialogVisible: false,
      desktopCharacterStatsVisible: false,
      desktopRenderError: null,
      namePromptVisible: false,
      namePromptMode: 'create',
      namePromptInput: '',
      namePromptAllowEmpty: true,
      namePromptError: '',
      namePromptResolver: null,
      interactionPulseTimer: null,
      glossarySheetVisible: false,
      activeGlossaryEntryKey: '',
      previousGameStateForDelta: null,
      donationQrLoadFailed: {
        wechat: false,
        alipay: false
      },
      currentUser: null,
      authForm: {
        username: '',
        password: '',
        displayName: ''
      },
      adminSeed: {
        username: 'admin',
        password: 'admin123456'
      },
      toastItems: []
    };
  },
  created() {
    this.$message = {
      success: (text) => this.pushToast('success', text),
      error: (text) => this.pushToast('error', text)
    };
  },
  computed: {
    showAccessStrip() {
      if (!(this.currentUser || this.snapshot.playAccess)) return false;
      if (this.isMobileLayout && !this.currentUser) return false;
      return true;
    },
    gameTitle() {
      const rawTitle = String(this.snapshot.world.gameTitle || '').trim();
      if (!rawTitle || rawTitle === '汉末往事之卷' || rawTitle === '汉末往昔之影') return '汉末·往昔之影';
      return rawTitle;
    },
    heroDescription() {
      if (this.isMobileLayout) {
        return this.snapshot.world.phase === 'playing'
          ? '先看正文，再从少量高价值动作里挑一手、押一路、做取舍。'
          : '先选来路和落脚城，这卷乱世才会真正开始。';
      }
      return '这不是一条固定职业线。我可以经营城池、结交人物、投身军旅，也可以独行江湖，把一身武学修到足以改变战局。';
    },
    displayTitleTags() {
      const tags = [
        this.snapshot.world.dateLabel,
        `第${this.snapshot.world.turn || 0}回`,
        `${this.snapshot.gameState.age || 22}岁`,
        this.snapshot.gameState.name || '无名之人',
        this.snapshot.gameState.genderLabel || '未定',
        this.snapshot.world.currentCityName || '籍贯未定',
        this.snapshot.gameState.identity || '布衣',
        this.snapshot.gameState.martialRealm || '未入流'
      ].filter(Boolean);
      return this.isMobileLayout ? tags.slice(0, 4) : tags;
    },
    showMobileStarterCard() {
      return this.isMobileLayout
        && ['choose_background', 'choose_origin'].includes(String(this.snapshot.world.phase || '').trim());
    },
    mobileStarterTitle() {
      if (this.snapshot.world.phase === 'choose_origin') return '第二步：先定落脚城';
      return '先定出身，再把故事放进一座城';
    },
    mobileStarterSummary() {
      if (this.snapshot.world.phase === 'choose_origin') {
        return '出身已经定下。现在只要选一座城，这卷故事就会切进真正可操作的正文盘面。';
      }
      return '新玩家首屏不需要先看完整面板。先挑一条来路，再挑一座城，系统才会放出真正有意义的动作。';
    },
    mobileStarterSteps() {
      return this.snapshot.world.phase === 'choose_origin'
        ? [
          { title: '1. 看落子区', text: '直接切到“落子”，从城池选项里定第一座落脚城。' },
          { title: '2. 进入正文', text: '选完城池后，剧情区会立刻落下第一段正文。' },
          { title: '3. 再看面板', text: '等正文起来之后，再去看情报舱和数值面板也不迟。' }
        ]
        : [
          { title: '1. 先选出身', text: '第一回只需要在落子区选一条来路，不用先研究完整系统。' },
          { title: '2. 再定城池', text: '选完出身后，系统会让你决定故事先落在哪座城。' },
          { title: '3. 正文起来后再做局', text: '进入正文后，优先点动态动作，固定动作放在次级。' }
        ];
    },
    showTurnOverview() {
      if (!this.isMobileLayout) return true;
      return !!this.currentUser || Number(this.snapshot.world.turn || 0) > 0 || this.snapshot.world.phase === 'playing';
    },
    remainingRenameCount() {
      const limit = Number(this.snapshot.gameState.renameLimit || 0);
      const used = Number(this.snapshot.gameState.renameCount || 0);
      return Math.max(0, limit - used);
    },
    canRenamePlayer() {
      return !!this.sessionId && this.remainingRenameCount > 0;
    },
    playerRenameLabel() {
      return this.remainingRenameCount > 0 ? `改名一次` : '姓名已定';
    },
    showMobileStageSwitch() {
      if (!this.isMobileLayout) return false;
      return !this.showMobileStarterCard;
    },
    showMobileQuickActions() {
      return false;
    },
    mobileViewOptions() {
      const iconByKey = {
        story: UI_ICON_MAP.strategy,
        action: UI_ICON_MAP.route,
        intel: UI_ICON_MAP.seal
      };
      return Object.keys(MOBILE_VIEW_META).map((key) => Object.assign({}, MOBILE_VIEW_META[key], {
        icon: iconByKey[key] || UI_ICON_MAP.route
      }));
    },
    mobileStatusItems() {
      const gs = this.snapshot.gameState || {};
      return [
        { key: 'date', label: '时局', value: this.snapshot.world.dateLabel || '未定' },
        { key: 'coins', label: '资财', value: Number(gs.coins || 0) },
        { key: 'morale', label: '军心', value: Number(gs.morale || 0) },
        { key: 'influence', label: '声势', value: Number(gs.influence || 0) }
      ];
    },
    titleCrestStats() {
      return [
        { key: 'city', label: '落脚', value: this.snapshot.world.currentCityName || '未定', icon: UI_ICON_MAP.city },
        { key: 'mainline', label: '主线', value: this.currentMainline.title || '未定', icon: UI_ICON_MAP.route },
        { key: 'identity', label: '身份', value: this.snapshot.gameState.identity || '布衣', icon: UI_ICON_MAP.seal }
      ];
    },
    titleSignalCards() {
      const gs = this.snapshot.gameState || {};
      return [
        { key: 'time', label: '时局', value: this.snapshot.world.dateLabel || '未定', icon: UI_ICON_MAP.clock },
        { key: 'funds', label: '资财', value: `${Number(gs.coins || 0)}钱`, icon: UI_ICON_MAP.coin },
        { key: 'morale', label: '军心', value: `${Number(gs.morale || 0)}`, icon: UI_ICON_MAP.banner },
        { key: 'influence', label: '声势', value: `${Number(gs.influence || 0)}`, icon: UI_ICON_MAP.influence }
      ];
    },
    topVitalStats() {
      const gs = this.snapshot.gameState || {};
      return [
        {
          key: 'time',
          label: '时局',
          value: this.snapshot.world.dateLabel || '未定',
          short: `主线 ${this.mainlineProgress}%`,
          icon: UI_ICON_MAP.clock
        },
        {
          key: 'funds',
          label: '资财',
          value: Number(gs.coins || 0),
          short: `粮 ${Number(gs.supplies || 0)}`,
          icon: UI_ICON_MAP.coin
        },
        {
          key: 'morale',
          label: '军心',
          value: Number(gs.morale || 0),
          short: `疲 ${Number(gs.fatigue || 0)}`,
          icon: UI_ICON_MAP.banner
        },
        {
          key: 'influence',
          label: '声势',
          value: Number(gs.influence || 0),
          short: `望 ${Number(gs.renown || 0)}`,
          icon: UI_ICON_MAP.influence
        }
      ];
    },
    turnOverviewMarkers() {
      return [
        { key: 'mainline', label: '主线', value: this.currentMainline.title || '未定', icon: UI_ICON_MAP.route },
        { key: 'pressure', label: '压力', value: Number(this.snapshot.world.pressure || 0), icon: UI_ICON_MAP.strategy },
        { key: 'identity', label: '身份', value: this.snapshot.gameState.identity || '布衣', icon: UI_ICON_MAP.seal }
      ];
    },
    turnOverviewOracleLine() {
      if (this.inBattle) return '眼下先拆战局，不宜把注意力分给旁线。';
      if (this.isSetupPhase) {
        return this.snapshot.world.phase === 'choose_origin'
          ? '先定落脚城，最先遇见的人和门路才会真正显出来。'
          : '先定出身，这卷故事的底色和第一层手牌才会落稳。';
      }
      if (this.activeFixedDirectionMeta) return `这一回更适合先从“${this.activeFixedDirectionMeta.label}”方向落手，把当前局面压稳。`;
      return '先看主线态势，再决定是补根基、接人物，还是直接抢线。';
    },
    titleDeckTitle() {
      if (this.inBattle) return '战局已起，工作区切到战场。';
      if (this.isSetupPhase) return this.snapshot.world.phase === 'choose_origin' ? '先定落脚城，再让故事真正起笔。' : '先定出身，再决定故事从哪一条命路切进来。';
      return '先读正文与局势，再去落子区把这一回推进下去。';
    },
    titleDeckSummary() {
      if (this.inBattle) return '正文、状态和战斗操作都已经合并在主界面，不需要来回跳转。';
      if (this.showRecommendedFixedChoices) return '固定行动区已经替你把更适合眼前盘面的先手动作顶到前面，适合直接落手。';
      return '当前界面把正文、局势、常备动作和情报舱并在同一页，优先级顺序是：先看局，再落子。';
    },
    titleDeckMeta() {
      return [
        { key: 'phase', label: '阶段', value: this.snapshot.world.phase === 'playing' ? '经营中' : (this.snapshot.world.phase || '未定') },
        { key: 'city', label: '所在', value: this.snapshot.world.currentCityName || '未定' },
        { key: 'prompt', label: '落子', value: this.phasePrompt }
      ];
    },
    activeMobileViewMeta() {
      return MOBILE_VIEW_META[this.activeMobileView] || MOBILE_VIEW_META.story;
    },
    mobileStoryPanelOptions() {
      return Object.keys(MOBILE_STORY_PANEL_META).map((key) => MOBILE_STORY_PANEL_META[key]);
    },
    storySummaryRibbon() {
      return [
        { key: 'mainline', label: '主线', value: this.currentMainline.title || '未定' },
        { key: 'advice', label: '建议', value: this.currentMomentPanel.shortAdvice || '先审局势' },
        { key: 'status', label: '状态', value: this.currentMomentPanel.badge || '可决策' }
      ];
    },
    mainlineInlineFacts() {
      return [
        { label: '推进', value: `${this.mainlineProgress}%` },
        { label: '压力', value: Number(this.snapshot.world.pressure || 0) },
        { label: '隐患', value: this.currentMainline.crisis || '暂无' }
      ];
    },
    mainlineExpandedFacts() {
      return [
        { key: 'title', label: '主线题眼', value: this.currentMainline.title || '未定' },
        { key: 'focus', label: '落手方向', value: this.activeFixedDirectionMeta ? this.activeFixedDirectionMeta.label : '先看推荐手' },
        { key: 'status', label: '当前状态', value: this.snapshot.scene.statusLine || '局势仍在推进' }
      ];
    },
    currentMomentInlineFacts() {
      return [
        { label: '状态', value: this.currentMomentPanel.badge || '可决策' },
        { label: '建议', value: this.currentMomentPanel.shortAdvice || '先审主线' }
      ];
    },
    currentResponseMeta() {
      if (this.interactionLocked) {
        return {
          note: '这一卷已经落定，眼下只剩回看与重开。',
          warning: ''
        };
      }
      if (this.turnProcessingState) {
        return {
          note: this.turnProcessingState.kind === 'battle' ? '战局结果会先写回剧情，再刷新下一手。' : '正文与下一轮可选动作正在接续整理。',
          warning: ''
        };
      }
      if (this.narrationStreaming) {
        return {
          note: '先看正文继续怎么落，再决定是否立刻接下一手。',
          warning: this.waitingForNarration ? '首段正文尚未落下，稍候会继续补全。' : ''
        };
      }
      if (this.inBattle) {
        return {
          note: '战斗操作会直接改变场上强弱，先读清上一手余波。',
          warning: ''
        };
      }
      return {
        note: this.showRecommendedFixedChoices ? '下方已把更适合眼前盘面的先手动作提到前面。' : '可以先看主线态势，再从落子区挑一手推进。',
        warning: ''
      };
    },
    currentMomentPanel() {
      const title = this.interactionLocked
        ? '此局已定'
        : this.narrationStreaming
          ? '叙事正在展开'
          : this.aiLoading
            ? '正在收束本回'
            : '等待我落子';
      const badge = this.inBattle ? '战局' : (this.aiLoading || this.narrationStreaming ? '处理中' : '可决策');
      const summary = this.displayStatusText;
      const items = [
        {
          key: 'state',
          label: '局势状态',
          value: title,
          note: this.currentResponseMeta.warning || '当前盘面状态'
        },
        {
          key: 'advice',
          label: '行动建议',
          value: this.showRecommendedFixedChoices ? '先看推荐手' : '先审主线',
          note: this.currentResponseMeta.note || '当前动作导向'
        },
        {
          key: 'runtime',
          label: '运转情况',
          value: this.runtimeConfigLine ? '已配置' : '本地续写',
          note: this.runtimeConfigLine || this.lastProviderIssueLine || '当前没有额外运行提示'
        }
      ];
      return {
        title,
        badge,
        summary,
        shortAdvice: this.showRecommendedFixedChoices ? '先看推荐先手' : '先看主线后落子',
        note: this.lastProviderIssueLine || this.currentResponseMeta.note || '局势眼下没有额外枝节提醒。',
        items
      };
    },
    currentStagePackage() {
      if (this.inBattle) return STAGE_PACKAGE_META.wartime;
      const phase = String(this.snapshot.world.phase || '').trim();
      if (phase === 'choose_background' || phase === 'choose_origin') return STAGE_PACKAGE_META.opening;
      if (this.interactionLocked) return STAGE_PACKAGE_META.endgame;
      const territory = this.territorySummary || {};
      const gs = this.snapshot.gameState || {};
      const retinue = this.retinueOverview;
      const governed = Number(territory.governedCount || 0);
      const controlled = Number(territory.controlledCount || 0);
      const memberCount = Number(retinue && retinue.memberCount || 0);
      const assignmentCount = Number(retinue && retinue.assignmentCount || 0);
      const influence = Number(gs.influence || 0);
      const pressure = Number(this.snapshot.world.pressure || 0);
      const battlefield = Number(gs.battlefieldPrestige || 0);
      const martial = Number(gs.martialLevel || 0);

      if (controlled >= 2 || governed >= 2 || influence >= 55) return STAGE_PACKAGE_META.expansion;
      if (pressure >= 48 || battlefield >= 24 || Number(gs.troops || 0) >= 120) return STAGE_PACKAGE_META.wartime;
      if (memberCount >= 2 || assignmentCount >= 1 || martial >= 24 || Number(gs.strategy || 0) >= 24) return STAGE_PACKAGE_META.growth;
      return STAGE_PACKAGE_META.footing;
    },
    progressionStats() {
      const gs = this.snapshot.gameState || {};
      const territory = this.territorySummary || {};
      const retinue = this.retinueOverview;
      return [
        {
          key: 'footing',
          label: '根基',
          value: territory.currentAuthorityLabel || '无根基',
          note: `控 ${Number(territory.controlledCount || 0)} / 纳 ${Number(territory.governedCount || 0)}`
        },
        {
          key: 'network',
          label: '人脉',
          value: `${this.visibleRelations.length} 人`,
          note: `影响 ${Number(gs.influence || 0)} / 名望 ${Number(gs.renown || 0)}`
        },
        {
          key: 'cadre',
          label: '班底',
          value: retinue ? `${retinue.memberCount}/${retinue.capacity}` : '0/6',
          note: retinue ? `任命 ${retinue.assignmentCount}` : '尚未成形'
        },
        {
          key: 'route',
          label: '路数',
          value: gs.martialFocusName || '未定志向',
          note: `${gs.strategyRouteName || '乱世求生'} / 武阶 ${gs.martialRealm || '未入流'}`
        }
      ];
    },
    progressionLoopCards() {
      const gs = this.snapshot.gameState || {};
      const territory = this.territorySummary || {};
      const retinue = this.retinueOverview;
      const historicalCount = this.historicalClueCards.length;
      return [
        {
          key: 'survive',
          title: '生存闭环',
          summary: '血量、疲惫、士气不能只靠休息恢复，也要靠收益、人物和低风险动作续航。',
          lines: [
            `当前体力 ${Number(gs.health || 0)}/${Number(gs.maxHealth || 100)}，疲惫 ${Number(gs.fatigue || 0)}，士气 ${Number(gs.morale || 0)}`,
            '若经济断档，养成、剧情高价值动作和关系回报必须都能补出恢复空间。'
          ]
        },
        {
          key: 'footing',
          title: '根基闭环',
          summary: '立足不只来自控城，还来自人脉、商路、任命和转场后的新入口。',
          lines: [
            `当前权柄 ${territory.currentAuthorityLabel || '无根基'}，每回合 ${Number(territory.incomePerTurn || 0)}钱 / ${Number(territory.supplyPerTurn || 0)}粮`,
            '即使暂时拿不到治权，也必须能靠人情、经营或换城继续抬高根基值。'
          ]
        },
        {
          key: 'cadre',
          title: '班底闭环',
          summary: '班底不是结果而是加速器；没人时要给招募替代路，有人时要给任命和协同回报。',
          lines: [
            retinue ? `当前队伍 ${retinue.memberCount}/${retinue.capacity}，任命 ${retinue.assignmentCount}，空位 ${retinue.vacancyCount}` : '尚未成队，招募、人脉和剧情传闻必须持续补入口。',
            '队伍成形后，应把收益、谋略与军旅动作转成真正的长期优势。'
          ]
        },
        {
          key: 'route',
          title: '路线闭环',
          summary: '武学、军旅、经世、江湖不应互斥锁死，副路线积累必须能反哺主线。',
          lines: [
            `当前志向 ${gs.martialFocusName || '未定'}，军旅威望 ${Number(gs.battlefieldPrestige || 0)}，江湖声望 ${Number(gs.jianghuPrestige || 0)}`,
            historicalCount ? `史势线索 ${historicalCount} 条已浮现，可用来转化路线推进。` : '还没有成型的史势线索时，系统也必须从城市、人脉或江湖补传闻。'
          ]
        }
      ];
    },
    stageSafetyRules() {
      return (this.currentStagePackage && this.currentStagePackage.safety) || [];
    },
    availabilityAuditCards() {
      const territory = this.territorySummary || {};
      const retinue = this.retinueOverview;
      const fixedDirections = this.availableFixedDirections || [];
      return [
        {
          key: 'entry',
          title: '入口完整性',
          state: fixedDirections.length >= 3 ? '稳定' : '偏少',
          summary: `当前可用行动门类 ${fixedDirections.length} 个。固定入口不应低于 3 个，否则就会形成单解。`
        },
        {
          key: 'recruit',
          title: '招募兜底',
          state: retinue && retinue.memberCount > 0 ? '已启动' : '待补强',
          summary: retinue && retinue.recruitTracks && retinue.recruitTracks.length
            ? `已有 ${retinue.recruitTracks.length} 条招募推进线，招募链未断。`
            : '若暂无可招募对象，系统需要继续给出打听、引荐、酒肆物色等低门槛替代手。'
        },
        {
          key: 'territory',
          title: '控城兜底',
          state: Number(territory.controlledCount || 0) > 0 || Number(territory.governedCount || 0) > 0 ? '已起势' : '前置中',
          summary: Number(territory.controlledCount || 0) > 0 || Number(territory.governedCount || 0) > 0
            ? '地盘线已经启动，可以通过经营、守成、扩张三路继续放大。'
            : '若暂时没有攻城口，必须保证经营、人脉或转场至少一路能继续抬升根基。'
        },
        {
          key: 'route',
          title: '路线可转化',
          state: this.historicalClueCards.length || this.pendingThreads.length ? '可推进' : '需投放',
          summary: this.historicalClueCards.length || this.pendingThreads.length
            ? '人物线、暗线或史势线已经有继续推进的抓手。'
            : '若主路线动作暂时断档，系统应主动投放传闻态或接触态内容，避免路线空转。'
        }
      ];
    },
    operationLaneLead() {
      if (this.showRecommendedFixedChoices && this.recommendedFixedChoices[0]) {
        return this.recommendedFixedChoices[0].text;
      }
      return this.operationHeadSummary;
    },
    heroHubViewModel() {
      return {
        showAccessStrip: this.showAccessStrip,
        currentUser: this.currentUser,
        accessIdentityTitle: this.accessIdentityTitle,
        accessIdentityText: this.accessIdentityText,
        trialRemainingTurns: this.trialRemainingTurns,
        paidTurnCredits: this.paidTurnCredits,
        hasMonthCard: this.hasMonthCard,
        monthCardStatusText: this.monthCardStatusText,
        purchaseLoading: this.purchaseLoading,
        activePurchaseSku: this.activePurchaseSku,
        accessFootText: this.accessFootText,
        togglePurchaseSku: this.togglePurchaseSku,
        purchaseTurnPack: this.purchaseTurnPack,
        purchaseMonthCard: this.purchaseMonthCard,
        logout: this.logout,
        snapshot: this.snapshot,
        gameTitle: this.gameTitle,
        heroDescription: this.heroDescription,
        displayTitleTags: this.displayTitleTags,
        titleCrestStats: this.titleCrestStats,
        titleDeckTitle: this.titleDeckTitle,
        titleDeckSummary: this.titleDeckSummary,
        titleDeckMeta: this.titleDeckMeta,
        titleSignalCards: this.titleSignalCards,
        aiLoading: this.aiLoading,
        resetGame: this.resetGame,
        donationEntry: this.donationEntry,
        donationChannels: this.donationChannels,
        activeDonationChannel: this.activeDonationChannel,
        setActiveDonationChannel: this.setActiveDonationChannel,
        activeDonationQrAvailable: this.activeDonationQrAvailable,
        activeDonationConfig: this.activeDonationConfig,
        handleDonationQrError: this.handleDonationQrError,
        openDonationGuide: this.openDonationGuide,
        endingCanInherit: this.endingCanInherit,
        inheritGame: this.inheritGame,
        showMobileStarterCard: this.showMobileStarterCard,
        mobileStarterTitle: this.mobileStarterTitle,
        mobileStarterSummary: this.mobileStarterSummary,
        mobileStarterSteps: this.mobileStarterSteps,
        jumpToMobileSection: this.jumpToMobileSection,
        scrollToAuthZone: () => this.scrollToSection('authZone'),
        setupPhaseChoices: this.setupPhaseChoices,
        interactionBlocked: this.interactionBlocked,
        submitChoice: this.submitChoice,
        setupChoiceBadge: this.setupChoiceBadge,
        setupChoiceCategory: this.setupChoiceCategory,
        showTurnOverview: this.showTurnOverview,
        interactionBlocked: this.interactionBlocked,
        canRenamePlayer: this.canRenamePlayer,
        renamePlayerOnce: this.renamePlayerOnce,
        playerRenameLabel: this.playerRenameLabel,
        topOverviewSummary: this.topOverviewSummary,
        turnOverviewOracleLine: this.turnOverviewOracleLine,
        turnOverviewMarkers: this.turnOverviewMarkers,
        topVitalStats: this.topVitalStats,
        showMobileStageSwitch: this.showMobileStageSwitch,
        mobileStatusItems: this.mobileStatusItems,
        activeMobileViewMeta: this.activeMobileViewMeta,
        mobileViewOptions: this.mobileViewOptions,
        activeMobileView: this.activeMobileView
      };
    },
    actionDeckViewModel() {
      return {
        showSetupChoiceDeck: this.showSetupChoiceDeck,
        setupChoiceDeckTitle: this.setupChoiceDeckTitle,
        setupChoiceDeckSummary: this.setupChoiceDeckSummary,
        setupPhaseChoices: this.setupPhaseChoices,
        interactionBlocked: this.interactionBlocked,
        submitChoice: this.submitChoice,
        setupChoiceBadge: this.setupChoiceBadge,
        setupChoiceCategory: this.setupChoiceCategory,
        canShowNarrativeDynamicChoices: this.canShowNarrativeDynamicChoices,
        dynamicChoiceSlots: this.dynamicChoiceSlots,
        isMobileLayout: this.isMobileLayout,
        mobileDynamicChoiceTabs: this.mobileDynamicChoiceTabs,
        activeMobileDynamicSlot: this.activeMobileDynamicSlot,
        setActiveMobileDynamicSlot: this.setActiveMobileDynamicSlot,
        activeMobileDynamicSlotEntry: this.activeMobileDynamicSlotEntry,
        dynamicSlotMeta: this.dynamicSlotMeta,
        choiceForecastText: this.choiceForecastText,
        choiceRequirementsText: this.choiceRequirementsText,
        showFixedActionDeck: this.showFixedActionDeck,
        fixedDeckTitle: this.fixedDeckTitle,
        fixedDeckSummary: this.fixedDeckSummary,
        showRecommendedFixedChoices: this.showRecommendedFixedChoices,
        recommendedFixedChoices: this.recommendedFixedChoices,
        useDirectionPanel: this.useDirectionPanel,
        showFixedDirectionExpanded: this.showFixedDirectionExpanded,
        activeFixedDirectionMeta: this.activeFixedDirectionMeta,
        fixedNavSummary: this.fixedNavSummary,
        availableFixedDirections: this.availableFixedDirections,
        activeChoiceDirection: this.activeChoiceDirection,
        setActiveChoiceDirection: this.setActiveChoiceDirection,
        activeFixedPanelTitle: this.activeFixedPanelTitle,
        activeFixedGroupFilter: this.activeFixedGroupFilter,
        clearActiveFixedGroupFilter: this.clearActiveFixedGroupFilter,
        collapseFixedDirectionPanel: this.collapseFixedDirectionPanel,
        visibleFixedChoices: this.visibleFixedChoices,
        activeFixedPanelSummary: this.activeFixedPanelSummary,
        operationLaneLead: this.operationLaneLead,
        fixedQuickGroupLinks: this.fixedQuickGroupLinks,
        setActiveFixedGroupFilter: this.setActiveFixedGroupFilter,
        mobileFixedChoiceSections: this.mobileFixedChoiceSections,
        activeMobileFixedSection: this.activeMobileFixedSection,
        setActiveMobileFixedSection: this.setActiveMobileFixedSection,
        renderedFixedChoiceGroups: this.renderedFixedChoiceGroups,
        fixedGroupKicker: this.fixedGroupKicker,
        isRelationChoice: this.isRelationChoice,
        relationChoiceHint: this.relationChoiceHint,
        relationChoiceTargets: this.relationChoiceTargets,
        relationChoiceKey: this.relationChoiceKey,
        relationOptionsForChoice: this.relationOptionsForChoice,
        relationOptionLabel: this.relationOptionLabel,
        relationChoicePlaceholder: this.relationChoicePlaceholder,
        setRelationChoiceTarget: this.setRelationChoiceTarget,
        showCustomActionInput: this.showCustomActionInput,
        inBattle: this.inBattle,
        playerInput: this.playerInput,
        setPlayerInput: (value) => { this.playerInput = value; },
        submitCustom: this.submitCustom,
        aiLoading: this.aiLoading
      };
    },
    activeCrpgCommandGroup() {
      if (this.crpgCommandGroupKey) return this.crpgCommandGroupKey;
      if (this.inBattle) return 'battle';
      if (this.isSetupPhase) return 'setup';
      if (this.dynamicChoices.length || this.showRecommendedFixedChoices) return 'priority';
      return this.activeChoiceDirection || ((this.availableFixedDirections[0] || {}).key || '');
    },
    desktopSystemMenuItems() {
      const items = [
        {
          key: 'account',
          label: this.currentUser ? '当前账号' : '试玩状态',
          value: this.currentUser
            ? ((this.currentUser.displayName || this.currentUser.username || '已登录'))
            : (this.accessStatusText || '匿名试玩')
        }
      ];
      if (this.currentUser) {
        items.push(
          { key: 'auth', label: '登录或注册', value: '当前已登录' },
          { key: 'turn-credits', label: '储备回合', value: `${Number(this.paidTurnCredits || 0)} 回` },
          { key: 'month-card', label: '月卡', value: this.hasMonthCard ? this.monthCardStatusText : '未开启' }
        );
      }
      if (!this.currentUser) {
        items.push({ key: 'auth', label: '登录或注册', value: '继续这局并解锁更多试玩回合' });
      }
      if (this.canRenamePlayer) {
        items.push({ key: 'rename', label: this.playerRenameLabel, value: '仅可使用一次' });
      }
      items.push({ key: 'character-stats', label: '角色属性', value: '查看内政、军务、谋略、武艺' });
      if (this.donationEntry && this.donationEntry.enabled) {
        items.push({ key: 'donation-guide', label: this.donationEntry.triggerLabel, value: '查看支持说明' });
      }
      items.push({ key: 'reset', label: '重开此卷', value: '重新开始当前存档' });
      if (this.currentUser) items.push({ key: 'logout', label: '退出登录', value: '返回试玩状态' });
      return items;
    },
    desktopSupportEntry() {
      if (!this.donationEntry || !this.donationEntry.enabled) return null;
      return {
        key: 'donation-guide',
        label: this.donationEntry.triggerLabel,
        title: '支持创作',
        hint: '喜欢这局就点一下',
        value: '扫码随喜',
        pulse: !this.donationGuideVisible
      };
    },
    crpgCommandGroups() {
      if (this.inBattle) {
        return [
          {
            key: 'battle',
            label: this.battleModeLabel || '战斗',
            summary: this.battleCenterTip || this.battleModeSummary || '这一回的战场指令会直接在主界面结算。',
            count: `${this.battleCommandChoices.length} 项`,
            icon: UI_ICON_MAP.military,
            actions: this.battleCommandChoices.map(choice => this.buildCrpgActionFromChoice(choice, { badge: '战斗' }))
          }
        ];
      }

      if (this.isSetupPhase) {
        return [
          {
            key: 'setup',
            label: this.fixedDeckTitle,
            summary: this.setupChoiceDeckSummary,
            count: `${this.setupPhaseChoices.length} 项`,
            icon: UI_ICON_MAP.world,
            actions: this.setupPhaseChoices.map(choice => this.buildCrpgActionFromChoice(choice, { badge: this.setupChoiceBadge }))
          }
        ];
      }

      const groups = [];
      const priorityChoices = []
        .concat(this.dynamicChoiceSlots.filter(slot => slot && slot.type === 'choice').map(slot => slot.choice))
        .concat(this.recommendedFixedChoices)
        .filter((choice, index, list) => choice && list.findIndex(item => item.id === choice.id) === index);

      if (priorityChoices.length) {
        groups.push({
          key: 'priority',
          label: '当前优先',
          summary: this.operationHeadSummary,
          count: `${priorityChoices.length} 项`,
          icon: UI_ICON_MAP.route,
          actions: priorityChoices.map(choice => this.buildCrpgActionFromChoice(choice, {
            badge: choice.source === 'dynamic' ? '当前回合' : '推荐'
          }))
        });
      }

      this.availableFixedDirections.forEach((direction) => {
        const source = ((this.fixedChoiceGroups[direction.key] || {}).choices || [])
          .filter(choice => choice && !/^placeholder:/.test(String(choice.id || '')))
          .slice(0, 8);
        if (!source.length) return;
        groups.push({
          key: direction.key,
          label: direction.label,
          summary: direction.summary,
          count: `${direction.count} 项`,
          icon: direction.icon || UI_ICON_MAP.governance,
          actions: source.map(choice => this.buildCrpgActionFromChoice(choice))
        });
      });

      return groups;
    },
    crpgNarrativeViewModel() {
      const logs = [];
      if (this.recentBattleReturnCard) {
        logs.push({
          key: 'battle-return',
          label: '战局回流',
          paragraphs: [
            this.recentBattleReturnCard.summary,
            `我方战力 ${this.recentBattleReturnCard.playerStrength}，敌方战力 ${this.recentBattleReturnCard.enemyStrength}，折损 ${this.recentBattleReturnCard.casualties}，耗粮 ${this.recentBattleReturnCard.supplyCost}。`
          ]
        });
      }
      return {
        chapterTitle: this.snapshot.world.dateLabel || '建安元年',
        sceneTitle: this.snapshot.scene.title || '正文未起',
        sceneSubtitle: this.snapshot.scene.statusLine || '局势正在等待我落下下一步。',
        sceneBadge: this.currentMomentPanel.badge || '可决策',
        summaryRibbon: this.storySummaryRibbon,
        cards: [
          {
            key: 'mainline',
            kicker: '主线走势',
            title: this.currentMainline.title || '未定',
            badge: `进度 ${this.mainlineProgress}%`,
            description: this.currentMainline.summary || '主线眼下还没有完全成形。',
            facts: this.mainlineInlineFacts
          },
          {
            key: 'moment',
            kicker: '此刻局势',
            title: this.currentMomentPanel.title || '等待我落子',
            badge: this.currentMomentPanel.badge || '可决策',
            description: this.currentMomentPanel.summary || '先看主线，再决定这一回先压哪一路。',
            facts: this.currentMomentPanel.items.slice(0, 3).map(item => ({ label: item.label, value: item.value }))
          }
        ],
        storyHtml: this.renderedStoryHtml,
        storyArchive: this.showStoryArchiveCard ? this.latestArchivedStory : null,
        showStreamTail: this.showStoryStreamTail,
        streamingLabel: this.waitingForNarration ? '仍在等待正文首段…' : '正文仍在继续落下，后面还有内容。',
        logs
      };
    },
    crpgCharacterSheetViewModel() {
      const gs = this.snapshot.gameState || {};
      return {
        name: gs.name || '无名之人',
        title: `${gs.identity || '布衣'} · ${gs.martialRealm || '未入流'}`,
        location: `${this.snapshot.world.currentCityName || '未定城池'} · ${this.currentCityAuthorityLabel}`,
        tags: this.displayTitleTags.filter(tag => tag && tag !== (gs.name || '')).slice(0, 6),
        metrics: this.titleSignalCards,
        vitals: [
          {
            key: 'health',
            label: '寿元',
            value: `${Number(gs.health || 0)} / ${Number(gs.maxHealth || 100)}`,
            percent: this.percentOf(Number(gs.health || 0), Number(gs.maxHealth || 100) || 100),
            tone: 'danger'
          },
          {
            key: 'fatigue',
            label: '疲惫',
            value: `${Number(gs.fatigue || 0)}`,
            percent: this.reversePercent(Number(gs.fatigue || 0), 100),
            meta: '越高越不适合连续压强动作。'
          },
          {
            key: 'morale',
            label: '士气',
            value: `${Number(gs.morale || 0)}`,
            percent: this.percentOf(Number(gs.morale || 0), 100),
            tone: 'support',
            meta: this.sideDeltaMap.morale ? this.sideDeltaMap.morale.value : '当前战意与执行意愿。'
          },
          {
            key: 'renown',
            label: '名望',
            value: `${Number(gs.renown || 0)}`,
            percent: this.percentOf(Number(gs.renown || 0), 100),
            meta: '别人会不会把我当回事。'
          }
        ]
      };
    },
    desktopCharacterStats() {
      const gs = this.snapshot.gameState || {};
      const territory = this.territorySummary || {};
      const legacyBase = [
        Number(gs.attack || 0) ? `武力 ${Number(gs.attack || 0)}` : '',
        Number(gs.defense || 0) ? `智力 ${Number(gs.defense || 0)}` : '',
        Number(gs.agility || 0) ? `统率 ${Number(gs.agility || 0)}` : ''
      ].filter(Boolean).join(' / ') || '旧制字段未启用';
      return {
        name: gs.name || '无名之人',
        realm: gs.martialRealm || '未入流',
        summary: `${gs.identity || '布衣'} · ${this.snapshot.world.currentCityName || '未定城池'} · ${this.currentCityAuthorityLabel}`,
        items: [
          { key: 'health', label: '身骨', value: `${Number(gs.health || 0)} / ${Number(gs.maxHealth || 100)}`, tip: '体力与承伤余地' },
          { key: 'martialLevel', label: '武艺', value: Number(gs.martialLevel || 0), tip: '修习、试锋、江湖与战斗上限' },
          { key: 'martialInsight', label: '武感', value: Number(gs.martialInsight || 0), tip: '突破关口与高阶武学理解' },
          { key: 'military', label: '军务', value: Number(gs.military || 0), tip: '练兵、压阵、战场组织' },
          { key: 'strategy', label: '谋略', value: Number(gs.strategy || 0), tip: '探查、设局、路线成长' },
          { key: 'governance', label: '内政', value: Number(gs.governance || 0), tip: '治城、安民、根基建设' },
          { key: 'commerce', label: '经商', value: Number(gs.commerce || 0), tip: '钱粮周转与商路收益' },
          { key: 'diplomacy', label: '外交', value: Number(gs.diplomacy || 0), tip: '游说、谈判、势力周旋' },
          { key: 'charm', label: '魅力', value: Number(gs.charm || 0), tip: '人物经营、招揽和人心' },
          { key: 'coins', label: '资财', value: `${Number(gs.coins || 0)} 钱`, tip: `粮秣 ${Number(gs.supplies || 0)}` },
          { key: 'troops', label: '部曲', value: Number(gs.troops || 0), tip: `士气 ${Number(gs.morale || 0)}` },
          { key: 'influence', label: '声势', value: Number(gs.influence || 0), tip: `名望 ${Number(gs.renown || 0)}` },
          { key: 'legacy', label: '旧制底子', value: legacyBase, tip: '兼容早期存档，v5 主判定不靠它' },
          { key: 'authority', label: '权柄', value: territory.currentAuthorityLabel || '无根基', tip: this.snapshot.world.currentCityName || '未定城池' }
        ]
      };
    },
    crpgDesktopBridge() {
      try {
        return {
          errorMessage: '',
          title: this.gameTitle,
          timeLabel: this.snapshot.world.dateLabel || '建安元年',
          turnLabel: `第 ${this.snapshot.world.turn || 0} 回`,
          systemItems: this.desktopSystemMenuItems,
          supportEntry: this.desktopSupportEntry,
          commandSubtitle: this.phasePrompt,
          commandGroups: Array.isArray(this.crpgCommandGroups) ? this.crpgCommandGroups.filter(group => group && group.key) : [],
          activeGroupKey: this.activeCrpgCommandGroup || '',
          isNarrativeLoading: !!this.narrationStreaming,
          narrative: this.crpgNarrativeViewModel || {
            chapterTitle: '',
            sceneTitle: '',
            sceneSubtitle: '',
            sceneBadge: '',
            cards: [],
            logs: [],
            summaryRibbon: []
          },
          character: this.crpgCharacterSheetViewModel || {
            name: '',
            title: '',
            location: '',
            tags: [],
            metrics: [],
            vitals: []
          }
        };
      } catch (error) {
        return {
          errorMessage: error && error.message ? error.message : String(error || '未知错误'),
          title: this.gameTitle,
          timeLabel: this.snapshot.world.dateLabel || '建安元年',
          turnLabel: `第 ${this.snapshot.world.turn || 0} 回`,
          systemItems: [],
          supportEntry: null,
          commandSubtitle: this.phasePrompt || '',
          commandGroups: [],
          activeGroupKey: '',
          isNarrativeLoading: !!this.aiLoading,
          narrative: {
            chapterTitle: this.snapshot.world.dateLabel || '建安元年',
            sceneTitle: this.snapshot.scene.title || '界面桥接失败',
            sceneSubtitle: '桌面布局桥接时发生错误，已切到安全兜底。',
            sceneBadge: '错误',
            cards: [],
            logs: [{
              key: 'desktop-bridge-error',
              label: '桌面布局异常',
              paragraphs: [
                error && error.message ? error.message : String(error || '未知错误')
              ]
            }],
            summaryRibbon: []
          },
          character: {
            name: (this.snapshot.gameState || {}).name || '无名之人',
            title: '界面兜底',
            location: this.snapshot.world.currentCityName || '未定',
            tags: [],
            metrics: [],
            vitals: []
          }
        };
      }
    },
    showRuntimeStatusLine() {
      return !!(this.runtimeConfigLine && (this.lastProviderIssueLine || this.aiLoading || this.narrationStreaming));
    },
    showStorySection() {
      return !this.isMobileLayout || this.activeMobileView === 'story';
    },
    showOperationSection() {
      return !this.isMobileLayout || this.activeMobileView === 'action';
    },
    showIntelSection() {
      return !this.isMobileLayout || this.activeMobileView === 'intel';
    },
    currentMainline() { return Object.assign({}, createEmptySnapshot().world.mainline, this.snapshot.world.mainline || {}); },
    mainlineProgress() { return Math.max(0, Math.min(100, Number(this.currentMainline.progress || 0))); },
    displayedStoryText() {
      if (this.aiLoading && this.streamingText) return this.streamingText;
      if (this.aiLoading && this.storyStageCleared) return '';
      return this.snapshot.scene.text || '故事还没有真正落笔。';
    },
    typewriterStoryText() {
      return this.typedStoryText || '';
    },
    renderedStoryHtml() {
      const typingActive = Boolean(this.aiLoading || this.storyTypingTimer || this.typewriterStoryText);
      return this.decorateStoryText(typingActive ? this.typewriterStoryText : this.displayedStoryText);
    },
    activeGlossaryEntry() {
      return STORY_GLOSSARY[this.activeGlossaryEntryKey] || null;
    },
    latestArchivedStory() { return this.storyArchive[0] || null; },
    showStoryArchiveCard() {
      return !!this.latestArchivedStory && !this.isMobileLayout;
    },
    narrationStreaming() { return this.aiLoading && !this.narrationDoneReceived; },
    waitingForNarration() { return this.narrationStreaming && this.placeholderStreaming && !this.streamingText; },
    showStoryStreamTail() { return this.narrationStreaming && !this.waitingForNarration && !!this.streamingText; },
    effectiveWorldPhase() {
      return this.resolveChoicePhase(this.aiLoading ? this.liveChoices : this.snapshot.choices);
    },
    canShowNarrativeDynamicChoices() {
      return !this.inBattle && this.effectiveWorldPhase === 'playing';
    },
    dynamicPlanning() {
      return this.canShowNarrativeDynamicChoices && this.aiLoading && this.narrationDoneReceived && !this.streamDoneReceived;
    },
    retinueOverviewStyle() {
      return { height: `${this.retinuePanelHeight}px` };
    },
    interactionLocked() { return this.snapshot.world.phase === 'ended'; },
    interactionBlocked() { return this.aiLoading || this.interactionLocked; },
    activeBattle() {
      if (this.aiLoading && this.battleUiReleased) return null;
      return this.snapshot.gameState && this.snapshot.gameState.activeBattle && this.snapshot.gameState.activeBattle.active
        ? this.snapshot.gameState.activeBattle
        : null;
    },
    inBattle() {
      return !!this.activeBattle;
    },
    historicalDeviationUnlocked() {
      const eventStates = (((this.snapshot || {}).gameState || {}).historical || {}).eventStates || {};
      return Object.keys(eventStates).some((key) => {
        const item = eventStates[key];
        return item && item.triggered && (item.branch === 'shifting' || item.branch === 'rewrite');
      });
    },
    battleModeLabel() {
      if (!this.activeBattle) return '';
      if (this.activeBattle.mode !== 'duel') return '沙场征战';
      return this.activeBattle.variant === 'sparring' ? '江湖切磋' : '江湖对决';
    },
    battleModeSummary() {
      if (!this.activeBattle) return '';
      if (this.activeBattle.mode !== 'duel') {
        return '战斗仍然在主操作区里逐回合推进，不再额外漂出侧边；先看战场态势，再直接下令。';
      }
      return this.activeBattle.variant === 'sparring'
        ? '切磋以喂招和熟悉节奏为主，损耗较轻，适合教学和试手感。'
        : '江湖对决会直接比拼攻守、步点、真气与绝招判断，每一手都在主界面原地结算。';
    },
    battleCenterTip() {
      if (!this.activeBattle) return '';
      if (this.activeBattle.mode !== 'duel') {
        return '先稳态势，再决定是抢先手、打计策还是让主将强破。';
      }
      return this.activeBattle.variant === 'sparring'
        ? '这场以切磋为主，重点是看拆招、运功和绝招节奏。'
        : '这一场分高下，攻守转换和真气管理都不能乱。';
    },
    battleCommandChoices() {
      if (!this.inBattle) return [];
      const actual = this.fixedChoices.filter(item => String(item.id || '').startsWith('battlecmd:'));
      if (actual.length) return actual;
      return this.fallbackBattleCommandChoices();
    },
    battlePlayerRows() {
      return this.buildBattleRows('player');
    },
    battleEnemyRows() {
      return this.buildBattleRows('enemy');
    },
    useDirectionPanel() {
      return !this.inBattle && this.snapshot.world.phase === 'playing';
    },
    currentAccess() {
      if (this.currentUser && this.currentUser.access) return this.currentUser.access;
      return this.snapshot.playAccess || null;
    },
    trialRemainingTurns() {
      return this.currentAccess ? Number(this.currentAccess.trialRemainingTurns || 0) : 0;
    },
    paidTurnCredits() {
      return this.currentAccess ? Number(this.currentAccess.turnCredits || 0) : 0;
    },
    hasMonthCard() {
      return !!(this.currentAccess && this.currentAccess.monthCardActive);
    },
    monthCardStatusText() {
      if (!this.hasMonthCard) return '未开通';
      return `月卡有效期至 ${this.formatMonthCardExpiry(this.currentAccess && this.currentAccess.monthCardExpiresAt) || '长期有效'}`;
    },
    accessStatusText() {
      if (!this.currentAccess) return this.currentUser ? '未登录' : '匿名试玩';
      return this.formatAccessSummary(this.currentAccess);
    },
    accessIdentityTitle() {
      return this.currentUser ? (this.currentUser.displayName || this.currentUser.username) : '匿名试玩';
    },
    accessIdentityText() {
      if (!this.currentUser) return this.accessStatusText;
      return `${this.currentUser.username} · 已接入账号存档 · ${this.accessStatusText}`;
    },
    accessFootText() {
      if (!this.currentUser) {
        return '匿名状态下也能继续当前这局；需要接着往后玩时，再登录或注册即可。';
      }
      if (this.hasMonthCard) {
        return `${this.monthCardStatusText}，当前账号可直接沿着剧情、江湖线和经营线继续推进。`;
      }
      if (this.paidTurnCredits > 0) {
        return `当前还储备 ${this.paidTurnCredits} 回付费回合，续玩入口已经并入上方权益舱。`;
      }
      if (this.trialRemainingTurns > 0) {
        return `试玩额度还剩 ${this.trialRemainingTurns} 回，想继续长期推进时可直接在这里补回合或开月卡。`;
      }
      return '试玩额度已经用尽，继续推进时可在这里直接补回合或开月卡，不再跳到分散入口。';
    },
    donationEntry() {
      return DONATION_ENTRY;
    },
    donationChannels() {
      return Object.keys((this.donationEntry && this.donationEntry.channels) || {}).map((key) => this.donationEntry.channels[key]);
    },
    activeDonationConfig() {
      const channels = (this.donationEntry && this.donationEntry.channels) || {};
      return channels[this.activeDonationChannel] || channels.wechat || { key: '', label: '收款', image: '', expectedPath: '', alt: '收款码' };
    },
    activeDonationQrAvailable() {
      const key = this.activeDonationChannel || 'wechat';
      return !!(this.donationEntry.enabled && this.activeDonationConfig.image && !this.donationQrLoadFailed[key]);
    },
    intelTabs() {
      return Object.keys(INTEL_TAB_META).map((key) => INTEL_TAB_META[key]);
    },
    activeIntelMeta() {
      return INTEL_TAB_META[this.activeIntelTab] || INTEL_TAB_META.self;
    },
    topOverviewSummary() {
      const identity = this.snapshot.gameState.identity || '布衣';
      const city = this.snapshot.world.currentCityName || '未定城池';
      const authority = this.currentCityAuthorityLabel || '无根基';
      return `${identity}立足${city}，当前主线是“${this.currentMainline.title || '未定'}”，在当地权柄为“${authority}”，接下来每一手都会同时影响人物、地盘和这身路数。`;
    },
    topOverviewStats() {
      const gs = this.snapshot.gameState || {};
      const territory = this.territorySummary || {};
      const retinue = this.retinueOverview;
      return [
        { key: 'survival', label: '生存', value: `${Number(gs.health || 0)}/${Number(gs.maxHealth || 100)} · 疲${Number(gs.fatigue || 0)} · 气${Number(gs.morale || 0)}`, tip: '身骨 / 疲惫 / 士气' },
        { key: 'assets', label: '家底', value: `${Number(gs.coins || 0)}钱 · ${Number(gs.supplies || 0)}粮 · ${Number(gs.troops || 0)}部曲`, tip: '钱粮 / 部曲' },
        { key: 'momentum', label: '势能', value: `望${Number(gs.renown || 0)} · 影${Number(gs.influence || 0)} · 军${Number(gs.battlefieldPrestige || 0)} · 江${Number(gs.jianghuPrestige || 0)}`, tip: '名望 / 影响 / 军望 / 江湖望' },
        { key: 'footing', label: '根基', value: `${territory.currentAuthorityLabel || '无根基'} · 城${Number(territory.governedCount || 0)} · 队${retinue ? retinue.memberCount : 0}`, tip: '权柄 / 城池 / 班底' }
      ];
    },
    displayTopOverviewStats() {
      if (!this.isMobileLayout) return this.topOverviewStats;
      const gs = this.snapshot.gameState || {};
      const territory = this.territorySummary || {};
      const retinue = this.retinueOverview;
      return [
        { key: 'survival', label: '生存', value: `${Number(gs.health || 0)}/${Number(gs.maxHealth || 100)}`, tip: `疲${Number(gs.fatigue || 0)} · 气${Number(gs.morale || 0)}` },
        { key: 'assets', label: '家底', value: `${Number(gs.coins || 0)}钱 · ${Number(gs.supplies || 0)}粮`, tip: `部曲 ${Number(gs.troops || 0)}` },
        { key: 'momentum', label: '势能', value: `望${Number(gs.renown || 0)} · 影${Number(gs.influence || 0)}`, tip: `军${Number(gs.battlefieldPrestige || 0)} · 江${Number(gs.jianghuPrestige || 0)}` },
        { key: 'footing', label: '根基', value: territory.currentAuthorityLabel || '无根基', tip: `城${Number(territory.governedCount || 0)} · 队${retinue ? retinue.memberCount : 0}` }
      ];
    },
    sideStatusGroups() {
      const rows = this.statusRowsByPanel;
      return [
        {
          key: 'survival',
          title: '生存状态',
          items: [
            this.makeSideBoardItem('身骨', this.formatSideValue(this.snapshot.gameState.health, this.snapshot.gameState.maxHealth ? `/${this.snapshot.gameState.maxHealth}` : '')),
            this.makeSideBoardItem('疲惫', this.snapshot.gameState.fatigue),
            this.makeSideBoardItem('士气', this.snapshot.gameState.morale)
          ]
        },
        {
          key: 'assets',
          title: '资产',
          items: (rows.resources || []).filter((row) => ['钱财', '粮秣', '部曲', '名望'].includes(row.label)).map((row) => this.makeSideBoardItem(row.label, row.value))
        },
        {
          key: 'faction',
          title: '势力',
          items: [
            this.makeSideBoardItem('当前立足', this.currentCityAuthorityLabel || '无根基'),
            this.makeSideBoardItem('当前城池', this.snapshot.world.currentCityName || '未定'),
            this.makeSideBoardItem('主线', this.currentMainline.title || '未定'),
            this.makeSideBoardItem('影响', this.snapshot.gameState.influence)
          ]
        }
      ];
    },
    mobileAccordionSections() {
      return [
        {
          key: 'top-dynamic',
          title: '当回高价值动作',
          summary: '剧情直接给出的优先落子。',
          items: this.dynamicChoiceSlots.filter((slot) => slot && slot.type === 'choice').map((slot) => slot.choice)
        },
        {
          key: 'fixed-actions',
          title: '常备经营入口',
          summary: '长期经营、关系推进与常规动作。',
          items: this.visibleFixedChoices
        },
        {
          key: 'intel-links',
          title: '卷册与说明',
          summary: '文字地图、人物关系与局势备忘。',
          items: []
        }
      ];
    },
    sideDeltaMap() {
      const current = this.snapshot.gameState || {};
      const previous = this.previousGameStateForDelta || {};
      return {
        health: this.computeSideDelta(Number(current.health || 0), Number(previous.health || 0)),
        fatigue: this.computeSideDelta(Number(current.fatigue || 0), Number(previous.fatigue || 0), true),
        morale: this.computeSideDelta(Number(current.morale || 0), Number(previous.morale || 0)),
        coins: this.computeSideDelta(Number(current.coins || 0), Number(previous.coins || 0)),
        supplies: this.computeSideDelta(Number(current.supplies || 0), Number(previous.supplies || 0)),
        troops: this.computeSideDelta(Number(current.troops || 0), Number(previous.troops || 0)),
        renown: this.computeSideDelta(Number(current.renown || 0), Number(previous.renown || 0)),
        influence: this.computeSideDelta(Number(current.influence || 0), Number(previous.influence || 0))
      };
    },
    authActionTitle() {
      return this.authMode === 'login' ? '登录后进入这卷乱世' : '注册一个新账号';
    },
    authActionSummary() {
      return this.authMode === 'login'
        ? '不登录也可以先试玩 10 回。登录后可接着当前这局继续，并把试玩上限提升到总计 30 回。'
        : '新账号注册后默认拥有总计 30 回试玩额度；如果你是匿名试玩进来的，注册后会直接接上当前这局。';
    },
    endingTreeLabel() {
      const tree = Array.isArray(this.snapshot.gameState.endingTree) ? this.snapshot.gameState.endingTree.filter(Boolean) : [];
      return tree.length ? tree.join(' / ') : (this.snapshot.gameState.endingTitle || '此局已定');
    },
    endingBiography() {
      return this.snapshot.gameState.endingBiography || this.snapshot.gameState.endingSummary || '这一卷已经收束。';
    },
    endingCommentary() {
      return this.snapshot.gameState.endingCommentary || '这一局已经落定，可以重开，或者带着部分余韵再试另一条路。';
    },
    endingTags() {
      return (this.snapshot.gameState.endingTags || []).slice(0, 6);
    },
    endingCanInherit() {
      return this.interactionLocked && this.snapshot.gameState.canInherit === true;
    },
    endingInheritanceSummary() {
      const preview = this.snapshot.gameState.inheritancePreview || null;
      return (preview && preview.summary) || this.snapshot.gameState.inheritanceSummary || '可继承部分武学、谋略与经营手感，但钱粮、部曲、人物关系与记忆都会回到建安元年重新开始。';
    },
    martialApexState() {
      const raw = (this.snapshot.gameState && this.snapshot.gameState.martialApex) || {};
      return {
        unlockedAtTurn: Math.max(0, Number(raw.unlockedAtTurn || 0)),
        threat: Math.max(0, Math.min(100, Number(raw.threat || 0))),
        exposure: Math.max(0, Math.min(100, Number(raw.exposure || 0))),
        burden: Math.max(0, Math.min(100, Number(raw.burden || 0))),
        sideEffectStage: Math.max(0, Number(raw.sideEffectStage || 0)),
        lastSideEffectTurn: Math.max(0, Number(raw.lastSideEffectTurn || 0)),
        lastCrisisTurn: Math.max(0, Number(raw.lastCrisisTurn || 0)),
        lastBurdenNote: String(raw.lastBurdenNote || '').trim(),
        triggeredCrisisKeys: Array.isArray(raw.triggeredCrisisKeys) ? raw.triggeredCrisisKeys.filter(Boolean) : [],
        resolvedCrisisKeys: Array.isArray(raw.resolvedCrisisKeys) ? raw.resolvedCrisisKeys.filter(Boolean) : []
      };
    },
    martialApexActive() {
      const gs = this.snapshot.gameState || {};
      const apex = this.martialApexState;
      return Number(gs.martialLevel || 0) >= 100 || apex.unlockedAtTurn > 0 || apex.threat > 0 || apex.exposure > 0;
    },
    topRelationStats() {
      return (this.snapshot.gameState.relationships || [])
        .filter(Boolean)
        .slice()
        .sort((a, b) => (
          ((Number(b.trust || 0) + Number(b.affection || 0) + Number(b.loyalty || 0) - Number(b.rivalry || 0)))
          - ((Number(a.trust || 0) + Number(a.affection || 0) + Number(a.loyalty || 0) - Number(a.rivalry || 0)))
        ));
    },
    topLoverRelation() {
      return this.topRelationStats
        .filter((item) => item && (item.bondKey === 'lover' || Number(item.affection || 0) >= 68))
        .sort((a, b) => (
          ((Number(b.affection || 0) * 2) + Number(b.trust || 0) + Number(b.loyalty || 0))
          - ((Number(a.affection || 0) * 2) + Number(a.trust || 0) + Number(a.loyalty || 0))
        ))[0] || null;
    },
    topRomanceCandidate() {
      return this.topRelationStats
        .filter((item) => item && item.romanceable !== false && Number(item.rivalry || 0) < 45)
        .filter((item) => {
          const stage = item.romanceStage || this.deriveRomanceStage(item);
          const favor = item.favorScore !== undefined ? item.favorScore : this.deriveFavorScore(item);
          return stage !== '未启' || favor >= 26 || Number(item.affection || 0) >= 6 || Number(item.trust || 0) >= 10;
        })
        .sort((a, b) => (
          ((Number(b.affection || 0) * 2) + Number(b.trust || 0) + Number(b.loyalty || 0) - Number(b.rivalry || 0))
          - ((Number(a.affection || 0) * 2) + Number(a.trust || 0) + Number(a.loyalty || 0) - Number(a.rivalry || 0))
        ))[0] || null;
    },
    topAdvisorRelation() {
      return this.topRelationStats
        .filter((item) => item && item.bondKey === 'advisor')
        .sort((a, b) => (
          (Number(b.loyalty || 0) + Number(b.trust || 0) + Number(b.affection || 0))
          - (Number(a.loyalty || 0) + Number(a.trust || 0) + Number(a.affection || 0))
        ))[0] || null;
    },
    historicalSummaryState() {
      const historical = (((this.snapshot || {}).gameState || {}).historical) || {};
      const states = historical.eventStates && typeof historical.eventStates === 'object' ? Object.values(historical.eventStates) : [];
      return {
        triggered: states.filter((item) => item && item.triggered).length,
        rewritten: states.filter((item) => item && item.branch === 'rewrite').length,
        shifting: states.filter((item) => item && item.branch === 'shifting').length,
        active: Array.isArray(historical.activeEventIds) ? historical.activeEventIds.length : 0,
        momentum: Number(historical.historyMomentum || 0),
        lastTitle: String(historical.lastEventTitle || '').trim(),
        lastSummary: String(historical.lastEventSummary || '').trim()
      };
    },
    routeScoreBoard() {
      const gs = this.snapshot.gameState || {};
      const relationList = this.topRelationStats.slice(0, 3);
      const relationTotal = relationList.reduce((sum, item) => sum + Number(item.trust || 0) + Number(item.affection || 0) + Number(item.loyalty || 0), 0);
      const lover = this.topLoverRelation;
      const advisor = this.topAdvisorRelation;
      const history = this.historicalSummaryState;
      return {
        military: (Number(gs.battlefieldPrestige || 0) * 1.35) + (Number(gs.military || 0) * 1.2) + (Number(gs.troops || 0) / 4) + Number(gs.morale || 0) + (Number(gs.renown || 0) * 0.5),
        jianghu: (Number(gs.jianghuPrestige || 0) * 1.45) + (Number(gs.martialLevel || 0) * 1.15) + (Number(gs.martialInsight || 0) * 2) + (Number(gs.renown || 0) * 0.45),
        sect: (Number(gs.sectFavor || 0) * 1.1) + (Number(gs.sectPower || 0) * 1.2) + (Number(gs.martialLevel || 0) * 0.85) + (Number(gs.strategyLevel || 0) * 0.35) + ((gs.sectId || '') ? 20 : 0),
        statecraft: (Number(gs.governance || 0) * 1.2) + (Number(gs.strategy || 0) * 1.15) + (Number(gs.diplomacy || 0) * 0.8) + (Number(gs.influence || 0) * 0.65) + (Number(gs.supplies || 0) * 0.4) + (advisor ? 18 : 0),
        commerce: (Number(gs.commerce || 0) * 1.3) + (Number(gs.coins || 0) * 0.8) + (Number(gs.supplies || 0) * 0.75) + (Number(gs.diplomacy || 0) * 0.45) + (Number(gs.influence || 0) * 0.4),
        strategy: (Number(gs.strategy || 0) * 1.25) + (Number(gs.strategyLevel || 0) * 1.05) + (Number(gs.influence || 0) * 0.75) + (Number(gs.diplomacy || 0) * 0.55) + (history.momentum * 2),
        romance: lover
          ? (Number(lover.affection || 0) * 1.6) + (Number(lover.trust || 0) * 1.15) + (Number(lover.loyalty || 0) * 0.9) + (Number(gs.charm || 0) * 0.6) + (Number(gs.renown || 0) * 0.25)
          : 0,
        relations: (relationTotal * 0.42) + (Number(gs.influence || 0) * 0.85) + (Number(gs.diplomacy || 0) * 0.6) + (relationList.length * 12),
        history: (history.rewritten * 85) + (history.shifting * 34) + (history.triggered * 12) + (history.momentum * 3) + (this.mainlineProgress * 0.55) + (Number(gs.influence || 0) * 0.4) + (Number(gs.renown || 0) * 0.3)
      };
    },
    martialApexRouteKey() {
      const gs = this.snapshot.gameState || {};
      const territory = this.territorySummary || {};
      const scores = this.routeScoreBoard;
      const battlefieldScore = Number(scores.military || 0) + (Number(territory.controlledCount || 0) * 18);
      const jianghuScore = Number(scores.jianghu || 0);
      const sectScore = Number(scores.sect || 0);
      const territoryScore = Number(scores.statecraft || 0) + Number(scores.strategy || 0) * 0.4 + (Number(territory.governedCount || 0) * 20);
      if (gs.martialFocusId === 'battlefield') return 'battlefield';
      if (gs.martialFocusId === 'jianghu') return 'jianghu';
      if ((gs.sectId || '') && sectScore >= Math.max(battlefieldScore - 8, jianghuScore - 8, territoryScore - 8)) return 'sect';
      const ranked = [
        { key: 'battlefield', score: battlefieldScore },
        { key: 'jianghu', score: jianghuScore },
        { key: 'sect', score: sectScore },
        { key: 'territory', score: territoryScore }
      ].sort((left, right) => right.score - left.score);
      return ranked[0] ? ranked[0].key : 'territory';
    },
    martialApexRouteLabel() {
      return {
        battlefield: '军旅转化',
        jianghu: '江湖转化',
        sect: '门派转化',
        territory: '经世转化'
      }[this.martialApexRouteKey] || '武名转化';
    },
    martialApexDisplayCard() {
      if (!this.martialApexActive && !this.martialApexPendingThreads.length) return null;
      const apex = this.martialApexState;
      const stage = apex.sideEffectStage >= 3
        ? '巅峰反噬已压到台前'
        : apex.sideEffectStage >= 2
          ? '巅峰反噬正在扩散'
          : apex.sideEffectStage >= 1
            ? '巅峰余震已经起势'
            : '巅峰气压尚在蓄积';
      const summary = apex.sideEffectStage >= 3
        ? '这一身武名已经不再只是加成。继续靠蛮压推进，会开始直接拖累粮秣、军心、人心和局势节奏。'
        : apex.sideEffectStage >= 2
          ? '旁人已经在先防你会不会动手。就算你这一回想做经营、谈判、查线，也会被这层武名预先扭曲。'
          : '武艺踏到顶点后，系统已经把你当成会改局的人。后面每一手都会更容易放大连锁后果。';
      return {
        title: stage,
        summary,
        note: apex.lastBurdenNote || '',
        route: this.martialApexRouteLabel
      };
    },
    martialApexPendingThreads() {
      return this.pendingThreads.filter((thread) => String(thread && thread.opportunityKey || '').startsWith('apex:'));
    },
    martialApexCrisisChecklist() {
      if (!this.martialApexActive && !this.martialApexPendingThreads.length) return [];
      const resolved = this.martialApexState.resolvedCrisisKeys || [];
      const routeKey = this.martialApexRouteKey;
      const routeThreadKey = routeKey === 'battlefield'
        ? 'apex:battlefield:crisis'
        : routeKey === 'jianghu'
          ? 'apex:jianghu:crisis'
          : routeKey === 'sect'
            ? 'apex:sect:crisis'
            : 'apex:territory:crisis';
      const routeLabel = routeKey === 'battlefield'
        ? '军旅线危机：把个人锋头重新压回军令、赏罚与粮道'
        : routeKey === 'jianghu'
          ? '江湖线危机：把武名从仇怨和借名里重新收束成人心'
          : routeKey === 'sect'
            ? '门派线危机：把武名从争承夺位里重新压回规矩与传承'
            : '经世线危机：把武名从强横误读里重新压回地盘秩序';
      const pendingKeys = this.martialApexPendingThreads.map((thread) => String(thread.opportunityKey || ''));
      const buildStatus = (key) => {
        if (resolved.includes(key)) return '已经接住';
        if (pendingKeys.includes(key)) return '当前正在台面上';
        if ((this.martialApexState.triggeredCrisisKeys || []).includes(key)) return '已经错过或尚未收住';
        return '尚未触发';
      };
      return [
        { key: 'apex:exposure_probe', label: '外溢试探：先拆掉别人借你名头并线搅局', done: resolved.includes('apex:exposure_probe'), status: buildStatus('apex:exposure_probe') },
        { key: routeThreadKey, label: routeLabel, done: resolved.includes(routeThreadKey), status: buildStatus(routeThreadKey) },
        { key: 'apex:conversion', label: '终极转化：把“我能打”换成能长期运转的秩序、盟约或传承', done: resolved.includes('apex:conversion'), status: buildStatus('apex:conversion') }
      ];
    },
    activeEndgameGateCard() {
      const gs = this.snapshot.gameState || {};
      const territory = this.territorySummary || {};
      const scores = this.routeScoreBoard;
      const history = this.historicalSummaryState;
      const relationsScore = Number(scores.relations || 0);
      const lover = this.topLoverRelation;
      const advisor = this.topAdvisorRelation;
      const resolved = this.martialApexState.resolvedCrisisKeys || [];
      const martial100 = Number(gs.martialLevel || 0) >= 100;
      const endingTree = Array.isArray(gs.endingTree) ? gs.endingTree : [];
      const endingBranch = String(endingTree[1] || '').trim();
      const buildGateCard = (key, title, summary, items, extraLines = []) => ({
        key,
        title,
        summary,
        noteLines: [`已具备 ${items.filter(item => item.done).length}/${items.length}`].concat(extraLines).filter(Boolean),
        items
      });
      const routeKey = this.interactionLocked
        ? ({
          军旅建功: 'battlefield',
          军旅试锋: 'battlefield',
          江湖问剑: 'jianghu',
          江湖试锋: 'jianghu',
          门派传承: 'sect',
          经世成局: 'territory',
          经营持局: 'territory',
          商路成势: 'territory'
        }[endingBranch] || (this.martialApexActive ? this.martialApexRouteKey : 'territory'))
        : (this.martialApexActive ? this.martialApexRouteKey : (
          (gs.martialFocusId === 'battlefield' && 'battlefield')
          || (gs.martialFocusId === 'jianghu' && 'jianghu')
          || ((gs.sectId || '') && scores.sect >= Math.max(Number(scores.military || 0), Number(scores.jianghu || 0), Number(scores.statecraft || 0)) - 8 && 'sect')
          || (Number(scores.statecraft || 0) >= Math.max(Number(scores.military || 0), Number(scores.jianghu || 0), Number(scores.sect || 0)) ? 'territory' : 'battlefield')
        ));

      if (routeKey === 'battlefield') {
        const items = [
          { key: 'prestige', label: '军阵威名', done: Number(gs.battlefieldPrestige || 0) >= 90, status: `当前 ${Number(gs.battlefieldPrestige || 0)} / 目标 90` },
          { key: 'territory', label: '城池底盘', done: Number(territory.controlledCount || 0) >= 1 || Number(territory.governedCount || 0) >= 2, status: `稳控 ${Number(territory.controlledCount || 0)} 城 · 纳入 ${Number(territory.governedCount || 0)} 城` },
          { key: 'govern', label: '治理或谋略', done: Number(gs.governance || 0) >= 42 || Number(gs.strategy || 0) >= 42, status: `内政 ${Number(gs.governance || 0)} · 谋略 ${Number(gs.strategy || 0)}` },
          { key: 'network', label: '幕僚或人心', done: Number(gs.influence || 0) >= 28 || !!advisor || relationsScore >= 118, status: advisor ? `已有幕僚 ${advisor.name}` : `影响 ${Number(gs.influence || 0)} · 人情盘 ${Math.round(relationsScore)}` },
          { key: 'crisis', label: '巅峰危机与转化', done: !martial100 || (resolved.includes('apex:battlefield:crisis') && resolved.includes('apex:conversion')), status: martial100 ? `${resolved.includes('apex:battlefield:crisis') ? '军旅危机已解' : '军旅危机未解'} · ${resolved.includes('apex:conversion') ? '已转化' : '未转化'}` : '武力未到 100，暂不要求' }
        ];
        return buildGateCard('battlefield', '军前定鼎', '不再只是够猛就行。你得把个人锋头压回军令、城池和可执行的人手体系里。', items, ['路线：军旅']);
      }

      if (routeKey === 'jianghu') {
        const items = [
          { key: 'prestige', label: '江湖声望', done: Number(gs.jianghuPrestige || 0) >= 95, status: `当前 ${Number(gs.jianghuPrestige || 0)} / 目标 95` },
          { key: 'relations', label: '人情承接', done: relationsScore >= 118 || !!lover || !!(gs.sectId || '') || Number(gs.influence || 0) >= 34, status: lover ? `已有关键关系 ${lover.name}` : `影响 ${Number(gs.influence || 0)} · 人情盘 ${Math.round(relationsScore)}` },
          { key: 'brains', label: '收局手段', done: Number(history.momentum || 0) >= 10 || Number(gs.diplomacy || 0) >= 36 || Number(gs.strategy || 0) >= 40, status: `史势 ${Number(history.momentum || 0)} · 外交 ${Number(gs.diplomacy || 0)} · 谋略 ${Number(gs.strategy || 0)}` },
          { key: 'crisis', label: '巅峰危机与转化', done: !martial100 || (resolved.includes('apex:jianghu:crisis') && resolved.includes('apex:conversion')), status: martial100 ? `${resolved.includes('apex:jianghu:crisis') ? '江湖危机已解' : '江湖危机未解'} · ${resolved.includes('apex:conversion') ? '已转化' : '未转化'}` : '武力未到 100，暂不要求' }
        ];
        return buildGateCard('jianghu', '天下绝顶', '现在的江湖终局要求你把“天下第一”的武名，换成众人默认的规矩和边界。', items, ['路线：江湖']);
      }

      if (routeKey === 'sect') {
        const items = [
          { key: 'sect', label: '门派归属', done: !!(gs.sectId || ''), status: gs.sectName || '当前无门无派' },
          { key: 'power', label: '门中情分', done: Number(gs.sectFavor || 0) >= 65 || Number(gs.sectPower || 0) >= 65, status: `情分 ${Number(gs.sectFavor || 0)} · 势力 ${Number(gs.sectPower || 0)}` },
          { key: 'network', label: '对外牵引', done: Number(gs.diplomacy || 0) >= 32 || Number(gs.influence || 0) >= 32 || relationsScore >= 110, status: `外交 ${Number(gs.diplomacy || 0)} · 影响 ${Number(gs.influence || 0)} · 人情盘 ${Math.round(relationsScore)}` },
          { key: 'structure', label: '传承根基', done: Number(gs.strategyLevel || 0) >= 20 || Number(gs.governance || 0) >= 28 || Number(history.momentum || 0) >= 8, status: `路线 ${Number(gs.strategyLevel || 0)} · 内政 ${Number(gs.governance || 0)} · 史势 ${Number(history.momentum || 0)}` },
          { key: 'crisis', label: '巅峰危机与转化', done: !martial100 || (resolved.includes('apex:sect:crisis') && resolved.includes('apex:conversion')), status: martial100 ? `${resolved.includes('apex:sect:crisis') ? '门派危机已解' : '门派危机未解'} · ${resolved.includes('apex:conversion') ? '已转化' : '未转化'}` : '武力未到 100，暂不要求' }
        ];
        return buildGateCard('sect', '一派宗师', '这条终局要求你把个人巅峰压成真正的传承、规矩和门中秩序。', items, ['路线：门派']);
      }

      const items = [
        { key: 'statecraft', label: '经世根基', done: Number(scores.statecraft || 0) >= 168 && Number(gs.governance || 0) >= 62, status: `经世 ${Math.round(Number(scores.statecraft || 0))} · 内政 ${Number(gs.governance || 0)}` },
        { key: 'territory', label: '地盘收益', done: Number(territory.governedCount || 0) >= 1, status: `纳入 ${Number(territory.governedCount || 0)} 城 · 稳控 ${Number(territory.controlledCount || 0)} 城` },
        { key: 'support', label: '制度与人手', done: !!advisor || Number(gs.influence || 0) >= 30 || relationsScore >= 108, status: advisor ? `已有幕僚 ${advisor.name}` : `影响 ${Number(gs.influence || 0)} · 人情盘 ${Math.round(relationsScore)}` }
      ];
      return buildGateCard('territory', '经世成局', '关键已经不是能不能打，而是能不能让地盘、人手和秩序替你自己继续运转。', items, ['路线：经世']);
    },
    endingRouteAuditCard() {
      return this.interactionLocked ? this.activeEndgameGateCard : null;
    },
    martialApexEndingAuditCard() {
      if (!this.interactionLocked || !this.martialApexActive) return null;
      return {
        title: `${this.martialApexRouteLabel}危机链`,
        summary: '武力100以后，这一局不再只看你多能打，还看你有没有把巅峰带来的外溢、路线反噬和最终转化一并接住。',
        items: this.martialApexCrisisChecklist
      };
    },
    displayStatusText() {
      if (this.interactionLocked) return this.snapshot.gameState.endingSummary || this.snapshot.gameState.endingTitle || '此局已经收束。';
      if (this.inBattle) {
        if (this.activeBattle.mode === 'duel') {
          return this.activeBattle.lastRoundSummary
            ? '这一手已经结算，回合演绎写在下方战斗区，定神后再接下一招。'
            : (this.activeBattle.variant === 'sparring'
              ? '切磋架势已经摆开，先用这几手把攻守节奏摸熟。'
              : '对手已摆开架势，等我先接这一手。');
        }
        return this.activeBattle.lastRoundSummary
          ? '这一道军令已经落地，下方战场演绎会先交代清楚场上变化。'
          : '战局已经拉开，下一道军令会直接改变场上强弱。';
      }
      if (this.systemStatus) return this.systemStatus;
      if (this.turnProcessingState) return this.turnProcessingState.detail;
      if (this.narrationStreaming) return '正在等待正文落下。';
      if (this.aiLoading) return '正文已经写定，正在整理后续落子。';
      return '局势暂时平静，等我下一手。';
    },
    runtimeConfigLine() {
      const settings = this.snapshot.settings || {};
      if (!settings.enabled) {
        return settings.apiKeyConfigured
          ? '外部模型未完全启用，请检查模型名或上游地址。'
          : '当前未启用外部模型，回合会直接走本地续写。';
      }
      const provider = settings.providerName || '外部模型';
      const model = settings.model || 'unknown';
      const base = this.compactProviderBase(settings.apiBaseUrl);
      return base
        ? `当前实际请求：${provider} / ${model} / ${base}`
        : `当前实际请求：${provider} / ${model}`;
    },
    lastProviderIssueLine() {
      const scene = this.snapshot.scene || {};
      const reason = String(scene.narrationReason || '');
      const detail = String(scene.narrationDetail || '');
      if (!reason && !detail) return '';
      if (reason === 'provider_disabled' || detail.includes('provider-disabled')) {
        return '上一回没有真正发出外部模型请求，服务端直接走了本地回退。';
      }
      if (detail.includes('idle-timeout:20000')) {
        return '上一回流式请求已发出，但上游在 20 秒内没有继续返回正文分片，服务端已切回本地续写。';
      }
      if (detail.includes('reasoning-only-body')) {
        return '上一回上游只返回了 reasoning 或空正文，没有给出可用剧情文本，所以被本地规则判为失败。';
      }
      const statusMatch = detail.match(/(?:status:|->\s*)(\d{3})(?=[:|])/);
      if (statusMatch) {
        return `上一回上游立即返回 ${statusMatch[1]}，所以没有进入正常等待流式。`;
      }
      if (/upstream-unavailable|provider_unavailable|provider_nonstream_failed/.test(`${reason}|${detail}`)) {
        return '上一回外部模型请求失败，正文已由本地引擎接管。';
      }
      return '';
    },
    stageSnapshotTitle() {
      if (this.recentBattleReturnCard) return this.recentBattleReturnCard.title;
      if (this.worldPerceptionCard) return this.worldPerceptionCard.headline;
      if (this.worldFermentationCard) return this.worldFermentationCard.headline;
      if (this.retinueOverview) return this.retinueOverview.readiness;
      return this.historicalClueSummary;
    },
    stageSnapshotSummary() {
      if (this.recentBattleReturnCard) return this.recentBattleReturnCard.summary;
      if (this.worldPerceptionCard) return this.worldPerceptionCard.summary;
      if (this.worldFermentationCard) return this.worldFermentationCard.summary;
      if (this.retinueOverview) return `当前班底 ${this.retinueOverview.memberCount}/${this.retinueOverview.capacity}，任命 ${this.retinueOverview.assignmentCount}，可见职司空位 ${this.retinueOverview.vacancyCount}。`;
      return this.territorySummaryLine;
    },
    stageSnapshotNotes() {
      const notes = [];
      if (this.historicalClueCards.length) notes.push(`史实线索 ${this.historicalClueCards.length} 条`);
      if (this.worldPerceptionCard) notes.push(`风评 ${this.worldPerceptionCard.signalLines.length} 条`);
      if (this.territoryExpansionCards.length) notes.push(`可压城池 ${this.territoryExpansionCards.length} 处`);
      if (this.retinueOverview) notes.push(`队伍 ${this.retinueOverview.memberCount}/${this.retinueOverview.capacity}`);
      if (this.pendingThreads.length) notes.push(`暗线 ${this.pendingThreads.length} 条`);
      if (!notes.length) notes.push('当前没有额外枝线提醒');
      return notes.slice(0, 4);
    },
    stageSnapshotMetaLabel() {
      if (this.recentBattleReturnCard) return '战局回流';
      if (this.worldPerceptionCard) return '风评变化';
      if (this.worldFermentationCard) return '暗潮发酵';
      if (this.retinueOverview) return '班底概况';
      return '局势摘记';
    },
    showCondensedSnapshot() {
      return !!(
        this.stageSnapshotTitle
        && this.stageSnapshotSummary
        && (
          this.recentBattleReturnCard
          || this.worldPerceptionCard
          || this.worldFermentationCard
          || this.stageSnapshotNotes.some(item => item && item !== '当前没有额外枝线提醒')
        )
      );
    },
    quickHints() { return (this.snapshot.gameState.advisory || []).slice(0, 2); },
    lastRetinueFeedback() {
      return (this.snapshot.gameState && this.snapshot.gameState.lastRetinueFeedback) || null;
    },
    lastSkillFeedback() {
      return (this.snapshot.gameState && this.snapshot.gameState.lastSkillFeedback) || null;
    },
    lastCityReport() {
      return (this.snapshot.gameState && this.snapshot.gameState.lastCityReport) || null;
    },
    lastRetinueFeedbackCard() {
      const feedback = this.lastRetinueFeedback;
      if (!feedback || !feedback.actionText) return null;
      const participants = Array.isArray(feedback.participants) ? feedback.participants : [];
      const supportBonuses = Array.isArray(feedback.supportBonuses) ? feedback.supportBonuses : [];
      const participantLine = participants.length
        ? participants.map(item => {
          const name = item && item.name ? item.name : '队友';
          const slot = item && (item.slotLabel || item.roleName) ? (item.slotLabel || item.roleName) : '';
          return slot ? `${name}掌${slot}` : name;
        }).join('、')
        : '这一步主要还是我亲自硬扛。';
      const supportLines = supportBonuses
        .map(item => {
          const name = item && item.memberName ? item.memberName : '';
          const line = item && item.deltaLine ? item.deltaLine : this.formatRetinueDelta(item && item.delta);
          if (!name || !line) return '';
          return `${name}：${line}`;
        })
        .filter(Boolean)
        .slice(0, 4);
      const totalLine = this.formatRetinueDelta(feedback.totalDelta);
      return {
        title: feedback.actionText,
        tier: String(feedback.tier || ''),
        summaryLine: feedback.summaryLine || '',
        participantLine,
        supportLines,
        totalLine,
        tags: Array.isArray(feedback.summaryTags) ? feedback.summaryTags.filter(Boolean).slice(0, 4) : []
      };
    },
    lastSkillFeedbackCard() {
      const feedback = this.lastSkillFeedback;
      if (!feedback || !feedback.actionText) return null;
      const totalLine = feedback.totalLine || this.formatRetinueDelta(feedback.totalDelta);
      return {
        title: feedback.actionText,
        tier: String(feedback.tier || ''),
        summaryLine: feedback.summaryLine || '',
        detailLines: Array.isArray(feedback.lines) ? feedback.lines.filter(Boolean).slice(0, 5) : [],
        totalLine,
        tags: Array.isArray(feedback.summaryTags) ? feedback.summaryTags.filter(Boolean).slice(0, 4) : []
      };
    },
    lastCityReportCard() {
      const report = this.lastCityReport;
      if (!report || !report.cityName) return null;
      const yields = report.yields || {};
      const yieldLine = `${Number(yields.coins || 0)}钱 / ${Number(yields.supplies || 0)}粮 / ${Number(yields.troops || 0)}部曲 / ${Number(yields.influence || 0)}影响`;
      const scaleLine = `已纳入 ${Number(report.governedCount || 0)} 城，稳控 ${Number(report.controlledCount || 0)} 城`;
      return {
        cityName: report.cityName,
        authorityLabel: report.authorityLabel || '无根基',
        authorityScore: Number(report.authorityScore || 0),
        summary: report.summary || '',
        yieldLine,
        scaleLine
      };
    },
    statusPanelTabs() {
      return Object.keys(STATUS_PANEL_META).map((key) => STATUS_PANEL_META[key]);
    },
    statusRowsByPanel() {
      const gs = this.snapshot.gameState || {};
      const territory = this.snapshot.world && this.snapshot.world.territory ? this.snapshot.world.territory : {};
      const retinue = this.retinueOverview;
      return {
        resources: [
          this.makeStatusRow('钱财', gs.coins, '能不能立刻拿钱砸开一条门路。'),
          this.makeStatusRow('粮秣', gs.supplies, '军旅、远行和长期经营的底气。'),
          this.makeStatusRow('部曲', gs.troops, '当前能直接调动、听令的人手规模。'),
          this.makeStatusRow('士气', gs.morale, '队伍还肯不肯继续压上。'),
          this.makeStatusRow('身骨', `${Number(gs.health || 0)}/${Number(gs.maxHealth || 100)}`, '个人还能不能扛风险和硬仗。'),
          this.makeStatusRow('疲惫', gs.fatigue, '越高越不适合连续压强动作。'),
          this.makeStatusRow('名望', gs.renown, '别人会不会记住我、愿不愿给我门路。'),
          this.makeStatusRow('影响', gs.influence, '我说出去的话能带起多少实际回响。')
        ],
        abilities: [
          this.makeStatusRow('内政', gs.governance, '稳地面、仓廪、民心和治理盘。'),
          this.makeStatusRow('经商', gs.commerce, '把货、钱、商路和收益接实。'),
          this.makeStatusRow('外交', gs.diplomacy, '游说、谈判与借势能力。'),
          this.makeStatusRow('军务', gs.military, '练兵、整军、统人和调度。'),
          this.makeStatusRow('谋略', gs.strategy, '看线头、布后手、拆局反制。')
        ],
        martial: [
          this.makeStatusRow('武艺', `${Number(gs.martialLevel || 0)}/${Number(gs.martialTrainingCap || 90)}`, gs.martialRealm || '未入流', gs.martialRouteName || '乱世野修'),
          this.makeStatusRow('武学见识', gs.martialInsight, '对手感、破绽和路数的理解深度。'),
          this.makeStatusRow('兵力折算', gs.martialPower, '这一身武艺大致能折抵多少战场兵力差。'),
          ...(this.martialApexActive ? [this.makeStatusRow('巅峰反噬', `威${this.martialApexState.threat} / 露${this.martialApexState.exposure}`, this.martialApexRouteLabel, `负担 ${this.martialApexState.burden}，${this.martialApexDisplayCard ? this.martialApexDisplayCard.summary : '武名正在继续发酵。'}`)] : []),
          this.makeStatusRow('军旅志向', gs.battlefieldPrestige, gs.martialFocusName || '未定志向', '战阵威名积累越高，越像真正压进军旅。'),
          this.makeStatusRow('江湖声望', gs.jianghuPrestige, gs.martialTitle || gs.martialRealm || '未入流', '越高越容易逼出江湖人物、风波与对手。'),
          this.makeStatusRow('门派情分', gs.sectFavor, gs.sectName || '无门无派', '门里是否真的有人愿意替我撑伞。'),
          this.makeStatusRow('门派势力', gs.sectPower, '宗门这条线能不能反哺整体盘面。'),
          this.makeStatusRow('谋略路线', `${Number(gs.strategyLevel || 0)}/100`, gs.strategyRouteName || '乱世求生', `路线经验 ${Number(gs.strategyExp || 0)}`)
        ],
        footing: [
          this.makeStatusRow('当前立足', territory.currentAuthorityLabel || '无根基', this.snapshot.world.currentCityName || '未定城池', territory.currentAuthoritySummary || '只是路过此地，谈不上在城里站稳。'),
          this.makeStatusRow('已纳入城池', territory.governedCount, `稳控 ${Number(territory.controlledCount || 0)} 城`, territory.summaryLine || '眼下还没有真正纳入名下的城池。'),
          this.makeStatusRow('每回合收益', `${Number(territory.incomePerTurn || 0)}钱 / ${Number(territory.supplyPerTurn || 0)}粮`, `补入 ${Number(territory.troopSupportPerTurn || 0)} 部曲`, '这是版图经营每回合能直接回流的资源。'),
          this.makeStatusRow('队伍班底', retinue ? `${retinue.memberCount}/${retinue.capacity}` : '0/6', retinue ? `任命 ${retinue.assignmentCount} · 空位 ${retinue.vacancyCount}` : '尚未成形', '决定你能不能把很多推进从单人硬扛，变成长期协同。'),
          this.makeStatusRow('当前主线', `${this.currentMainline.title || '未定'}`, `${this.mainlineProgress}%`, this.currentMainline.crisis || '局势暂稳。')
        ]
      };
    },
    statusOverviewCards() {
      const gs = this.snapshot.gameState || {};
      const territory = this.snapshot.world && this.snapshot.world.territory ? this.snapshot.world.territory : {};
      const retinue = this.retinueOverview;
      return [
        {
          key: 'survival',
          kicker: '生存',
          title: `身骨 ${Number(gs.health || 0)}/${Number(gs.maxHealth || 100)}`,
          lines: [`士气 ${Number(gs.morale || 0)}`, `疲惫 ${Number(gs.fatigue || 0)}`],
          tip: Number(gs.health || 0) <= 55 ? '眼下不宜连续硬压高风险动作。' : '还能继续顶一两手硬活。'
        },
        {
          key: 'assets',
          kicker: '家底',
          title: `钱粮 ${Number(gs.coins || 0)} / ${Number(gs.supplies || 0)}`,
          lines: [`部曲 ${Number(gs.troops || 0)}`, `影响 ${Number(gs.influence || 0)}`],
          tip: Number(gs.supplies || 0) <= 20 ? '粮秣偏紧，军旅与远行都会受限。' : '眼下的钱粮和人手还够继续调度。'
        },
        {
          key: 'momentum',
          kicker: '势能',
          title: `名望 ${Number(gs.renown || 0)}`,
          lines: [`战阵 ${Number(gs.battlefieldPrestige || 0)}`, `江湖 ${Number(gs.jianghuPrestige || 0)}`],
          tip: '这是别人会不会把我当回事、会把我放到哪一层盘面上的直接分量。'
        },
        {
          key: 'footing',
          kicker: '根基',
          title: `${territory.currentAuthorityLabel || '无根基'} · ${this.snapshot.world.currentCityName || '未定城池'}`,
          lines: [`城池 ${Number(territory.governedCount || 0)} / 控盘 ${Number(territory.controlledCount || 0)}`, `班底 ${retinue ? retinue.memberCount : 0} / 任命 ${retinue ? retinue.assignmentCount : 0}`],
          tip: territory.summaryLine || '眼下还没有真正立住一块能反复吃收益的地盘。'
        }
      ];
    },
    statusPanelCards() {
      return this.statusPanelTabs.map((meta) => {
        const rows = this.statusRowsByPanel[meta.key] || [];
        return {
          key: meta.key,
          kicker: meta.key === 'resources' ? '资源' : meta.key === 'abilities' ? '能力' : meta.key === 'martial' ? '武学军旅' : '根基',
          label: meta.label,
          summary: meta.summary,
          previewLines: rows.slice(0, 3).map((row) => `${row.label} ${row.value}`),
          rows
        };
      });
    },
    selfStatusSections() {
      return [
        {
          key: 'survival',
          kicker: '生存',
          title: '生存与行动',
          summary: '先看还能不能继续压动作，再决定是扩张、练兵还是收束。',
          rows: [
            this.makeStatusRow('身骨', `${Number(this.snapshot.gameState.health || 0)}/${Number(this.snapshot.gameState.maxHealth || 100)}`, '个人还能不能扛风险和硬仗。'),
            this.makeStatusRow('疲惫', this.snapshot.gameState.fatigue, '越高越不适合连续压强动作。'),
            this.makeStatusRow('士气', this.snapshot.gameState.morale, '队伍还肯不肯继续压上。'),
            this.makeStatusRow('名望', this.snapshot.gameState.renown, '别人会不会记住我、愿不愿给我门路。'),
            this.makeStatusRow('影响', this.snapshot.gameState.influence, '我说出去的话能带起多少实际回响。')
          ]
        },
        {
          key: 'resources',
          kicker: '资源',
          title: '钱粮与人手',
          summary: STATUS_PANEL_META.resources.summary,
          rows: this.statusRowsByPanel.resources.filter((row) => ['钱财', '粮秣', '部曲'].includes(row.label))
        },
        {
          key: 'abilities',
          kicker: '能力',
          title: '经营与谋略',
          summary: STATUS_PANEL_META.abilities.summary,
          rows: this.statusRowsByPanel.abilities
        },
        {
          key: 'martial',
          kicker: '武学军旅',
          title: '武学、军旅与门派',
          summary: STATUS_PANEL_META.martial.summary,
          rows: this.statusRowsByPanel.martial
        },
        {
          key: 'footing',
          kicker: '根基',
          title: '城池、队伍与立足',
          summary: STATUS_PANEL_META.footing.summary,
          rows: this.statusRowsByPanel.footing
        }
      ];
    },
    selfPinnedRows() {
      const gs = this.snapshot.gameState || {};
      return [
        this.makeStatusRow('身骨', `${Number(gs.health || 0)}/${Number(gs.maxHealth || 100)}`, '还能不能继续硬压'),
        this.makeStatusRow('疲惫', gs.fatigue, '高了就该收手'),
        this.makeStatusRow('士气', gs.morale, '队伍肯不肯继续压上'),
        this.makeStatusRow('钱财', gs.coins, '能不能立刻砸开门路'),
        this.makeStatusRow('粮秣', gs.supplies, '军旅和远行底气'),
        this.makeStatusRow('部曲', gs.troops, '当前可直接调动人手'),
        this.makeStatusRow('名望', gs.renown, '别人会不会把我当回事'),
        this.makeStatusRow('影响', gs.influence, '我这一步能带起多大回响')
      ];
    },
    visibleSelfPinnedRows() {
      if (!this.isMobileLayout) return this.selfPinnedRows;
      return this.selfPinnedRows.slice(0, 6);
    },
    foodItems() {
      return ((this.snapshot.gameState && this.snapshot.gameState.items) || [])
        .filter(item => item && item.itemType === 'food' && Number(item.count || 0) > 0);
    },
    foodBuffs() {
      return ((this.snapshot.gameState && this.snapshot.gameState.foodBuffs) || [])
        .filter(item => item && Number(item.turns || 0) > 0);
    },
    foodStatusCard() {
      const items = this.fixedChoices
        .filter(choice => this.choiceDirectionOf(choice) === 'growth' && choice.actionMode === 'eat' && !/^placeholder:food/.test(String(choice.id || '')))
        .slice(0, 4);
      const count = this.foodItems.reduce((sum, item) => sum + Number(item.count || 0), 0);
      const latestMeal = this.snapshot.gameState && this.snapshot.gameState.lastMeal ? this.snapshot.gameState.lastMeal : null;
      const buffLine = this.foodBuffs.length
        ? `当前食效：${this.foodBuffs.map(item => `${item.foodName}·${item.domain} +${item.score}（${item.turns}回）`).join(' / ')}`
        : '';
      return {
        title: latestMeal ? `最近入口：${latestMeal.name}` : '养成食味',
        countLine: `行囊 ${count} 份`,
        summary: latestMeal
          ? (latestMeal.flavorText || '这一口已经吃下去，余味还留在身上。')
          : '食物不改大盘，只拿来回气、养伤、提神，顺手给下一手带一点风味加成。',
        soulLine: latestMeal && latestMeal.soulLine ? latestMeal.soulLine : '',
        buffLine,
        items
      };
    },
    foodSelfCard() {
      const latestMeal = this.snapshot.gameState && this.snapshot.gameState.lastMeal ? this.snapshot.gameState.lastMeal : null;
      if (!latestMeal && !this.foodBuffs.length) return null;
      return {
        title: latestMeal ? latestMeal.name : '食味未散',
        summary: latestMeal
          ? (latestMeal.flavorText || '刚入口的那点味道还在身上。')
          : '上一口留下的那点食效还没散干净。',
        soulLine: latestMeal && latestMeal.soulLine ? latestMeal.soulLine : '',
        buffLine: this.foodBuffs.length
          ? `当前食效：${this.foodBuffs.map(item => `${item.foodName}·${item.domain} +${item.score}（${item.turns}回）`).join(' / ')}`
          : ''
      };
    },
    activeSelfStatusSection() {
      return this.selfStatusSections.find((item) => item.key === this.activeSelfSection) || this.selfStatusSections[0] || null;
    },
    showExpandedSelfDetails() {
      return !this.isMobileLayout || this.mobileSelfDetailsExpanded;
    },
    visibleSelfStatusRows() {
      const section = this.activeSelfStatusSection;
      const rows = (section && Array.isArray(section.rows)) ? section.rows : [];
      if (!this.isMobileLayout) return rows;
      return rows.slice(0, 4);
    },
    footingLeadCard() {
      const territory = this.territorySummary || {};
      return {
        title: `${territory.currentAuthorityLabel || '无根基'} · ${this.snapshot.world.currentCityName || '未定城池'}`,
        summary: territory.currentAuthoritySummary || '眼下只是路过此地，谈不上真正把一块地盘经营成自己的根。',
        notes: [
          `当前主线 ${this.currentMainline.title || '未定'}`,
          `推进 ${this.mainlineProgress}%`,
          `局势压力 ${Number(this.snapshot.world.pressure || 0)}`
        ]
      };
    },
    footingStatusCards() {
      const territory = this.territorySummary || {};
      const retinue = this.retinueOverview;
      return [
        {
          key: 'territory',
          kicker: '版图',
          title: `已纳入 ${Number(territory.governedCount || 0)} 城`,
          stats: [`稳控 ${Number(territory.controlledCount || 0)} 城`, territory.summaryLine || '版图还在起步'],
          summary: '先看到底有没有稳定吃收益的地盘，再谈扩线。'
        },
        {
          key: 'income',
          kicker: '回流',
          title: `${Number(territory.incomePerTurn || 0)}钱 / ${Number(territory.supplyPerTurn || 0)}粮`,
          stats: [`补入 ${Number(territory.troopSupportPerTurn || 0)} 部曲`, `影响回流 ${Number(territory.influencePerTurn || 0)}`],
          summary: '这是版图经营每回合能自动回流到手上的资源。'
        },
        {
          key: 'retinue',
          kicker: '班底',
          title: retinue ? `${retinue.memberCount}/${retinue.capacity}` : '0/6',
          stats: [
            retinue ? `任命 ${retinue.assignmentCount}` : '任命 0',
            retinue ? `空位 ${retinue.vacancyCount}` : '空位 6'
          ],
          summary: '队伍规模和任命深度，决定你能不能把推进从单人硬扛变成长期协同。'
        },
        {
          key: 'expansion',
          kicker: '外扩',
          title: this.territoryExpansionCards.length ? `可压 ${this.territoryExpansionCards.length} 处` : '暂无近线口子',
          stats: this.territoryExpansionCards.length
            ? this.territoryExpansionCards.slice(0, 2).map((item) => item.text)
            : [this.territoryExpansionSummary],
          summary: this.territoryExpansionCards.length
            ? '已经有可以顺势压出去的近线城池。'
            : '先稳住本城根基，再谈外扩更顺。'
        }
      ];
    },
    statusDetailRows() {
      return this.statusRowsByPanel[this.activeStatusPanel] || [];
    },
    statusFeedbackCards() {
      const list = [];
      if (this.lastRetinueFeedbackCard) {
        list.push({
          key: 'retinue',
          kicker: '本回协同',
          title: this.lastRetinueFeedbackCard.title,
          summary: this.lastRetinueFeedbackCard.summaryLine || this.lastRetinueFeedbackCard.participantLine,
          extra: this.lastRetinueFeedbackCard.totalLine ? `协同收益：${this.lastRetinueFeedbackCard.totalLine}` : '',
          tier: this.lastRetinueFeedbackCard.tier || '已结算'
        });
      }
      if (this.lastSkillFeedbackCard) {
        list.push({
          key: 'skill',
          kicker: '本回技能',
          title: this.lastSkillFeedbackCard.title,
          summary: this.lastSkillFeedbackCard.summaryLine,
          extra: this.lastSkillFeedbackCard.totalLine ? `技能收益：${this.lastSkillFeedbackCard.totalLine}` : '',
          tier: this.lastSkillFeedbackCard.tier || '已结算'
        });
      }
      if (this.lastCityReportCard) {
        list.push({
          key: 'city',
          kicker: '城池回流',
          title: this.lastCityReportCard.cityName,
          summary: this.lastCityReportCard.summary,
          extra: `${this.lastCityReportCard.yieldLine} · ${this.lastCityReportCard.scaleLine}`,
          tier: this.lastCityReportCard.authorityLabel || '已结算'
        });
      }
      return list.slice(0, 3);
    },
    statusCards() {
      const gs = this.snapshot.gameState;
      return [
        this.makeCard('coins', '钱财', gs.coins, 200, '盘缠与调度空间'),
        this.makeCard('supplies', '粮秣', gs.supplies, 200, '远行与战事底气'),
        this.makeCard('troops', '部曲', gs.troops, 500, '可直接调动的人手'),
        this.makeCard('morale', '士气', gs.morale, 100, '队伍是否还肯继续压上'),
        this.makeCard('health', '身骨', gs.health, gs.maxHealth || 100, '个人状态与硬撑能力'),
        this.makeCard('renown', '名望', gs.renown, 100, '别人会不会把我当回事')
      ];
    },
    abilityMetrics() {
      const gs = this.snapshot.gameState;
      return [
        this.makeMetric('governance', '内政', gs.governance, '根基是否扎实'),
        this.makeMetric('commerce', '经商', gs.commerce, '钱粮流转能力'),
        this.makeMetric('diplomacy', '外交', gs.diplomacy, '说服与交涉能力'),
        this.makeMetric('military', '军务', gs.military, '练兵整军能力'),
        this.makeMetric('strategy', '谋略', gs.strategy, '看暗线与做局能力')
      ];
    },
    martialPercent() { return Math.max(0, Math.min(100, Number(this.snapshot.gameState.martialLevel || 0))); },
    sectPercent() {
      const favor = Number(this.snapshot.gameState.sectFavor || 0);
      const power = Number(this.snapshot.gameState.sectPower || 0);
      return Math.max(0, Math.min(100, Math.round((favor + power) / 2)));
    },
    sectStatus() {
      if (!this.snapshot.gameState.sectId) return '尚未归门，武学成长主要靠自行摸索。';
      if ((this.snapshot.gameState.sectFavor || 0) >= 70) return '门中已经有人愿意替我撑伞。';
      if ((this.snapshot.gameState.sectFavor || 0) >= 40) return '门中认得我，但还在继续试我。';
      return '只是刚有门路，还谈不上站稳。';
    },
    currentChoices() {
      const rawSource = (this.aiLoading && !this.isSetupPhase) ? this.liveChoices : this.snapshot.choices;
      const source = Array.isArray(rawSource) ? rawSource : [];
      return source.filter(item => item && item.id && item.text);
    },
    safeChoices() { return this.currentChoices; },
    isSetupPhase() {
      const phase = String(this.snapshot.world.phase || '').trim();
      return phase === 'choose_background' || phase === 'choose_origin';
    },
    setupPhaseChoices() {
      if (!this.isSetupPhase) return [];
      return (this.snapshot.choices || []).filter(item => item && item.id && item.text);
    },
    showSetupChoiceDeck() {
      return this.isSetupPhase && this.setupPhaseChoices.length > 0;
    },
    showFixedActionDeck() {
      if (this.inBattle) return false;
      if (this.isSetupPhase) return false;
      return this.fixedChoices.length > 0;
    },
    setupChoiceDeckTitle() {
      return this.snapshot.world.phase === 'choose_origin' ? '起局城池' : '开局出身';
    },
    setupChoiceDeckSummary() {
      if (this.snapshot.world.phase === 'choose_origin') {
        return '这一步决定故事先从哪座城切入，也会影响最先接触到的人物、势力和门派气候。';
      }
      return '先定来路，再定落脚城。开局阶段先用固定操作盘承接这两步，等真正入局后再展开完整经营动作。';
    },
    setupChoiceBadge() {
      return this.snapshot.world.phase === 'choose_origin' ? '起点' : '出身';
    },
    setupChoiceCategory() {
      return this.snapshot.world.phase === 'choose_origin' ? '籍贯' : '开局';
    },
    fixedDeckTitle() {
      if (this.inBattle) return '这一回可用的战斗指令';
      if (this.isSetupPhase) return this.snapshot.world.phase === 'choose_origin' ? '起局案卷 · 落脚城' : '起局案卷 · 开局出身';
      return this.isMobileLayout ? '常备行动' : '常备行动案卷';
    },
    fixedDeckSummary() {
      if (this.isSetupPhase) return this.setupChoiceDeckSummary;
      if (this.useDirectionPanel && this.activeFixedDirectionMeta) {
        return this.isMobileLayout
          ? `先从门类里切方向，再从下方精选动作里落手。当前偏重：${this.activeFixedDirectionMeta.label}。`
          : (this.showFixedDirectionExpanded
            ? this.activeFixedDirectionMeta.summary
            : `当前收束在“${this.activeFixedDirectionMeta.label}”方向，点门类再展开完整案卷。`);
      }
      return '';
    },
    showOperationHeadStrip() {
      return !this.interactionLocked
        && !this.inBattle
        && (this.snapshot.world.phase === 'playing' || this.isSetupPhase);
    },
    operationHeadTitle() {
      if (this.isSetupPhase) return this.setupChoiceDeckTitle;
      if (this.showRecommendedFixedChoices && this.recommendedFixedChoices[0]) return this.recommendedFixedChoices[0].text;
      if (this.activeFixedDirectionMeta) return `先从${this.activeFixedDirectionMeta.label}线里挑一手`;
      if (this.dynamicChoices.length) return '剧情已经把高价值动作摆到台前';
      return '先处理眼前最稳的一手';
    },
    operationHeadSummary() {
      if (this.isSetupPhase) return this.setupChoiceDeckSummary;
      if (this.showRecommendedFixedChoices && this.recommendedFixedChoices[0]) {
        const choice = this.recommendedFixedChoices[0];
        return this.choiceForecastText(choice) || this.choiceRequirementsText(choice) || choice.hint || '这一手最适合先落。';
      }
      if (this.activeFixedDirectionMeta) return this.activeFixedDirectionMeta.summary;
      return '优先补足能形成正反馈的那一步，再回头处理旁线。';
    },
    fixedNavSummary() {
      if (this.isSetupPhase) return this.setupChoiceDeckSummary;
      if (!this.useDirectionPanel) return '把可长期使用的行动按方向收成案卷，先定方向，再挑一手推进。';
      if (this.isMobileLayout) return '先点一类，再看当前类里最值得落手的动作。';
      if (this.activeFixedGroupMeta) return `当前正在看“${this.activeFixedGroupMeta.label}”分组，可随时回到整类动作。`;
      if (this.activeFixedDirectionMeta) return `当前以“${this.activeFixedDirectionMeta.label}”为主轴，右侧只保留这一类最相关的动作。`;
      return '先定方向，再看右侧当前案卷。';
    },
    namePromptTitle() {
      return this.namePromptMode === 'rename' ? '改名' : '新开一卷';
    },
    namePromptSummary() {
      return this.namePromptMode === 'rename'
        ? '这个存档只允许改名一次。确认后会立刻写入当前存档。'
        : '新开一卷前，可以先给主角定一个名字。留空则随机入局。';
    },
    namePromptConfirmLabel() {
      return this.namePromptMode === 'rename' ? '确认改名' : '带着这个名字入局';
    },
    namePromptCancelLabel() {
      return this.namePromptMode === 'rename' ? '取消' : '随机入局';
    },
    namePromptPlaceholder() {
      return this.namePromptAllowEmpty ? '留空则随机生成' : '请输入 2 到 12 字姓名';
    },
    fixedChoices() { return this.safeChoices.filter(item => item.source !== 'dynamic'); },
    dynamicChoices() {
      if (!this.canShowNarrativeDynamicChoices) return [];
      return this.safeChoices.filter(item => item.source === 'dynamic');
    },
    fixedChoiceGroups() {
      const groups = {};
      this.fixedChoices.forEach((choice) => {
        const key = this.choiceDirectionOf(choice);
        if (!key) return;
        if (!groups[key]) {
          groups[key] = {
            key,
            label: (ACTION_DIRECTION_META[key] || {}).label || key,
            summary: (ACTION_DIRECTION_META[key] || {}).summary || '',
            choices: []
          };
        }
        groups[key].choices.push(choice);
      });
      return groups;
    },
    availableFixedDirections() {
      if (!this.useDirectionPanel) return [];
      const list = Object.keys(ACTION_DIRECTION_META)
        .filter(key => this.fixedChoiceGroups[key] && this.fixedChoiceGroups[key].choices.length)
        .map((key) => Object.assign({}, ACTION_DIRECTION_META[key], {
          count: this.fixedChoiceGroups[key].choices.length,
          availableCount: this.fixedChoiceGroups[key].choices.filter(choice => choice && !choice.disabled).length,
          priority: this.directionPriorityScore(key),
          icon: UI_ICON_MAP[key] || UI_ICON_MAP.governance
        }))
        .sort((a, b) => {
          if (Number(b.priority || 0) !== Number(a.priority || 0)) return Number(b.priority || 0) - Number(a.priority || 0);
          if (Number(b.availableCount || 0) !== Number(a.availableCount || 0)) return Number(b.availableCount || 0) - Number(a.availableCount || 0);
          return Number(b.count || 0) - Number(a.count || 0);
        });
      return this.isMobileLayout ? list.slice(0, 5) : list;
    },
    activeFixedDirectionMeta() {
      if (!this.useDirectionPanel) return null;
      return this.availableFixedDirections.find(item => item.key === this.activeChoiceDirection) || this.availableFixedDirections[0] || null;
    },
    activeFixedGroupMeta() {
      if (!this.activeFixedGroupFilter) return null;
      return FIXED_GROUP_META[this.activeFixedGroupFilter] || null;
    },
    activeStatusPanelMeta() {
      return STATUS_PANEL_META[this.activeStatusPanel] || STATUS_PANEL_META.resources;
    },
    turnProcessingState() {
      if (!this.aiLoading) return null;
      if (this.pendingBattleAction) {
        if (!this.narrationDoneReceived) {
          return {
            kind: 'battle',
            title: '这一手正在结算',
            badge: '战斗演绎中',
            detail: '战斗已经进入计算与演绎阶段，当前按钮会暂时锁住；等这一回的场上变化写完，系统才会放出下一手。',
            notes: ['战况先写在上方剧情区', '本回未结清前不可继续下令', '战局结束后会自动回到剧情推进']
          };
        }
        return {
          kind: 'battle',
          title: '战果正在回流剧情',
          badge: '结果整理中',
          detail: '这一回的战场结果已经算完，系统正在把战果写回剧情，并刷新新的固定动作与动态动作。',
          notes: ['按钮锁定属于正常状态', '下一批可选动作会在整理完成后恢复', '若已脱离战局，会直接回到剧情盘面']
        };
      }
      if (!this.narrationDoneReceived) {
        return {
          kind: 'story',
          title: '这一回正在演绎',
          badge: '正文生成中',
          detail: '当前落子已经送入推演，正文还在继续落下；固定动作和动态动作会在正文写稳后继续出现。',
          notes: ['先看剧情区的正文变化', '动态动作会顺着剧情逐步补出', '按钮锁定直到本回收束']
        };
      }
      return {
        kind: 'story',
        title: '正文已落定，正在整理下一手',
        badge: '选项刷新中',
        detail: '这回正文已经写完，系统正在补全后续可选动作，所以眼下还不能继续点击。',
        notes: ['固定操作会先回位', '动态动作会按当前局势继续补全', '整理完会自动恢复可操作状态']
      };
    },
    activeFixedPanelTitle() {
      if (this.activeFixedGroupMeta) return this.activeFixedGroupMeta.label;
      return (this.activeFixedDirectionMeta && this.activeFixedDirectionMeta.label) || '固定操作盘';
    },
    activeFixedPanelSummary() {
      if (this.activeFixedGroupMeta) return this.activeFixedGroupMeta.summary || '';
      return (this.activeFixedDirectionMeta && this.activeFixedDirectionMeta.summary) || '';
    },
    showFixedDirectionExpanded() {
      if (!(this.useDirectionPanel && this.activeFixedDirectionMeta)) return false;
      if (this.isMobileLayout) return true;
      return !!this.fixedDirectionExpanded;
    },
    visibleFixedChoices() {
      if (this.isSetupPhase) return this.setupPhaseChoices;
      const limited = (list) => {
        const limit = this.isMobileLayout ? 4 : 6;
        return this.sortChoicesForDisplay(list || []).slice(0, limit);
      };
      if (!this.useDirectionPanel) return this.sortChoicesForDisplay(this.fixedChoices);
      if (this.activeFixedGroupFilter) {
        return limited(this.fixedChoices
          .filter(choice => this.choiceGroupOf(choice) === this.activeFixedGroupFilter));
      }
      const meta = this.activeFixedDirectionMeta;
      if (!meta) return this.sortChoicesForDisplay(this.fixedChoices);
      return limited((this.fixedChoiceGroups[meta.key] && this.fixedChoiceGroups[meta.key].choices) || []);
    },
    fixedQuickGroupLinks() {
      if (!this.useDirectionPanel) return [];
      return ['recruit', 'appoint', 'retinue_interaction', 'team']
        .map((key) => {
          const count = this.fixedChoices.filter(choice => this.choiceGroupOf(choice) === key).length;
          if (!count) return null;
          const meta = FIXED_GROUP_META[key] || { label: key };
          return {
            key,
            label: meta.label,
            summary: meta.summary || '',
            count
          };
        })
        .filter(Boolean);
    },
    recommendedFixedChoices() {
      if (this.isSetupPhase) return this.setupPhaseChoices.slice(0, this.isMobileLayout ? 2 : 3);
      if (!this.useDirectionPanel) return [];
      const preferredDirection = (this.fixedChoiceGroups[(this.activeFixedDirectionMeta && this.activeFixedDirectionMeta.key) || ''] || {}).choices || [];
      const preferredGroup = this.activeFixedGroupFilter
        ? this.fixedChoices.filter(choice => this.choiceGroupOf(choice) === this.activeFixedGroupFilter)
        : [];
      const source = preferredGroup.length ? preferredGroup : preferredDirection;
      return this.sortChoicesForDisplay(source)
        .filter(choice => choice && !choice.disabled)
        .slice(0, this.isMobileLayout ? 2 : 3);
    },
    showRecommendedFixedChoices() {
      return !this.inBattle && this.snapshot.world.phase === 'playing' && this.recommendedFixedChoices.length > 0;
    },
    visibleFixedChoiceGroups() {
      const groups = {};
      const directionOrder = Object.keys(ACTION_DIRECTION_META);
      this.visibleFixedChoices.forEach((choice) => {
        const key = this.activeFixedGroupFilter
          ? this.choiceDirectionOf(choice)
          : this.choiceGroupOf(choice);
        const meta = this.activeFixedGroupFilter
          ? (ACTION_DIRECTION_META[key] || { label: key, summary: '' })
          : (FIXED_GROUP_META[key] || FIXED_GROUP_META.personal);
        if (!groups[key]) {
          groups[key] = {
            key,
            label: meta.label,
            summary: meta.summary,
            order: this.activeFixedGroupFilter ? directionOrder.indexOf(key) : meta.order,
            choices: []
          };
        }
        groups[key].choices.push(choice);
      });
      return Object.values(groups).sort((a, b) => Number(a.order || 999) - Number(b.order || 999));
    },
    retinueOverview() {
      if (this.snapshot.world.phase !== 'playing') return null;
      const retinue = (this.snapshot.gameState && this.snapshot.gameState.retinue) || {};
      const members = Array.isArray(retinue.members) ? retinue.members : [];
      const assignmentsMap = retinue.assignments && typeof retinue.assignments === 'object' ? retinue.assignments : {};
      const assignmentCount = Object.keys(assignmentsMap).length;
      const capacity = Number(retinue.capacity || 6);
      const relations = Array.isArray(this.snapshot.gameState.relationships) ? this.snapshot.gameState.relationships : [];
      const companionRelationId = String(retinue.companionRelationId || '');
      const parseRecruitRelationId = (choice) => {
        const raw = String((choice && (choice.actionText || choice.id)) || '');
        const matched = raw.match(/action:social:([^:]+):(?:recruit|recruit_probe)/);
        return matched ? matched[1] : '';
      };
      const unmetRequirementText = (choice) => {
        const list = (choice && Array.isArray(choice.requirements) ? choice.requirements : [])
          .filter(item => item && item.met !== true)
          .slice(0, 3)
          .map(item => this.formatChoiceRequirement(item));
        return list.join(' · ');
      };
      const recruitTracks = this.fixedChoices
        .filter(choice => this.choiceGroupOf(choice) === 'recruit' && !/^placeholder:/.test(String(choice.id || '')))
        .slice(0, 5)
        .map((choice) => {
          const relationId = parseRecruitRelationId(choice);
          const relation = relations.find(item => item && item.id === relationId);
          const stage = Number(relation && relation.retinueRecruitStage || 0);
          const inclination = Number(relation && relation.retinueRecruitInclination || 0);
          const gapText = choice.disabled ? unmetRequirementText(choice) : '';
          const stageLabel = choice.actionMode === 'recruit'
            ? (choice.disabled ? '火候未足' : '可正式延揽')
            : stage >= 1 ? '已试探' : '待试探';
          return {
            id: choice.id,
            text: choice.text,
            stageLabel,
            summary: [choice.recruitProfileLabel, choice.recruitProfileSummary || choice.hint].filter(Boolean).join(' · '),
            statsLine: relation
              ? `倾向${inclination} · 信任${Number(relation.trust || 0)} · 忠诚${Number(relation.loyalty || 0)} · 情分${Number(relation.affection || 0)}`
              : '人物已露面，尚待进一步推进。',
            gapText: gapText ? `还差：${gapText}` : ''
          };
        });
      const teamActions = this.fixedChoices
        .filter(choice => this.choiceGroupOf(choice) === 'team' && !choice.disabled)
        .slice(0, 4)
        .map(choice => ({
          id: choice.id,
          text: choice.text,
            requiredRoles: (choice.requirements || []).map(item => item.label).filter(Boolean)
          }));
      const teamLocked = this.fixedChoices
        .filter(choice => this.choiceGroupOf(choice) === 'team' && choice.disabled)
        .slice(0, 3)
        .map(choice => ({
          id: choice.id,
          text: choice.text,
          lockedReason: choice.lockedReason || choice.hint || ''
        }));
      const vacantRoles = this.fixedChoices
        .filter(choice => this.choiceGroupOf(choice) === 'appoint' && choice.disabled && /^placeholder:appoint:/.test(String(choice.id || '')) && /vacant$/.test(String(choice.id || '')))
        .slice(0, 6)
        .map(choice => {
          const text = String(choice.text || '').replace('暂缺人手', '').trim();
          const roleIdMatch = String(choice.id || '').match(/^placeholder:appoint:([^:]+):/);
          const roleMeta = roleIdMatch ? RETINUE_ROLE_META[roleIdMatch[1]] || null : null;
          return {
            roleId: choice.id,
            slotLabel: text || (roleMeta && roleMeta.slotLabel) || '待补职司'
          };
        });
      const assignments = Object.keys(assignmentsMap).map((roleId) => {
        const memberId = assignmentsMap[roleId];
        const relation = (this.snapshot.gameState.relationships || []).find(item => item && item.id === memberId);
        const roleMeta = RETINUE_ROLE_META[roleId] || null;
        const appointChoice = this.fixedChoices.find(choice => String(choice.actionMode || '') === `appoint_${roleId}` && !choice.disabled);
        const placeholderChoice = this.fixedChoices.find(choice => String(choice.id || '') === `placeholder:appoint:${roleId}:assigned`);
        const slotLabel = roleMeta && roleMeta.slotLabel
          ? roleMeta.slotLabel
          : appointChoice
            ? String(appointChoice.text || '').replace(/^任[^掌]+掌/, '')
            : roleId;
        return {
          roleId,
          slotLabel,
          roleName: roleMeta && roleMeta.name ? roleMeta.name : slotLabel,
          memberName: relation && relation.name ? relation.name : memberId,
          yieldText: (appointChoice && appointChoice.hint) || (placeholderChoice && placeholderChoice.hint) || (roleMeta && roleMeta.yieldText) || ''
        };
      });
      const appointmentProspects = this.fixedChoices
        .filter(choice => this.choiceGroupOf(choice) === 'appoint' && !choice.disabled)
        .slice(0, 4)
        .map(choice => ({
          id: choice.id,
          text: choice.text,
          hint: choice.hint || ''
        }));
      const readiness = assignmentCount >= 3
        ? '班底成形'
        : assignmentCount >= 1
          ? '已有分职'
          : members.length >= 1
            ? '幕下初聚'
            : '仍是单打独斗';
      return {
        capacity,
        memberCount: members.length,
        assignmentCount,
        vacancyCount: Math.max(0, capacity - members.length),
        companionName: companionRelationId ? ((relations.find(item => item && item.id === companionRelationId) || {}).name || '') : '',
        readiness,
        recruitTracks,
        assignments,
        appointmentProspects,
        teamActions,
        teamLocked,
        vacantRoles,
        recentFeedback: this.lastRetinueFeedbackCard
      };
    },
    dynamicDraftChoices() {
      if (!this.canShowNarrativeDynamicChoices || !this.aiLoading) return [];
      return (this.liveChoiceDrafts || [])
        .filter(item => item && item.source === 'dynamic')
        .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0));
    },
    dynamicChoiceSlots() {
      const finalized = new Map();
      const drafts = new Map();
      const slots = [];
      const slotMeta = (slot, role) => {
        const fallback = DYNAMIC_SLOT_ROLE_META[Number(slot || 0)] || DYNAMIC_SLOT_ROLE_META[0];
        if (!role) return fallback;
        return Object.values(DYNAMIC_SLOT_ROLE_META).find(item => item.role === role) || fallback;
      };

      this.dynamicChoices.forEach((item) => {
        const slot = Number(item.order || 0);
        if (!finalized.has(slot)) finalized.set(slot, item);
      });
      this.dynamicDraftChoices.forEach((item) => {
        const slot = Number(item.slot || 0);
        if (!drafts.has(slot)) drafts.set(slot, item);
      });

      for (let slot = 0; slot < 3; slot += 1) {
        if (finalized.has(slot)) {
          slots.push({ slot, type: 'choice', choice: finalized.get(slot) });
          continue;
        }

        if (drafts.has(slot)) {
          const draft = drafts.get(slot);
          const meta = slotMeta(slot, draft.slotRole);
          slots.push({
            slot,
            type: 'draft',
            draft,
            label: draft.text || meta.title || DRAFT_PLACEHOLDER_TITLE,
            hint: draft.hint || meta.hint || DRAFT_PLACEHOLDER_HINT
          });
          continue;
        }

        if (this.dynamicPlanning) {
          const meta = slotMeta(slot, '');
          slots.push({
            slot,
            type: 'placeholder',
            label: meta.title || DRAFT_PLACEHOLDER_TITLE,
            hint: meta.hint || DRAFT_PLACEHOLDER_HINT
          });
        }
      }

      return slots;
    },
    mobileDynamicChoiceTabs() {
      const slotLabels = ['第一手', '第二手', '第三手'];
      return this.dynamicChoiceSlots.map((slot) => {
        const role = slot.type === 'choice'
          ? slot.choice && slot.choice.slotRole
          : slot.draft && slot.draft.slotRole;
        const meta = this.dynamicSlotMeta(slot.slot, role);
        return {
          key: Number(slot.slot || 0),
          type: slot.type,
          label: slotLabels[Number(slot.slot || 0)] || `第${Number(slot.slot || 0) + 1}手`,
          note: slot.type === 'choice'
            ? (slot.choice.category || meta.note || '动作')
            : (slot.type === 'draft' ? '浮现中' : (meta.note || '铺陈中'))
        };
      });
    },
    activeMobileDynamicSlotEntry() {
      return this.dynamicChoiceSlots.find((slot) => Number(slot.slot || 0) === Number(this.activeMobileDynamicSlot || 0)) || this.dynamicChoiceSlots[0] || null;
    },
    mobileFixedChoiceSections() {
      return this.visibleFixedChoiceGroups;
    },
    activeMobileFixedChoiceSection() {
      return this.mobileFixedChoiceSections.find((item) => item.key === this.activeMobileFixedSection) || this.mobileFixedChoiceSections[0] || null;
    },
    renderedFixedChoiceGroups() {
      if (!this.isMobileLayout) return this.visibleFixedChoiceGroups;
      const active = this.activeMobileFixedChoiceSection;
      return active ? [active] : [];
    },
    phasePrompt() {
      const phase = this.snapshot.world.phase;
      if (this.inBattle) return this.activeBattle.mode === 'duel' ? (this.activeBattle.variant === 'sparring' ? '这一手怎么喂招' : '这一招怎么拆') : '这一阵怎么打';
      if (phase === 'choose_background') return '我从哪一条来路走进这卷乱世';
      if (phase === 'choose_origin') return '我要先把故事落在哪一座城';
      if (phase === 'ended') return '此局已定，可另开新卷';
      return '这一手我会如何落子';
    },
    phaseDescription() {
      const phase = this.snapshot.world.phase;
      if (this.inBattle) {
        return this.activeBattle.mode === 'duel'
          ? `${this.activeBattle.variant === 'sparring' ? '江湖切磋' : '江湖对决'}第 ${this.activeBattle.round} 回合，对手是 ${this.activeBattle.targetName || '未知对手'}。`
          : `${this.activeBattle.scaleLabel || '战局已起'}，第 ${this.activeBattle.round} 回合，对手是 ${this.activeBattle.targetName || '未知对手'}。`;
      }
      if (phase === 'choose_background') return '挑一条出身，让这卷故事真正有了我的底色。';
      if (phase === 'choose_origin') return '先择一处落脚地，再看这乱世怎样把人卷进去。';
      if (phase === 'ended') return this.snapshot.gameState.endingBiography || this.snapshot.gameState.endingSummary || '这一卷先收在这里。';
      return '';
    },
    visibleRelations() {
      return ensureArray(this.snapshot.gameState.relationships).filter((item) => {
        if (!item) return false;
        if (item.visibilityState) return String(item.visibilityState).trim().toLowerCase() === 'met';
        return item.discovered !== false;
      });
    },
    relationBookEntries() {
      return (this.snapshot.gameState.relationships || [])
        .filter(item => item && this.relationVisibilityOf(item) !== 'hidden')
        .slice()
        .sort((a, b) => {
          const visibilityRank = { met: 2, scene: 1, rumor: 0, hidden: -1 };
          const visibilityDelta = (visibilityRank[this.relationVisibilityOf(b)] || 0) - (visibilityRank[this.relationVisibilityOf(a)] || 0);
          if (visibilityDelta !== 0) return visibilityDelta;
          const aScore = a && a.favorScore !== undefined ? a.favorScore : this.deriveFavorScore(a);
          const bScore = b && b.favorScore !== undefined ? b.favorScore : this.deriveFavorScore(b);
          return bScore - aScore;
        });
    },
    sortedRelations() {
      return this.visibleRelations.slice().sort((a, b) => {
        const aScore = a && a.favorScore !== undefined ? a.favorScore : this.deriveFavorScore(a);
        const bScore = b && b.favorScore !== undefined ? b.favorScore : this.deriveFavorScore(b);
        return bScore - aScore;
      });
    },
    historicalClueCards() {
      return (this.snapshot.gameState.relationships || [])
        .filter((relation) => {
          if (!relation || relation.isHistorical !== true) return false;
          if (!['rumor', 'met'].includes(this.relationVisibilityOf(relation))) return false;
          const presence = relation.historicalPresence && typeof relation.historicalPresence === 'object'
            ? relation.historicalPresence
            : null;
          return !!(presence && presence.active);
        })
        .slice(0, 3)
        .map((relation) => ({
          id: relation.id || relation.name,
          name: relation.name || '未名人物',
          title: relation.title || '史势人物',
          stageLabel: this.historicalRelationStageLabel(relation),
          summary: relation.status || relation.summary || '这一条线索刚浮出来，还隔着一层传闻。',
          recommendation: this.historicalLeadRecommendation(relation)
        }));
    },
    historicalClueSummary() {
      if (this.historicalClueCards.length) return `${this.snapshot.world.currentCityName || '此地'}已有 ${this.historicalClueCards.length} 条可继续推进的史实人物线索`;
      return `${this.snapshot.world.currentCityName || '此地'}暂时没有浮到明面的史实人物线索`;
    },
    historicalClueEmptyText() {
      return '当前城中还没有可继续推进的史实人物线索。想接上史势人物，先去对的城，或继续用江湖、探查、行路把风声翻出来。';
    },
    skillList() {
      return (this.snapshot.gameState.skills || []).slice().sort((a, b) => {
        const aLevel = String((a && a.level) || '');
        const bLevel = String((b && b.level) || '');
        return bLevel.localeCompare(aLevel, 'zh-Hans-CN');
      });
    },
    sortedFactions() {
      return (this.snapshot.gameState.factions || []).slice().sort((a, b) => ((b.power || 0) + (b.hostility || 0) + (b.leverage || 0)) - ((a.power || 0) + (a.hostility || 0) + (a.leverage || 0)));
    },
    advisoryList() { return this.snapshot.gameState.advisory || []; },
    pendingThreads() {
      return (this.snapshot.pendingThreads || [])
        .slice()
        .sort((a, b) => {
          if (Number(b.urgency || 0) !== Number(a.urgency || 0)) return Number(b.urgency || 0) - Number(a.urgency || 0);
          return Number(a.deadlineTurn || 0) - Number(b.deadlineTurn || 0);
        })
        .slice(0, this.isMobileLayout ? 5 : 8);
    },
    mapRoutes() { return (((this.snapshot.world || {}).map || {}).routes || []).slice(0, 6); },
    longMapRoutes() { return (((this.snapshot.world || {}).map || {}).longRoutes || []).slice(0, 4); },
    territorySummary() { return (((this.snapshot.world || {}).territory) || {}); },
    territoryCards() { return (this.territorySummary.cityCards || []).slice(0, 6); },
    territorySummaryLine() { return this.territorySummary.summaryLine || '眼下还没有真正纳入名下的城池。'; },
    currentCityAuthorityLabel() { return this.territorySummary.currentAuthorityLabel || '无根基'; },
    currentCityAuthoritySummary() { return this.territorySummary.currentAuthoritySummary || '只是路过此地，谈不上在城里站稳。'; },
    currentCityEconomyCard() {
      const currentCityName = this.snapshot.world.currentCityName || '';
      return this.territoryCards.find(item => item && item.cityName === currentCityName) || this.territoryCards[0] || null;
    },
    sideIndustrySummary() {
      const city = this.currentCityEconomyCard || {};
      const currentCityName = this.snapshot.world.currentCityName || city.cityName || '当前城池';
      const order = Number(city.order || 0);
      const prosperity = Number(city.prosperity || 0);
      const security = Number(city.security || 0);
      const average = Math.round((order + prosperity + security) / 3) || 0;
      let tone = '还在立足期，先补秩序与民生，再谈放大收益。';
      if (average >= 80) {
        tone = '城池已经进入高效运转区，可以把资源投向扩张或高风险推进。';
      } else if (average >= 60) {
        tone = '城池运转稳定，适合一边续剧情，一边做经营加固。';
      } else if (average >= 40) {
        tone = '盘面刚刚稳住，任何抽兵或激进动作都要先看代价。';
      }
      return {
        title: `${currentCityName}经营面`,
        headline: `${average} 分`,
        tone,
        metrics: [
          { key: 'order', label: '秩序', value: order, note: order >= 70 ? '民心可用' : '需要压住杂音' },
          { key: 'prosperity', label: '民生', value: prosperity, note: prosperity >= 70 ? '可持续出账' : '还得养盘' },
          { key: 'security', label: '治安', value: security, note: security >= 70 ? '外患较低' : '要防生变' }
        ]
      };
    },
    territorySiegeChoices() {
      return this.fixedChoices
        .filter(choice => choice && choice.actionKind === 'military' && choice.actionMode === 'seize_city')
        .slice(0, 3);
    },
    territoryExpansionCards() {
      return this.territorySiegeChoices.map((choice) => ({
        id: choice.id,
        text: choice.text || '攻取邻城',
        hint: choice.hint || '近线已有可压过去的城池。',
        status: choice.targetName ? `目标：${choice.targetName}` : '目标城待定'
      }));
    },
    territoryExpansionSummary() {
      if (this.territoryExpansionCards.length) {
        return `${this.snapshot.world.currentCityName || '当前城池'}周边已有 ${this.territoryExpansionCards.length} 处可直接压过去的城池`;
      }
      if ((this.territorySummary.currentAuthority || '') === 'control') {
        return `${this.snapshot.world.currentCityName || '当前城池'}已稳住，但眼下没有合适的近线攻城口`;
      }
      return '先拿下本城治权，再谈往外扩张';
    },
    territoryExpansionEmptyText() {
      if ((this.territorySummary.currentAuthority || '') === 'control') {
        return '你在当前城已经站住脚，但还缺兵粮、近线口子，或周边城池尚不适合立刻压过去。';
      }
      return '只有在当前城达到“掌控”，并且兵粮足够时，才会出现相邻城池的攻取入口。';
    },
    battleLogEntries() {
      return this.activeBattle && Array.isArray(this.activeBattle.log) ? this.activeBattle.log.slice().reverse().slice(0, 4) : [];
    },
    recentBattleReturnCard() {
      const report = this.snapshot.gameState && this.snapshot.gameState.lastBattleReport;
      if (!report || this.inBattle) return null;
      return {
        title: report.targetFactionName ? `与${report.targetFactionName}这一战的余波` : '战后的余波',
        mode: report.mode || '战局回看',
        scale: report.scaleLabel || '未定规模',
        playerStrength: report.playerStrength || 0,
        enemyStrength: report.enemyStrength || 0,
        casualties: report.casualties || 0,
        supplyCost: report.supplyCost || 0,
        summary: this.snapshot.gameState.lastResolutionSummary || '战局已经收束，正文正在承接这一手的后续余波。'
      };
    },
    dramaticMemoCard() {
      const layer = (((this.snapshot || {}).gameState || {}).dramaticLayer) || null;
      if (!layer) return null;
      const question = String(layer.activeQuestion || '').trim();
      const residues = Array.isArray(layer.sceneResidue) ? layer.sceneResidue.filter(Boolean).slice(0, 3) : [];
      const plan = layer.latestScenePlan || {};
      const actor = (((layer.softState || {}).actor) || {});
      const planBits = [
        plan.surfaceGoal ? `表层目标：${plan.surfaceGoal}` : '',
        plan.obstacle ? `阻力：${plan.obstacle}` : '',
        plan.turnPoint ? `转折：${plan.turnPoint}` : '',
        plan.emotionalShift ? `情绪转折：${plan.emotionalShift}` : ''
      ].filter(Boolean);
      if (!question && !residues.length && !planBits.length) return null;
      return {
        question: question || '这一回虽然落了子，但局势里还有未冷却的火线。',
        planLine: planBits
          .map((item) => item.replace('表层目标：', '眼下想做：').replace('阻力：', '拦着的是：').replace('转折：', '变数：').replace('情绪转折：', '心势：'))
          .slice(0, 2)
          .join(' · '),
        residueLines: residues.map(item => `余波：${item}`),
        actorLine: `心压 ${actor.pressure || 0} · 所欲 ${actor.desire || 0} · 持重 ${actor.composure || 0}`
      };
    },
    worldFermentationCard() {
      const fermentation = (((this.snapshot || {}).gameState || {}).worldFermentation) || null;
      if (!fermentation) return null;
      const headline = String(fermentation.headline || '').trim();
      const summary = String(fermentation.summary || '').trim();
      const signals = Array.isArray(fermentation.signals) ? fermentation.signals.filter(Boolean).slice(0, 3) : [];
      const heat = Number(fermentation.heat || 0);
      if (!headline && !summary && !signals.length) return null;
      return {
        headline: headline || '这一手已经在台面底下继续发酵。',
        summary: summary || '它不会只停在说明层，而会继续影响后面的门路和反应。',
        signalLines: signals.map(item => `风声：${item}`),
        heatLine: `暗潮热度 ${heat} · 发酵到第 ${Number(fermentation.lastTurn || 0)} 回`
      };
    },
    worldPerceptionCard() {
      const perception = (((this.snapshot || {}).gameState || {}).worldPerception) || null;
      if (!perception) return null;
      const headline = String(perception.headline || '').trim();
      const summary = String(perception.summary || '').trim();
      const signals = Array.isArray(perception.signalLines) ? perception.signalLines.filter(Boolean).slice(0, 3) : [];
      const relationBeats = Array.isArray(perception.relationBeats) ? perception.relationBeats.filter(Boolean).slice(0, 2) : [];
      const intensity = Number(perception.intensity || 0);
      if (!headline && !summary && !signals.length && !relationBeats.length) return null;
      return {
        headline: headline || '旁人已经开始替我这一手加上各自的注脚。',
        summary: summary || '同一件事，在城里、江湖、军中和亲近之人眼里，往往并不是同一种意思。',
        signalLines: signals.map(item => `旁人眼里：${item}`),
        beatLines: relationBeats.map(item => `有人记下：${item}`),
        intensityLine: `风评热度 ${intensity} · 记在第 ${Number(perception.lastTurn || 0)} 回`
      };
    },
    romanceProgressCard() {
      const relation = this.topLoverRelation || this.topRomanceCandidate;
      if (!relation) return null;
      const stage = relation.romanceStage || this.deriveRomanceStage(relation);
      const favor = relation.favorScore !== undefined ? relation.favorScore : this.deriveFavorScore(relation);
      const trust = Number(relation.trust || 0);
      const affection = Number(relation.affection || 0);
      const loyalty = Number(relation.loyalty || 0);
      const journey = relation.retinueRecruitJourney && typeof relation.retinueRecruitJourney === 'object'
        ? relation.retinueRecruitJourney
        : {};
      const promiseCount = Number(journey.promise || 0);
      const bondCount = Number(journey.bond || 0);
      const dailyCount = Number(journey.daily || 0);
      const companionCount = Number(journey.companion || 0);
      const jealousyCount = Number(journey.jealousy || 0);
      const headline = stage === '定情' || relation.bondKey === 'lover'
        ? `${relation.name}这条情分已经成局`
        : `${relation.name}这条情分正在升温`;
      const summary = relation.bondSummary
        || relation.status
        || '这段关系已经不只靠气氛，还在等下一次真正落地的推进。';
      const progressLine = `当前阶段 ${stage} · 好感 ${favor} · 信 ${trust} · 情 ${affection} · 忠 ${loyalty}`;
      let nextLine = '下一步建议：继续把人物线做热，再挑一个真正会改变关系层级的时机推进。';
      if (stage === '未启') {
        nextLine = '下一步建议：先用社交、动态人物线或共同事件把温度做起来，再用“借灯夜会”试探。';
      } else if (stage === '近身') {
        nextLine = '下一步建议：这条线已经能从“借灯夜会”走向“试表心迹”，别一直停在气氛层。';
      } else if (stage === '暧昧') {
        nextLine = '下一步建议：别只反复暧昧，可以找一回真要共同担事的场面，去点“共许风雨”。';
      } else if (stage === '定情' || relation.bondKey === 'lover') {
        nextLine = '下一步建议：恋爱线已经闭环到“恋人”层，后续可走相伴日常、携手同行，若旁人目光起波澜则用“安抚吃醋”稳住。';
      }
      const riskBits = [];
      if (Number(relation.rivalry || 0) > 0) riskBits.push(`怨 ${Number(relation.rivalry || 0)}`);
      if (promiseCount > 0) riskBits.push(`表心迹 ${promiseCount} 次`);
      if (bondCount > 0) riskBits.push(`共担风雨 ${bondCount} 次`);
      if (dailyCount > 0) riskBits.push(`相伴日常 ${dailyCount} 次`);
      if (companionCount > 0) riskBits.push(`携手同行 ${companionCount} 次`);
      if (jealousyCount > 0) riskBits.push(`安抚吃醋 ${jealousyCount} 次`);
      if (relation.isHistorical && !this.historicalDeviationUnlocked) riskBits.push('史实人物的恋爱推进仍受史势边界约束');
      return {
        headline,
        summary,
        progressLine,
        nextLine,
        riskLine: riskBits.length ? `牵动与代价：${riskBits.join(' · ')}` : ''
      };
    },
    overlayTitle() {
      return { relations: '人物关系簿', skills: '技能簿', factions: '势力版图', memo: '局势备忘', map: '文字地图' }[this.activeOverlay] || '';
    },
    textMapGroups() {
      const atlasRegions = ((((this.snapshot || {}).world || {}).map || {}).atlas || {}).regions || [];
      return atlasRegions.length ? atlasRegions : TEXT_MAP_GROUPS;
    }
  },
  watch: {
    displayedStoryText() {
      this.refreshTypewriterStory();
    },
    currentUser() {
      this.desktopRenderError = null;
      this.pushDebugBeacon('auth:current-user-changed');
    }
  },
  async mounted() {
    document.addEventListener('click', this.handleDocumentClick, true);
    this.syncViewportLayout();
    window.addEventListener('resize', this.handleViewportResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.handleViewportResize, { passive: true });
      window.visualViewport.addEventListener('scroll', this.handleViewportResize, { passive: true });
    }
    await this.bootstrap();
    this.refreshTypewriterStory(true);
    this.pushDebugBeacon('page:mounted-finished');
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleDocumentClick, true);
    window.removeEventListener('resize', this.handleViewportResize);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.handleViewportResize);
      window.visualViewport.removeEventListener('scroll', this.handleViewportResize);
    }
    this.stopLoadingTicker();
    this.stopStoryTyping();
    this.clearAllChoiceDraftTimers();
    this.endRetinueResize();
  },
  errorCaptured(error, instance, info) {
    this.pushDebugBeacon('page:errorCaptured', {
      error: error && error.message ? error.message : String(error || 'unknown'),
      info: info || '',
      mobile: this.isMobileLayout ? 'yes' : 'no'
    });
    if (this.isMobileLayout) return true;
    this.desktopRenderError = {
      message: error && error.message ? error.message : String(error || '未知错误'),
      info: info || ''
    };
    if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
      console.error('[GamePageHanmoChronicleV2 errorCaptured]', error, info, instance);
    }
    return false;
  },
  methods: {
    pushDebugBeacon(stage, extra = {}) {
      if (typeof window === 'undefined') return;
      const beacon = window.__chronicleDebug;
      if (!beacon || typeof beacon.mark !== 'function') return;
      beacon.mark(stage, Object.assign({
        current_user: this.currentUser ? (this.currentUser.username || this.currentUser.id || 'yes') : 'guest',
        session_id: this.sessionId || '(none)',
        phase: ((this.snapshot || {}).world || {}).phase || '',
        mobile_layout: this.isMobileLayout ? 'yes' : 'no',
        desktop_error: this.desktopRenderError ? this.desktopRenderError.message : ''
      }, extra || {}));
    },
    inspectDomVisibility() {
      if (typeof window === 'undefined' || !this.$el) return;
      const describe = (selector) => {
        const node = selector === 'self'
          ? this.$el
          : (this.$el.querySelector ? this.$el.querySelector(selector) : null);
        if (!node || !node.getBoundingClientRect) {
          return { exists: 'no' };
        }
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return {
          exists: 'yes',
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          left: Math.round(rect.left)
        };
      };

      const chronicle = describe('self');
      const pageShell = describe('.page-shell');
      const crpgShell = describe('.crpg-shell');
      const mainGrid = describe('.main-grid');
      const authEntry = describe('.auth-entry');

      this.pushDebugBeacon('page:dom-inspect', {
        active_overlay: this.activeOverlay || '',
        donation_visible: this.donationGuideVisible ? 'yes' : 'no',
        glossary_visible: this.glossarySheetVisible ? 'yes' : 'no',
        name_prompt_visible: this.namePromptVisible ? 'yes' : 'no',
        chronicle_exists: chronicle.exists,
        chronicle_display: chronicle.display || '',
        chronicle_visibility: chronicle.visibility || '',
        chronicle_opacity: chronicle.opacity || '',
        chronicle_size: `${chronicle.width || 0}x${chronicle.height || 0}`,
        page_shell_exists: pageShell.exists,
        page_shell_display: pageShell.display || '',
        page_shell_visibility: pageShell.visibility || '',
        page_shell_size: `${pageShell.width || 0}x${pageShell.height || 0}`,
        crpg_exists: crpgShell.exists,
        crpg_display: crpgShell.display || '',
        crpg_visibility: crpgShell.visibility || '',
        crpg_opacity: crpgShell.opacity || '',
        crpg_size: `${crpgShell.width || 0}x${crpgShell.height || 0}`,
        main_grid_exists: mainGrid.exists,
        auth_exists: authEntry.exists
      });
    },
    pushToast(type, text) {
      const item = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        text: String(text || '').trim()
      };
      if (!item.text) return;
      this.toastItems = this.toastItems.concat(item).slice(-4);
      window.setTimeout(() => {
        this.toastItems = this.toastItems.filter(entry => entry.id !== item.id);
      }, type === 'error' ? 4200 : 3000);
    },
    scrollToSection(refName) {
      if (typeof window === 'undefined') return;
      const node = this.$refs[refName];
      const target = Array.isArray(node) ? node[0] : node;
      if (!target || !target.getBoundingClientRect) return;
      const top = Math.max(0, target.getBoundingClientRect().top + window.pageYOffset - (this.isMobileLayout ? 92 : 24));
      window.scrollTo({ top, behavior: 'smooth' });
    },
    openAuthDialog() {
      this.authDialogVisible = true;
    },
    directionPriorityScore(key) {
      const gs = this.snapshot.gameState || {};
      const territory = this.territorySummary || {};
      let score = 0;
      if (key === 'military') {
        score += (gs.martialFocusId === 'battlefield' ? 12 : 0) + Math.min(8, Math.floor(Number(gs.battlefieldPrestige || 0) / 12));
      } else if (key === 'jianghu') {
        score += (gs.martialFocusId === 'jianghu' ? 12 : 0) + Math.min(8, Math.floor(Number(gs.jianghuPrestige || 0) / 12));
      } else if (key === 'martial') {
        score += Math.min(8, Math.floor(Number(gs.martialLevel || 0) / 15)) + ((gs.sectId || '') ? 4 : 0);
      } else if (key === 'governance') {
        score += Number(territory.governedCount || 0) > 0 ? 12 : (Number(territory.currentAuthorityScore || 0) >= 20 ? 6 : 0);
      } else if (key === 'network') {
        score += Math.min(8, Math.floor(Number(gs.influence || 0) / 10));
      } else if (key === 'strategy') {
        score += Math.min(8, Math.floor(Number(gs.strategy || 0) / 10));
      } else if (key === 'world') {
        score += (String(this.snapshot.world.phase || '') === 'playing' && Number(this.snapshot.world.pressure || 0) >= 35) ? 6 : 0;
      } else if (key === 'growth') {
        score += Number(gs.fatigue || 0) >= 65 ? 10 : 0;
        score += Number(gs.health || 0) <= 45 ? 8 : 0;
      }
      return score;
    },
    threadTurnsLeft(thread) {
      const deadline = Number(thread && thread.deadlineTurn || 0);
      const turn = Number(this.snapshot.world.turn || 0);
      if (!deadline) return 0;
      return Math.max(0, deadline - turn);
    },
    threadPressureText(thread) {
      const turnsLeft = this.threadTurnsLeft(thread);
      const urgency = Number(thread && thread.urgency || 0);
      if (turnsLeft > 0) return `急 ${urgency} · 还剩 ${turnsLeft} 回`;
      return `急 ${urgency} · 该处理`;
    },
    handleViewportResize() {
      this.syncViewportLayout();
    },
    syncViewportLayout() {
      if (typeof window === 'undefined') return;
      const viewport = window.visualViewport || null;
      const viewportWidth = viewport ? Math.round(viewport.width) : window.innerWidth;
      const viewportHeight = viewport ? Math.round(viewport.height) : window.innerHeight;
      document.documentElement.style.setProperty('--app-width', `${viewportWidth}px`);
      document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`);
      const nextMobile = viewportWidth <= MOBILE_LAYOUT_BREAKPOINT;
      this.isMobileLayout = nextMobile;
      this.pushDebugBeacon('page:viewport-sync', {
        viewport_width: viewportWidth,
        viewport_height: viewportHeight
      });
      if (!nextMobile) {
        this.activeMobileView = 'story';
        this.mobileStoryToolsExpanded = false;
        this.$nextTick(() => this.inspectDomVisibility());
        return;
      }
      if (!MOBILE_VIEW_META[this.activeMobileView]) {
        this.activeMobileView = 'story';
      }
      if (String(this.snapshot.world.phase || '') !== 'playing' && !this.inBattle) {
        this.activeMobileView = 'action';
      }
      this.syncActiveMobileFixedSection();
      this.syncActiveMobileDynamicSlot();
      this.$nextTick(() => this.inspectDomVisibility());
    },
    setActiveMobileView(viewKey) {
      if (!MOBILE_VIEW_META[viewKey]) return;
      this.activeMobileView = viewKey;
      if (!this.isMobileLayout || typeof window === 'undefined') return;
      this.$nextTick(() => {
        const anchor = this.$el && this.$el.querySelector ? this.$el.querySelector('.main-grid') : null;
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        const targetTop = Math.max(0, window.scrollY + rect.top - 96);
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      });
    },
    ensureMobileView(viewKey) {
      if (!this.isMobileLayout) return;
      if (!MOBILE_VIEW_META[viewKey]) return;
      this.activeMobileView = viewKey;
    },
    jumpToMobileSection(viewKey) {
      if (!MOBILE_VIEW_META[viewKey]) return;
      this.activeMobileView = viewKey;
      if (!this.isMobileLayout) return;
      if (viewKey !== 'intel') {
        this.mobileAuthGuideExpanded = false;
      }
      if (viewKey === 'action') {
        this.focusOperationZone(true);
        return;
      }
      if (viewKey === 'intel') {
        this.emitInteractionPulse('soft');
        return;
      }
      this.focusStoryZone(true);
    },
    handleMobileViewAfterEnter(viewKey) {
      if (!this.isMobileLayout || viewKey !== this.activeMobileView) return;
      if (viewKey === 'action') {
        this.focusOperationZone(true);
      }
    },
    closeMobileSheet() {
      if (this.mobileAuthGuideExpanded) {
        this.mobileAuthGuideExpanded = false;
        return;
      }
      if (this.isMobileLayout && this.activeMobileView === 'intel') {
        this.activeMobileView = 'story';
      }
    },
    handleStoryScroll(event) {
      if (!this.isMobileLayout) return;
      const target = event && event.target;
      if (!target) return;
      const top = Number(target.scrollTop || 0);
      const nearBottom = target.scrollHeight - target.clientHeight - top < 80;
      if (!this.storyAutoScrolling) {
        this.storyAutoFollow = nearBottom || top <= 4;
      }
      const delta = top - Number(this.lastStoryScrollTop || 0);
      if (Math.abs(delta) > 8) {
        this.storyChromeHidden = delta > 0 && top > 48;
      }
      this.lastStoryScrollTop = top;
    },
    handleDocumentClick(event) {
      if (!this.activePurchaseSku) return;
      const target = event && event.target;
      if (target && typeof target.closest === 'function' && target.closest('.purchase-group')) return;
      this.activePurchaseSku = '';
    },
    emitInteractionPulse(kind = 'soft') {
      if (typeof navigator !== 'undefined' && navigator && typeof navigator.vibrate === 'function' && this.isMobileLayout) {
        try { navigator.vibrate(kind === 'strong' ? 12 : 8); } catch (e) { void e; }
      }
    },
    inferChoicePhase(list) {
      const choices = Array.isArray(list) ? list.filter(item => item && item.id) : [];
      if (!choices.length) return '';
      if (choices.every(item => String(item.id || '').startsWith('origin:'))) return 'choose_origin';
      if (choices.every(item => String(item.id || '').startsWith('background:'))) return 'choose_background';
      return '';
    },
    resolveChoicePhase(list) {
      const inferred = this.inferChoicePhase(list);
      if (inferred) return inferred;
      if (this.aiLoading && this.pendingPhaseOverride) return this.pendingPhaseOverride;
      return this.snapshot.world.phase;
    },
    dynamicSlotMeta(slot, role) {
      const fallback = DYNAMIC_SLOT_ROLE_META[Number(slot || 0)] || DYNAMIC_SLOT_ROLE_META[0];
      if (!role) return fallback;
      return Object.values(DYNAMIC_SLOT_ROLE_META).find(item => item.role === role) || fallback;
    },
    syncActiveMobileDynamicSlot(force = false) {
      const slots = this.dynamicChoiceSlots;
      if (!slots.length) {
        this.activeMobileDynamicSlot = 0;
        return;
      }
      const exists = slots.some(item => Number(item.slot || 0) === Number(this.activeMobileDynamicSlot || 0));
      if (!force && exists) return;
      const preferred = slots.find(item => item.type === 'choice') || slots[0];
      this.activeMobileDynamicSlot = Number(preferred.slot || 0);
    },
    setActiveMobileDynamicSlot(slot) {
      this.activeMobileDynamicSlot = Number(slot || 0);
    },
    syncActiveMobileFixedSection(force = false) {
      const sections = this.mobileFixedChoiceSections;
      if (!sections.length) {
        this.activeMobileFixedSection = '';
        return;
      }
      const exists = sections.some(item => item.key === this.activeMobileFixedSection);
      if (!force && exists) return;
      this.activeMobileFixedSection = sections[0].key;
    },
    setActiveMobileFixedSection(key) {
      if (!key) return;
      this.activeMobileFixedSection = key;
    },
    sanitizeChoicesForPhase(list, phase) {
      const choices = (list || []).filter(item => item && item.id && item.text);
      if (phase !== 'playing') return choices.filter(item => item.source !== 'dynamic');
      return choices;
    },
    predictPhaseFromAction(actionText) {
      const action = String(actionText || '').trim();
      if (action.startsWith('background:')) return 'choose_origin';
      if (action.startsWith('origin:')) return 'playing';
      return '';
    },
    sortLiveChoices(list) {
      const dynamic = (list || [])
        .filter(item => item && item.source === 'dynamic')
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const fixed = this.sortChoicesForDisplay((list || []).filter(item => item && item.source !== 'dynamic'));
      return dynamic.concat(fixed);
    },
    sortChoicesForDisplay(list) {
      return (list || []).slice().sort((a, b) => {
        const aDisabled = a && a.disabled ? 1 : 0;
        const bDisabled = b && b.disabled ? 1 : 0;
        if (aDisabled !== bDisabled) return aDisabled - bDisabled;
        const aRecommended = this.isChoiceRecommended(a) ? 1 : 0;
        const bRecommended = this.isChoiceRecommended(b) ? 1 : 0;
        if (aRecommended !== bRecommended) return bRecommended - aRecommended;
        const aGroup = Number(((FIXED_GROUP_META[this.choiceGroupOf(a)] || {}).order) || 999);
        const bGroup = Number(((FIXED_GROUP_META[this.choiceGroupOf(b)] || {}).order) || 999);
        if (aGroup !== bGroup) return aGroup - bGroup;
        const directionDelta = this.choiceDirectionOrderOf(a) - this.choiceDirectionOrderOf(b);
        if (directionDelta !== 0) return directionDelta;
        return Number(a && a.order || 0) - Number(b && b.order || 0);
      });
    },
    isChoiceRecommended(choice) {
      if (!choice) return false;
      const activeDirection = this.activeFixedDirectionMeta && this.activeFixedDirectionMeta.key;
      if (activeDirection && this.choiceDirectionOf(choice) === activeDirection && !choice.disabled) return true;
      return false;
    },
    choiceDirectionOf(choice) {
      if (!choice) return '';
      const explicit = String(choice.direction || '').trim();
      if (explicit) return explicit;
      const id = String(choice.id || '');
      const kind = String(choice.actionKind || '');
      if (kind === 'govern' || kind === 'trade') return 'governance';
      if (kind === 'social' || kind === 'romance' || kind === 'diplomacy') return 'network';
      if (kind === 'investigate' || kind === 'intrigue') return 'strategy';
      if (kind === 'martial' || kind === 'sect' || id.startsWith('joinsect:')) return 'martial';
      if (kind === 'military' || kind === 'warpath') return 'military';
      if (kind === 'spar') return 'jianghu';
      if (kind === 'jianghu') return 'jianghu';
      if (kind === 'travel') return 'world';
      if (kind === 'rest') return 'growth';
      return 'governance';
    },
    choiceGroupOf(choice) {
      const explicit = String(choice && choice.group || '').trim();
      if (explicit) return explicit;
      return this.choiceDirectionOf(choice) === 'world' ? 'travel' : 'personal';
    },
    choiceDirectionOrderOf(choice) {
      return Math.max(0, Object.keys(ACTION_DIRECTION_META).indexOf(this.choiceDirectionOf(choice)));
    },
    preferredChoiceDirection() {
      const availableKeys = this.availableFixedDirections.map(item => item.key);
      if (!availableKeys.length) return '';
      const focus = Array.isArray(this.currentMainline.focus) ? this.currentMainline.focus : [];
      const preferenceOrder = [];
      if (focus.includes('govern') || focus.includes('trade')) preferenceOrder.push('governance');
      if (focus.includes('social') || focus.includes('diplomacy') || focus.includes('sect')) preferenceOrder.push('network');
      if (focus.includes('investigate') || focus.includes('intrigue')) preferenceOrder.push('strategy');
      if (focus.includes('martial')) preferenceOrder.push('martial');
      if (focus.includes('jianghu')) preferenceOrder.push('jianghu');
      if (focus.includes('travel')) preferenceOrder.push('world');
      if (focus.includes('military') || focus.includes('battle')) preferenceOrder.push('military');
      if ((this.snapshot.gameState.martialFocusId || '') === 'jianghu') preferenceOrder.unshift('jianghu');
      if ((this.snapshot.gameState.martialFocusId || '') === 'battlefield') preferenceOrder.unshift('military');
      if (Number(this.snapshot.gameState.fatigue || 0) >= 28 || Number(this.snapshot.gameState.health || 0) <= 55) {
        preferenceOrder.unshift('growth');
      }
      const matched = preferenceOrder.find(key => availableKeys.includes(key));
      return matched || availableKeys[0];
    },
    syncActiveChoiceDirection(force = false) {
      if (!this.useDirectionPanel) {
        this.activeChoiceDirection = '';
        this.activeFixedGroupFilter = '';
        this.fixedDirectionExpanded = false;
        return;
      }
      const availableKeys = this.availableFixedDirections.map(item => item.key);
      if (!availableKeys.length) {
        this.activeChoiceDirection = '';
        this.activeFixedGroupFilter = '';
        this.fixedDirectionExpanded = false;
        return;
      }
      if (this.activeFixedGroupFilter) {
        const hasGroupChoices = this.fixedChoices.some(choice => this.choiceGroupOf(choice) === this.activeFixedGroupFilter);
        if (!hasGroupChoices) this.activeFixedGroupFilter = '';
      }
      if (!force && availableKeys.includes(this.activeChoiceDirection)) {
        this.syncActiveMobileFixedSection(true);
        return;
      }
      this.activeChoiceDirection = this.preferredChoiceDirection();
      this.fixedDirectionExpanded = true;
      this.syncActiveMobileFixedSection(true);
    },
    setActiveChoiceDirection(key) {
      if (!key) return;
      if (this.activeChoiceDirection === key) {
        if (this.isMobileLayout) {
          this.fixedDirectionExpanded = true;
          this.activeFixedGroupFilter = '';
          this.syncActiveMobileFixedSection(true);
          return;
        }
        this.fixedDirectionExpanded = !this.fixedDirectionExpanded;
        this.activeFixedGroupFilter = '';
        this.syncActiveMobileFixedSection(true);
        return;
      }
      this.activeFixedGroupFilter = '';
      this.activeChoiceDirection = key;
      this.fixedDirectionExpanded = true;
      this.syncActiveMobileFixedSection(true);
    },
    setActiveFixedGroupFilter(groupKey) {
      if (!groupKey) return;
      if (this.activeFixedGroupFilter === groupKey) {
        this.clearActiveFixedGroupFilter();
        return;
      }
      const firstChoice = this.fixedChoices.find(choice => this.choiceGroupOf(choice) === groupKey);
      this.activeFixedGroupFilter = groupKey;
      if (firstChoice) this.activeChoiceDirection = this.choiceDirectionOf(firstChoice);
      this.fixedDirectionExpanded = true;
      this.syncActiveMobileFixedSection(true);
    },
    clearActiveFixedGroupFilter() {
      this.activeFixedGroupFilter = '';
      this.syncActiveChoiceDirection(true);
      this.syncActiveMobileFixedSection(true);
    },
    fixedGroupKicker(group) {
      if (this.activeFixedGroupFilter) return this.isMobileLayout ? '同类分线' : '当前分线';
      if (this.isMobileLayout) return '当前子类';
      return '行动子类';
    },
    toggleStoryPanelExpanded(key) {
      if (!this.storyPanelExpanded || !Object.prototype.hasOwnProperty.call(this.storyPanelExpanded, key)) return;
      this.emitInteractionPulse('soft');
      this.storyPanelExpanded[key] = !this.storyPanelExpanded[key];
    },
    collapseFixedDirectionPanel() {
      this.fixedDirectionExpanded = false;
    },
    toggleStatusPanel(panelKey) {
      if (!STATUS_PANEL_META[panelKey]) return;
      this.activeStatusPanel = this.activeStatusPanel === panelKey ? '' : panelKey;
    },
    setActiveStatusPanel(panelKey) {
      if (!STATUS_PANEL_META[panelKey]) return;
      this.activeStatusPanel = panelKey;
    },
    makeCard(key, name, value, max, tip) {
      const base = Number(value || 0);
      const upper = Number(max || 100) || 100;
      return { key, name, value: base, percent: Math.max(0, Math.min(100, Math.round((base / upper) * 100))), tip };
    },
    formatSideValue(value, suffix = '') {
      if (value === undefined || value === null || value === '') return `0${suffix}`;
      return `${value}${suffix}`;
    },
    makeSideBoardItem(label, value) {
      const keyMap = {
        身骨: 'health',
        疲惫: 'fatigue',
        士气: 'morale',
        钱财: 'coins',
        粮秣: 'supplies',
        部曲: 'troops',
        名望: 'renown',
        影响: 'influence'
      };
      const deltaKey = keyMap[label] || '';
      return {
        key: label,
        label,
        value: value === undefined || value === null || value === '' ? '0' : String(value),
        delta: deltaKey ? this.sideDeltaMap[deltaKey] : null
      };
    },
    computeSideDelta(current, previous, reversePositive = false) {
      if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
      const diff = current - previous;
      if (!diff) return null;
      const positive = reversePositive ? diff < 0 : diff > 0;
      return {
        value: `${diff > 0 ? '+' : ''}${diff}`,
        positive
      };
    },
    makeStatusRow(label, value, tip, extra = '') {
      return {
        key: label,
        label,
        value: value === undefined || value === null || value === '' ? '0' : String(value),
        tip: tip || '',
        extra: extra || ''
      };
    },
    percentOf(value, max) {
      const upper = Math.max(1, Number(max || 0));
      return Math.max(0, Math.min(100, Math.round((Number(value || 0) / upper) * 100)));
    },
    reversePercent(value, max) {
      return 100 - this.percentOf(value, max);
    },
    buildCrpgActionFromChoice(choice, overrides = {}) {
      if (!choice) return null;
      const relationRequired = this.isRelationChoice(choice);
      const relationOptions = relationRequired ? this.relationOptionsForChoice(choice) : [];
      const selectedRelation = relationRequired ? this.selectedRelationForChoice(choice) : null;
      const relationBlocked = relationRequired && !selectedRelation && relationOptions.length > 1;
      const direction = this.choiceDirectionOf(choice);
      const badge = overrides.badge || (relationBlocked ? '需指人' : (choice.disabled ? '未达成' : ''));
      const meta = relationBlocked
        ? '先去关系簿明确人物，再回来执行这一手。'
        : (this.choiceForecastText(choice)
          || this.choiceRequirementsText(choice)
          || (relationRequired ? this.relationChoiceHint(choice) : '')
          || choice.hint
          || '这一手已经摆上台面。');
      return {
        key: choice.id,
        label: choice.text,
        meta,
        badge,
        icon: UI_ICON_MAP[direction] || UI_ICON_MAP.governance,
        disabled: Boolean(choice.disabled || relationBlocked),
        tone: overrides.tone || '',
        requirements: Array.isArray(choice.requirements) ? choice.requirements : [],
        choice
      };
    },
    handleCrpgSystemAction(item) {
      if (!item || !item.key) return;
      switch (item.key) {
        case 'auth':
          this.openAuthDialog();
          break;
        case 'character-stats':
          this.desktopCharacterStatsVisible = true;
          break;
        case 'rename':
          this.renamePlayerOnce();
          break;
        case 'donation-guide':
          this.openDonationGuide();
          break;
        case 'reset':
          this.resetGame();
          break;
        case 'logout':
          this.logout();
          break;
        default:
          break;
      }
    },
    handleCrpgGroupToggle(group) {
      if (!group || !group.key) return;
      const key = String(group.key);
      const next = this.activeCrpgCommandGroup === key ? '' : key;
      this.crpgCommandGroupKey = next;
      if (['priority', 'setup', 'battle'].includes(key)) return;
      if (!next) return;
      this.activeFixedGroupFilter = '';
      this.activeChoiceDirection = key;
      this.fixedDirectionExpanded = true;
    },
    handleCrpgActionSelect(action) {
      if (!action || !action.choice) return;
      this.submitChoice(action.choice);
    },
    stopStoryTyping() {
      if (this.storyTypingTimer) {
        clearTimeout(this.storyTypingTimer);
        clearInterval(this.storyTypingTimer);
        this.storyTypingTimer = null;
      }
    },
    followStoryStreamBottom(force = false) {
      if (!this.isMobileLayout) return;
      if (!force && !this.storyAutoFollow) return;
      this.$nextTick(() => {
        const container = this.$refs.storyScroll;
        if (!container) return;
        const targetTop = Math.max(0, container.scrollHeight - container.clientHeight);
        const gap = Math.abs(Number(container.scrollTop || 0) - targetTop);
        if (!force && gap < 18) return;
        this.storyAutoScrolling = true;
        if (typeof container.scrollTo === 'function') {
          container.scrollTo({ top: targetTop, behavior: force ? 'auto' : 'smooth' });
        } else {
          container.scrollTop = targetTop;
        }
        window.setTimeout(() => {
          this.storyAutoScrolling = false;
          this.lastStoryScrollTop = Number(container.scrollTop || targetTop);
        }, force ? 40 : 360);
      });
    },
    refreshTypewriterStory(force = false) {
      const target = String(this.displayedStoryText || '');
      if (!target) {
        this.stopStoryTyping();
        this.typedStoryText = '';
        return;
      }
      if (force) {
        this.stopStoryTyping();
        if (!this.aiLoading || !target.startsWith(String(this.typedStoryText || ''))) {
          this.typedStoryText = '';
        }
      }
      if (!force && this.typedStoryText === target) return;
      if (this.storyTypingTimer && !force) return;
      const step = () => {
        const liveTarget = String(this.displayedStoryText || '');
        if (!liveTarget) {
          this.typedStoryText = '';
          this.stopStoryTyping();
          return;
        }
        let current = String(this.typedStoryText || '');
        if (!liveTarget.startsWith(current)) {
          current = '';
          this.typedStoryText = '';
        }
        if (current.length >= liveTarget.length) {
          this.typedStoryText = liveTarget;
          this.stopStoryTyping();
          return;
        }
        const backlog = liveTarget.length - current.length;
        const nextLength = Math.min(liveTarget.length, current.length + this.storyTypingStepSize(backlog));
        this.typedStoryText = liveTarget.slice(0, nextLength);
        this.followStoryStreamBottom(false);
        if (nextLength < liveTarget.length) {
          const emitted = liveTarget.slice(Math.max(0, nextLength - 2), nextLength);
          this.storyTypingTimer = setTimeout(step, this.storyTypingDelay(backlog, emitted));
        } else {
          this.stopStoryTyping();
        }
      };
      step();
    },
    storyTypingStepSize(backlog) {
      const count = Number(backlog || 0);
      if (count > 260) return 9;
      if (count > 160) return 6;
      if (count > 80) return 4;
      if (count > 28) return 2;
      return 1;
    },
    storyTypingDelay(backlog, emitted = '') {
      const text = String(emitted || '');
      const count = Number(backlog || 0);
      if (/[。！？；]/.test(text)) return count > 120 ? 58 : 150;
      if (/[，、：]/.test(text)) return count > 120 ? 34 : 78;
      if (/\n/.test(text)) return 140;
      if (count > 260) return 10;
      if (count > 160) return 14;
      if (count > 80) return 20;
      return 34;
    },
    decorateStoryText(text) {
      const source = String(text || '');
      if (!source) return '故事还没有真正落笔。';
      const escaped = this.escapeHtml(source);
      const paragraphs = escaped
        .split('\n')
        .map((line) => line.trim() ? this.decorateStoryLine(line) : '<div class="story-spacer"></div>');
      return paragraphs.join('');
    },
    decorateStoryLine(line) {
      let html = line;
      html = this.decorateGlossary(html);
      html = this.decorateProperNouns(html);
      return `<p class="story-paragraph">${html}</p>`;
    },
    decorateGlossary(line) {
      return Object.keys(STORY_GLOSSARY).reduce((result, key) => {
        const pattern = new RegExp(key, 'g');
        return result.replace(pattern, `<button type="button" class="story-glossary-term" data-glossary="${key}">${key}</button>`);
      }, line);
    },
    decorateProperNouns(line) {
      const placePattern = /(长安|洛阳|襄阳|汉中|邺城|平原|北平|江陵|荆州|许都|长安城|洛阳城)/g;
      const personPattern = /(曹操|刘备|孙权|关羽|张飞|诸葛亮|沈知微|吕布|袁绍|董卓|貂蝉|司马懿|郭嘉|赵云|黄忠|马超)/g;
      return line
        .replace(personPattern, '<strong class="story-person">$1</strong>')
        .replace(placePattern, '<strong class="story-place">$1</strong>');
    },
    escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    handleStoryBodyClick(event) {
      const target = event && event.target;
      if (!target || !target.dataset || !target.dataset.glossary) return;
      this.openGlossary(target.dataset.glossary);
    },
    openGlossary(key) {
      if (!STORY_GLOSSARY[key]) return;
      this.activeGlossaryEntryKey = key;
      this.glossarySheetVisible = true;
    },
    closeGlossary() {
      this.glossarySheetVisible = false;
      this.activeGlossaryEntryKey = '';
    },
    formatRetinueDelta(delta) {
      const labels = {
        governance: '内政',
        commerce: '经商',
        diplomacy: '外交',
        military: '军务',
        strategy: '谋略',
        martialLevel: '武学',
        martialInsight: '武感',
        charm: '魅力',
        health: '身骨',
        fatigue: '疲惫',
        morale: '士气',
        renown: '名望',
        influence: '声势',
        troops: '部曲',
        supplies: '粮秣',
        coins: '钱财',
        jianghuPrestige: '江湖名望',
        battlefieldPrestige: '战阵威名',
        sectFavor: '门派情分',
        sectPower: '门派势力'
      };
      const parts = Object.keys(delta || {}).reduce((list, key) => {
        const value = Number((delta || {})[key] || 0);
        if (!value) return list;
        list.push(`${labels[key] || key}${value > 0 ? '+' : ''}${value}`);
        return list;
      }, []);
      return parts.join(' · ');
    },
    battlePercent(value, max) {
      const upper = Math.max(1, Number(max || 0));
      return Math.max(0, Math.min(100, Math.round((Number(value || 0) / upper) * 100)));
    },
    buildBattleRows(side) {
      const battle = this.activeBattle;
      if (!battle || !battle[side]) return [];
      const unit = battle[side];
      if (battle.mode === 'duel') {
        return [
          {
            key: 'hp',
            label: '气血',
            value: unit.hp,
            percent: this.battlePercent(unit.hp, side === 'player' ? battle.initialPlayerHp : battle.initialEnemyHp),
            barClass: 'red-fill',
            tip: side === 'player' ? '先看血线，再决定这一手要不要硬吃。' : '把对手血线压低，后续绝招才更稳。'
          },
          {
            key: 'qi',
            label: '真气',
            value: unit.qi,
            percent: this.battlePercent(unit.qi, 100),
            barClass: 'gold-fill',
            tip: side === 'player' ? `守势 ${unit.guard} · 身法 ${unit.agility}` : `守势 ${unit.guard} · 身法 ${unit.agility}`
          }
        ];
      }
      return [
        {
          key: 'force',
          label: '兵势',
          value: unit.force,
          percent: this.battlePercent(unit.force, side === 'player' ? battle.initialPlayerForce : battle.initialEnemyForce),
          barClass: 'iron-fill',
          tip: side === 'player' ? `将令 ${unit.command} · 谋略 ${unit.strategy}` : `将令 ${unit.command} · 谋略 ${unit.strategy}`
        },
        {
          key: 'morale',
          label: '士气',
          value: unit.morale,
          percent: this.battlePercent(unit.morale, 100),
          barClass: 'gold-fill',
          tip: side === 'player' ? `主将武勇 ${unit.martial}` : `敌将武勇 ${unit.martial}`
        }
      ];
    },
    metricRank(value) {
      const num = Number(value || 0);
      if (num >= 80) return '已成气候';
      if (num >= 60) return '根基深厚';
      if (num >= 40) return '渐成规模';
      if (num >= 25) return '勉强可用';
      return '仍需打磨';
    },
    makeMetric(key, name, value, tip) {
      const num = Number(value || 0);
      return { key, name, value: num, percent: Math.max(0, Math.min(100, num)), rank: this.metricRank(num), tip };
    },
    deriveFavorScore(relation) {
      if (!relation) return 0;
      const trust = Number(relation.trust || 0);
      const affection = Number(relation.affection || 0);
      const loyalty = Number(relation.loyalty || 0);
      const rivalry = Number(relation.rivalry || 0);
      return Math.max(0, Math.min(100, Math.round(trust * 0.5 + affection * 1.2 + loyalty * 0.35 - rivalry * 0.85)));
    },
    deriveRomanceStage(relation) {
      if (!relation) return '未启';
      const trust = Number(relation.trust || 0);
      const affection = Number(relation.affection || 0);
      const rivalry = Number(relation.rivalry || 0);
      const favor = this.deriveFavorScore(relation);
      if (rivalry >= 45) return '未启';
      if (affection >= 70 && trust >= 48) return '定情';
      if (affection >= 42 && favor >= 58 && trust >= 28) return '暧昧';
      if (favor >= 36 && trust >= 14) return '近身';
      return '未启';
    },
    isRelationChoice(choice) {
      return !!choice && choice.targetType === 'relation';
    },
    relationChoiceKey(choice) {
      return choice && choice.id ? choice.id : '';
    },
    relationChoiceKind(choice) {
      return choice && choice.actionKind ? choice.actionKind : '';
    },
    relationChoiceMode(choice) {
      return choice && choice.actionMode ? choice.actionMode : '';
    },
    relationChoicePlaceholder(choice) {
      if (choice && choice.actionKind === 'spar') return '可指定要切磋的人';
      const scope = choice && choice.relationScope ? choice.relationScope : 'general';
      if (scope === 'historical') return '选择要顺线接触的史实人物';
      if (scope === 'warpath') return '选择已结识的史实军旅人物';
      if (scope === 'romance') return '从已结识人物里选择要推进情感的人';
      if (scope === 'martial') return '可指定要讨教的人';
      if (scope === 'strategy') return '可指定要问策的人';
      if (scope === 'retinue') return '选择一位已经入队的幕下成员';
      if (scope === 'retinue_strategy') return '选择一位幕下成员当面问策';
      return '可指定人物';
    },
    historicalRelationActionAllowed(relation, purpose) {
      if (!relation || relation.isHistorical !== true) return true;
      if (this.historicalDeviationUnlocked) return true;
      return !['romance', 'spar'].includes(String(purpose || ''));
    },
    relationOptionsForChoice(choice) {
      const list = this.visibleRelations.slice();
      const retinueMembers = ensureArray((((this.snapshot.gameState || {}).retinue || {}).members));
      const retinueMemberIds = new Set(retinueMembers.map(item => item && item.relationId).filter(Boolean));
      const retinueList = list.filter(relation => relation && retinueMemberIds.has(relation.id));
      if (choice && choice.relationScope === 'historical') {
        return ensureArray(this.snapshot.gameState.relationships).filter((relation) => {
          if (!relation || relation.isHistorical !== true) return false;
          if (!['rumor', 'met'].includes(this.relationVisibilityOf(relation))) return false;
          const presence = relation.historicalPresence && typeof relation.historicalPresence === 'object'
            ? relation.historicalPresence
            : null;
          return !!(presence && presence.active);
        });
      }
      if (choice && choice.relationScope === 'warpath') {
        return list.filter((relation) => {
          if (!relation || relation.isHistorical !== true) return false;
          if (this.relationVisibilityOf(relation) !== 'met') return false;
          const presence = relation.historicalPresence && typeof relation.historicalPresence === 'object'
            ? relation.historicalPresence
            : null;
          if (presence && presence.active !== true) return false;
          const tags = Array.isArray(relation.tags) ? relation.tags : [];
          return tags.some(tag => ['battle', 'military', 'warpath', 'frontier'].includes(tag));
        });
      }
      if (choice && choice.relationScope === 'romance') {
        return list.filter((relation) => {
          if (relation.romanceable === false) return false;
          if (Number(relation.rivalry || 0) >= 45) return false;
          if (!this.historicalRelationActionAllowed(relation, 'romance')) return false;
          const stage = relation.romanceStage || this.deriveRomanceStage(relation);
          const isLover = relation.bondKey === 'lover';
          if (choice.actionMode === 'promise') {
            return ['近身', '暧昧', '定情'].includes(stage) || isLover;
          }
          if (choice.actionMode === 'bond' || choice.actionMode === 'companion') {
            return ['暧昧', '定情'].includes(stage) || isLover;
          }
          if (choice.actionMode === 'daily') {
            return ['近身', '暧昧', '定情'].includes(stage) || isLover;
          }
          if (choice.actionMode === 'jealousy') {
            return stage === '定情' || isLover;
          }
          const favor = relation.favorScore !== undefined ? relation.favorScore : this.deriveFavorScore(relation);
          return favor >= 26 || Number(relation.trust || 0) >= 10 || Number(relation.affection || 0) >= 6 || stage !== '未启';
        });
      }
      if (choice && choice.relationScope === 'martial') {
        return list.filter((relation) => {
          const rating = Number(relation.martialRating || 0);
          const tags = Array.isArray(relation.tags) ? relation.tags : [];
          if (!(rating > 0 || tags.some(tag => ['martial', 'battle', 'warpath', 'frontier', 'military'].includes(tag)))) return false;
          if (choice.actionKind === 'spar' && !this.historicalRelationActionAllowed(relation, 'spar')) return false;
          return true;
        });
      }
      if (choice && choice.relationScope === 'strategy') {
        return list.filter((relation) => {
          const rating = Number(relation.strategyRating || 0);
          const tags = Array.isArray(relation.tags) ? relation.tags : [];
          return rating > 0 || tags.some(tag => ['strategy', 'govern', 'trade', 'diplomacy', 'investigate', 'intrigue'].includes(tag));
        });
      }
      if (choice && choice.relationScope === 'retinue') {
        return retinueList;
      }
      if (choice && choice.relationScope === 'retinue_strategy') {
        const strategic = retinueList.filter((relation) => {
          const rating = Number(relation.strategyRating || 0);
          const tags = Array.isArray(relation.tags) ? relation.tags : [];
          return rating > 0 || tags.some(tag => ['strategy', 'govern', 'trade', 'diplomacy', 'investigate', 'intrigue'].includes(tag));
        });
        return strategic.length ? strategic : retinueList;
      }
      return list;
    },
    relationOptionLabel(relation) {
      if (!relation) return '未定';
      const favor = relation.favorScore !== undefined ? relation.favorScore : this.deriveFavorScore(relation);
      const stage = relation.romanceStage || this.deriveRomanceStage(relation);
      const martial = Number(relation.martialRating || 0) > 0 ? ` · 武${relation.martialRating}` : '';
      const strategy = Number(relation.strategyRating || 0) > 0 ? ` · 智${relation.strategyRating}` : '';
      const visibility = this.relationVisibilityOf(relation);
      const visibilityLabel = visibility === 'rumor' ? ' · 风闻' : '';
      const historicalStage = relation.isHistorical ? ` · ${this.historicalRelationStageLabel(relation)}` : '';
      return `${relation.name}${visibilityLabel}${historicalStage} · 好感${favor}${stage && stage !== '未启' ? ` · ${stage}` : ''}${martial}${strategy}`;
    },
    setRelationChoiceTarget(choice, value) {
      const key = this.relationChoiceKey(choice);
      if (!key) return;
      this.relationChoiceTargets[key] = value || '';
    },
    selectedRelationForChoice(choice) {
      const key = this.relationChoiceKey(choice);
      const id = key ? this.relationChoiceTargets[key] : '';
      const options = this.relationOptionsForChoice(choice);
      if (!id) return options.length === 1 ? options[0] : null;
      return options.find(item => item.id === id) || null;
    },
    relationChoiceHint(choice) {
      const relation = this.selectedRelationForChoice(choice);
      if (!relation) return choice && choice.hint ? `${choice.hint} 可从关系簿指定人物。` : '可从关系簿指定人物推进这一手。';
      const favor = relation.favorScore !== undefined ? relation.favorScore : this.deriveFavorScore(relation);
      const stage = relation.romanceStage || this.deriveRomanceStage(relation);
      const martial = Number(relation.martialRating || 0) > 0 ? ` · 武${relation.martialRating}` : '';
      const strategy = Number(relation.strategyRating || 0) > 0 ? ` · 智${relation.strategyRating}` : '';
      return `${choice.hint || '这一手已经摆上台面。'} 当前指定：${relation.name} · 好感${favor}${stage && stage !== '未启' ? ` · ${stage}` : ''}${martial}${strategy}`;
    },
    formatChoiceRequirement(requirement) {
      if (!requirement) return '';
      if (requirement.type === 'stat') {
        const current = Number(requirement.current || 0);
        const minimum = Number(requirement.minimum || 0);
        const mark = current >= minimum ? '✓' : '还差';
        return `${requirement.label}${current}/${minimum} ${mark}`;
      }
      return requirement.label || '';
    },
    choiceRequirementsText(choice) {
      const list = choice && Array.isArray(choice.requirements) ? choice.requirements : [];
      const parts = list.map(item => this.formatChoiceRequirement(item)).filter(Boolean);
      if (!parts.length) return '';
      return `条件：${parts.join(' · ')}`;
    },
    choiceForecastText(choice) {
      if (!choice) return '';
      const effectHints = Array.isArray(choice.effectHints) ? choice.effectHints.filter(Boolean) : [];
      const costHints = Array.isArray(choice.costHints) ? choice.costHints.filter(Boolean) : [];
      const parts = effectHints.concat(costHints).slice(0, 3);
      if (!parts.length) return '';
      return `预计：${parts.join(' · ')}`;
    },
    normalizeStoryComparisonText(text) {
      return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    },
    stabilizeRenderedStoryText(finalText, streamedText) {
      const finalStory = String(finalText || '');
      const streamedStory = String(streamedText || '');
      if (!streamedStory.trim()) return finalStory;
      if (!finalStory.trim()) return streamedStory;
      const normalizedFinal = this.normalizeStoryComparisonText(finalStory);
      const normalizedStreamed = this.normalizeStoryComparisonText(streamedStory);
      if (!normalizedFinal) return streamedStory;
      if (normalizedFinal === normalizedStreamed) return streamedStory;
      if (normalizedFinal.replace(/[，。！？；：、\s]/g, '') === normalizedStreamed.replace(/[，。！？；：、\s]/g, '')) {
        return streamedStory;
      }
      return finalStory;
    },
    markNarrationSettled(statusText = '正文已写定，正在整理后续可选行动。') {
      this.narrationDoneReceived = true;
      this.placeholderStreaming = false;
      if (statusText) this.systemStatus = statusText;
    },
    settleNarrationFromChoiceSignal(statusText = '正文已写定，正在整理后续可选行动。') {
      if (!String(this.streamingText || '').trim()) return false;
      this.markNarrationSettled(statusText);
      return true;
    },
    normalizeStatusMessage(message) {
      const text = String(message || '').trim();
      if (!text) return '';
      if (/正文已写定|正文已落下|正在整理后续可选行动|整理后续落子/.test(text)) {
        return '正文已写定，正在整理后续可选行动。';
      }
      if (/正在落下这一手的正文|正文稍后落下/.test(text)) {
        return '正文正在落下，请先看剧情区。';
      }
      if (/局势|正文已落下|会话不存在|行动不能为空|模型配置|续写失败/.test(text)) {
        return '';
      }
      return text;
    },
    relationVisibilityOf(relation) {
      if (!relation) return 'hidden';
      const state = String(relation.visibilityState || '').trim().toLowerCase();
      if (state) return state;
      if (relation.discovered === true) return 'met';
      if (relation.discovered === false) return 'hidden';
      return 'met';
    },
    relationVisibilityLabel(relation) {
      return {
        met: '已结识',
        scene: '已露面',
        rumor: '风闻已起',
        hidden: '未入接触面'
      }[this.relationVisibilityOf(relation)] || '未定';
    },
    historicalRelationStageLabel(relation) {
      if (!relation || relation.isHistorical !== true) return '未定';
      const stage = Number(relation.retinueRecruitStage || 0);
      if (stage >= 3) return '可延揽';
      if (stage >= 2) return '已接上线';
      if (this.relationVisibilityOf(relation) === 'met') return '已结识';
      return '风闻';
    },
    historicalLeadRecommendation(relation) {
      const cityName = this.snapshot.world.currentCityName || '此地';
      const presence = relation && relation.historicalPresence && typeof relation.historicalPresence === 'object'
        ? relation.historicalPresence
        : null;
      const territory = ((this.snapshot.world || {}).territory) || {};
      const authority = territory.currentAuthorityLabel || '无根基';
      const authorityReady = ['steward', 'control'].includes(String(territory.currentAuthority || ''));
      const stage = this.historicalRelationStageLabel(relation);
      if (presence && presence.active) {
        if (stage === '可延揽' && authorityReady) {
          return `此刻人在${cityName}，而且你在当地已有“${authority}”级别权柄，可以从招募线继续往正式延揽推进。`;
        }
        return `此刻可在${cityName}顺线推进。先用“史实人物线索”把这条人脉做深；若还没拿到本城治权，目前也只能停在结识与来往。`;
      }
      return '这条风闻已经记进关系簿，但眼下不在当前城池的直接接触面里。换到对应城市，再顺线去接。';
    },
    formatMonthCardExpiry(value) {
      const date = value ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
    formatAccessSummary(access) {
      if (!access) return '未登录';
      const parts = [];
      if (access.isGuest) {
        if (Number(access.trialRemainingTurns || 0) > 0) {
          return `匿名试玩剩余 ${Number(access.trialRemainingTurns || 0)} 回`;
        }
        return '匿名试玩已用完';
      }
      if (access.monthCardActive) {
        parts.push(`月卡至 ${this.formatMonthCardExpiry(access.monthCardExpiresAt)}`);
      }
      if (Number(access.turnCredits || 0) > 0) {
        parts.push(`付费 ${Number(access.turnCredits || 0)} 回`);
      }
      if (Number(access.trialRemainingTurns || 0) > 0) {
        parts.push(`试玩 ${Number(access.trialRemainingTurns || 0)} 回`);
      }
      if (!parts.length) {
        return '试玩已用完';
      }
      return parts.join(' · ');
    },
    openOverlay(panel) {
      this.emitInteractionPulse('soft');
      this.activeOverlay = panel;
    },
    closeOverlay() { this.activeOverlay = ''; },
    async bootstrap() {
      this.pushDebugBeacon('page:bootstrap:start');
      await this.bootstrapAuth();
      this.pushDebugBeacon('page:bootstrap:after-auth');
      await this.bootstrapGameSession();
      this.pushDebugBeacon('page:bootstrap:after-session');
    },
    async bootstrapAuth() {
      this.authReady = false;
      this.pushDebugBeacon('auth:bootstrap:start');
      if (!getStoredAuthToken()) {
        this.authReady = true;
        this.pushDebugBeacon('auth:bootstrap:no-token');
        return;
      }
      try {
        const payload = await authApi.getMe();
        await this.consumeAuthPayload(payload);
      } catch (error) {
        setStoredAuthToken('');
        this.currentUser = null;
        this.pushDebugBeacon('auth:bootstrap:failed', {
          auth_error: error && error.message ? error.message : String(error || 'unknown')
        });
      } finally {
        this.authReady = true;
        this.pushDebugBeacon('auth:bootstrap:done');
      }
    },
    async consumeAuthPayload(payload) {
      if (payload && payload.token) {
        setStoredAuthToken(payload.token);
      }
      if (payload && payload.user) {
        this.currentUser = payload.user;
      }
      if (payload && payload.adminSeed) {
        this.adminSeed = payload.adminSeed;
      }
      this.pushDebugBeacon('auth:payload-consumed', {
        auth_user: payload && payload.user ? (payload.user.username || payload.user.id || 'user') : 'none'
      });
    },
    clearLocalSession() {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      this.sessionId = '';
      this.storyArchive = [];
      this.storyStageCleared = false;
      this.activeChoiceDirection = '';
      this.fixedDirectionExpanded = false;
      this.snapshot = createEmptySnapshot();
    },
    activateSession(snapshot) {
      if (!snapshot || !snapshot.sessionId) return false;
      this.sessionId = snapshot.sessionId;
      localStorage.setItem(SESSION_STORAGE_KEY, snapshot.sessionId);
      this.storyArchive = [];
      this.storyStageCleared = false;
      this.applySnapshot(snapshot);
      this.pushDebugBeacon('session:activated', {
        activated_session: snapshot.sessionId,
        activated_owner: snapshot.ownerUserId || ''
      });
      return true;
    },
    isOwnedByCurrentUser(snapshot) {
      return !!(
        this.currentUser
        && snapshot
        && snapshot.ownerUserId
        && snapshot.ownerUserId === this.currentUser.id
      );
    },
    pickNewerSnapshot(primary, fallback) {
      if (!primary || !primary.sessionId) return fallback || null;
      if (!fallback || !fallback.sessionId) return primary;

      const primaryTime = Date.parse(primary.saveTime || '');
      const fallbackTime = Date.parse(fallback.saveTime || '');
      if (Number.isFinite(primaryTime) && Number.isFinite(fallbackTime)) {
        return primaryTime >= fallbackTime ? primary : fallback;
      }
      return primary;
    },
    async bootstrapGameSession() {
      this.pushDebugBeacon('session:bootstrap:start');
      const storedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
      let localSnapshot = null;

      if (storedSessionId) {
        try {
          const snapshot = await sessionApi.getSession(storedSessionId);
          this.pushDebugBeacon('session:stored-fetched', {
            stored_session: storedSessionId,
            stored_owner: snapshot && snapshot.ownerUserId ? snapshot.ownerUserId : ''
          });
          if (this.currentUser && !snapshot.ownerUserId) {
            const claimedSnapshot = await sessionApi.claimSession(storedSessionId);
            this.activateSession(claimedSnapshot);
            this.pushDebugBeacon('session:stored-claimed', {
              claimed_session: storedSessionId
            });
            return;
          }
          if (!this.currentUser || this.isOwnedByCurrentUser(snapshot)) {
            localSnapshot = snapshot;
          } else {
            localStorage.removeItem(SESSION_STORAGE_KEY);
          }
        } catch (error) {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          this.pushDebugBeacon('session:stored-failed', {
            stored_session_error: error && error.message ? error.message : String(error || 'unknown')
          });
        }
      }

      if (this.currentUser) {
        try {
          const accountSnapshot = await sessionApi.getCurrentSession();
          this.pushDebugBeacon('session:account-fetched', {
            account_session: accountSnapshot && accountSnapshot.sessionId ? accountSnapshot.sessionId : '(none)'
          });
          const preferredSnapshot = this.pickNewerSnapshot(accountSnapshot, localSnapshot);
          if (this.activateSession(preferredSnapshot)) {
            return;
          }
        } catch (error) {
          this.pushDebugBeacon('session:account-failed', {
            account_session_error: error && error.message ? error.message : String(error || 'unknown')
          });
          // Fall back to local snapshot or a fresh server-side session.
        }
      }

      if (this.activateSession(localSnapshot)) {
        return;
      }

      await this.createFreshSession();
      this.pushDebugBeacon('session:fresh-created');
    },
    async submitAuth() {
      if (this.authLoading) return;
      this.authLoading = true;
      try {
        const payload = this.authMode === 'login'
          ? await authApi.login({
            username: this.authForm.username,
            password: this.authForm.password
          })
          : await authApi.register({
            username: this.authForm.username,
            password: this.authForm.password,
            displayName: this.authForm.displayName
          });
        await this.consumeAuthPayload(payload);
        this.authReady = true;
        this.authForm.password = '';
        this.authDialogVisible = false;
        if (this.sessionId) {
          const snapshot = await sessionApi.claimSession(this.sessionId);
          this.activateSession(snapshot);
        } else if (this.currentUser) {
          const snapshot = await sessionApi.getCurrentSession();
          if (this.activateSession(snapshot)) {
            this.$message.success(this.authMode === 'login' ? '已登录。' : '注册完成，已进入试玩。');
            return;
          }
          await this.createFreshSession();
        } else {
          await this.createFreshSession();
        }
        this.$message.success(this.authMode === 'login' ? '已登录。' : '注册完成，已进入试玩。');
      } catch (error) {
        this.$message.error(error.message || '账号操作失败。');
      } finally {
        this.authLoading = false;
      }
    },
    async logout() {
      try {
        await authApi.logout();
      } catch (error) {
        // Ignore logout failures and clear local state anyway.
      }
      setStoredAuthToken('');
      this.currentUser = null;
      this.activePurchaseSku = '';
      this.clearLocalSession();
      this.authReady = true;
      await this.bootstrapGameSession();
    },
    async refreshCurrentUser() {
      if (!getStoredAuthToken()) return;
      try {
        const payload = await authApi.getMe();
        await this.consumeAuthPayload(payload);
      } catch (error) {
        setStoredAuthToken('');
        this.currentUser = null;
        this.activePurchaseSku = '';
        this.clearLocalSession();
      }
    },
    togglePurchaseSku(sku) {
      if (this.purchaseLoading) return;
      this.activePurchaseSku = this.activePurchaseSku === sku ? '' : sku;
    },
    setActiveDonationChannel(channel) {
      if (!channel || channel === this.activeDonationChannel) return;
      this.activeDonationChannel = channel;
    },
    openDonationGuide() {
      this.donationGuideVisible = true;
    },
    handleDonationQrError(channel) {
      const key = channel || this.activeDonationChannel || 'wechat';
        this.donationQrLoadFailed[key] = true;
    },
    async purchaseTurnPack(channel, turns) {
      if (!this.currentUser || this.purchaseLoading) return;
      this.purchaseLoading = true;
      try {
        const payload = await authApi.mockPurchase({
          channel,
          productType: 'turn_pack',
          turns
        });
        this.currentUser = payload.user;
        await this.refreshCurrentUser();
        this.activePurchaseSku = '';
        this.$message.success(`${channel === 'wechat' ? '微信' : '支付宝'}模拟支付成功，已到账 ${turns} 回合。`);
      } catch (error) {
        this.$message.error(error.message || '购买失败。');
      } finally {
        this.purchaseLoading = false;
      }
    },
    async purchaseMonthCard(channel, days) {
      if (!this.currentUser || this.purchaseLoading) return;
      this.purchaseLoading = true;
      try {
        const payload = await authApi.mockPurchase({
          channel,
          productType: 'month_card',
          days
        });
        this.currentUser = payload.user;
        await this.refreshCurrentUser();
        this.activePurchaseSku = '';
        this.$message.success(`${channel === 'wechat' ? '微信' : '支付宝'}模拟支付成功，月卡已开通 ${days} 天。`);
      } catch (error) {
        this.$message.error(error.message || '购买失败。');
      } finally {
        this.purchaseLoading = false;
      }
    },
    normalizePlayerNameInput(value) {
      return String(value || '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/[^\u4e00-\u9fffA-Za-z0-9·]/g, '');
    },
    validatePlayerNameInput(value, options = {}) {
      const allowEmpty = options && options.allowEmpty === true;
      const normalized = this.normalizePlayerNameInput(value);
      if (!normalized) return allowEmpty ? true : '请输入 2 到 12 字姓名';
      if (normalized.length < 2 || normalized.length > 12) return '请输入 2 到 12 字姓名';
      return true;
    },
    async promptPlayerName(options = {}) {
      const mode = options && options.mode ? options.mode : 'create';
      const allowEmpty = mode === 'create';
      this.namePromptMode = mode;
      this.namePromptAllowEmpty = allowEmpty;
      this.namePromptInput = options && options.initialValue ? options.initialValue : '';
      this.namePromptError = '';
      this.namePromptVisible = true;
      return new Promise((resolve) => {
        this.namePromptResolver = resolve;
      });
    },
    resolveNamePrompt(value) {
      const resolver = this.namePromptResolver;
      this.namePromptVisible = false;
      this.namePromptError = '';
      this.namePromptResolver = null;
      if (resolver) resolver(value);
    },
    confirmNamePrompt() {
      const validation = this.validatePlayerNameInput(this.namePromptInput, { allowEmpty: this.namePromptAllowEmpty });
      if (validation !== true) {
        this.namePromptError = validation;
        return;
      }
      this.resolveNamePrompt(this.normalizePlayerNameInput(this.namePromptInput));
    },
    cancelNamePrompt() {
      this.resolveNamePrompt(this.namePromptAllowEmpty ? '' : null);
    },
    async createFreshSession(payload = {}) {
      const snapshot = await sessionApi.createSession(payload || {});
      this.activateSession(snapshot);
    },
    async renamePlayerOnce() {
      if (!this.canRenamePlayer || !this.sessionId || this.aiLoading) return;
      const nextName = await this.promptPlayerName({
        mode: 'rename',
        initialValue: this.snapshot.gameState.name || ''
      });
      if (!nextName) return;
      try {
        const snapshot = await sessionApi.renameSession(this.sessionId, { playerName: nextName });
        this.applySnapshot(snapshot);
        this.$message.success('姓名已改，这次机会也已用掉。');
      } catch (error) {
        this.$message.error(error.message || '改名失败。');
      }
    },
    applySnapshot(snapshot) {
      const previousPhase = this.snapshot && this.snapshot.world ? String(this.snapshot.world.phase || '') : '';
      const previousGameState = this.snapshot && this.snapshot.gameState ? JSON.parse(JSON.stringify(this.snapshot.gameState)) : null;
      const preservedStoryText = this.aiLoading
        ? this.stabilizeRenderedStoryText(snapshot && snapshot.scene && snapshot.scene.text, this.streamingText)
        : '';
      this.battleUiReleased = false;
      this.snapshot = normalizeSnapshotShape(snapshot, preservedStoryText);
      this.clearAllChoiceDraftTimers();
      this.streamingText = this.snapshot.scene.text || '';
      this.storyStageCleared = false;
      this.systemStatus = '';
      this.placeholderStreaming = false;
      this.narrationDoneReceived = true;
      this.streamDoneReceived = true;
      this.pendingPhaseOverride = '';
      this.liveChoices = this.sortLiveChoices(this.sanitizeChoicesForPhase((this.snapshot.choices || []).slice(), this.snapshot.world.phase));
      this.liveChoiceDrafts = [];
      this.storyDragging = false;
      this.fixedDirectionExpanded = false;
      this.activeMobileFixedSection = '';
      this.activeMobileDynamicSlot = 0;
      Object.keys(this.relationChoiceTargets || {}).forEach((key) => {
        const selectedId = this.relationChoiceTargets[key];
        const exists = (this.snapshot.gameState.relationships || []).some(item => item.id === selectedId);
        if (!exists) this.relationChoiceTargets[key] = '';
      });
      this.syncActiveChoiceDirection(true);
      this.syncActiveMobileFixedSection(true);
      this.syncActiveMobileDynamicSlot(true);
      this.previousGameStateForDelta = previousGameState;
      this.pushDebugBeacon('snapshot:applied', {
        snapshot_phase: this.snapshot.world.phase || '',
        snapshot_turn: this.snapshot.world.turn || 0,
        snapshot_title: this.snapshot.scene.title || '',
        choices_count: Array.isArray(this.snapshot.choices) ? this.snapshot.choices.length : 0
      });
      if (this.isMobileLayout) {
        const nextPhase = String(this.snapshot.world.phase || '');
        const transitionedIntoPlaying = previousPhase && previousPhase !== 'playing' && nextPhase === 'playing';
        this.activeMobileView = this.inBattle || nextPhase !== 'playing' || transitionedIntoPlaying ? 'action' : 'story';
        this.mobileAuthGuideExpanded = false;
        if (nextPhase === 'choose_background' || nextPhase === 'choose_origin') {
          this.$nextTick(() => this.focusOperationZone(true));
        }
      }
      this.stopLoadingTicker();
      this.refreshTypewriterStory(true);
      this.$nextTick(() => this.inspectDomVisibility());
    },
    applyLiveChoices(choices) {
      const phase = this.resolveChoicePhase(choices);
      this.liveChoices = this.sortLiveChoices(this.sanitizeChoicesForPhase(choices, phase));
      this.syncActiveChoiceDirection();
      this.syncActiveMobileFixedSection(true);
      this.syncActiveMobileDynamicSlot(true);
    },
    clearChoiceDraftTimer(slot) {
      const key = String(slot);
      if (!this.choiceDraftTimers[key]) return;
      clearInterval(this.choiceDraftTimers[key]);
      delete this.choiceDraftTimers[key];
    },
    clearAllChoiceDraftTimers() {
      Object.keys(this.choiceDraftTimers || {}).forEach((key) => this.clearChoiceDraftTimer(key));
    },
    compactProviderBase(url) {
      const raw = String(url || '').trim();
      if (!raw) return '';
      return raw.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    },
    sortLiveChoiceDrafts(list) {
      return (list || []).slice().sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0));
    },
    scheduleChoiceDraftTyping(slot) {
      const key = String(slot);
      this.clearChoiceDraftTimer(key);

      const tick = () => {
        const next = this.sortLiveChoiceDrafts((this.liveChoiceDrafts || []).slice());
        const index = next.findIndex(item => item && String(item.slot) === key);
        if (index < 0) {
          this.clearChoiceDraftTimer(key);
          return;
        }

        const current = Object.assign({}, next[index]);
        const targetText = String(current.targetText || current.text || DRAFT_PLACEHOLDER_TITLE);
        const targetHint = String(current.targetHint || current.hint || DRAFT_PLACEHOLDER_HINT);
        let changed = false;

        if (String(current.text || '').length < targetText.length) {
          current.text = targetText.slice(0, String(current.text || '').length + 1);
          changed = true;
        } else if (String(current.hint || '').length < targetHint.length) {
          current.hint = targetHint.slice(0, String(current.hint || '').length + 1);
          changed = true;
        }

        const stillTyping = String(current.text || '').length < targetText.length || String(current.hint || '').length < targetHint.length;
        if (current.isTyping !== stillTyping) {
          current.isTyping = stillTyping;
          changed = true;
        }

        if (changed) {
          next.splice(index, 1, current);
          this.liveChoiceDrafts = next;
        }

        if (!stillTyping) this.clearChoiceDraftTimer(key);
      };

      tick();
      const target = (this.liveChoiceDrafts || []).find(item => item && String(item.slot) === key);
      if (target && target.isTyping) {
        this.choiceDraftTimers[key] = setInterval(tick, DRAFT_TYPING_INTERVAL);
      }
    },
    applyChoiceDraft(draft) {
      if (!draft || draft.slot === undefined || draft.slot === null) return;
      if (this.resolveChoicePhase(this.liveChoices) !== 'playing') return;
      const next = this.sortLiveChoiceDrafts((this.liveChoiceDrafts || []).slice());
      const slot = Number(draft.slot || 0);
      const existing = next.find(item => item && Number(item.slot || 0) === slot) || null;
      const targetText = String(draft.text || (existing && existing.targetText) || DRAFT_PLACEHOLDER_TITLE);
      const targetHint = String(draft.hint || (existing && existing.targetHint) || DRAFT_PLACEHOLDER_HINT);
      const normalized = Object.assign({
        slot,
        source: 'dynamic',
        isDraft: true,
        text: existing ? String(existing.text || '') : '',
        hint: existing ? String(existing.hint || '') : '',
        targetText,
        targetHint,
        isTyping: true
      }, existing || {}, draft, {
        slot,
        source: 'dynamic',
        isDraft: true,
        targetText,
        targetHint
      });

      if (!targetText.startsWith(normalized.text || '')) normalized.text = '';
      if (!targetHint.startsWith(normalized.hint || '')) normalized.hint = '';

      const index = next.findIndex(item => item && Number(item.slot || 0) === normalized.slot);
      if (index >= 0) next.splice(index, 1, normalized);
      else next.push(normalized);
      this.liveChoiceDrafts = this.sortLiveChoiceDrafts(next);
      this.syncActiveMobileDynamicSlot();
      this.scheduleChoiceDraftTyping(slot);
    },
    appendLiveChoice(choice) {
      if (!choice || !choice.id || !choice.text) return;
      if (choice.source === 'dynamic' && this.resolveChoicePhase(this.liveChoices) !== 'playing') return;
      if (choice.order !== undefined && choice.order !== null) {
        this.clearChoiceDraftTimer(choice.order);
        this.liveChoiceDrafts = (this.liveChoiceDrafts || []).filter(item => item && Number(item.slot || 0) !== Number(choice.order || 0));
      }
      const next = (this.liveChoices || []).slice().filter(item => item && item.id && item.text);
      const index = next.findIndex(item => item.id === choice.id || item.text === choice.text);
      if (index >= 0) next.splice(index, 1, choice);
      else next.push(choice);
      this.liveChoices = this.sortLiveChoices(next);
      this.syncActiveChoiceDirection();
      this.syncActiveMobileFixedSection();
      this.syncActiveMobileDynamicSlot();
    },
    startLoadingTicker() {
      this.stopLoadingTicker();
      this.loadingStartedAt = Date.now();
      this.loadingTimer = setInterval(() => {
        if (!this.aiLoading) return;
        const elapsed = Date.now() - this.loadingStartedAt;
        const index = Math.min(LOADING_COPY.length - 1, Math.floor(elapsed / 4000));
        if (!this.systemStatus || this.systemStatus.indexOf('正文') === -1) this.systemStatus = LOADING_COPY[index];
      }, 2000);
    },
    stopLoadingTicker() {
      if (this.loadingTimer) {
        clearInterval(this.loadingTimer);
        this.loadingTimer = null;
      }
    },
    archiveCurrentStory() {
      const text = String((this.snapshot.scene && this.snapshot.scene.text) || '').trim();
      if (!text) return;
      const entry = {
        key: `${this.snapshot.world.turn || 0}-${Date.now()}`,
        title: (this.snapshot.scene && this.snapshot.scene.title) || '上一回',
        statusLine: (this.snapshot.scene && this.snapshot.scene.statusLine) || '',
        dateLabel: (this.snapshot.world && this.snapshot.world.dateLabel) || '',
        text
      };
      const previous = this.storyArchive[0];
      if (previous && previous.title === entry.title && previous.text === entry.text) return;
      this.storyArchive = [entry].concat(this.storyArchive).slice(0, 6);
    },
    resetStoryViewport() {
      this.$nextTick(() => {
        const container = this.$refs.storyScroll;
        if (container) {
          container.scrollTop = 0;
          this.lastStoryScrollTop = 0;
          this.storyAutoFollow = true;
        }
      });
    },
    focusStoryZone(force = false) {
      this.ensureMobileView('story');
      this.$nextTick(() => {
        const section = this.$refs.storyScroll || this.$refs.storyZone;
        if (!section || typeof window === 'undefined') return;
        const rect = section.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const topPadding = Math.max(18, Math.round(viewportHeight * 0.08));
        if (!force && rect.top >= topPadding && rect.top <= Math.max(topPadding + 64, viewportHeight * 0.24)) return;
        const targetTop = Math.max(0, window.scrollY + rect.top - topPadding);
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      });
    },
    focusOperationZone(force = false) {
      this.ensureMobileView('action');
      this.$nextTick(() => {
        const align = (behavior = 'smooth') => {
          const anchor = this.isMobileLayout
            ? this.$refs.operationZone
            : (this.$refs.operationSuggestionAnchor || this.$refs.operationZone);
          if (!anchor || typeof window === 'undefined') return;
          if (this.isMobileLayout && anchor.scrollTop) {
            anchor.scrollTop = 0;
          }
          const rect = anchor.getBoundingClientRect();
          const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
          const topPadding = this.isMobileLayout ? Math.max(6, Number(window.visualViewport && window.visualViewport.offsetTop || 0) + 6) : 18;
          if (!force && rect.top >= topPadding && rect.top <= Math.max(topPadding + 32, viewportHeight * 0.16)) return;
          const targetTop = Math.max(0, window.scrollY + rect.top - topPadding);
          window.scrollTo({ top: targetTop, behavior });
          const actionDeck = this.$refs.actionDeck && this.$refs.actionDeck.$el ? this.$refs.actionDeck.$el : null;
          if (actionDeck) {
            actionDeck.querySelectorAll('.mobile-choice-tabs, .mobile-fixed-board__directions').forEach((node) => {
              node.scrollLeft = 0;
            });
          }
        };
        align('auto');
        if (this.isMobileLayout && typeof window !== 'undefined') {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => align('auto')));
          window.setTimeout(() => align('auto'), 90);
          window.setTimeout(() => align('auto'), 180);
          window.setTimeout(() => align('auto'), 340);
          window.setTimeout(() => align('auto'), 460);
        }
      });
    },
    focusDirectionExpandedPanel(force = false) {
      this.$nextTick(() => {
        const refNode = this.$refs.actionDeck || this.$refs.directionExpandedPanel;
        const section = refNode && typeof refNode.getDirectionExpandedElement === 'function'
          ? refNode.getDirectionExpandedElement()
          : refNode;
        if (!section || typeof window === 'undefined') return;
        const rect = section.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const topPadding = this.isMobileLayout ? 126 : 22;
        if (!force && rect.top >= topPadding && rect.top <= Math.max(topPadding + 64, viewportHeight * 0.32)) return;
        const targetTop = Math.max(0, window.scrollY + rect.top - topPadding);
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      });
    },
    focusIntelZone(force = false) {
      this.ensureMobileView('intel');
      this.$nextTick(() => {
        const section = this.$refs.intelZone;
        if (!section || typeof window === 'undefined') return;
        const rect = section.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const topPadding = 18;
        if (!force && rect.top >= topPadding && rect.bottom <= viewportHeight - 18) return;
        const targetTop = Math.max(0, window.scrollY + rect.top - topPadding);
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      });
    },
    focusBattleRoundZone(force = false) {
      this.ensureMobileView('action');
      this.$nextTick(() => {
        const section = this.$refs.battleRoundZone || this.$refs.operationZone;
        if (!section || typeof window === 'undefined') return;
        const rect = section.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const topPadding = Math.max(18, Math.round(viewportHeight * 0.08));
        if (!force && rect.top >= topPadding && rect.bottom <= viewportHeight - 24) return;
        const targetTop = Math.max(0, window.scrollY + rect.top - topPadding);
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      });
    },
    releaseBattleUiToStory() {
      if (this.battleUiReleased) return;
      this.battleUiReleased = true;
      this.resetStoryViewport();
      this.focusStoryZone(true);
    },
    fallbackBattleCommandChoices() {
      const battle = this.activeBattle;
      if (!battle) return [];
      if (battle.mode === 'duel') {
        return [
          { id: 'battlecmd:strike', text: '抢攻进手', hint: '主动压近，逼对手先交破绽。', category: '攻势', actionKind: 'jianghu', source: 'fixed' },
          { id: 'battlecmd:guard', text: '沉气守势', hint: '先守中线，降低对手这一手的伤害。', category: '守势', actionKind: 'jianghu', source: 'fixed' },
          { id: 'battlecmd:channel', text: '提气运功', hint: '回一口真气，为下一手绝招做准备。', category: '运功', actionKind: 'jianghu', source: 'fixed' },
          { id: 'battlecmd:footwork', text: '身法游走', hint: '拉扯步点，适合破解对手重手与绝招。', category: '身法', actionKind: 'jianghu', source: 'fixed' },
          { id: 'battlecmd:finisher', text: '绝招爆发', hint: '消耗真气一锤定音，若被看穿也会露空门。', category: '绝招', actionKind: 'jianghu', source: 'fixed' }
        ];
      }
      return [
        { id: 'battlecmd:spearhead', text: '锋矢突进', hint: '压强攻势，适合抢先手，但若被守稳会吃反震。', category: '阵型', actionKind: 'battle', source: 'fixed' },
        { id: 'battlecmd:fortify', text: '方圆固守', hint: '先稳阵脚，削弱敌方正面冲击，适合顶住一波。', category: '阵型', actionKind: 'battle', source: 'fixed' },
        { id: 'battlecmd:harry', text: '雁行游击', hint: '绕侧牵制，克制死守，但对正面硬冲较吃亏。', category: '阵型', actionKind: 'battle', source: 'fixed' },
        { id: 'battlecmd:fire', text: '火计奇袭', hint: '看谋略与时机，打中后能直接撕开阵势。', category: '计策', actionKind: 'battle', source: 'fixed' },
        { id: 'battlecmd:rally', text: '整军鼓舞', hint: '回稳士气与军心，适合被压制时缓一口气。', category: '军令', actionKind: 'battle', source: 'fixed' },
        { id: 'battlecmd:champion', text: '主将陷阵', hint: '以个人武勇强行破局，风险高，但上限最高。', category: '主将', actionKind: 'battle', source: 'fixed' }
      ];
    },
    prepareStoryStageForTurn() {
      this.archiveCurrentStory();
      this.storyStageCleared = true;
      this.storyAutoFollow = true;
      this.resetStoryViewport();
    },
    beginStoryDrag(event) {
      const container = this.$refs.storyScroll;
      if (!container || container.scrollHeight <= container.clientHeight) return;
      this.storyDragging = true;
      this.storyDragStartY = event.clientY;
      this.storyDragStartScrollTop = container.scrollTop;
    },
    onStoryDrag(event) {
      if (!this.storyDragging) return;
      const container = this.$refs.storyScroll;
      if (!container) return;
      container.scrollTop = this.storyDragStartScrollTop - (event.clientY - this.storyDragStartY);
    },
    beginStoryTouchDrag(event) {
      const container = this.$refs.storyScroll;
      const touch = event.touches && event.touches[0];
      if (!container || !touch || container.scrollHeight <= container.clientHeight) return;
      this.storyDragging = true;
      this.storyDragStartY = touch.clientY;
      this.storyDragStartScrollTop = container.scrollTop;
    },
    onStoryTouchDrag(event) {
      if (!this.storyDragging) return;
      const container = this.$refs.storyScroll;
      const touch = event.touches && event.touches[0];
      if (!container || !touch) return;
      container.scrollTop = this.storyDragStartScrollTop - (touch.clientY - this.storyDragStartY);
    },
    endStoryDrag() { this.storyDragging = false; },
    clampRetinuePanelHeight(value) {
      return Math.max(220, Math.min(560, Math.round(Number(value) || 304)));
    },
    extractPointerY(event) {
      const touch = event && event.touches && event.touches[0];
      if (touch) return Number(touch.clientY || 0);
      return Number(event && event.clientY || 0);
    },
    beginRetinueResize(event) {
      const pointerY = this.extractPointerY(event);
      this.retinueResizing = true;
      this.retinueResizeStartY = pointerY;
      this.retinueResizeStartHeight = this.retinuePanelHeight;
      window.addEventListener('mousemove', this.onRetinueResize);
      window.addEventListener('mouseup', this.endRetinueResize);
      window.addEventListener('touchmove', this.onRetinueTouchResize, { passive: false });
      window.addEventListener('touchend', this.endRetinueResize);
      window.addEventListener('touchcancel', this.endRetinueResize);
    },
    onRetinueResize(event) {
      if (!this.retinueResizing) return;
      const delta = this.extractPointerY(event) - this.retinueResizeStartY;
      this.retinuePanelHeight = this.clampRetinuePanelHeight(this.retinueResizeStartHeight + delta);
    },
    onRetinueTouchResize(event) {
      if (!this.retinueResizing) return;
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      this.onRetinueResize(event);
    },
    endRetinueResize() {
      this.retinueResizing = false;
      window.removeEventListener('mousemove', this.onRetinueResize);
      window.removeEventListener('mouseup', this.endRetinueResize);
      window.removeEventListener('touchmove', this.onRetinueTouchResize);
      window.removeEventListener('touchend', this.endRetinueResize);
      window.removeEventListener('touchcancel', this.endRetinueResize);
    },
    async resetGame(options = {}) {
      if (!this.sessionId) return;
      const payload = Object.assign({}, options || {});
      if (!payload.inherit && !Object.prototype.hasOwnProperty.call(payload, 'playerName')) {
        payload.playerName = this.normalizePlayerNameInput(this.snapshot.gameState.name || '') || '';
      }
      const snapshot = await sessionApi.resetSession(this.sessionId, payload);
      this.playerInput = '';
      this.storyArchive = [];
      this.storyStageCleared = false;
      this.clearAllChoiceDraftTimers();
      this.applySnapshot(snapshot);
    },
    async inheritGame() {
      if (!this.sessionId || !this.endingCanInherit) return;
      await this.resetGame({ inherit: true });
    },
    async submitChoice(choice) {
      if (!choice || this.aiLoading || choice.disabled) return;
      let actionText = choice.actionText || choice.id || choice.text;
      if (this.isRelationChoice(choice)) {
        const relation = this.selectedRelationForChoice(choice);
        if (!relation) {
          this.systemStatus = '这一手需要先指定人物。';
          return;
        }
        const kind = this.relationChoiceKind(choice);
        const mode = this.relationChoiceMode(choice);
        actionText = `action:${kind}:${relation.id}:${mode || ''}`;
      }
      if (!actionText) return;
      const payload = { actionText };
      if (choice.source === 'dynamic') {
        payload.choiceMeta = {
          choiceId: choice.id || '',
          text: choice.text || '',
          actionKind: choice.actionKind || '',
          slotRole: choice.slotRole || '',
          source: choice.source || 'dynamic',
          frontierId: choice.frontierId || '',
          noveltyKey: choice.noveltyKey || '',
          target: choice.target || '',
          targetId: choice.targetId || '',
          targetName: choice.targetName || '',
          outcomes: Array.isArray(choice.outcomes) ? choice.outcomes.slice(0, 6) : [],
          effect: choice.effect && typeof choice.effect === 'object' ? choice.effect : null,
          order: choice.order !== undefined && choice.order !== null ? Number(choice.order) : undefined
        };
      }
      if (this.isSetupPhase) {
        await this.runSetupChoice(actionText, payload);
        return;
      }
      await this.runTurn(actionText, payload);
    },
    async submitCustom() {
      const value = (this.playerInput || '').trim();
      if (!value || this.aiLoading) return;
      this.playerInput = '';
      await this.runTurn(value, { actionText: value });
    },
    async travelFromOverlay(cityId) {
      this.closeOverlay();
      const actionText = `travel:${cityId}`;
      await this.runTurn(actionText, { actionText });
    },
    isBattleInteractiveAction(actionText) {
      return /^(action:(spar)|battlecmd:)/.test(String(actionText || '').trim());
    },
    async runTurn(actionText, payload = null) {
      if (!this.sessionId || !actionText || this.aiLoading || this.interactionLocked) return;
      const interactiveBattleAction = this.isBattleInteractiveAction(actionText);
      let battleNarrationStarted = false;
      let storyNarrationFocused = false;
      this.battleUiReleased = false;
      if (!interactiveBattleAction) {
        this.prepareStoryStageForTurn();
        this.focusStoryZone(true);
      }
      else this.focusOperationZone(true);
      this.clearAllChoiceDraftTimers();
      this.collapseFixedDirectionPanel();
      this.aiLoading = true;
      this.pendingBattleAction = interactiveBattleAction;
      this.pendingPhaseOverride = this.predictPhaseFromAction(actionText);
      this.streamingText = '';
      this.liveChoices = [];
      this.liveChoiceDrafts = [];
      this.placeholderStreaming = !interactiveBattleAction;
      this.narrationDoneReceived = false;
      this.streamDoneReceived = false;
      this.systemStatus = interactiveBattleAction
        ? '正在切入战斗操作阶段。'
        : '这一手已送入推演，正在等待正文起笔。';
      this.startLoadingTicker();
      let turnFinished = false;
      try {
        await sessionApi.streamTurn(this.sessionId, payload && typeof payload === 'object'
          ? Object.assign({ actionText }, payload)
          : { actionText }, {
          onStatus: (message) => {
            const nextStatus = this.normalizeStatusMessage(message);
            if (nextStatus) this.systemStatus = nextStatus;
          },
          onDelta: (text) => {
            if (interactiveBattleAction && !battleNarrationStarted) {
              battleNarrationStarted = true;
              this.archiveCurrentStory();
              this.releaseBattleUiToStory();
            }
            if (!interactiveBattleAction && !storyNarrationFocused) {
              storyNarrationFocused = true;
            }
            if (this.placeholderStreaming) {
              this.streamingText = text;
              this.placeholderStreaming = false;
              this.storyStageCleared = false;
            } else {
              this.streamingText += text;
            }
            this.refreshTypewriterStory(true);
            this.followStoryStreamBottom(false);
          },
          onNarrationDone: () => {
            if (interactiveBattleAction) {
              battleNarrationStarted = true;
              this.releaseBattleUiToStory();
            }
            this.markNarrationSettled();
          },
          onChoicesReset: (choices) => {
            if (interactiveBattleAction) {
              battleNarrationStarted = true;
              this.releaseBattleUiToStory();
            }
            this.settleNarrationFromChoiceSignal();
            this.applyLiveChoices(choices);
          },
          onChoiceDraft: (draft) => {
            this.settleNarrationFromChoiceSignal();
            this.applyChoiceDraft(draft);
          },
          onChoice: (choice) => {
            this.settleNarrationFromChoiceSignal();
            this.appendLiveChoice(choice);
          },
          onDone: (snapshot) => {
            this.narrationDoneReceived = true;
            this.streamDoneReceived = true;
            turnFinished = true;
            const battleStillActive = !!(snapshot && snapshot.gameState && snapshot.gameState.activeBattle && snapshot.gameState.activeBattle.active);
            if (interactiveBattleAction && !battleStillActive && !battleNarrationStarted) {
              this.archiveCurrentStory();
            }
            this.applySnapshot(snapshot);
            if (battleStillActive) {
              this.focusBattleRoundZone(true);
            } else if (interactiveBattleAction) {
              this.resetStoryViewport();
              this.focusStoryZone(true);
            }
          }
        });
        if (turnFinished && this.currentUser) {
          await this.refreshCurrentUser();
        }
      } catch (error) {
        if (error && (error.status === 401 || error.status === 403)) {
          await this.refreshCurrentUser();
        }
        this.$message.error(error.message || '这一回没能顺利写完。');
      } finally {
        this.aiLoading = false;
        this.pendingBattleAction = false;
        this.stopLoadingTicker();
      }
    },
    async runSetupChoice(actionText, payload = null) {
      if (!this.sessionId || !actionText || this.aiLoading || this.interactionLocked) return;
      this.aiLoading = true;
      this.pendingPhaseOverride = this.predictPhaseFromAction(actionText);
      this.systemStatus = '这一手已经落下，局势正在续写。';
      this.startLoadingTicker();
      try {
        const snapshot = await sessionApi.advanceSession(
          this.sessionId,
          payload && typeof payload === 'object'
            ? Object.assign({ actionText }, payload)
            : { actionText }
        );
        this.applySnapshot(snapshot);
      } catch (error) {
        this.$message.error(error.message || '这一手没能顺利推进。');
      } finally {
        this.aiLoading = false;
        this.pendingBattleAction = false;
        this.stopLoadingTicker();
      }
    }
  }
};
</script>

<style lang="less" scoped>
.chronicle-page {
  min-height: 100vh;
  min-height: var(--app-height, 100vh);
  --bg-main: #121212;
  --bg-panel: #0d0d0d;
  --bg-panel-soft: #181818;
  --text-main: #e0e0e0;
  --text-dim: #8f8f8f;
  --text-gold: #d4af37;
  --text-green: #5fa57a;
  --text-danger: #d06767;
  --line-subtle: rgba(255, 255, 255, 0.05);
  padding: 20px;
  padding:
    calc(20px + var(--safe-top, 0px))
    calc(20px + var(--safe-right, 0px))
    calc(20px + var(--safe-bottom, 0px))
    calc(20px + var(--safe-left, 0px));
  color: var(--text-main);
  background: #0A0A0A;
}
.page-shell {
  width: 100%;
  max-width: 1520px;
  margin: 0 auto;
}
.page-shell,
.page-shell * {
  min-width: 0;
}
.card {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.title-zone, .story-zone, .operation-zone, .ability-card { padding: 24px; }
.title-zone {
  position: relative;
  overflow: visible;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
  background: transparent;
}
.title-zone::before,
.title-zone::after {
  content: '';
  position: absolute;
  pointer-events: none;
}
.title-zone::before,
.title-zone::after {
  display: none;
}
.title-zone::before {
  inset: 0;
  background: linear-gradient(90deg, rgba(255,247,229,.05), transparent 45%, rgba(255,247,229,.02));
  opacity: .7;
}
.title-zone::after {
  top: -80px;
  right: -40px;
  width: 220px;
  height: 220px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(242, 196, 138, 0.18), transparent 68%);
  filter: blur(4px);
}
.eyebrow, .section-kicker { font-size: 12px; letter-spacing: 3px; color: var(--text-dim); text-transform: uppercase; }
.title-copy,
.title-tools {
  position: relative;
  z-index: 1;
}
.title-copy h1 { margin: 10px 0 12px; font-size: 42px; letter-spacing: 2px; color: var(--text-main); }
.title-desc, .story-meta, .panel-text, .status-tip, .choice-hint, .custom-tip, .metric-foot { color: var(--text-dim); line-height: 1.82; }
.title-tags, .status-notes { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
.title-tags span, .status-notes span, .choice-category {
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text-dim);
}
.access-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  margin-bottom: 14px;
  padding: 14px 18px;
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255,247,229,.07), rgba(255,247,229,.03)),
    linear-gradient(135deg, rgba(64,28,22,.68), rgba(20,16,15,.76));
}
.access-strip--guest {
  background:
    linear-gradient(180deg, rgba(255,247,229,.06), rgba(255,247,229,.025)),
    linear-gradient(135deg, rgba(46,32,28,.64), rgba(20,16,15,.74));
}
.access-strip__main,
.access-strip__status,
.access-strip__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.access-strip__main {
  flex: 1 1 420px;
  justify-content: space-between;
  min-width: 280px;
}
.access-strip__identity {
  min-width: 0;
}
.access-strip__status,
.access-strip__actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}
.purchase-group {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  z-index: 12;
}
.purchase-group--title {
  z-index: 40;
}
.purchase-methods {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  z-index: 48;
  min-width: 178px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 249, 238, 0.98), rgba(252, 236, 210, 0.98)),
    rgba(252, 236, 210, 0.98);
  border: 1px solid rgba(231, 182, 111, 0.28);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.78),
    0 18px 38px rgba(111, 70, 24, 0.16);
  backdrop-filter: blur(10px);
}
.purchase-methods::before {
  content: '';
  position: absolute;
  top: -7px;
  left: 18px;
  width: 12px;
  height: 12px;
  transform: rotate(45deg);
  background: rgba(253, 241, 220, 0.98);
  border-left: 1px solid rgba(231, 182, 111, 0.26);
  border-top: 1px solid rgba(231, 182, 111, 0.26);
}
.purchase-methods__title {
  color: #8e5c24;
  font-size: 11px;
  letter-spacing: 1.1px;
  text-transform: uppercase;
}
.title-utility-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
}
.title-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-content: flex-start;
  justify-content: flex-end;
  max-width: 360px;
}
.auth-entry {
  margin-bottom: 18px;
  padding: 24px;
}
.mobile-starter {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 18px;
  padding: 22px;
  border: 1px solid rgba(255,223,190,.12);
  background:
    linear-gradient(180deg, rgba(255,247,229,.08), rgba(255,247,229,.03)),
    linear-gradient(145deg, rgba(74,30,22,.82), rgba(26,19,16,.86));
}
.mobile-starter__steps {
  display: grid;
  gap: 10px;
}
.mobile-starter__step {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255,247,229,.05);
  border: 1px solid rgba(255,223,190,.1);
}
.mobile-starter__step strong {
  color: #ffe7c7;
  font-size: 13px;
}
.mobile-starter__step span {
  color: #d7c1a4;
  font-size: 12px;
  line-height: 1.65;
}
.mobile-starter__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.mobile-starter__choices {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}
.mobile-starter__choice {
  min-height: 0;
}
.mobile-quick-actions {
  display: none;
}
.mobile-quick-actions__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.mobile-quick-actions__donation {
  position: relative;
  top: auto;
  left: auto;
  margin-top: 12px;
  width: 100%;
}
.auth-guide-toggle {
  width: 100%;
  margin-top: 12px;
}
.title-utility {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}
.title-action-button,
.purchase-group--title {
  width: 100%;
}
.purchase-group--title > .title-action-button {
  width: 100%;
  justify-content: center;
}
.access-chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,247,229,.08);
  border: 1px solid rgba(255,223,190,.12);
  color: #ffe2c0;
  font-size: 11px;
  letter-spacing: .6px;
  line-height: 1.45;
}
.access-summary-text {
  max-width: 360px;
  font-size: 12px;
  line-height: 1.58;
}
.access-chip--emphasis {
  background: linear-gradient(180deg, rgba(236,187,129,.22), rgba(236,187,129,.12));
  border-color: rgba(236,187,129,.28);
}
.access-chip--month-live {
  color: #f3fff6;
  border-color: rgba(79, 209, 129, 0.44);
  background:
    linear-gradient(180deg, rgba(55, 191, 109, 0.3), rgba(19, 122, 64, 0.22)),
    rgba(21, 75, 41, 0.24);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.08),
    0 8px 20px rgba(38, 156, 88, 0.18);
}
.access-chip--month-idle,
.auth-benefit {
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255,223,190,.1);
  background: rgba(255,247,229,.05);
  box-shadow: inset 0 1px 0 rgba(255,247,229,.04);
}
.access-chip--month-idle {
  color: #e5d1b5;
  border-color: rgba(255,223,190,.14);
}
.purchase-chip {
  min-height: 38px;
  padding: 8px 12px;
  border-radius: 14px;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: .3px;
  white-space: nowrap;
}
.purchase-chip--product {
  color: #1c5db6;
  border-color: rgba(109, 177, 255, 0.58);
  background:
    linear-gradient(180deg, rgba(234, 245, 255, 0.98), rgba(173, 213, 255, 0.98)),
    linear-gradient(180deg, rgba(255,255,255,.42), rgba(255,255,255,0));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.82),
    0 12px 28px rgba(84, 153, 227, 0.24);
  text-shadow: none;
}
.purchase-chip--product-active {
  color: #114a97;
  border-color: rgba(82, 163, 255, 0.76);
  background:
    linear-gradient(180deg, rgba(242, 249, 255, 1), rgba(186, 221, 255, 0.98)),
    linear-gradient(180deg, rgba(255,255,255,.52), rgba(255,255,255,0));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.9),
    0 16px 34px rgba(72, 149, 230, 0.28);
}
.purchase-chip--month-trigger {
  color: #196b3b;
  border-color: rgba(126, 206, 152, 0.56);
  background:
    linear-gradient(180deg, rgba(223, 248, 230, 0.98), rgba(151, 225, 174, 0.98)),
    linear-gradient(180deg, rgba(255,255,255,.46), rgba(255,255,255,0));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.82),
    0 12px 28px rgba(96, 174, 120, 0.22);
}
.purchase-chip--donation {
  color: #165a35;
  border-color: rgba(103, 206, 139, 0.62);
  background:
    linear-gradient(180deg, rgba(227, 255, 236, 0.98), rgba(171, 236, 191, 0.98)),
    linear-gradient(180deg, rgba(255,255,255,.46), rgba(255,255,255,0));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.82),
    0 12px 28px rgba(66, 168, 102, 0.24);
  text-shadow: none;
}
.purchase-chip--donation-hero {
  min-height: 54px;
  padding: 9px 12px;
  font-size: 12px;
}
.purchase-chip--donation.purchase-chip--product-active,
.purchase-chip--donation-hero.purchase-chip--product-active {
  color: #0f4d2c;
  border-color: rgba(82, 191, 120, 0.78);
  background:
    linear-gradient(180deg, rgba(236, 255, 242, 1), rgba(183, 243, 201, 0.98)),
    linear-gradient(180deg, rgba(255,255,255,.54), rgba(255,255,255,0));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.9),
    0 16px 34px rgba(64, 171, 102, 0.28);
}
.purchase-chip--method {
  min-height: 34px;
  padding: 7px 11px;
  font-size: 11px;
  border-radius: 12px;
  width: 100%;
  justify-content: center;
}
.purchase-chip--wechat {
  color: #0f6d3b;
  border-color: rgba(7, 193, 96, 0.42);
  background:
    linear-gradient(180deg, rgba(232, 255, 239, 1), rgba(169, 240, 193, 0.98)),
    linear-gradient(180deg, rgba(255,255,255,.48), rgba(255,255,255,0));
  box-shadow: 0 10px 24px rgba(7, 193, 96, 0.16);
  text-shadow: none;
}
.purchase-chip--alipay {
  color: #1a5cbe;
  border-color: rgba(22, 119, 255, 0.42);
  background:
    linear-gradient(180deg, rgba(236, 246, 255, 1), rgba(169, 211, 255, 0.98)),
    linear-gradient(180deg, rgba(255,255,255,.48), rgba(255,255,255,0));
  box-shadow: 0 10px 24px rgba(22, 119, 255, 0.16);
  text-shadow: none;
}
.purchase-chip--wechat:hover {
  border-color: rgba(29, 225, 120, 0.58);
  background:
    linear-gradient(180deg, rgba(242, 255, 246, 1), rgba(187, 245, 206, 1)),
    linear-gradient(180deg, rgba(255,255,255,.54), rgba(255,255,255,0));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.92),
    0 16px 30px rgba(7, 193, 96, 0.2);
}
.purchase-chip--alipay:hover {
  border-color: rgba(62, 155, 255, 0.58);
  background:
    linear-gradient(180deg, rgba(244, 249, 255, 1), rgba(187, 220, 255, 1)),
    linear-gradient(180deg, rgba(255,255,255,.54), rgba(255,255,255,0));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.92),
    0 16px 30px rgba(22, 119, 255, 0.22);
}
.purchase-chip--wechat:active {
  box-shadow:
    inset 0 2px 10px rgba(98, 173, 122, 0.14),
    0 8px 18px rgba(7, 193, 96, 0.14);
}
.purchase-chip--alipay:active {
  box-shadow:
    inset 0 2px 10px rgba(107, 153, 200, 0.14),
    0 8px 18px rgba(22, 119, 255, 0.16);
}
.access-foot-note {
  max-width: 380px;
  font-size: 12px;
  line-height: 1.58;
}
.tool-button,
.story-briefing__tab,
.intel-tab,
.mobile-bottom-dock__item,
.direction-card,
.choice-card,
.choice-action-button,
.fixed-quick-chip,
.story-tool {
  touch-action: manipulation;
}
.purchase-methods--donation {
  min-width: 250px;
  max-width: 280px;
  padding: 12px;
}
.purchase-methods--title-donation {
  left: auto;
  right: 0;
  min-width: 286px;
  max-width: 320px;
}
.donation-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.donation-panel__intro {
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(120, 188, 112, 0.2);
  background:
    linear-gradient(135deg, rgba(236, 255, 242, 0.86), rgba(255, 247, 231, 0.62));
  color: #315c2a;
}
.donation-panel__intro strong {
  font-size: 12px;
  line-height: 1.45;
}
.donation-panel__intro span {
  color: #6f7140;
  font-size: 11px;
  line-height: 1.55;
}
.donation-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.donation-panel__channel-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  flex: 1 1 auto;
}
.donation-panel__channel-tab {
  min-height: 34px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(231, 182, 111, 0.22);
  background: rgba(255,255,255,.56);
  color: #8b5925;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color .18s ease, background .18s ease, transform .18s ease;
}
.donation-panel__channel-tab:hover {
  transform: translateY(-1px);
  border-color: rgba(208, 141, 84, 0.38);
}
.donation-panel__channel-tab--active {
  color: #7a3d17;
  border-color: rgba(208, 141, 84, 0.48);
  background: linear-gradient(180deg, rgba(255, 243, 232, 0.96), rgba(255, 216, 184, 0.96));
}
.donation-panel__guide-trigger {
  flex: 0 0 auto;
  min-height: 34px;
  padding: 8px 12px;
  border-radius: 12px;
  color: #56763f;
  border-color: rgba(146, 184, 112, 0.28);
  background: rgba(241, 248, 231, 0.68);
}
.donation-panel__image-wrap {
  display: flex;
  justify-content: center;
  padding: 6px;
  border-radius: 16px;
  background: rgba(255,255,255,.62);
  border: 1px solid rgba(231, 182, 111, 0.18);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.58);
}
.donation-panel__image {
  width: 188px;
  height: 188px;
  object-fit: contain;
  border-radius: 12px;
  background: #fff;
}
.donation-panel__fallback {
  padding: 12px;
  border-radius: 14px;
  background: rgba(255,255,255,.58);
  border: 1px dashed rgba(183, 123, 66, 0.35);
  color: #7a4d24;
  line-height: 1.7;
}
.donation-panel__fallback-title {
  font-weight: 700;
  color: #8e5c24;
}
.donation-panel__fallback-line code {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 11px;
  color: #7c4a1f;
}
.donation-panel__desc {
  color: #7f4b1d;
  font-size: 12px;
  line-height: 1.75;
}
.donation-panel__note {
  color: #9a6a3e;
  font-size: 11px;
  line-height: 1.7;
}
.donation-panel__soft-cta {
  width: 100%;
  min-height: 34px;
  justify-content: center;
  color: #6a4b2c;
  border-color: rgba(177, 131, 78, 0.24);
  background: rgba(255, 246, 232, 0.7);
}
.donation-panel__soft-cta:hover {
  color: #5c351b;
  border-color: rgba(177, 131, 78, 0.4);
  background: rgba(255, 240, 217, 0.92);
}
.donation-guide {
  color: #5c3721;
  max-height: 68vh;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(209, 153, 91, 0.56) rgba(255, 244, 232, 0.18);
}
.donation-guide__lead,
.donation-guide__foot {
  line-height: 1.8;
  color: #6a4228;
}
.donation-guide__section + .donation-guide__section,
.donation-guide__section + .donation-guide__foot {
  margin-top: 16px;
}
.donation-guide__title {
  margin-bottom: 8px;
  color: #8b5424;
  font-weight: 700;
}
.donation-guide__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.donation-guide__item {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 244, 232, 0.72);
  border: 1px solid rgba(219, 174, 125, 0.24);
  line-height: 1.7;
}
.donation-guide__item code {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 11px;
  color: #7b4a1d;
}
.donation-guide__qr-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.donation-guide__qr-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(219, 174, 125, 0.3);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 249, 241, 0.9), rgba(255, 236, 213, 0.84));
  color: #6a3f22;
  cursor: pointer;
  text-align: left;
  box-shadow: 0 10px 24px rgba(117, 72, 28, 0.1);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}
.donation-guide__qr-card:hover {
  transform: translateY(-2px);
  border-color: rgba(206, 133, 70, 0.5);
  box-shadow: 0 16px 30px rgba(117, 72, 28, 0.15);
}
.donation-guide__qr-label {
  font-size: 14px;
  font-weight: 800;
  color: #7a421c;
}
.donation-guide__qr-frame {
  display: grid;
  place-items: center;
  min-height: 210px;
  border-radius: 12px;
  border: 1px solid rgba(183, 123, 66, 0.16);
  background: rgba(255, 255, 255, 0.78);
}
.donation-guide__qr-image {
  width: 100%;
  max-width: 210px;
  aspect-ratio: 1;
  object-fit: contain;
  border-radius: 10px;
  background: #fff;
}
.donation-guide__qr-missing {
  padding: 12px;
  color: #875426;
  font-size: 12px;
  line-height: 1.7;
  text-align: center;
}
.donation-guide__qr-hint {
  color: #966239;
  font-size: 12px;
  line-height: 1.5;
}
.donation-guide__scroll-hint {
  display: grid;
  gap: 4px;
  margin-top: 10px;
  color: #8b633d;
  font-size: 12px;
  line-height: 1.55;
}
.auth-dialog {
  display: grid;
  gap: 12px;
  color: #e8d6ba;
}
.auth-dialog__identity {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid rgba(224, 189, 137, 0.16);
  border-radius: 8px;
  background: rgba(255, 244, 227, 0.05);
}
.auth-dialog__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.character-stats-dialog {
  color: #ead7bb;
}
.character-stats-dialog__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border: 1px solid rgba(198, 150, 90, 0.16);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(184, 153, 71, 0.12), transparent 42%),
    rgba(20, 16, 16, 0.78);
}
.character-stats-dialog__name {
  color: #fff0dc;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}
.character-stats-dialog__meta {
  margin-top: 6px;
  color: rgba(234, 215, 187, 0.72);
  font-size: 13px;
  line-height: 1.6;
}
.character-stats-dialog__badge {
  flex: 0 0 auto;
  max-width: 160px;
  padding: 7px 10px;
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 999px;
  color: #d4af37;
  background: rgba(212, 175, 55, 0.08);
  font-size: 12px;
  line-height: 1.2;
  text-align: center;
}
.character-stats-dialog__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.character-stats-dialog__item {
  min-width: 0;
  min-height: 96px;
  padding: 12px;
  border: 1px solid rgba(198, 150, 90, 0.12);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.045), rgba(255, 244, 227, 0.015)),
    rgba(12, 10, 9, 0.52);
}
.character-stats-dialog__item span,
.character-stats-dialog__item small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.character-stats-dialog__item span {
  color: rgba(234, 215, 187, 0.68);
  font-size: 12px;
}
.character-stats-dialog__item strong {
  display: block;
  margin-top: 7px;
  overflow: hidden;
  color: #d4af37;
  font-size: 22px;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-word;
}
.character-stats-dialog__item:nth-child(12) strong {
  font-size: 14px;
  line-height: 1.35;
  white-space: normal;
}
.character-stats-dialog__item small {
  margin-top: 8px;
  color: rgba(234, 215, 187, 0.52);
  font-size: 11px;
  line-height: 1.4;
}
@media (max-width: 640px) {
  .character-stats-dialog__hero {
    flex-direction: column;
    gap: 10px;
  }

  .character-stats-dialog__badge {
    max-width: 100%;
  }

  .character-stats-dialog__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.title-utility {
  flex: 0 0 156px;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}
.auth-entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}
.auth-entry-card {
  position: relative;
  overflow: hidden;
  padding: 18px;
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255,247,229,.06), rgba(255,247,229,.03)),
    rgba(255,247,229,.03);
  border: 1px solid rgba(255,223,190,.1);
  box-shadow: inset 0 1px 0 rgba(255,247,229,.04);
}

.auth-entry-card > .panel-title,
.auth-entry-card > .panel-text,
.auth-entry-card > .native-auth-input,
.auth-entry-card > .auth-actions,
.auth-entry-card > .auth-benefit-list,
.auth-entry-card > .status-tip {
  animation: authStepIn .42s ease-out both;
}

.auth-entry-card > .panel-text { animation-delay: .06s; }
.auth-entry-card > .native-auth-input:nth-of-type(1) { animation-delay: .12s; }
.auth-entry-card > .native-auth-input:nth-of-type(2) { animation-delay: .18s; }
.auth-entry-card > .native-auth-input:nth-of-type(3) { animation-delay: .24s; }
.auth-entry-card > .auth-actions,
.auth-entry-card > .auth-benefit-list { animation-delay: .3s; }
.auth-entry-card > .status-tip { animation-delay: .36s; }

@keyframes authStepIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.auth-entry-card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(135deg, rgba(255,247,229,.035), transparent 45%);
}
.auth-entry-card--guide {
  background:
    radial-gradient(circle at top right, rgba(236,187,129,.08), transparent 32%),
    linear-gradient(180deg, rgba(255,247,229,.06), rgba(255,247,229,.03)),
    rgba(255,247,229,.03);
}
.native-auth-input {
  width: 100%;
  margin-top: 14px;
  padding: 12px 4px 10px;
  font-size: 16px;
  border: 0;
  border-bottom: 2px solid #3a2d20;
  border-radius: 0;
  background: transparent;
  color: #e3d8c8;
  caret-color: #d4af37;
  font-family: "Noto Serif SC", "Songti SC", SimSun, serif;
  text-align: center;
  outline: none;
  transition: border-color .22s ease, color .22s ease, filter .22s ease;
}
.native-auth-input::placeholder {
  color: rgba(215,193,164,.72);
}
.native-auth-input:focus {
  border-color: #d4af37;
  box-shadow: none;
}
.auth-native-btn {
  min-width: 180px;
}
.auth-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}
.auth-benefit-list {
  display: grid;
  gap: 10px;
  margin: 14px 0 16px;
}
.auth-benefit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.auth-benefit span {
  color: #d9c3a8;
}
.auth-benefit strong {
  color: #fff0dc;
  font-size: 16px;
}
.tool-button, .text-route, .choice-card {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease, filter .18s ease, opacity .18s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.tool-button::before,
.text-route::before {
  display: none;
}
.tool-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  box-shadow: none;
}
.tool-button:hover, .text-route:hover, .choice-card:hover {
  transform: none;
  border-color: transparent;
  box-shadow: none;
  filter: none;
}
.tool-button:active, .text-route:active, .choice-card:active {
  transform: none;
  box-shadow: none;
  filter: none;
}
.tool-button:disabled, .text-route:disabled, .choice-card:disabled {
  opacity: .46;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
.tool-button--subtle {
  background: transparent;
}
.tool-button--accent {
  background: transparent;
  border-color: transparent;
}
.zone-head, .status-top, .choice-top, .custom-actions, .panel-foot, .story-status-head, .thread-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.zone-title { margin-top: 6px; font-size: 28px; font-weight: 600; }
.zone-title,
.panel-title,
.choice-name {
  word-break: break-word;
}
.panel-title { margin-top: 6px; font-size: 22px; font-weight: 600; }
.panel-title--small { font-size: 18px; }
.main-grid { display: grid; grid-template-columns: minmax(0, 7fr) minmax(280px, 3fr); gap: 0; align-items: stretch; background: transparent; }
.primary-column, .ability-zone, .metric-list, .overlay-content { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
.primary-column,
.ability-zone { height: 100%; }
.story-zone,
.operation-zone,
.ability-zone,
.intel-hub,
.custom-box,
.battle-command-card,
.battle-log-card,
.overlay-panel {
  min-width: 0;
}
.turn-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.8fr);
  gap: 18px;
  margin-bottom: 14px;
  padding: 18px 0 22px;
  background: transparent;
  border-bottom: 1px solid var(--line-subtle);
}
.mobile-stage-switch {
  display: none;
  margin-bottom: 14px;
  padding: 14px 16px;
  border-radius: 22px;
  background:
    radial-gradient(circle at top right, rgba(236,187,129,.14), transparent 42%),
    linear-gradient(180deg, rgba(255,247,229,.08), rgba(255,247,229,.03)),
    linear-gradient(135deg, rgba(40,28,25,.94), rgba(20,16,15,.97));
  border: 1px solid rgba(236,187,129,.16);
  box-shadow: 0 16px 34px rgba(0,0,0,.18);
}
.mobile-stage-switch__head {
  margin-top: 8px;
}
.mobile-stage-switch__tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}
.mobile-stage-switch__tab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;
  min-height: 56px;
  padding: 10px 12px;
  border: 1px solid rgba(255,223,190,.12);
  border-radius: 16px;
  background: rgba(255,247,229,.04);
  color: #f5e8d8;
  text-align: left;
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;
}
.mobile-stage-switch__tab span {
  font-size: 14px;
  font-weight: 700;
}
.mobile-stage-switch__tab small {
  color: #d3b89a;
  font-size: 11px;
  line-height: 1.45;
}
.mobile-stage-switch__tab.active {
  border-color: rgba(236,187,129,.34);
  background:
    linear-gradient(180deg, rgba(236,187,129,.16), rgba(255,247,229,.05)),
    rgba(255,247,229,.05);
  box-shadow: 0 12px 26px rgba(0,0,0,.14);
}
.mobile-stage-switch__notes {
  margin-top: 12px;
  opacity: .78;
}
.mobile-bottom-dock {
  position: fixed;
  left: 10px;
  right: 10px;
  bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  z-index: 18;
  display: none;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 10px;
  border-radius: 0;
  border: 0;
  background: #0A0A0A;
  box-shadow: none;
  backdrop-filter: none;
}
.mobile-bottom-dock__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 52px;
  padding: 8px 6px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #f5e8d8;
  cursor: pointer;
  transition: border-color .18s ease, background .18s ease, transform .18s ease;
}
.mobile-bottom-dock__item span {
  font-size: 13px;
  font-weight: 600;
}
.mobile-bottom-dock__item small {
  color: #d2b899;
  font-size: 10px;
  line-height: 1.35;
}
.mobile-bottom-dock__item.active {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}
.main-grid--mobile-staged {
  align-items: start;
}
.turn-overview__main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.turn-overview__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.turn-overview__rename {
  flex: 0 0 auto;
  white-space: nowrap;
}
.turn-overview__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.turn-overview__stats {
  display: flex;
  align-items: flex-end;
  gap: 26px;
  overflow-x: auto;
  overflow-y: hidden;
}
.turn-overview__stat--vital {
  flex: 0 0 auto;
  min-width: 110px;
}
.turn-overview__stat {
  display: flex;
  flex-direction: column;
  gap: 5px;
  justify-content: space-between;
  min-height: 0;
  padding: 0;
  border-radius: 0;
  background: transparent;
  border: 0;
}
.turn-overview__stat span {
  order: 2;
  color: #71717a;
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.turn-overview__stat strong {
  order: 1;
  color: #ca8a04;
  font-size: 30px;
  font-weight: 600;
  line-height: 1.1;
  word-break: break-word;
}
.turn-overview__stat--vital strong,
.side-dashboard__value {
  font-family: Consolas, 'Courier New', monospace;
}
.turn-overview__stat--vital span,
.side-dashboard__label,
.side-dashboard__title {
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}
.turn-overview__stat small {
  order: 3;
  color: #52525b;
  font-size: 11px;
  line-height: 1.5;
}
.story-tools-toggle {
  width: 100%;
  justify-content: center;
  margin-top: 14px;
}
.story-timehead {
  margin-top: 8px;
  color: #d6d6d6;
  font-family: 'STSong', 'SimSun', serif;
  font-size: clamp(28px, 2.4vw, 38px);
  line-height: 1.25;
  letter-spacing: 0.04em;
}
.story-zone { display: flex; flex-direction: column; min-height: 0; }
.story-briefing {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 18px;
  align-items: stretch;
}
.story-briefing--mobile {
  grid-template-columns: 1fr;
}
.story-briefing__tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.story-briefing__tab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 11px 12px;
  border: 1px solid rgba(255,223,190,.1);
  border-radius: 16px;
  background: rgba(255,247,229,.04);
  color: #f5e8d8;
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, background .18s ease;
}
.story-briefing__tab span {
  font-size: 13px;
  font-weight: 600;
}
.story-briefing__tab small {
  color: #d2b899;
  font-size: 11px;
  line-height: 1.45;
}
.story-briefing__tab.active {
  border-color: rgba(236,187,129,.28);
  background:
    linear-gradient(180deg, rgba(236,187,129,.12), rgba(255,247,229,.04)),
    rgba(255,247,229,.04);
}
.story-briefing__card {
  padding: 0;
  border-radius: 0;
  background: transparent;
  min-height: 0;
  border: 0;
}
.story-panel, .status-item, .metric-item, .ability-panel, .overlay-card {
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(255,247,229,.05);
}
.story-panel {
  display: flex;
  flex-direction: column;
  min-height: clamp(188px, 22vh, 224px);
  max-height: clamp(188px, 22vh, 224px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(214,162,104,.6) rgba(255,255,255,.04);
}
.story-dashboard .panel-title {
  font-size: 19px;
}
.story-dashboard .panel-text,
.story-dashboard .status-tip {
  font-size: 13px;
  line-height: 1.72;
}
.story-panel--status { overflow: hidden; }
.story-clue-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}
.story-clue-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255,247,229,.04);
  border: 1px solid rgba(255,223,190,.08);
}
.story-status-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(214,162,104,.6) rgba(255,255,255,.04);
}
.status-cockpit {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  margin-top: 14px;
}
.status-overview-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.status-overview-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 12px 14px;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255,247,229,.06), rgba(255,247,229,.03)),
    rgba(255,247,229,.03);
  border: 1px solid rgba(255,223,190,.09);
}
.status-overview-lines {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.status-overview-lines span {
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255,247,229,.06);
  color: #f3e7d5;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.status-panel-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}
.status-panel-block {
  border-radius: 18px;
  border: 1px solid rgba(255,223,190,.08);
  background: rgba(255,247,229,.035);
  overflow: hidden;
  transition: border-color .18s ease, background .18s ease, box-shadow .18s ease;
}
.status-panel-block--active {
  border-color: rgba(236,187,129,.2);
  background:
    linear-gradient(180deg, rgba(236,187,129,.08), rgba(255,247,229,.03)),
    rgba(255,247,229,.035);
  box-shadow: inset 0 0 0 1px rgba(236,187,129,.08);
}
.status-panel-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  width: 100%;
  padding: 13px 14px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.status-panel-toggle__copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.status-panel-toggle__head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.status-panel-toggle__head strong {
  color: #f5e8d8;
  font-size: 16px;
}
.status-panel-toggle__summary {
  color: #ddc8ab;
  font-size: 13px;
  line-height: 1.65;
}
.status-panel-toggle__preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.status-panel-toggle__preview span {
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255,247,229,.06);
  color: #f0dfca;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.status-panel-toggle__arrow {
  position: relative;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid rgba(255,223,190,.1);
  background: rgba(255,247,229,.05);
}
.status-panel-toggle__arrow::before {
  content: '';
  position: absolute;
  top: 11px;
  left: 12px;
  width: 9px;
  height: 9px;
  border-right: 2px solid rgba(255,232,200,.88);
  border-bottom: 2px solid rgba(255,232,200,.88);
  transform: rotate(45deg);
  transition: transform .18s ease, top .18s ease;
}
.status-panel-toggle__arrow.active::before {
  top: 14px;
  transform: rotate(-135deg);
}
.status-panel-body {
  padding: 0 14px 14px;
}
.status-panel-body .status-detail-board {
  max-height: 236px;
}
.status-detail-board {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(214,162,104,.6) rgba(255,255,255,.04);
}
.food-status-board,
.food-self-card {
  margin-top: 12px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(236,187,129,.12);
  background:
    linear-gradient(180deg, rgba(236,187,129,.08), rgba(255,247,229,.03)),
    rgba(255,247,229,.03);
}
.food-status-board__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.food-pill-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.food-pill {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 12px;
  border: 1px solid rgba(255,223,190,.12);
  border-radius: 14px;
  background: rgba(255,247,229,.05);
  color: #f2e5d2;
  text-align: left;
  cursor: pointer;
}
.food-pill:disabled {
  opacity: .58;
  cursor: default;
}
.food-pill strong {
  color: #fff1dc;
  font-size: 14px;
}
.food-pill span {
  color: #d8c4a8;
  font-size: 12px;
  line-height: 1.65;
}
.status-detail-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255,247,229,.035);
  border: 1px solid rgba(255,223,190,.06);
}
.status-detail-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.status-detail-copy strong {
  color: #f3e7d5;
}
.status-detail-values {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  text-align: right;
}
.status-detail-value {
  color: #ffe2c0;
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.status-detail-extra {
  color: #d7c1a4;
  font-size: 12px;
  line-height: 1.5;
}
.status-feedback-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}
.compact { padding: 12px 14px; }
.progress-track { height: 10px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,.08); }
.mini-track { margin-top: 8px; }
.progress-bar { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #cf8e54, #f3d7b2); }
.red-fill { background: linear-gradient(90deg, #8f291f, #d89f74); }
.gold-fill { background: linear-gradient(90deg, #8f6b2f, #f3dfb5); }
.stream-banner { display: flex; gap: 14px; align-items: center; margin-top: 16px; padding: 14px 16px; border-radius: 18px; background: rgba(255,247,229,.06); }
.stream-dot { width: 12px; height: 12px; border-radius: 999px; background: #d29a67; box-shadow: 0 0 0 8px rgba(210,154,103,.16); }
.ability-value, .choice-name { font-size: 19px; font-weight: 600; }
.story-scroll {
  position: relative;
  margin-top: 16px;
  min-height: 260px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 28px 0 12px;
  background: rgba(24, 24, 27, 0.4);
  backdrop-filter: blur(12px);
  border-left: 2px solid #b91c1c;
  padding: 24px;
  border-radius: 0;
  cursor: grab;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%);
  scrollbar-width: thin;
  scrollbar-color: rgba(214,162,104,.75) rgba(255,255,255,.05);
}
.story-scroll.is-dragging { cursor: grabbing; user-select: none; }
.story-scroll::-webkit-scrollbar { width: 8px; }
.story-scroll::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(214,162,104,.65); }
.story-scroll::-webkit-scrollbar-track { border-radius: 999px; background: rgba(255,255,255,.05); }
.story-waiting {
  position: sticky;
  top: 12px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
  border-radius: 0;
  background: rgba(39, 39, 42, 0.24);
  color: var(--text-main);
  backdrop-filter: blur(6px);
}
.story-waiting-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #d7a575;
  animation: storyPulse 1.1s ease-in-out infinite;
}
.story-waiting-dot:nth-child(2) { animation-delay: .16s; }
.story-waiting-dot:nth-child(3) { animation-delay: .32s; }
.story-body { font-size: 17px; line-height: 2.02; white-space: pre-wrap; }
.story-body--enhanced {
  white-space: normal;
  font-size: 18px;
  line-height: 1.8;
  color: var(--text-main);
  font-family: 'Noto Serif SC', 'STSong', 'SimSun', serif;
  max-width: 860px;
  margin: 0 auto;
}
.story-paragraph {
  margin: 0 0 1.15em;
}
.story-spacer {
  height: 1.1em;
}
.story-person {
  color: var(--text-gold);
  font-weight: 700;
}
.story-place {
  color: var(--text-green);
  font-weight: 700;
}
.story-glossary-term {
  display: inline;
  padding: 0;
  border: 0;
  border-bottom: 1px dashed rgba(224, 224, 224, 0.4);
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.story-glossary-term:hover,
.story-glossary-term:focus {
  color: var(--text-gold);
  border-bottom-color: var(--text-gold);
  outline: none;
}
.story-type-caret {
  display: inline-block;
  width: 8px;
  height: 1.15em;
  margin-left: 6px;
  vertical-align: text-bottom;
  background: transparent;
}
.story-type-caret--active {
  background: rgba(212, 175, 55, 0.9);
  animation: choiceCaretBlink .7s steps(1) infinite;
}
.story-stream-tail {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 10px 0 0;
  border-radius: 0;
  background: transparent;
  color: var(--text-dim);
}
.story-archive {
  margin-top: 16px;
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(255,247,229,.04);
  border: 1px solid rgba(255,223,190,.08);
}
.story-archive-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.story-archive-body {
  max-height: 168px;
  overflow-y: auto;
  padding-right: 6px;
  color: #d8c3a9;
  line-height: 1.88;
  white-space: pre-wrap;
  scrollbar-width: thin;
  scrollbar-color: rgba(214,162,104,.55) rgba(255,255,255,.05);
}
.story-tools {
  position: sticky;
  top: 14px;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
  padding: 12px 0 0;
  border-radius: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
  backdrop-filter: none;
}
.story-tool {
  flex: 0 0 auto;
  text-align: center;
  justify-content: center;
  min-height: 44px;
  background: transparent;
}
.mobile-story-actions {
  display: none;
}
.mobile-continue-button {
  width: 100%;
  min-height: 54px;
  border: 0;
  background: #050505;
  color: #ffffff;
  font-size: 22px;
  line-height: 1;
}
.mobile-continue-button--secondary {
  background: #1a1a1a;
}
.operation-zone {
  position: relative;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--line-subtle);
  padding: 24px 0 0;
}
.intel-hub {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 24px;
}
.intel-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-top: 16px;
}
.intel-tab {
  padding: 10px 8px;
  border: 1px solid rgba(255,223,190,.12);
  border-radius: 14px;
  background: rgba(255,247,229,.04);
  color: inherit;
  cursor: pointer;
  transition: border-color .18s ease, background .18s ease, transform .18s ease;
}
.intel-tab:hover {
  transform: translateY(-1px);
  border-color: rgba(236,187,129,.28);
}
.intel-tab.active {
  border-color: rgba(236,187,129,.4);
  background: linear-gradient(180deg, rgba(236,187,129,.15), rgba(255,247,229,.05));
}
.intel-scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  margin-top: 14px;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(214,162,104,.6) rgba(255,255,255,.04);
}
.intel-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 0;
  border-radius: 0;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--line-subtle);
}
.intel-card--self-summary {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #0A0A0A;
  backdrop-filter: none;
}
.intel-card--self-pinned {
  gap: 12px;
}
.intel-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.intel-list__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 0;
  border-radius: 0;
  background: transparent;
  border: 0;
}
.intel-list__item strong {
  color: #f3e7d5;
}
.status-detail-board--plain {
  overflow: visible;
  max-height: none;
  padding-right: 0;
}
.self-pinned-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.self-pinned-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 11px 12px;
  border-radius: 14px;
  background: rgba(255,247,229,.04);
  border: 1px solid rgba(255,223,190,.06);
}
.self-pinned-item span {
  color: #d9c2a3;
  font-size: 12px;
}
.self-pinned-item strong {
  color: #ffe3c3;
  font-size: 16px;
  font-weight: 600;
}
.self-pinned-item small {
  color: #cdb392;
  font-size: 12px;
  line-height: 1.5;
}
.self-section-tabs {
  position: sticky;
  top: 110px;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 2px 0;
  background: linear-gradient(180deg, rgba(21,15,13,.98), rgba(21,15,13,.82));
}
.mobile-self-toggle {
  width: 100%;
  justify-content: center;
  margin-top: -2px;
}
.self-section-tab {
  padding: 8px 12px;
  border: 1px solid rgba(255,223,190,.12);
  border-radius: 999px;
  background: rgba(255,247,229,.04);
  color: inherit;
  cursor: pointer;
  transition: border-color .18s ease, background .18s ease, transform .18s ease;
}
.self-section-tab:hover {
  transform: translateY(-1px);
  border-color: rgba(236,187,129,.28);
}
.self-section-tab.active {
  border-color: rgba(236,187,129,.4);
  background: linear-gradient(180deg, rgba(236,187,129,.15), rgba(255,247,229,.05));
}
.footing-self {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.footing-self__hero {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(236,187,129,.1), rgba(255,247,229,.04)),
    rgba(255,247,229,.04);
  border: 1px solid rgba(236,187,129,.16);
}
.footing-self__hero-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.footing-self__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.footing-self-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 13px 14px;
  border-radius: 16px;
  background: rgba(255,247,229,.04);
  border: 1px solid rgba(255,223,190,.08);
}
.footing-self-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.footing-self-card__stats span {
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255,247,229,.06);
  color: #f0dfca;
  font-size: 12px;
}
.ending-panel {
  margin-top: 18px;
}
.turn-processing-banner {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px;
  border-radius: 20px;
  border: 1px solid rgba(236,187,129,.16);
  background:
    linear-gradient(180deg, rgba(255,247,229,.06), rgba(255,247,229,.03)),
    rgba(255,247,229,.04);
}
.turn-processing-banner--battle {
  border-color: rgba(199,133,88,.24);
  background:
    linear-gradient(180deg, rgba(138,56,36,.22), rgba(255,247,229,.04)),
    rgba(255,247,229,.04);
}
.turn-processing-banner__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.ending-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.ending-card {
  padding: 18px;
  border-radius: 20px;
  background: rgba(255,247,229,.05);
  border: 1px solid rgba(255,223,190,.08);
}
.ending-card--tree,
.ending-card--inherit {
  background: linear-gradient(180deg, rgba(108,43,29,.3), rgba(255,247,229,.04));
}
.intel-card--apex {
  border-color: rgba(199,133,88,.18);
  background:
    linear-gradient(180deg, rgba(122,52,31,.2), rgba(255,247,229,.04)),
    rgba(255,247,229,.04);
}
.ending-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}
.gate-checklist {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.gate-card-notes {
  margin-top: 10px;
}
.gate-checklist__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 11px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,223,190,.08);
  background: rgba(255,247,229,.04);
}
.gate-checklist__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.gate-checklist__item strong {
  color: #e4b782;
  font-size: 12px;
  letter-spacing: .08em;
  white-space: nowrap;
}
.gate-checklist__item span {
  color: #f3e7d5;
  line-height: 1.55;
  text-align: right;
}
.gate-checklist__item small {
  color: #cfb89a;
  line-height: 1.5;
}
.gate-checklist__item--done {
  border-color: rgba(122,171,108,.2);
  background: rgba(122,171,108,.08);
}
.gate-checklist__item--done strong {
  color: #b9d7a8;
}
.choice-stack--locked {
  opacity: .78;
}
.retinue-overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
  padding: 16px 18px 12px;
  border: 1px solid rgba(255,223,190,.08);
  border-radius: 22px;
  background: rgba(255,247,229,.05);
  box-shadow: inset 0 0 0 1px rgba(255,247,229,.03);
  overflow: hidden;
}
.retinue-overview--resizing {
  user-select: none;
}
.retinue-overview__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.retinue-overview__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(214,162,104,.55) rgba(255,255,255,.04);
}
.retinue-overview__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.retinue-overview__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100%;
  padding: 14px;
  border-radius: 18px;
  background: rgba(255,247,229,.04);
  border: 1px solid rgba(255,223,190,.08);
}
.retinue-overview__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.retinue-overview__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.retinue-overview__item strong {
  color: #f3e7d5;
}
.retinue-overview__item span {
  color: #d7c1a4;
  line-height: 1.6;
}
.retinue-overview__stats {
  color: #ffe2c0;
  font-variant-numeric: tabular-nums;
}
.retinue-overview__split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.retinue-overview__resize {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  min-height: 18px;
  margin-top: 2px;
  padding: 6px 0 0;
  border: 0;
  background: transparent;
  cursor: ns-resize;
}
.retinue-overview__resize span {
  width: 34px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255,223,190,.2);
}
.battle-group {
  margin-bottom: 4px;
}
.battle-stage {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.battle-stage__overview,
.battle-stage__body {
  display: grid;
  gap: 14px;
}
.battle-stage__overview {
  grid-template-columns: minmax(0, 1fr) minmax(220px, .78fr) minmax(0, 1fr);
}
.battle-stage__body {
  grid-template-columns: 1fr;
}
.battle-log-card,
.battle-command-card {
  padding: 18px;
  border-radius: 22px;
  background: rgba(255,247,229,.05);
  border: 1px solid rgba(255,223,190,.08);
}
.battle-round-card {
  background:
    linear-gradient(180deg, rgba(236,187,129,.08), rgba(255,247,229,.04)),
    rgba(255,247,229,.05);
  border-color: rgba(236,187,129,.16);
}
.battle-round-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.battle-log-list {
  margin-top: 12px;
}
.battle-side,
.battle-center {
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255,247,229,.045);
  border: 1px solid rgba(255,223,190,.08);
}
.battle-center {
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  background: linear-gradient(180deg, rgba(236,187,129,.08), rgba(255,247,229,.04));
}
.battle-center__tip {
  margin-top: 12px;
  color: #dec9ad;
  line-height: 1.75;
}
.battle-meters {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}
.battle-meter {
  padding: 12px 12px 10px;
  border-radius: 16px;
  background: rgba(255,247,229,.035);
}
.battle-meter__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.battle-round-highlight {
  margin-bottom: 12px;
  color: #f3e7d5;
  line-height: 1.85;
}
.battle-log-row + .battle-log-row {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255,223,190,.08);
}
.battle-log-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}
.battle-command-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}
.battle-command-button {
  min-height: 112px;
  border-color: rgba(236,187,129,.18);
  background: linear-gradient(180deg, rgba(236,187,129,.1), rgba(255,247,229,.04));
}
.iron-fill { background: linear-gradient(90deg, #4e596b, #b5c0cf); }
.choice-stack { display: flex; flex-direction: column; gap: 18px; margin-top: 18px; }
.choice-group { display: flex; flex-direction: column; gap: 12px; }
.choice-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.choice-group-head--stacked {
  align-items: flex-start;
}
.choice-group-note {
  color: #d7c1a4;
  font-size: 13px;
  line-height: 1.7;
}
.mobile-choice-switch {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mobile-choice-tabs {
  display: grid;
  gap: 8px;
}
.mobile-choice-tabs--dynamic {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.mobile-choice-tab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 3px;
  min-height: 50px;
  padding: 10px 12px;
  border: 1px solid rgba(255,223,190,.12);
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255,247,229,.05), rgba(255,247,229,.03)),
    rgba(255,247,229,.03);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;
}
.mobile-choice-tab span {
  color: #f7e7d0;
  font-size: 14px;
  font-weight: 600;
}
.mobile-choice-tab small {
  color: #d2b899;
  font-size: 11px;
  line-height: 1.35;
}
.mobile-choice-tab.active {
  border-color: rgba(236,187,129,.38);
  background:
    linear-gradient(180deg, rgba(236,187,129,.16), rgba(255,247,229,.05)),
    rgba(255,247,229,.04);
  box-shadow: inset 0 0 0 1px rgba(236,187,129,.08);
}
.mobile-choice-stage {
  display: flex;
  flex-direction: column;
}
.mobile-choice-card {
  min-height: 0;
}
.direction-board {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.direction-board--mobile {
  position: sticky;
  top: calc(74px + var(--safe-top, 0px));
  z-index: 4;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 10px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(24,18,16,.96), rgba(24,18,16,.92)),
    rgba(24,18,16,.94);
  border: 1px solid rgba(255,223,190,.12);
  box-shadow:
    inset 0 1px 0 rgba(255,247,229,.04),
    0 14px 28px rgba(0,0,0,.16);
  backdrop-filter: blur(10px);
}
.fixed-quick-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}
.fixed-quick-chip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "label count"
    "summary count";
  align-items: center;
  gap: 4px 10px;
  min-height: 68px;
  padding: 12px 14px;
  border: 1px solid rgba(255,223,190,.12);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255,247,229,.05), rgba(255,247,229,.025)),
    rgba(255,247,229,.03);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color .18s ease, background .18s ease, transform .18s ease, box-shadow .18s ease;
}
.fixed-quick-chip__label {
  grid-area: label;
  color: #f7e7d0;
  font-size: 15px;
  font-weight: 600;
}
.fixed-quick-chip__summary {
  grid-area: summary;
  color: #d1b89a;
  font-size: 12px;
  line-height: 1.5;
}
.fixed-quick-chip__count {
  grid-area: count;
  min-width: 34px;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(255,247,229,.1);
  color: #ffe2c0;
  font-size: 12px;
  text-align: center;
}
.fixed-quick-chip:hover {
  transform: translateY(-1px);
  border-color: rgba(236,187,129,.3);
  box-shadow: 0 14px 26px rgba(0,0,0,.12);
}
.fixed-quick-chip.active {
  border-color: rgba(236,187,129,.42);
  background:
    linear-gradient(180deg, rgba(236,187,129,.16), rgba(255,247,229,.05)),
    rgba(255,247,229,.05);
  box-shadow: inset 0 0 0 1px rgba(236,187,129,.08);
}
.fixed-quick-chip--disabled {
  cursor: not-allowed;
}
.direction-card {
  padding: 12px 14px;
  border: 1px solid rgba(255,223,190,.12);
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255,247,229,.05), rgba(255,247,229,.03)),
    rgba(255,247,229,.03);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;
}
.direction-card:hover {
  transform: translateY(-1px);
  border-color: rgba(236,187,129,.3);
  box-shadow: 0 12px 26px rgba(0,0,0,.16);
}
.direction-card.active {
  border-color: rgba(236,187,129,.42);
  background: linear-gradient(180deg, rgba(236,187,129,.15), rgba(255,247,229,.05));
  box-shadow: 0 0 0 1px rgba(236,187,129,.12) inset;
}
.direction-card--mobile {
  min-height: 58px;
  padding: 10px 9px;
  border-radius: 14px;
}
.direction-card--disabled {
  cursor: not-allowed;
}
.direction-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}
.direction-name {
  font-size: 18px;
  font-weight: 600;
}
.direction-count {
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255,247,229,.08);
  color: #ffe2c0;
  font-size: 12px;
}
.direction-hint {
  margin-top: 8px;
  color: #d7c1a4;
  line-height: 1.7;
}
.direction-expanded {
  padding: 18px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255,247,229,.06), rgba(108,43,29,.12));
  border: 1px solid rgba(236,187,129,.16);
  box-shadow: inset 0 0 0 1px rgba(255,247,229,.03);
  scroll-margin-top: 138px;
}
.direction-expanded-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.direction-expanded-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.direction-expanded-count {
  min-width: 68px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(236,187,129,.12);
  color: #ffe2c0;
  font-size: 12px;
  text-align: center;
}
.direction-collapse {
  padding: 8px 14px;
  border-radius: 999px;
}
.direction-expanded-summary {
  margin-top: 10px;
  color: #dec9ad;
  line-height: 1.75;
}
.fixed-mobile-section-tabs {
  position: sticky;
  top: calc(146px + var(--safe-top, 0px));
  z-index: 3;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 12px;
  padding: 10px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(26,20,18,.96), rgba(26,20,18,.92)),
    rgba(26,20,18,.94);
  border: 1px solid rgba(255,223,190,.1);
  box-shadow:
    inset 0 1px 0 rgba(255,247,229,.04),
    0 10px 20px rgba(0,0,0,.14);
  backdrop-filter: blur(10px);
}
.mobile-choice-tab--fixed {
  min-height: 46px;
  padding: 9px 10px;
  border-radius: 14px;
}
.fixed-group-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.fixed-group-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(236,187,129,.16);
}
.fixed-group-block:first-child {
  padding-top: 0;
  border-top: 0;
}
.fixed-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.fixed-group-count {
  color: rgba(255, 233, 200, .62);
  font-size: 12px;
  letter-spacing: .08em;
}
.fixed-group-summary {
  color: #d9c2a3;
  line-height: 1.7;
}
.battle-return-card {
  margin: 18px 0 2px;
  padding: 18px 20px;
  border-radius: 22px;
  border: 1px solid rgba(236,187,129,.28);
  background:
    linear-gradient(180deg, rgba(126,45,28,.24), rgba(42,25,22,.2)),
    rgba(255,247,229,.04);
  box-shadow: inset 0 0 0 1px rgba(255,247,229,.03);
}
.battle-return-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.battle-return-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}
.battle-return-card__meta span {
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255,228,188,.1);
  color: #f6dfc2;
  font-size: 12px;
}
.choice-grid--expanded {
  margin-top: 16px;
}
.choice-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.choice-card {
  position: relative;
  overflow: hidden;
  padding: 18px;
  text-align: left;
  border-color: rgba(255,223,190,.14);
}
.choice-card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(135deg, rgba(255,247,229,.035), transparent 42%);
}
.choice-card--relation {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.choice-select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,223,190,.1);
  background:
    linear-gradient(180deg, rgba(255,247,229,.06), rgba(255,247,229,.025)),
    rgba(255,247,229,.03);
}
.choice-select__prefix {
  display: inline-flex;
  align-items: center;
  height: 100%;
  padding-left: 2px;
  color: #bfa68a;
  font-size: 12px;
  letter-spacing: .08em;
}
.choice-action-button {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.choice-action-button:disabled {
  cursor: not-allowed;
}
.choice-card--dynamic {
  border-color: rgba(117, 170, 128, 0.26);
  background: rgba(115, 171, 125, 0.08);
}
.choice-card--placeholder {
  cursor: default;
  border-style: dashed;
  opacity: .92;
}
.choice-card--drafting {
  border-color: rgba(148, 209, 158, 0.3);
  box-shadow: 0 0 0 1px rgba(148, 209, 158, 0.1) inset;
}
.choice-card--disabled {
  opacity: .56;
  filter: saturate(.78);
  cursor: not-allowed;
}
.choice-draft-caret {
  display: inline-block;
  width: 0;
  height: 1em;
  margin-left: 5px;
  border-right: 2px solid rgba(226, 246, 232, 0.9);
  vertical-align: -1px;
  animation: choiceCaretBlink .95s step-end infinite;
}
.choice-placeholder-line {
  height: 10px;
  margin-top: 14px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(129,190,141,.16), rgba(224,247,229,.4), rgba(129,190,141,.16));
  background-size: 220% 100%;
  animation: planningGlow 1.4s ease-in-out infinite;
}
.choice-tags { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.choice-requirements {
  margin-top: 10px;
  color: rgba(186, 220, 193, 0.86);
  font-size: 12px;
  line-height: 1.7;
}
.choice-forecast {
  margin-top: 10px;
  color: rgba(138, 224, 168, 0.92);
  font-size: 12px;
  line-height: 1.7;
}
.choice-requirements--locked {
  color: rgba(255, 206, 168, 0.84);
}
.choice-source {
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 228, 188, 0.14);
  color: #ffe0b7;
  font-size: 12px;
}
.choice-source--dynamic {
  background: rgba(131, 190, 142, 0.16);
  color: #d7f3dc;
}
.custom-box { margin-top: 16px; padding: 18px; border-radius: 22px; background: rgba(255,247,229,.04); }
.custom-actions { align-items: center; margin-top: 12px; }
.custom-tip { max-width: 74%; }
.hint-zone, .status-zone { display: none; }
.overlay-mask {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  padding-bottom: calc(24px + var(--safe-bottom, 0px));
  background: rgba(8,8,10,.72);
  backdrop-filter: blur(8px);
}
.overlay-mask--dialog {
  z-index: 70;
}
.overlay-panel {
  width: 100%;
  max-width: 920px;
  max-height: calc(100vh - 48px);
  max-height: calc(var(--app-height, 100vh) - 48px);
  overflow: auto;
  border-radius: 28px;
  border: 1px solid rgba(255,223,188,.14);
  background: linear-gradient(180deg, rgba(22,16,15,.98), rgba(18,14,16,.98));
  box-shadow: 0 32px 90px rgba(0,0,0,.32);
  padding: 20px;
}
.overlay-panel--dialog {
  max-width: 520px;
}
.native-auth-input--dialog {
  margin-top: 16px;
}
.status-tip--danger {
  color: #f2a3a3;
}
.overlay-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 14px; }
.overlay-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.overlay-content {
  gap: 10px;
}
.overlay-card {
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid rgba(255,223,190,.08);
  background:
    linear-gradient(180deg, rgba(255,247,229,.05), rgba(255,247,229,.025)),
    rgba(255,247,229,.025);
}
.overlay-card .panel-title--small {
  font-size: 16px;
}
.overlay-card .panel-text,
.overlay-card .status-tip,
.overlay-card .thread-row {
  font-size: 13px;
  line-height: 1.68;
}
.overlay-card .panel-text {
  color: #d4c0a5;
}
.text-route {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  padding: 12px 14px;
  text-align: left;
  font-size: 13px;
  line-height: 1.62;
  background:
    linear-gradient(180deg, rgba(255,247,229,.07), rgba(255,247,229,.03)),
    rgba(255,247,229,.03);
}
.ability-zone {
  height: 100%;
}
.ability-card {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 18px 18px 16px;
}
.ability-collapse {
  flex: 0 0 auto;
}
.ability-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}
.ability-tab {
  border: 1px solid rgba(255,223,190,.12);
  border-radius: 16px;
  padding: 10px 12px;
  background:
    linear-gradient(180deg, rgba(255,247,229,.07), rgba(255,247,229,.03)),
    rgba(255,247,229,.03);
  color: #f5e8d8;
  cursor: pointer;
  transition: border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .18s ease;
}
.ability-tab:hover {
  transform: translateY(-1px);
  border-color: rgba(236,187,129,.28);
  box-shadow: 0 10px 22px rgba(0,0,0,.12);
}
.ability-tab.active {
  border-color: rgba(236,187,129,.4);
  background: rgba(236,187,129,.12);
}
.metric-list {
  flex: 1;
  min-height: 0;
  gap: 10px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(214,162,104,.6) rgba(255,255,255,.04);
}
.metric-item,
.ability-panel {
  padding: 12px 14px;
}
.ability-collapsed-note {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255,247,229,.04);
  color: #d7c1a4;
}
@keyframes storyPulse {
  0%, 100% { opacity: .35; transform: scale(.9); }
  50% { opacity: 1; transform: scale(1.08); }
}
@keyframes planningGlow {
  0% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes choiceCaretBlink {
  0%, 100% { opacity: .15; }
  50% { opacity: 1; }
}
.choice-grid--desktop-text {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.choice-grid--setup {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.choice-card--setup {
  min-height: 158px;
  padding: 18px 18px 20px;
  border-radius: 22px;
  border: 1px solid rgba(255,223,190,.14);
  background:
    radial-gradient(circle at top right, rgba(236,187,129,.12), transparent 36%),
    linear-gradient(180deg, rgba(44,31,26,.96), rgba(24,18,16,.96));
  box-shadow:
    inset 0 1px 0 rgba(255,247,229,.04),
    0 18px 36px rgba(0,0,0,.16);
}
.choice-card--setup .choice-hint {
  margin-top: 12px;
  line-height: 1.8;
}
.choice-card--textbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 14px 18px;
  border: 0;
  border-radius: 0;
  background: #151515;
}
.choice-card--textbar:hover {
  background: #242424;
  transform: none;
  box-shadow: none;
  filter: none;
}
.choice-card--textbar:hover .choice-name,
.choice-card--textbar:hover .choice-source,
.choice-card--textbar:hover .choice-category {
  color: var(--text-gold);
}
.choice-card--textbar:hover .choice-name::before {
  content: '■';
  display: inline-block;
  margin-right: 10px;
  color: var(--text-gold);
  animation: choiceCaretBlink .7s steps(1) infinite;
}
.choice-bar-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.choice-bar-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  color: var(--text-dim);
  font-size: 12px;
}
.choice-cost-line {
  color: var(--text-danger);
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  font-family: Consolas, 'Courier New', monospace;
}
.choice-cost-line::before {
  content: '......';
  color: rgba(115, 115, 115, 0.7);
  margin-right: 10px;
}
.side-dashboard {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 0 0 24px;
  background: transparent;
}
.side-dashboard__hero,
.side-dashboard__group {
  padding: 18px;
  border-radius: 24px;
  border: 1px solid rgba(255,223,190,.1);
  background:
    radial-gradient(circle at top right, rgba(236,187,129,.12), transparent 38%),
    linear-gradient(180deg, rgba(23,18,17,.96), rgba(16,13,14,.94));
  box-shadow:
    inset 0 1px 0 rgba(255,247,229,.04),
    0 20px 40px rgba(0,0,0,.14);
}
.side-dashboard__hero {
  gap: 14px;
}
.side-dashboard__hero-title {
  margin-top: 6px;
  color: #fff0dc;
  font-size: 24px;
  font-weight: 600;
}
.side-dashboard__hero-text {
  margin-top: 10px;
  color: #d8c2a6;
  line-height: 1.8;
}
.side-dashboard__hero-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.side-dashboard__hero-badges span {
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(255,247,229,.08);
  color: #f0d8ba;
  font-size: 12px;
}
.side-dashboard__group + .side-dashboard__group {
  margin-top: 0;
}
.side-dashboard__group--industry {
  margin-top: 0;
}
.side-dashboard__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.side-dashboard__title {
  margin-bottom: 0;
  color: #fff0dc;
  font-size: 14px;
  letter-spacing: 0.12em;
}
.side-dashboard__group-count {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,247,229,.08);
  color: #d5bb9d;
  font-size: 11px;
  letter-spacing: .08em;
}
.side-dashboard__metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}
.side-dashboard__metric-card {
  padding: 14px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255,247,229,.05), rgba(255,247,229,.02)),
    rgba(255,247,229,.025);
  border: 1px solid rgba(255,223,190,.08);
}
.side-dashboard__label {
  color: #cdb395;
  font-size: 12px;
  letter-spacing: .06em;
}
.side-dashboard__metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.side-dashboard__value-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.side-dashboard__value {
  color: #ffd698;
  font-size: 28px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  word-break: break-word;
}
.side-dashboard__delta {
  font-size: 12px;
  font-weight: 700;
  animation: sideDeltaFloat 1.2s ease;
}
.side-dashboard__delta--positive {
  color: #4fb46a;
}
.side-dashboard__delta--negative {
  color: #d06767;
}
.side-dashboard__industry-intro {
  margin-top: 14px;
  color: #d8c2a6;
  line-height: 1.75;
}
.side-dashboard__industry-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}
.side-dashboard__industry-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255,247,229,.04);
  border: 1px solid rgba(255,223,190,.06);
}
.side-dashboard__industry-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.side-dashboard__industry-copy strong {
  color: #f7e7d0;
  font-size: 14px;
}
.side-dashboard__industry-copy span {
  color: #cdb395;
  font-size: 12px;
  line-height: 1.55;
}
.side-dashboard__industry-value {
  min-width: 52px;
  text-align: right;
  color: #ffd698;
  font-size: 24px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.mobile-status-strip {
  display: none;
}
.glossary-sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-end;
}
.glossary-sheet {
  width: 100%;
  min-height: 44vh;
  padding: 22px 20px 26px;
  background: #050505;
  color: var(--text-main);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.glossary-sheet__close {
  float: right;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-main);
  font-size: 14px;
}
.glossary-sheet__title {
  margin-bottom: 14px;
  font-size: 24px;
  color: #ffffff;
}
.glossary-sheet__body {
  clear: both;
  color: var(--text-dim);
  font-size: 15px;
  line-height: 1.8;
}
@keyframes sideDeltaFloat {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }
  20% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 1;
    transform: translateY(-2px);
  }
}
@media (max-width: 1280px) {
  .main-grid, .story-dashboard { grid-template-columns: 1fr; }
  .auth-entry-grid { grid-template-columns: 1fr; }
  .direction-board,
  .status-overview-strip,
  .story-status-grid, .choice-grid, .ending-grid, .retinue-overview__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .retinue-overview__split { grid-template-columns: 1fr; }
  .battle-stage__overview,
  .battle-stage__body {
    grid-template-columns: 1fr;
  }
  .battle-command-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .story-tools {
    position: static;
  }
}
@media (max-width: 820px) {
  .chronicle-page {
    min-height: var(--app-height, 100vh);
    background: #121212;
    padding:
      calc(14px + var(--safe-top, 0px))
      calc(14px + var(--safe-right, 0px))
      calc(128px + var(--safe-bottom, 0px))
      calc(14px + var(--safe-left, 0px));
  }
  .access-strip,
  .turn-overview,
  .mobile-stage-switch {
    display: none;
  }
  .title-zone {
    display: flex;
  }
  .mobile-status-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    align-items: center;
    min-height: 10vh;
    margin-bottom: 10px;
    color: var(--text-main);
    font-family: Consolas, 'Courier New', monospace;
    font-variant-numeric: tabular-nums;
  }
  .mobile-quick-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .mobile-status-strip__item {
    display: flex;
    justify-content: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-dim);
  }
  .mobile-status-strip__item strong {
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
  }
  .mobile-stage-switch {
    display: block;
    position: sticky;
    top: calc(10px + var(--safe-top, 0px));
    z-index: 6;
    backdrop-filter: blur(12px);
  }
  .mobile-bottom-dock {
    display: grid;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 0;
    border: 0;
    background: #0a0a0a;
    box-shadow: none;
    padding: 0;
    min-height: 10vh;
  }
  .card,
  .title-zone,
  .story-zone,
  .operation-zone,
  .ability-card,
  .auth-entry,
  .overlay-panel {
    border-radius: 22px;
  }
  .title-zone,
  .story-zone,
  .operation-zone,
  .ability-card,
  .mobile-starter,
  .auth-entry {
    padding: 18px;
  }
  .title-zone, .custom-actions, .overlay-head { flex-direction: column; }
  .title-tools, .custom-tip { max-width: none; }
  .access-strip,
  .auth-actions,
  .title-utility,
  .title-utility-row {
    width: 100%;
  }
  .access-strip,
  .access-strip__main,
  .access-strip__status,
  .access-strip__actions,
  .purchase-group,
  .auth-benefit,
  .title-utility {
    flex-direction: column;
  }
  .access-strip__main,
  .access-strip__status,
  .access-strip__actions,
  .purchase-group,
  .title-utility-row {
    justify-content: flex-start;
  }
  .purchase-methods {
    position: relative;
    top: auto;
    left: auto;
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
  .purchase-methods::before {
    display: none;
  }
  .purchase-methods--title-donation {
    right: auto;
    min-width: 0;
    max-width: none;
  }
  .donation-guide {
    max-height: 70vh;
  }
  .donation-guide__qr-grid {
    grid-template-columns: 1fr;
  }
  .donation-guide__qr-frame {
    min-height: 190px;
  }
  .donation-guide__qr-image {
    width: 100%;
    max-width: 190px;
  }
  .donation-panel__head {
    align-items: stretch;
    flex-direction: column;
  }
  .donation-panel__guide-trigger {
    width: 100%;
    justify-content: center;
  }
  .overlay-mask {
    align-items: flex-start;
    overflow-y: auto;
    padding: 12px;
  }
  .overlay-panel {
    max-height: none;
    min-height: calc(var(--app-height, 100vh) - 24px);
    padding: 16px;
  }
  .access-summary-text,
  .access-foot-note {
    max-width: none;
  }
  .mobile-starter__actions {
    grid-template-columns: 1fr;
  }
  .battle-command-grid {
    grid-template-columns: 1fr;
  }
  .turn-overview {
    grid-template-columns: 1fr;
    padding: 16px;
  }
  .turn-overview__title-row {
    align-items: flex-start;
    flex-direction: column;
  }
  .turn-overview__stats {
    display: grid;
    grid-template-columns: 1fr;
    overflow: visible;
    padding-bottom: 0;
  }
  .turn-overview__stat {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    grid-template-areas:
      'label value'
      'label tip';
    gap: 4px 12px;
    align-items: start;
    min-height: 0;
  }
  .turn-overview__stat span { grid-area: label; align-self: center; }
  .turn-overview__stat strong {
    grid-area: value;
    font-size: 17px;
    line-height: 1.42;
  }
  .turn-overview__stat small { grid-area: tip; }
  .self-pinned-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .footing-self__grid {
    grid-template-columns: 1fr;
  }
  .direction-board,
  .story-briefing,
  .story-status-grid, .choice-grid, .overlay-grid, .ending-grid, .retinue-overview__grid { grid-template-columns: 1fr; }
  .choice-grid--setup {
    grid-template-columns: 1fr;
  }
  .direction-board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .direction-board--mobile {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    top: calc(68px + var(--safe-top, 0px));
  }
  .mobile-choice-tabs--dynamic {
    position: sticky;
    top: calc(68px + var(--safe-top, 0px));
    z-index: 4;
    padding: 10px;
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(24,18,16,.96), rgba(24,18,16,.92)),
      rgba(24,18,16,.94);
    border: 1px solid rgba(255,223,190,.12);
    box-shadow:
      inset 0 1px 0 rgba(255,247,229,.04),
      0 14px 28px rgba(0,0,0,.16);
    backdrop-filter: blur(10px);
  }
  .direction-card--mobile .direction-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .direction-card--mobile .direction-name {
    font-size: 15px;
  }
  .direction-card--mobile .direction-count {
    padding: 3px 8px;
    font-size: 11px;
  }
  .story-briefing__tabs {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .mobile-choice-tab {
    min-height: 48px;
    padding: 9px 10px;
  }
  .mobile-choice-tab span {
    font-size: 13px;
  }
  .mobile-choice-tab small {
    font-size: 10px;
  }
  .story-briefing__card {
    min-height: auto;
    padding: 12px 14px;
  }
  .story-scroll {
    order: 3;
    min-height: calc(100vh - 230px);
    height: auto;
    max-height: none;
    cursor: auto;
  }
  .story-timehead {
    font-size: 22px;
  }
  .story-body--enhanced {
    font-size: 17px;
    line-height: 1.78;
  }
  .mobile-story-actions {
    display: block;
    order: 5;
    margin-top: 16px;
  }
  .title-copy h1 { font-size: 34px; }
  .title-desc {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .title-tags {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
  }
  .title-tags span {
    flex: 0 0 auto;
  }
  .choice-group-head { align-items: flex-start; flex-direction: column; }
  .status-panel-toggle,
  .turn-processing-banner__head {
    align-items: flex-start;
  }
  .status-panel-toggle__head {
    flex-wrap: wrap;
  }
  .self-section-tabs {
    position: static;
    top: auto;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 0;
    background: none;
  }
  .status-detail-row {
    grid-template-columns: 1fr;
  }
  .status-detail-values {
    align-items: flex-start;
    text-align: left;
  }
  .battle-round-card__head {
    align-items: flex-start;
    flex-direction: column;
  }
  .story-tools {
    position: static;
    order: 4;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: visible;
    margin-top: 12px;
    padding: 10px;
  }
  .story-tool {
    min-width: 0;
    width: 100%;
    min-height: 48px;
  }
  .tool-button,
  .story-briefing__tab,
  .story-tools-toggle,
  .direction-card,
  .choice-card,
  .mobile-bottom-dock__item,
  .intel-tab,
  .native-auth-input {
    min-height: 48px;
  }
  .choice-card,
  .battle-command-button {
    min-height: 120px;
  }
  .intel-tabs {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    overflow: visible;
    padding-bottom: 0;
  }
  .intel-tabs--mobile-text {
    display: flex;
    gap: 12px;
    justify-content: space-between;
  }
  .intel-tabs--mobile-text .intel-tab {
    padding: 0 0 8px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #5f5f5f;
    font-size: 16px;
  }
  .intel-tabs--mobile-text .intel-tab.active {
    color: #ffffff;
    font-size: 18px;
    font-weight: 700;
    border-bottom: 2px solid var(--text-gold);
  }
  .intel-card--self-summary {
    position: static;
  }
  .mobile-self-toggle {
    margin-top: 0;
  }
  .self-section-tab {
    width: 100%;
    min-height: 46px;
    border-radius: 14px;
  }
  .story-briefing--mobile {
    margin-top: 12px;
  }
  .story-briefing__tabs {
    gap: 8px;
  }
  .auth-entry-card--guide .auth-benefit-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .auth-entry-card--guide .auth-benefit {
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    min-height: 96px;
  }
  .mobile-starter {
    padding: 16px;
  }
  .fixed-mobile-section-tabs {
    top: calc(138px + var(--safe-top, 0px));
  }
  .fixed-group-block .choice-grid--expanded {
    gap: 10px;
  }
  .choice-card--fixed-mobile,
  .choice-card--fixed-mobile-shell {
    min-height: 0;
    padding: 12px 13px;
    border-radius: 18px;
  }
  .choice-card--fixed-mobile-shell {
    gap: 8px;
  }
  .choice-action-button--fixed-mobile {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .choice-card--fixed-mobile .choice-top,
  .choice-card--fixed-mobile-shell .choice-top {
    align-items: flex-start;
    gap: 8px;
  }
  .choice-card--fixed-mobile .choice-name,
  .choice-card--fixed-mobile-shell .choice-name {
    font-size: 15px;
    line-height: 1.48;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .choice-card--fixed-mobile .choice-tags,
  .choice-card--fixed-mobile-shell .choice-tags {
    gap: 6px;
  }
  .choice-card--fixed-mobile .choice-hint,
  .choice-card--fixed-mobile-shell .choice-hint {
    margin-top: 0;
    font-size: 12px;
    line-height: 1.62;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .choice-card--fixed-mobile .choice-forecast,
  .choice-card--fixed-mobile-shell .choice-forecast {
    display: none;
  }
  .choice-card--fixed-mobile .choice-requirements,
  .choice-card--fixed-mobile-shell .choice-requirements {
    margin-top: 0;
    font-size: 11px;
    line-height: 1.55;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
  }
  .choice-select--fixed-mobile .el-input__inner {
    height: 36px;
    line-height: 36px;
    border-radius: 12px;
    font-size: 13px;
  }
  .fixed-quick-strip {
    grid-template-columns: 1fr;
  }
  .fixed-quick-chip {
    min-height: 60px;
    padding: 11px 12px;
  }
  .fixed-quick-chip__summary {
    display: none;
  }
  .side-dashboard__metric-grid {
    grid-template-columns: 1fr;
  }
  .mobile-bottom-dock__item {
    min-height: 100%;
    border-radius: 0;
    padding: 10px 4px 12px;
    color: #5f5f5f;
  }
  .mobile-bottom-dock__item span {
    font-size: 18px;
    font-weight: 500;
  }
  .mobile-bottom-dock__item small {
    display: none;
  }
  .mobile-bottom-dock__item.active {
    background: transparent;
    border: 0;
    color: #ffffff;
    box-shadow: none;
  }
  .mobile-bottom-dock__item.active span {
    font-weight: 700;
    font-size: 20px;
    position: relative;
  }
  .mobile-bottom-dock__item.active span::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -8px;
    height: 2px;
    background: var(--text-gold);
  }
}
@media (max-width: 640px) {
  .chronicle-page {
    padding:
      calc(10px + var(--safe-top, 0px))
      calc(10px + var(--safe-right, 0px))
      calc(132px + var(--safe-bottom, 0px))
      calc(10px + var(--safe-left, 0px));
  }
  .mobile-stage-switch {
    top: 8px;
    padding: 12px;
  }
  .mobile-stage-switch__tabs {
    grid-template-columns: 1fr;
  }
  .mobile-stage-switch__notes {
    display: none;
  }
  .story-briefing__tabs {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .mobile-choice-tabs--dynamic {
    top: calc(64px + var(--safe-top, 0px));
    padding: 8px;
  }
  .title-zone,
  .story-zone,
  .operation-zone,
  .ability-card,
  .auth-entry {
    padding: 16px;
  }
  .title-copy h1 {
    font-size: 28px;
    letter-spacing: 1px;
  }
  .title-utility-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .title-tags,
  .status-notes,
  .status-overview-lines {
    gap: 8px;
  }
  .title-tags span,
  .status-notes span,
  .choice-category,
  .access-chip,
  .choice-source {
    padding: 6px 10px;
    font-size: 11px;
  }
  .donation-panel__channel-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .turn-overview__stat {
    grid-template-columns: 52px minmax(0, 1fr);
  }
  .turn-overview__stat,
  .story-briefing__card,
  .overlay-card {
    padding: 12px 13px;
  }
  .story-body {
    font-size: 15px;
    line-height: 1.88;
  }
  .story-scroll {
    min-height: 180px;
    max-height: 38vh;
    max-height: 38dvh;
  }
  .story-tools,
  .custom-box,
  .story-archive {
    padding: 12px;
  }
  .story-tool,
  .purchase-group > .tool-button,
  .auth-actions > .tool-button,
  .custom-actions > .tool-button {
    width: 100%;
    justify-content: center;
  }
  .story-tool {
    flex-basis: auto;
  }
  .story-tools {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .story-tools-toggle {
    margin-top: 12px;
  }
  .direction-board,
  .status-overview-strip {
    grid-template-columns: 1fr;
  }
  .direction-board--mobile {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    top: calc(64px + var(--safe-top, 0px));
    padding: 8px;
  }
  .fixed-mobile-section-tabs {
    top: calc(128px + var(--safe-top, 0px));
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 8px;
  }
  .direction-card--mobile {
    min-height: 54px;
    padding: 9px 8px;
  }
  .direction-card--mobile .direction-name {
    font-size: 14px;
  }
  .direction-card--mobile .direction-count {
    min-width: 0;
    padding: 2px 7px;
    font-size: 10px;
  }
  .mobile-choice-tab--fixed {
    min-height: 44px;
    padding: 8px 9px;
  }
  .fixed-group-block {
    gap: 8px;
  }
  .fixed-group-summary {
    font-size: 12px;
    line-height: 1.6;
  }
  .choice-card--fixed-mobile,
  .choice-card--fixed-mobile-shell {
    padding: 10px 11px;
    border-radius: 16px;
  }
  .choice-card--fixed-mobile .choice-top,
  .choice-card--fixed-mobile-shell .choice-top {
    flex-direction: column;
    gap: 6px;
  }
  .choice-card--fixed-mobile .choice-name,
  .choice-card--fixed-mobile-shell .choice-name {
    font-size: 14px;
    line-height: 1.44;
  }
  .choice-card--fixed-mobile .choice-hint,
  .choice-card--fixed-mobile-shell .choice-hint {
    font-size: 11px;
    line-height: 1.55;
    -webkit-line-clamp: 1;
  }
  .choice-card--fixed-mobile .choice-requirements,
  .choice-card--fixed-mobile-shell .choice-requirements {
    font-size: 10px;
  }
  .choice-select--fixed-mobile .el-input__inner {
    height: 34px;
    line-height: 34px;
    padding: 0 11px;
    font-size: 12px;
  }
  .custom-tip,
  .access-summary-text,
  .access-foot-note {
    font-size: 11px;
    line-height: 1.65;
  }
  .choice-tags {
    justify-content: flex-start;
  }
  .overlay-mask {
    padding: 8px;
  }
  .overlay-panel {
    min-height: calc(var(--app-height, 100vh) - 16px);
    padding: 14px;
  }
  .mobile-bottom-dock {
    left: 8px;
    right: 8px;
    bottom: calc(8px + env(safe-area-inset-bottom, 0px));
    padding: 8px;
  }
  .mobile-bottom-dock__item {
    min-height: 58px;
    padding: 10px 6px;
  }
  .intel-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .self-section-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .story-briefing__tab {
    min-height: 44px;
    padding: 9px 10px;
    align-items: center;
    text-align: center;
  }
  .story-briefing__tab small {
    display: none;
  }
  .self-pinned-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .self-pinned-item {
    min-height: 88px;
  }
  .auth-entry-card--guide .auth-benefit-list {
    grid-template-columns: 1fr;
  }
  .auth-entry-card--guide .auth-benefit {
    min-height: 0;
  }
}

/* Immersive UI refresh: presentation only, no logic changes */
.chronicle-page {
  --bg-main: #120f0d;
  --bg-panel: rgba(26, 19, 17, 0.94);
  --bg-panel-soft: rgba(35, 27, 24, 0.88);
  --bg-panel-elevated: rgba(43, 31, 27, 0.94);
  --surface-story: linear-gradient(180deg, rgba(48, 36, 30, 0.94), rgba(24, 18, 17, 0.98));
  --surface-command: linear-gradient(180deg, rgba(34, 25, 22, 0.96), rgba(18, 14, 14, 0.98));
  --surface-intel: linear-gradient(180deg, rgba(25, 20, 22, 0.96), rgba(15, 12, 15, 0.98));
  --surface-frost: linear-gradient(180deg, rgba(255, 244, 227, 0.08), rgba(255, 244, 227, 0.03));
  --surface-highlight: linear-gradient(135deg, rgba(208, 157, 92, 0.16), rgba(208, 157, 92, 0));
  --text-main: #f4eadb;
  --text-dim: #b79f82;
  --text-muted: #8e7862;
  --text-gold: #dcb472;
  --text-green: #8cc59d;
  --text-danger: #e59b8d;
  --line-subtle: rgba(219, 184, 133, 0.14);
  --line-strong: rgba(224, 189, 137, 0.22);
  --shadow-soft: 0 20px 42px rgba(0, 0, 0, 0.18);
  --shadow-heavy: 0 30px 64px rgba(0, 0, 0, 0.24);
  --radius-shell: 32px;
  --radius-panel: 28px;
  --radius-card: 22px;
  background:
    radial-gradient(circle at top center, rgba(141, 86, 43, 0.22), transparent 24%),
    radial-gradient(circle at 12% 18%, rgba(198, 148, 80, 0.12), transparent 26%),
    radial-gradient(circle at 88% 10%, rgba(82, 115, 88, 0.08), transparent 20%),
    linear-gradient(180deg, #201714 0%, #130f0d 42%, #0c0a0a 100%);
}

.chronicle-page::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.015) 0, rgba(255, 255, 255, 0) 32%, rgba(255, 255, 255, 0.015) 100%),
    radial-gradient(circle at center, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.26) 80%);
  opacity: 0.75;
  z-index: 0;
}

.page-shell {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line-subtle);
  border-radius: var(--radius-panel);
  background: var(--bg-panel);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(18px);
}

.card::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(255, 248, 235, 0.08), rgba(255, 248, 235, 0.02) 18%, transparent 42%),
    linear-gradient(135deg, rgba(221, 174, 103, 0.08), transparent 38%);
  opacity: 0.9;
}

.title-zone,
.story-zone,
.operation-zone,
.ability-card,
.auth-entry,
.mobile-starter,
.mobile-quick-actions,
.mobile-stage-switch,
.intel-hub {
  padding: 26px;
}

.title-zone {
  gap: 28px;
  margin-bottom: 0;
  border-color: rgba(229, 194, 145, 0.18);
  background:
    radial-gradient(circle at 80% 16%, rgba(201, 155, 88, 0.16), transparent 24%),
    radial-gradient(circle at 12% 0%, rgba(255, 241, 219, 0.08), transparent 26%),
    linear-gradient(120deg, rgba(47, 34, 29, 0.94), rgba(24, 18, 16, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255, 245, 230, 0.06),
    0 24px 50px rgba(0, 0, 0, 0.22);
}

.title-zone::after {
  display: block;
  top: auto;
  right: 36px;
  bottom: -74px;
  width: 220px;
  height: 220px;
  background: radial-gradient(circle, rgba(214, 171, 107, 0.24), transparent 68%);
  filter: blur(12px);
}

.title-copy {
  flex: 1 1 auto;
  max-width: 840px;
}

.title-chapter-strip {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  color: #d8bea0;
}

.title-chapter-strip__label {
  flex: 0 0 auto;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid rgba(219, 184, 133, 0.16);
  background: rgba(255, 244, 227, 0.04);
  font-size: 11px;
  letter-spacing: 0.22em;
}

.title-chapter-strip__line {
  width: 56px;
  height: 1px;
  background: linear-gradient(90deg, rgba(224, 189, 137, 0.7), rgba(224, 189, 137, 0));
}

.title-chapter-strip__text {
  font-size: 13px;
  letter-spacing: 0.08em;
}

.eyebrow,
.section-kicker {
  color: #cfb48c;
  letter-spacing: 0.32em;
}

.title-copy h1 {
  margin: 12px 0 14px;
  font-size: clamp(38px, 4vw, 56px);
  line-height: 1.08;
  letter-spacing: 0.08em;
  color: #fff4e2;
  text-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
}

.title-desc,
.story-meta,
.panel-text,
.status-tip,
.choice-hint,
.custom-tip,
.metric-foot {
  color: var(--text-dim);
}

.title-desc {
  max-width: 64ch;
  font-size: 15px;
  line-height: 1.92;
}

.title-tags,
.status-notes {
  gap: 10px;
}

.title-tags span,
.status-notes span,
.choice-category {
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(219, 184, 133, 0.14);
  background: rgba(255, 244, 227, 0.04);
  color: #e6d1af;
}

.title-tools {
  width: 100%;
  max-width: 360px;
}

.title-utility {
  gap: 12px;
}

.access-strip {
  margin-bottom: 0;
  padding: 18px 20px;
  border: 1px solid rgba(219, 184, 133, 0.16);
  border-radius: 24px;
  background:
    radial-gradient(circle at left top, rgba(219, 184, 133, 0.12), transparent 24%),
    linear-gradient(135deg, rgba(55, 38, 31, 0.94), rgba(22, 18, 17, 0.96));
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.06),
    0 18px 34px rgba(0, 0, 0, 0.18);
}

.access-strip--guest {
  background:
    radial-gradient(circle at left top, rgba(162, 126, 88, 0.1), transparent 24%),
    linear-gradient(135deg, rgba(46, 36, 31, 0.94), rgba(20, 18, 17, 0.96));
}

.access-chip {
  padding: 7px 12px;
  border-color: rgba(224, 189, 137, 0.16);
  background: rgba(255, 244, 227, 0.05);
  color: #f1ddbe;
}

.access-chip--emphasis {
  background: linear-gradient(180deg, rgba(213, 164, 96, 0.26), rgba(146, 93, 45, 0.18));
  border-color: rgba(224, 189, 137, 0.28);
}

.access-chip--month-idle,
.auth-benefit {
  background: rgba(255, 244, 227, 0.05);
  border-color: rgba(224, 189, 137, 0.12);
}

.purchase-methods {
  border-radius: 20px;
}

.auth-entry {
  margin-bottom: 0;
  background:
    radial-gradient(circle at 90% 16%, rgba(206, 162, 97, 0.14), transparent 26%),
    linear-gradient(180deg, rgba(31, 24, 22, 0.96), rgba(19, 15, 15, 0.98));
}

.auth-entry-card {
  border-radius: 24px;
  border-color: rgba(224, 189, 137, 0.12);
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.06), rgba(255, 244, 227, 0.025)),
    rgba(34, 26, 24, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 244, 227, 0.05);
}

.main-grid {
  gap: 24px;
  grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.9fr);
}

.primary-column,
.ability-zone,
.metric-list,
.overlay-content {
  gap: 18px;
}

.turn-overview {
  gap: 22px;
  margin-bottom: 0;
  padding: 24px 26px;
  border: 1px solid rgba(219, 184, 133, 0.16);
  border-radius: 30px;
  background:
    radial-gradient(circle at top right, rgba(216, 173, 105, 0.18), transparent 28%),
    radial-gradient(circle at left bottom, rgba(255, 243, 221, 0.06), transparent 30%),
    linear-gradient(145deg, rgba(44, 33, 28, 0.96), rgba(20, 16, 16, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.05),
    0 22px 40px rgba(0, 0, 0, 0.2);
}

.turn-overview__hero {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(220px, 0.7fr);
  gap: 18px;
  align-items: stretch;
}

.turn-overview__hero-main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.turn-overview__hero-side {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.turn-overview__marker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(219, 184, 133, 0.12);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.05), rgba(255, 244, 227, 0.02)),
    rgba(255, 244, 227, 0.02);
}

.turn-overview__marker span {
  color: #bda688;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.turn-overview__marker strong {
  color: #fff0dc;
  font-size: 14px;
  line-height: 1.45;
  text-align: right;
}

.turn-overview__oracle {
  margin-top: 12px;
  padding-left: 14px;
  border-left: 2px solid rgba(214, 171, 107, 0.5);
  color: #dcc4a3;
  font-size: 13px;
  line-height: 1.8;
}

.turn-overview__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  align-items: stretch;
}

.turn-overview__stat {
  min-width: 0;
  padding: 16px 16px 14px;
  border-radius: 20px;
  border: 1px solid rgba(219, 184, 133, 0.12);
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.06), rgba(255, 244, 227, 0.02)),
    rgba(255, 244, 227, 0.02);
  box-shadow: inset 0 1px 0 rgba(255, 244, 227, 0.04);
}

.turn-overview__stat-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.turn-overview__stat span {
  color: #d7c1a2;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.turn-overview__stat-head small {
  color: #9f8a70;
  font-size: 11px;
  line-height: 1.4;
  text-align: right;
}

.turn-overview__stat strong {
  color: #ffd79a;
  font-size: 24px;
  margin-top: 16px;
  line-height: 1.2;
}

.turn-overview__stat-track {
  position: relative;
  height: 6px;
  margin-top: 14px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 244, 227, 0.08);
}

.turn-overview__stat-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(255, 215, 154, 0.72), rgba(205, 150, 88, 0.96));
}

.turn-overview__stat small {
  color: var(--text-muted);
}

.story-zone {
  background: var(--surface-story);
  border-color: rgba(224, 189, 137, 0.18);
  box-shadow: var(--shadow-heavy);
}

.story-timehead {
  color: #fff1dc;
  font-size: clamp(30px, 2.8vw, 42px);
  letter-spacing: 0.08em;
}

.story-briefing {
  gap: 18px;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
}

.story-briefing__card--mainline,
.story-briefing__card--status {
  min-height: 100%;
}

.story-briefing__summary-strip,
.story-briefing-summary {
  border: 1px solid rgba(224, 189, 137, 0.12);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.06), rgba(255, 244, 227, 0.025)),
    rgba(255, 244, 227, 0.02);
}

.story-briefing__summary-strip {
  margin-top: 12px;
  padding: 14px 16px;
}

.story-briefing-summary {
  margin-top: 16px;
  padding: 18px 20px;
}

.story-briefing__card {
  padding: 18px 20px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(214, 171, 107, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(39, 29, 25, 0.96), rgba(20, 16, 16, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.05),
    0 16px 28px rgba(0, 0, 0, 0.16);
}

.story-briefing__card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.story-briefing__card-badge {
  flex: 0 0 auto;
  min-width: 58px;
  padding: 10px 12px;
  border-radius: 18px;
  border: 1px solid rgba(224, 189, 137, 0.16);
  background: rgba(255, 244, 227, 0.06);
  color: #ffe2b8;
  font-size: 15px;
  font-weight: 700;
  text-align: center;
}

.story-briefing__card-badge--status {
  min-width: 72px;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.story-briefing__hero-copy {
  margin-top: 14px;
  color: #ead8bf;
  font-size: 15px;
  line-height: 1.84;
}

.story-briefing__fact-grid,
.story-briefing__moment-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.story-briefing__fact-card,
.story-briefing__moment-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 13px;
  border: 1px solid rgba(224, 189, 137, 0.1);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.05), rgba(255, 244, 227, 0.02)),
    rgba(255, 244, 227, 0.02);
}

.story-briefing__fact-card span,
.story-briefing__moment-card span {
  color: #bea688;
  font-size: 11px;
  letter-spacing: 0.08em;
}

.story-briefing__fact-card strong,
.story-briefing__moment-card strong {
  color: #fff0dc;
  font-size: 18px;
  line-height: 1.35;
}

.story-briefing__fact-card small,
.story-briefing__moment-card small {
  color: #a99276;
  font-size: 12px;
  line-height: 1.56;
}

.story-briefing__fact-card--pressure strong {
  color: #ffcc9d;
}

.story-briefing__status-ribbon {
  margin-top: 16px;
  padding: 12px 14px;
  border-left: 3px solid rgba(214, 171, 107, 0.64);
  border-radius: 0 18px 18px 0;
  background: rgba(255, 244, 227, 0.04);
  color: #dbc29f;
  font-size: 13px;
  line-height: 1.72;
}

.story-briefing__status-ribbon--status {
  border-left-color: rgba(160, 193, 150, 0.62);
}

.story-briefing__summary-head,
.story-briefing-summary__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.story-briefing__summary-head strong,
.story-briefing-summary__badge {
  color: #fff0dc;
}

.story-briefing__summary-head span,
.story-briefing-summary__badge {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  background: rgba(255, 244, 227, 0.05);
  font-size: 11px;
  letter-spacing: 0.08em;
}

.current-response-note {
  color: #dcc2a0;
}

.story-briefing__tab,
.mobile-choice-tab,
.mobile-stage-switch__tab,
.intel-tab,
.ability-tab,
.self-section-tab {
  border-color: rgba(224, 189, 137, 0.12);
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.07), rgba(255, 244, 227, 0.03)),
    rgba(255, 244, 227, 0.02);
  color: #f7e7d0;
}

.story-briefing__tab.active,
.mobile-choice-tab.active,
.mobile-stage-switch__tab.active,
.intel-tab.active,
.ability-tab.active,
.self-section-tab.active {
  border-color: rgba(224, 189, 137, 0.28);
  background:
    linear-gradient(180deg, rgba(220, 180, 114, 0.18), rgba(255, 244, 227, 0.05)),
    rgba(255, 244, 227, 0.04);
  box-shadow: inset 0 0 0 1px rgba(224, 189, 137, 0.08);
}

.story-panel,
.status-item,
.metric-item,
.ability-panel,
.overlay-card {
  border: 1px solid rgba(224, 189, 137, 0.12);
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.06), rgba(255, 244, 227, 0.025)),
    rgba(255, 244, 227, 0.02);
  box-shadow: inset 0 1px 0 rgba(255, 244, 227, 0.04);
}

.story-panel {
  min-height: clamp(208px, 24vh, 244px);
  max-height: clamp(208px, 24vh, 244px);
}

.story-clue-item,
.status-overview-card,
.status-panel-block,
.food-status-board,
.food-self-card,
.status-detail-row,
.self-pinned-item,
.footing-self__hero,
.footing-self-card,
.ending-card,
.retinue-overview,
.retinue-overview__card,
.battle-log-card,
.battle-command-card,
.battle-side,
.battle-center,
.battle-meter,
.custom-box {
  border-color: rgba(224, 189, 137, 0.12);
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.06), rgba(255, 244, 227, 0.02)),
    rgba(255, 244, 227, 0.02);
}

.story-scroll {
  min-height: 320px;
  padding: 28px 28px 18px;
  border: 1px solid rgba(224, 189, 137, 0.18);
  border-left: 3px solid rgba(212, 151, 78, 0.72);
  border-radius: 26px;
  background:
    radial-gradient(circle at top, rgba(255, 245, 228, 0.05), transparent 28%),
    linear-gradient(180deg, rgba(20, 17, 16, 0.64), rgba(12, 10, 10, 0.78));
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.04),
    inset 0 0 0 1px rgba(255, 244, 227, 0.02);
}

.story-body--enhanced {
  color: #f4eadb;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.14);
}

.story-paragraph {
  position: relative;
  padding-left: 2px;
}

.story-paragraph:first-child::before {
  content: '引';
  position: absolute;
  left: -28px;
  top: 0.1em;
  color: rgba(224, 189, 137, 0.34);
  font-size: 12px;
  letter-spacing: 0.22em;
}

.story-glossary-term {
  border-bottom: 1px dashed rgba(224, 189, 137, 0.42);
  transition: color .18s ease, border-color .18s ease, background .18s ease;
}

.story-glossary-term:hover,
.story-glossary-term:focus {
  color: #ffe3b3;
  border-color: rgba(255, 216, 158, 0.72);
  background: rgba(255, 240, 205, 0.06);
}

.story-tools {
  top: 18px;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(26, 20, 18, 0.92), rgba(18, 15, 15, 0.94)),
    rgba(18, 15, 15, 0.92);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(14px);
}

.story-tool,
.tool-button,
.text-route,
.direction-card,
.fixed-quick-chip,
.choice-card,
.mobile-bottom-dock__item,
.mobile-continue-button {
  border: 1px solid rgba(224, 189, 137, 0.14);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.08), rgba(255, 244, 227, 0.03)),
    rgba(255, 244, 227, 0.02);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.05),
    0 10px 22px rgba(0, 0, 0, 0.12);
  transition:
    transform .22s cubic-bezier(.22, 1, .36, 1),
    border-color .18s ease,
    box-shadow .22s ease,
    background .22s ease,
    filter .18s ease;
}

.tool-button {
  min-height: 44px;
  padding: 10px 16px;
  color: #f3e7d5;
}

.tool-button:hover,
.text-route:hover,
.choice-card:hover,
.direction-card:hover,
.fixed-quick-chip:hover,
.story-tool:hover,
.mobile-bottom-dock__item:hover {
  transform: translateY(-1px);
  border-color: rgba(224, 189, 137, 0.24);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.07),
    0 16px 28px rgba(0, 0, 0, 0.16);
  filter: none;
}

.tool-button:active,
.text-route:active,
.choice-card:active {
  transform: translateY(0);
  box-shadow:
    inset 0 2px 10px rgba(0, 0, 0, 0.18),
    0 8px 18px rgba(0, 0, 0, 0.12);
}

.tool-button--subtle,
.story-tool,
.text-route {
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.05), rgba(255, 244, 227, 0.02)),
    rgba(255, 244, 227, 0.015);
}

.tool-button--accent,
.mobile-continue-button {
  color: #231710;
  border-color: rgba(232, 196, 142, 0.22);
  background:
    linear-gradient(180deg, rgba(244, 216, 170, 0.98), rgba(203, 150, 88, 0.94)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.36), rgba(255, 255, 255, 0));
  box-shadow:
    inset 0 1px 0 rgba(255, 252, 246, 0.72),
    0 18px 30px rgba(109, 66, 28, 0.24);
}

.operation-zone {
  border-top: 0;
  background: var(--surface-command);
  border-color: rgba(224, 189, 137, 0.16);
}

.operation-head-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: 4px 0 2px;
  padding: 14px 16px;
  border: 1px solid rgba(224, 189, 137, 0.14);
  border-radius: 22px;
  background:
    radial-gradient(circle at left center, rgba(214, 171, 107, 0.12), transparent 26%),
    linear-gradient(180deg, rgba(51, 36, 29, 0.92), rgba(24, 18, 17, 0.96));
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.05),
    0 14px 28px rgba(0, 0, 0, 0.14);
  scroll-margin-top: calc(10px + env(safe-area-inset-top, 0px));
}

.operation-head-strip__lead {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.operation-head-strip__badge {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(224, 189, 137, 0.16);
  background: rgba(255, 244, 227, 0.06);
  color: #f6e2c0;
  font-size: 11px;
  letter-spacing: 0.12em;
}

.operation-head-strip__lead strong {
  color: #fff0dc;
  font-size: 16px;
  line-height: 1.5;
}

.operation-head-strip__meta {
  max-width: 46ch;
  color: #d2b99a;
  font-size: 12px;
  line-height: 1.72;
  text-align: right;
}

.choice-stack,
.fixed-group-stack {
  gap: 18px;
}

.choice-group {
  gap: 14px;
}

.choice-group-head__minor {
  flex: 0 0 auto;
  padding: 7px 11px;
  border-radius: 999px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  background: rgba(255, 244, 227, 0.05);
  color: #d8c3a3;
  font-size: 12px;
}

.recommended-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.recommended-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-height: 88px;
  padding: 14px 15px;
  border: 1px solid rgba(224, 189, 137, 0.18);
  border-radius: 20px;
  background:
    radial-gradient(circle at top right, rgba(218, 180, 115, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(61, 42, 31, 0.96), rgba(30, 22, 18, 0.98));
  color: #fff1dd;
  text-align: left;
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}

.recommended-chip:hover {
  transform: translateY(-1px);
  border-color: rgba(224, 189, 137, 0.3);
  box-shadow: 0 16px 28px rgba(0, 0, 0, 0.16);
}

.recommended-chip--disabled {
  opacity: .58;
  cursor: not-allowed;
}

.recommended-chip__label {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.45;
}

.recommended-chip__meta {
  color: #d7c1a2;
  font-size: 12px;
  line-height: 1.65;
}

.direction-board {
  gap: 14px;
}

.fixed-quick-chip,
.direction-card,
.choice-card,
.choice-card--setup {
  border-radius: 22px;
}

.fixed-quick-chip {
  min-height: 76px;
}

.fixed-quick-strip {
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.fixed-quick-chip.active,
.direction-card.active {
  border-color: rgba(224, 189, 137, 0.28);
  background:
    linear-gradient(180deg, rgba(219, 184, 133, 0.18), rgba(255, 244, 227, 0.05)),
    rgba(255, 244, 227, 0.03);
}

.direction-expanded,
.battle-return-card {
  border-radius: 26px;
  border-color: rgba(224, 189, 137, 0.16);
  background:
    linear-gradient(180deg, rgba(219, 184, 133, 0.12), rgba(255, 244, 227, 0.03)),
    rgba(255, 244, 227, 0.03);
}

.choice-card {
  border: 1px solid rgba(224, 189, 137, 0.14);
  background:
    radial-gradient(circle at top right, rgba(219, 184, 133, 0.08), transparent 34%),
    linear-gradient(180deg, rgba(44, 32, 27, 0.94), rgba(24, 18, 17, 0.98));
}

.choice-card::before,
.story-tool::before,
.tool-button::before,
.mobile-bottom-dock__item::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(120deg, transparent 18%, rgba(255, 244, 227, 0.18) 50%, transparent 82%);
  transform: translateX(-120%);
  transition: opacity .18s ease, transform .36s ease;
}

.choice-card:hover::before,
.story-tool:hover::before,
.tool-button:hover::before,
.mobile-bottom-dock__item:hover::before {
  opacity: .7;
  transform: translateX(120%);
}

.choice-card--dynamic {
  border-color: rgba(128, 183, 140, 0.22);
  background:
    radial-gradient(circle at top right, rgba(116, 173, 129, 0.12), transparent 36%),
    linear-gradient(180deg, rgba(34, 42, 34, 0.94), rgba(18, 22, 19, 0.98));
}

.choice-card--textbar {
  border-radius: 22px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  background:
    linear-gradient(180deg, rgba(33, 25, 23, 0.98), rgba(18, 15, 15, 0.98));
}

.choice-card--textbar:hover {
  background:
    linear-gradient(180deg, rgba(44, 34, 31, 0.98), rgba(24, 20, 20, 0.98));
}

.choice-name,
.ability-value {
  font-size: 20px;
  color: #fff0dc;
}

.choice-source {
  border: 1px solid rgba(224, 189, 137, 0.12);
  background: rgba(255, 244, 227, 0.07);
}

.choice-source--dynamic {
  border-color: rgba(140, 196, 152, 0.16);
  background: rgba(123, 176, 135, 0.16);
}

.choice-forecast {
  color: #95d4a6;
}

.choice-requirements {
  color: #bddfbe;
}

.choice-requirements--locked {
  color: #efb7a8;
}

.custom-box {
  border: 1px solid rgba(224, 189, 137, 0.12);
}

.intel-hub,
.side-dashboard {
  background: transparent;
}

.intel-hub {
  border: 1px solid rgba(224, 189, 137, 0.14);
  border-radius: 28px;
  background: var(--surface-intel);
  box-shadow: var(--shadow-heavy);
}

.intel-card {
  padding: 16px 0;
  border-bottom-color: rgba(224, 189, 137, 0.12);
}

.intel-card--self-summary {
  top: -2px;
  margin: -6px -6px 2px;
  padding: 18px;
  border: 1px solid rgba(224, 189, 137, 0.14);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.06), rgba(255, 244, 227, 0.025)),
    rgba(29, 23, 23, 0.94);
  backdrop-filter: blur(16px);
}

.side-dashboard {
  gap: 18px;
  padding: 2px 0 0;
}

.side-dashboard__hero,
.side-dashboard__group {
  border-color: rgba(224, 189, 137, 0.14);
  background:
    radial-gradient(circle at top right, rgba(214, 171, 107, 0.14), transparent 34%),
    linear-gradient(180deg, rgba(27, 21, 22, 0.96), rgba(17, 13, 16, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.05),
    0 18px 34px rgba(0, 0, 0, 0.18);
}

.side-dashboard__hero-title {
  font-size: 28px;
  color: #fff1dd;
}

.side-dashboard__group-count,
.side-dashboard__hero-badges span,
.direction-count,
.direction-expanded-count,
.fixed-quick-chip__count {
  border: 1px solid rgba(224, 189, 137, 0.12);
  background: rgba(255, 244, 227, 0.06);
}

.side-dashboard__metric-card,
.side-dashboard__industry-row {
  border-color: rgba(224, 189, 137, 0.1);
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.05), rgba(255, 244, 227, 0.02)),
    rgba(255, 244, 227, 0.02);
}

.side-dashboard__value,
.side-dashboard__industry-value {
  color: #ffd79a;
}

.mobile-starter,
.mobile-quick-actions,
.mobile-stage-switch {
  border-color: rgba(224, 189, 137, 0.16);
  background:
    radial-gradient(circle at top right, rgba(214, 171, 107, 0.14), transparent 30%),
    linear-gradient(180deg, rgba(42, 31, 27, 0.96), rgba(22, 17, 16, 0.98));
}

.mobile-bottom-dock {
  left: 14px;
  right: 14px;
  bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(25, 19, 18, 0.96), rgba(16, 13, 13, 0.98)),
    rgba(16, 13, 13, 0.96);
  box-shadow: 0 24px 46px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(18px);
}

.mobile-bottom-dock__item {
  min-height: 58px;
  gap: 4px;
  border-radius: 18px;
  color: #d8c2a3;
}

.mobile-bottom-dock__item span {
  font-size: 14px;
}

.mobile-bottom-dock__item small {
  color: var(--text-muted);
}

.mobile-bottom-dock__item.active {
  border-color: rgba(224, 189, 137, 0.2);
  background:
    linear-gradient(180deg, rgba(219, 184, 133, 0.18), rgba(255, 244, 227, 0.04)),
    rgba(255, 244, 227, 0.03);
  color: #fff3e0;
}

.mobile-bottom-dock__item.active span {
  font-weight: 700;
}

.mobile-bottom-dock__item.active span::after {
  display: none;
}

.fixed-command-shell {
  display: grid;
  grid-template-columns: minmax(220px, 248px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.fixed-command-nav {
  position: sticky;
  top: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid rgba(224, 189, 137, 0.14);
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(214, 171, 107, 0.12), transparent 32%),
    linear-gradient(180deg, rgba(33, 25, 22, 0.98), rgba(18, 15, 15, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.05),
    0 16px 32px rgba(0, 0, 0, 0.18);
}

.fixed-command-nav__head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fixed-command-nav__title {
  font-size: 22px;
  font-weight: 700;
  color: #fff1dd;
  letter-spacing: 0.04em;
}

.fixed-command-nav__summary {
  color: #d6bea0;
  font-size: 13px;
  line-height: 1.75;
}

.fixed-command-shell .direction-board {
  grid-template-columns: 1fr;
  gap: 10px;
}

.fixed-command-shell .direction-card {
  min-height: 0;
  padding: 14px 15px;
  border-radius: 20px;
}

.fixed-command-shell .direction-card.active {
  box-shadow:
    inset 0 0 0 1px rgba(224, 189, 137, 0.12),
    0 14px 26px rgba(0, 0, 0, 0.16);
}

.fixed-command-shell .direction-name {
  font-size: 17px;
}

.fixed-command-shell .direction-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.65;
}

.fixed-command-shell .direction-expanded {
  min-height: 100%;
  padding: 20px;
}

.fixed-command-shell .direction-expanded-head {
  align-items: center;
}

.fixed-command-shell .fixed-quick-strip {
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  margin-top: 14px;
}

.fixed-command-shell .fixed-quick-chip {
  min-height: 64px;
  padding: 12px 13px;
  border-radius: 18px;
}

.fixed-command-shell .fixed-group-stack {
  margin-top: 16px;
  gap: 14px;
}

.fixed-command-shell .fixed-group-block {
  padding: 16px 0 0;
}

.fixed-command-shell .fixed-group-head {
  align-items: flex-start;
}

.fixed-command-shell .choice-grid--expanded {
  grid-template-columns: 1fr;
  gap: 12px;
}

.fixed-command-shell .choice-card,
.fixed-command-shell .choice-card--relation {
  min-height: 0;
}

.choice-card--action-rail,
.fixed-command-shell .choice-card--relation {
  border-radius: 24px;
  padding: 16px 18px;
}

.choice-card--action-rail .choice-top,
.fixed-command-shell .choice-card--relation .choice-top {
  align-items: flex-start;
}

.choice-card--action-rail .choice-name,
.fixed-command-shell .choice-card--relation .choice-name {
  font-size: 18px;
}

.choice-card--action-rail .choice-hint,
.fixed-command-shell .choice-card--relation .choice-hint {
  margin-top: 8px;
  color: #e0c9ab;
  line-height: 1.78;
}

.choice-card--action-rail .choice-forecast,
.choice-card--action-rail .choice-requirements,
.fixed-command-shell .choice-card--relation .choice-forecast,
.fixed-command-shell .choice-card--relation .choice-requirements {
  margin-top: 8px;
}

.choice-select-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 6px;
}

.choice-select-label {
  color: #d3ba99;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.fixed-command-shell .choice-select {
  padding: 12px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.05), rgba(255, 244, 227, 0.02)),
    rgba(255, 244, 227, 0.02);
}

.fixed-command-shell--mobile {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fixed-command-shell--mobile .fixed-command-nav {
  position: static;
  padding: 14px;
  border-radius: 22px;
}

.fixed-command-shell--mobile .fixed-command-nav__title {
  font-size: 18px;
}

.fixed-command-shell--mobile .direction-board {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.fixed-command-shell--mobile .direction-card {
  padding: 10px 9px;
  border-radius: 16px;
}

.fixed-command-shell--mobile .direction-card .direction-top {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.fixed-command-shell--mobile .direction-card .direction-name {
  font-size: 15px;
}

.fixed-command-shell--mobile .direction-expanded {
  padding: 16px;
  border-radius: 22px;
}

.fixed-command-shell--mobile .fixed-quick-strip {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.fixed-command-shell--mobile .choice-card--fixed-mobile,
.fixed-command-shell--mobile .choice-card--fixed-mobile-shell {
  padding: 14px;
  border-radius: 20px;
}

.fixed-command-shell--mobile .choice-card--fixed-mobile .choice-name,
.fixed-command-shell--mobile .choice-card--fixed-mobile-shell .choice-name {
  font-size: 17px;
}

.fixed-command-shell--mobile .choice-select-wrap {
  padding-top: 2px;
}

:global(html.chronicle-interaction-pulse) .chronicle-page::after {
  content: none;
}

@keyframes chroniclePulseFade {
  from { opacity: 1; }
  to { opacity: 0; }
}

@media (max-width: 1280px) {
  .main-grid {
    gap: 20px;
  }

  .side-dashboard {
    padding-top: 0;
  }
}

@media (max-width: 820px) {
  .chronicle-page {
    background:
      radial-gradient(circle at top center, rgba(141, 86, 43, 0.18), transparent 22%),
      linear-gradient(180deg, #1a1412 0%, #0d0b0b 100%);
  }

  .page-shell {
    gap: 14px;
  }

  .card,
  .title-zone,
  .story-zone,
  .operation-zone,
  .ability-card,
  .auth-entry,
  .overlay-panel,
  .intel-hub {
    border-radius: 24px;
  }

  .title-zone,
  .story-zone,
  .operation-zone,
  .ability-card,
  .mobile-starter,
  .auth-entry,
  .mobile-stage-switch,
  .mobile-quick-actions,
  .intel-hub {
    padding: 18px;
  }

  .mobile-status-strip {
    gap: 10px;
    margin-bottom: 2px;
  }

  .mobile-status-strip__item {
    flex-direction: column;
    gap: 2px;
    padding: 10px 8px;
    border: 1px solid rgba(224, 189, 137, 0.1);
    border-radius: 18px;
    background: rgba(255, 244, 227, 0.04);
  }

  .mobile-stage-switch {
    top: calc(8px + var(--safe-top, 0px));
  }

  .story-briefing__card {
    padding: 16px;
    border-radius: 22px;
  }

  .turn-overview__hero {
    grid-template-columns: 1fr;
  }

  .turn-overview__hero-side {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .turn-overview__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .story-briefing__fact-grid,
  .story-briefing__moment-grid {
    grid-template-columns: 1fr;
  }

  .story-scroll {
    min-height: calc(100vh - 270px);
    min-height: calc(100dvh - 270px);
    padding: 22px 18px 16px;
    border-radius: 22px;
  }

  .story-briefing-summary {
    margin-top: 12px;
    padding: 16px;
  }

  .story-briefing__summary-head,
  .story-briefing-summary__head {
    align-items: flex-start;
    flex-direction: column;
  }

  .operation-head-strip {
    flex-direction: column;
    align-items: flex-start;
  }

  .operation-head-strip__meta {
    max-width: none;
    text-align: left;
  }

  .story-tools {
    gap: 10px;
    padding: 12px;
    border-radius: 20px;
  }

  .story-tool,
  .tool-button,
  .mobile-bottom-dock__item,
  .story-briefing__tab,
  .mobile-choice-tab,
  .intel-tab,
  .native-auth-input {
    min-height: 48px;
  }

  .choice-card,
  .battle-command-button {
    min-height: 0;
  }

  .choice-card,
  .choice-card--setup,
  .choice-card--textbar,
  .recommended-chip,
  .fixed-quick-chip,
  .direction-card,
  .battle-log-card,
  .battle-command-card {
    border-radius: 20px;
  }

  .mobile-choice-tabs--dynamic,
  .direction-board--mobile,
  .fixed-mobile-section-tabs {
    border-color: rgba(224, 189, 137, 0.14);
    background:
      linear-gradient(180deg, rgba(25, 19, 18, 0.96), rgba(16, 13, 13, 0.96)),
      rgba(16, 13, 13, 0.94);
  }

  .mobile-bottom-dock {
    left: 10px;
    right: 10px;
    bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  }

  .mobile-bottom-dock__item {
    padding: 10px 6px;
  }

  .mobile-bottom-dock__item small {
    display: block;
  }

  .recommended-strip {
    grid-template-columns: 1fr;
  }

  .recommended-chip {
    min-height: 0;
    padding: 12px 13px;
  }

  .fixed-command-shell {
    grid-template-columns: 1fr;
  }

  .fixed-command-nav {
    position: static;
  }

  .fixed-quick-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mobile-bottom-dock__item.active {
    box-shadow:
      inset 0 1px 0 rgba(255, 244, 227, 0.08),
      0 12px 24px rgba(0, 0, 0, 0.16);
  }
}

@media (max-width: 640px) {
  .title-copy h1 {
    font-size: 30px;
    line-height: 1.12;
  }

  .title-desc {
    font-size: 14px;
    line-height: 1.8;
  }

  .title-chapter-strip {
    flex-wrap: wrap;
    gap: 8px;
  }

  .title-chapter-strip__line {
    width: 32px;
  }

  .title-tags span,
  .status-notes span,
  .choice-category,
  .access-chip,
  .choice-source {
    padding: 6px 10px;
    font-size: 11px;
  }

  .story-timehead {
    font-size: 24px;
  }

  .story-body,
  .story-body--enhanced {
    font-size: 16px;
    line-height: 1.82;
  }

  .story-scroll {
    min-height: 220px;
    max-height: none;
    padding: 18px 15px 14px;
  }

  .turn-overview {
    padding: 18px;
  }

  .turn-overview__hero-side,
  .turn-overview__stats {
    grid-template-columns: 1fr;
  }

  .turn-overview__marker,
  .turn-overview__stat {
    padding: 14px;
  }

  .story-briefing__card-head {
    flex-direction: column;
  }

  .story-briefing__card-badge,
  .story-briefing__card-badge--status {
    min-width: 0;
    width: fit-content;
  }

  .story-tools {
    grid-template-columns: 1fr;
  }

  .fixed-quick-strip {
    grid-template-columns: 1fr;
  }

  .fixed-command-shell--mobile .direction-board,
  .fixed-command-shell--mobile .fixed-quick-strip {
    grid-template-columns: 1fr 1fr;
  }

  .title-utility-row,
  .mobile-quick-actions__row {
    grid-template-columns: 1fr;
  }

  .mobile-bottom-dock {
    left: 8px;
    right: 8px;
    bottom: calc(8px + env(safe-area-inset-bottom, 0px));
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 8px;
    border-radius: 20px;
  }

  .mobile-bottom-dock__item {
    min-height: 54px;
    padding: 8px 4px;
  }

  .mobile-bottom-dock__item span {
    font-size: 12px;
  }

  .mobile-bottom-dock__item small {
    font-size: 9px;
  }

  .choice-group-head__minor {
    font-size: 11px;
  }

  .choice-card--fixed-mobile .choice-top,
  .choice-card--fixed-mobile-shell .choice-top {
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tool-button,
  .story-tool,
  .choice-card,
  .direction-card,
  .fixed-quick-chip,
  .mobile-bottom-dock__item,
  .recommended-chip,
  .story-glossary-term {
    transition: none !important;
    animation: none !important;
  }

  .choice-card:hover::before,
  .story-tool:hover::before,
  .tool-button:hover::before,
  .mobile-bottom-dock__item:hover::before {
    opacity: 0 !important;
    transform: none !important;
  }
}
</style>
<style lang="less" scoped>
.title-tools {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.title-command-deck {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  border-radius: 22px;
  background:
    radial-gradient(circle at top right, rgba(214, 171, 107, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(37, 28, 24, 0.96), rgba(20, 16, 16, 0.98));
}

.title-command-deck__head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.title-command-deck__title {
  color: #fff0dc;
  font-size: 17px;
  line-height: 1.55;
}

.title-command-deck__body {
  color: #d3b99a;
  font-size: 13px;
  line-height: 1.72;
}

.title-command-deck__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.title-command-deck__meta span {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  background: rgba(255, 244, 227, 0.05);
  color: #cdb393;
  font-size: 11px;
}

.turn-overview__stat-track,
.turn-overview__stat-fill {
  display: none !important;
}

.story-briefing__card-toggle {
  flex: 0 0 auto;
  padding: 8px 12px;
  border: 1px solid rgba(224, 189, 137, 0.14);
  border-radius: 999px;
  background: rgba(255, 244, 227, 0.04);
  color: #f0dcc0;
  font-size: 12px;
  cursor: pointer;
}

.story-briefing__inline-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.story-briefing__inline-facts span {
  padding: 7px 11px;
  border-radius: 999px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  background: rgba(255, 244, 227, 0.04);
  color: #d7c0a0;
  font-size: 12px;
}

.story-briefing__foldout {
  margin-top: 14px;
}

.story-briefing__moment-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.story-briefing__moment-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 13px;
  border: 1px solid rgba(224, 189, 137, 0.1);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.05), rgba(255, 244, 227, 0.02)),
    rgba(255, 244, 227, 0.02);
}

.story-briefing__moment-card span {
  color: #bea688;
  font-size: 11px;
  letter-spacing: 0.08em;
}

.story-briefing__moment-card strong {
  color: #fff0dc;
  font-size: 18px;
  line-height: 1.35;
}

.story-briefing__moment-card small {
  color: #a99276;
  font-size: 12px;
  line-height: 1.56;
}

@media (max-width: 820px) {
  .title-tools {
    max-width: none;
  }

  .story-briefing__moment-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .story-briefing__card-toggle {
    width: fit-content;
  }
}
</style>
<style lang="less">
.chronicle-page--crpg-desktop {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  padding: 0;
  background: #0c0a09;
}

.chronicle-page--crpg-desktop .page-shell {
  width: 100%;
  max-width: none;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.chronicle-page--crpg-desktop .auth-entry {
  display: none;
}

.chronicle-page .title-zone {
  position: relative;
  overflow: hidden;
}

.chronicle-page .title-zone::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 14% 18%, rgba(232, 196, 139, 0.16), transparent 24%),
    radial-gradient(circle at 78% 12%, rgba(153, 118, 78, 0.18), transparent 28%);
  opacity: .9;
}

.chronicle-page .title-copy,
.chronicle-page .title-tools {
  position: relative;
  z-index: 1;
}

.chronicle-page .title-copy {
  gap: 18px;
}

.chronicle-page .title-desc {
  max-width: 58ch;
  color: #e7d5be;
  line-height: 1.82;
}

.chronicle-page .title-crest-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 4px;
}

.chronicle-page .title-crest-strip__item,
.chronicle-page .title-command-deck__signal {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 14px 15px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.07), rgba(255, 244, 227, 0.025)),
    rgba(28, 22, 20, 0.55);
  backdrop-filter: blur(10px);
}

.chronicle-page .title-crest-strip__icon,
.chronicle-page .title-command-deck__signal-icon,
.chronicle-page .turn-overview__marker-icon,
.chronicle-page .turn-overview__stat-icon,
.chronicle-page .direction-mark,
.chronicle-page .direction-expanded-hero__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  color: #ffd89e;
  background: linear-gradient(180deg, rgba(235, 199, 141, 0.2), rgba(136, 94, 48, 0.12));
  box-shadow: inset 0 1px 0 rgba(255, 251, 243, 0.18);
}

.chronicle-page .title-crest-strip__icon svg,
.chronicle-page .title-command-deck__signal-icon svg,
.chronicle-page .turn-overview__marker-icon svg,
.chronicle-page .turn-overview__stat-icon svg,
.chronicle-page .direction-mark svg,
.chronicle-page .direction-expanded-hero__icon svg {
  width: 18px;
  height: 18px;
}

.chronicle-page .title-crest-strip__copy,
.chronicle-page .title-command-deck__signal-copy,
.chronicle-page .turn-overview__marker-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 4px;
}

.chronicle-page .title-crest-strip__copy small,
.chronicle-page .title-command-deck__signal-copy small {
  color: #bda688;
  font-size: 11px;
  letter-spacing: 0.1em;
}

.chronicle-page .title-crest-strip__copy strong,
.chronicle-page .title-command-deck__signal-copy strong {
  color: #fff1dc;
  font-size: 14px;
  line-height: 1.4;
}

.chronicle-page .title-command-deck {
  gap: 16px;
}

.chronicle-page .title-command-deck__signals {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.chronicle-page .turn-overview {
  gap: 18px;
}

.chronicle-page .turn-overview__hero {
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.85fr);
}

.chronicle-page .turn-overview__hero-side {
  grid-template-columns: 1fr;
}

.chronicle-page .turn-overview__marker {
  align-items: center;
  padding: 12px 14px;
}

.chronicle-page .turn-overview__marker-copy span {
  color: #bda688;
  font-size: 11px;
  letter-spacing: 0.08em;
}

.chronicle-page .turn-overview__marker-copy strong {
  color: #fff0dc;
  font-size: 14px;
  line-height: 1.45;
}

.chronicle-page .turn-overview__stats {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.chronicle-page .turn-overview__stat {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 86px;
  padding: 12px 14px;
  border-radius: 18px;
}

.chronicle-page .turn-overview__stat-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  gap: 6px;
}

.chronicle-page .turn-overview__stat-head {
  align-items: center;
}

.chronicle-page .turn-overview__stat-head small {
  color: #9f8a70;
  font-size: 10px;
  letter-spacing: 0.06em;
}

.chronicle-page .turn-overview__stat strong {
  margin-top: 0;
  font-size: 20px;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chronicle-page .story-zone .zone-head {
  margin-bottom: 18px;
}

.chronicle-page {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.chronicle-page button,
.chronicle-page [role='button'],
.chronicle-page .choice-card,
.chronicle-page .text-route,
.chronicle-page .story-briefing__tab,
.chronicle-page .story-briefing__card-toggle,
.chronicle-page .story-briefing__summary-pill,
.chronicle-page .intel-tab,
.chronicle-page .intel-card,
.chronicle-page .mobile-bottom-dock__item,
.chronicle-page .mobile-continue-button,
.chronicle-page .auth-benefit,
.chronicle-page .mobile-starter__step {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.chronicle-page button:active,
.chronicle-page [role='button']:active,
.chronicle-page .choice-card:active,
.chronicle-page .text-route:active,
.chronicle-page .story-briefing__tab:active,
.chronicle-page .story-briefing__card-toggle:active,
.chronicle-page .story-briefing__summary-pill:active,
.chronicle-page .intel-tab:active,
.chronicle-page .intel-card:active,
.chronicle-page .mobile-bottom-dock__item:active,
.chronicle-page .mobile-continue-button:active,
.chronicle-page .auth-benefit:active,
.chronicle-page .mobile-starter__step:active {
  filter: brightness(.9);
  transform: scale(.96);
  transition-duration: 150ms;
}

.chronicle-page .story-zone__head {
  transition: opacity .24s ease, transform .24s ease, filter .24s ease;
}

.chronicle-page .story-zone--immersive .story-zone__head {
  opacity: .24;
  filter: blur(.2px);
  transform: translateY(-10px);
}

.mobile-view-enter-active,
.mobile-view-leave-active {
  transition: opacity .3s ease-out, transform .3s ease-out, filter .3s ease-out;
}

.mobile-view-enter-from {
  opacity: 0;
  filter: blur(4px);
  transform: translateX(18px);
}

.mobile-view-leave-to {
  opacity: 0;
  filter: blur(3px);
  transform: translateX(-14px);
}

.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity .25s ease-out;
}

.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}

.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: transform .3s ease-out, opacity .3s ease-out;
}

.sheet-slide-enter-from,
.sheet-slide-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.mobile-sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(0, 0, 0, .6);
  backdrop-filter: blur(4px);
}

.mobile-sheet-handle {
  width: 48px;
  height: 4px;
  margin: 12px auto 4px;
  border-radius: 999px;
  background: #5c4b37;
}

.mobile-sheet-close,
.auth-guide-close {
  min-width: 76px;
}

.auth-guide-sheet {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 50;
  max-height: 72vh;
  overflow: auto;
  padding: 0 16px 18px;
  border-radius: 18px 18px 0 0;
  background: #171412;
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, .2),
    0 -24px 48px rgba(0, 0, 0, .42);
}

.chronicle-page .ability-zone--sheet {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 50;
  display: block;
  height: auto;
  max-height: 78vh;
  overflow: hidden;
  padding: 0;
  border-radius: 18px 18px 0 0;
  background: #171412;
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, .2),
    0 -24px 48px rgba(0, 0, 0, .42);
}

.chronicle-page .ability-zone--sheet .intel-hub {
  max-height: 78vh;
  margin: 0;
  overflow: hidden;
  border-radius: 18px 18px 0 0;
  background: #171412;
  box-shadow: none;
}

.chronicle-page .ability-zone--sheet .intel-scroll {
  max-height: calc(78vh - 150px);
  overflow-y: auto;
  padding-bottom: 20px;
  -webkit-overflow-scrolling: touch;
}

.chronicle-page .story-briefing {
  grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr);
  gap: 14px;
}

.chronicle-page .story-briefing__summary-ribbon {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.chronicle-page .story-briefing__summary-pill {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 13px;
  border: 1px solid rgba(224, 189, 137, 0.1);
  border-radius: 16px;
  background: rgba(255, 244, 227, 0.04);
}

.chronicle-page .story-briefing__summary-pill small {
  color: #bda688;
  font-size: 10px;
  letter-spacing: 0.08em;
}

.chronicle-page .story-briefing__summary-pill strong {
  color: #fff0dc;
  font-size: 13px;
  line-height: 1.45;
}

.chronicle-page .story-briefing__card {
  padding: 16px 18px;
}

.chronicle-page .story-briefing__hero-copy {
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.78;
}

.chronicle-page .story-briefing__inline-facts {
  margin-top: 12px;
}

.chronicle-page .story-briefing__inline-facts span {
  padding: 6px 10px;
  font-size: 11px;
}

.chronicle-page .story-briefing__fact-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.chronicle-page .story-briefing__fact-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 244, 227, 0.035);
  border: 1px solid rgba(224, 189, 137, 0.08);
}

.chronicle-page .story-briefing__fact-line span {
  color: #bda688;
  font-size: 12px;
}

.chronicle-page .story-briefing__fact-line strong {
  color: #f5e1bf;
  font-size: 13px;
  text-align: right;
  line-height: 1.5;
}

.chronicle-page .story-briefing-summary {
  padding: 16px 18px;
}

.chronicle-page .story-briefing-summary__notes {
  margin-top: 12px;
}

.chronicle-page .story-scroll {
  min-height: 400px;
  padding: 34px 34px 24px;
  border-radius: 30px;
  background:
    linear-gradient(180deg, rgba(30, 23, 21, 0.68), rgba(14, 12, 12, 0.82)),
    linear-gradient(90deg, rgba(215, 179, 125, 0.04), rgba(255, 246, 230, 0.02));
}

.chronicle-page .story-body {
  max-width: 74ch;
  margin: 0 auto;
}

.chronicle-page .operation-head-strip {
  align-items: stretch;
}

.chronicle-page .operation-head-strip__lead {
  align-items: flex-start;
}

.chronicle-page .operation-head-strip__stage {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 220px;
  padding: 12px 14px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  border-radius: 18px;
  background: rgba(255, 244, 227, 0.035);
}

.chronicle-page .operation-head-strip__stage span {
  color: #bfa88a;
  font-size: 11px;
  letter-spacing: 0.08em;
}

.chronicle-page .operation-head-strip__stage strong {
  color: #fff0dc;
  font-size: 14px;
  line-height: 1.55;
}

.chronicle-page .operation-head-strip__stage small {
  color: #cdb393;
  font-size: 12px;
  line-height: 1.6;
}

.chronicle-page .fixed-command-shell {
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 18px;
}

.chronicle-page .fixed-command-nav {
  gap: 16px;
}

.chronicle-page .fixed-command-shell .direction-card {
  padding: 12px 13px;
}

.chronicle-page .direction-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chronicle-page .direction-top__copy {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  gap: 4px;
  text-align: left;
}

.chronicle-page .direction-meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chronicle-page .direction-count--dim {
  opacity: .68;
}

.chronicle-page .direction-expanded {
  padding: 18px 18px 20px;
}

.chronicle-page .direction-expanded-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
  padding: 14px 15px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  border-radius: 20px;
  background: rgba(255, 244, 227, 0.04);
}

.chronicle-page .direction-expanded-hero__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.chronicle-page .direction-expanded-hero__copy strong {
  color: #fff0dc;
  font-size: 15px;
}

.chronicle-page .direction-expanded-hero__copy span {
  color: #d4bc9b;
  font-size: 12px;
  line-height: 1.7;
}

.chronicle-page .fixed-command-shell .fixed-quick-strip {
  grid-template-columns: repeat(auto-fit, minmax(122px, 1fr));
}

.chronicle-page .fixed-command-shell .fixed-quick-chip {
  min-height: 58px;
}

.chronicle-page .fixed-command-shell .choice-grid--expanded {
  gap: 10px;
}

.chronicle-page .choice-card--action-rail,
.chronicle-page .fixed-command-shell .choice-card--relation {
  border-radius: 20px;
  padding: 14px 16px;
}

.chronicle-page .choice-name {
  font-size: 18px;
}

.chronicle-page .choice-hint,
.chronicle-page .choice-forecast,
.chronicle-page .choice-requirements {
  line-height: 1.7;
}

.chronicle-page .choice-select-wrap {
  padding-top: 8px;
}

.chronicle-page .choice-select-label {
  font-size: 11px;
}

.chronicle-page .fixed-command-shell .choice-select {
  padding: 10px;
}

@media (max-width: 1024px) {
  .chronicle-page .title-crest-strip,
  .chronicle-page .title-command-deck__signals,
  .chronicle-page .story-briefing__summary-ribbon,
  .chronicle-page .turn-overview__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chronicle-page .turn-overview__hero,
  .chronicle-page .fixed-command-shell {
    grid-template-columns: 1fr;
  }

  .chronicle-page .story-scroll {
    min-height: 360px;
    padding: 26px 24px 20px;
  }
}

@media (max-width: 820px) {
  .chronicle-page .title-crest-strip,
  .chronicle-page .title-command-deck__signals,
  .chronicle-page .turn-overview__stats,
  .chronicle-page .story-briefing__summary-ribbon {
    grid-template-columns: 1fr 1fr;
  }

  .chronicle-page .turn-overview__stat {
    min-height: 74px;
  }

  .chronicle-page .story-briefing {
    grid-template-columns: 1fr;
  }

  .chronicle-page .story-scroll {
    min-height: 320px;
    padding: 22px 18px 18px;
    border-radius: 24px;
  }

  .chronicle-page .direction-expanded-hero {
    margin-top: 12px;
  }

  .chronicle-page .fixed-command-shell--mobile .direction-board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .chronicle-page .title-crest-strip,
  .chronicle-page .title-command-deck__signals,
  .chronicle-page .turn-overview__stats,
  .chronicle-page .story-briefing__summary-ribbon {
    grid-template-columns: 1fr;
  }

  .chronicle-page .turn-overview__stat {
    padding: 12px 13px;
  }

  .chronicle-page .turn-overview__stat strong {
    font-size: 18px;
  }

  .chronicle-page .operation-head-strip {
    padding: 12px 14px;
  }

  .chronicle-page .fixed-command-shell--mobile .direction-board {
    grid-template-columns: 1fr 1fr;
  }
}

.chronicle-page .ui-textarea,
.chronicle-page .ui-select {
  border: 1px solid rgba(224, 189, 137, 0.14);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.07), rgba(255, 244, 227, 0.03)),
    rgba(37, 28, 24, 0.92);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.04),
    0 10px 22px rgba(0, 0, 0, 0.1);
  color: #f4eadb;
}

.chronicle-page .ui-textarea {
  font-size: 16px;
}

.chronicle-page .choice-select.ui-select:focus-within {
  border-color: rgba(224, 189, 137, 0.3);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.06),
    0 0 0 1px rgba(224, 189, 137, 0.12),
    0 14px 28px rgba(0, 0, 0, 0.12);
}

@media (max-width: 640px) {
.chronicle-page .ui-select {
  min-height: 42px;
}
}

.chronicle-page {
  --surface-highlight: linear-gradient(135deg, rgba(208, 157, 92, 0.18), rgba(208, 157, 92, 0));
  --text-dim: #b79f82;
  --bg-glass: rgba(255, 244, 227, 0.045);
  --radius-card: 22px;
}

.chronicle-page .main-grid {
  position: relative;
  gap: 24px;
  grid-template-columns: minmax(0, 1.9fr) minmax(340px, 0.82fr);
}

.chronicle-page .story-zone {
  background:
    radial-gradient(circle at 100% 0, rgba(215, 176, 119, 0.12), transparent 24%),
    var(--surface-story);
  border-color: rgba(224, 189, 137, 0.18);
  box-shadow: var(--shadow-heavy);
}

.chronicle-page .story-scroll {
  min-height: 420px;
  padding: 38px 38px 28px;
  border-radius: 34px;
  background:
    radial-gradient(circle at top center, rgba(255, 241, 218, 0.05), transparent 24%),
    linear-gradient(180deg, rgba(32, 24, 22, 0.76), rgba(12, 11, 11, 0.88)),
    linear-gradient(90deg, rgba(215, 179, 125, 0.05), rgba(255, 246, 230, 0.02));
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.06),
    inset 0 0 0 1px rgba(224, 189, 137, 0.06);
}

.chronicle-page .mobile-bottom-dock {
  padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
}

@media (max-width: 820px) {
  .chronicle-page {
    padding:
      calc(12px + env(safe-area-inset-top, 0px))
      calc(12px + env(safe-area-inset-right, 0px))
      calc(94px + env(safe-area-inset-bottom, 0px))
      calc(12px + env(safe-area-inset-left, 0px));
  }

  .chronicle-page .hero-hub,
  .chronicle-page .mobile-stage-switch {
    display: none;
  }

  .chronicle-page .main-grid--mobile-staged {
    display: block;
    min-height: auto;
    overflow-anchor: none;
  }

  .chronicle-page .story-zone,
  .chronicle-page .operation-zone {
    padding: 14px 0 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    overflow-anchor: none;
  }

  .chronicle-page .story-zone .zone-head,
  .chronicle-page .operation-zone > .zone-head {
    padding: 0 2px 10px;
  }

  .chronicle-page .zone-title {
    font-size: 22px;
    line-height: 1.25;
  }

  .chronicle-page .story-meta,
  .chronicle-page .panel-text,
  .chronicle-page .status-tip {
    font-size: 13px;
    line-height: 1.72;
  }

  .chronicle-page .story-briefing--mobile {
    display: block;
    margin-bottom: 12px;
  }

  .chronicle-page .story-briefing__tabs,
  .chronicle-page .intel-tabs,
  .chronicle-page .mobile-choice-tabs,
  .chronicle-page .fixed-quick-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .chronicle-page .story-briefing__tabs::-webkit-scrollbar,
  .chronicle-page .intel-tabs::-webkit-scrollbar,
  .chronicle-page .mobile-choice-tabs::-webkit-scrollbar,
  .chronicle-page .fixed-quick-strip::-webkit-scrollbar {
    display: none;
  }

  .chronicle-page .story-briefing__tab,
  .chronicle-page .intel-tab,
  .chronicle-page .mobile-choice-tab,
  .chronicle-page .fixed-quick-chip {
    flex: 0 0 auto;
    min-width: 104px;
    min-height: 44px;
    border-radius: 999px;
  }

  .chronicle-page .story-briefing__summary-ribbon {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
  }

  .chronicle-page .story-briefing__summary-pill {
    min-height: 54px;
    padding: 8px 7px;
    border-radius: 14px;
  }

  .chronicle-page .story-briefing__summary-pill strong {
    font-size: 12px;
  }

  .chronicle-page .story-scroll {
    min-height: calc(100dvh - 250px);
    max-height: calc(100dvh - 210px);
    padding: 26px 20px 24px;
    border-radius: 0;
    border: 1px solid rgba(197, 157, 100, 0.18);
    background:
      linear-gradient(90deg, rgba(123, 75, 47, 0.12), transparent 10%, transparent 90%, rgba(123, 75, 47, 0.12)),
      linear-gradient(180deg, rgba(238, 218, 181, 0.08), rgba(33, 25, 22, 0.54)),
      rgba(18, 15, 14, 0.92);
    box-shadow:
      inset 0 1px 0 rgba(255, 244, 227, 0.08),
      0 16px 32px rgba(0, 0, 0, 0.2);
  }

  .chronicle-page .story-body,
  .chronicle-page .story-body--enhanced {
    max-width: 36em;
    font-size: 16px;
    line-height: 1.95;
    font-weight: 400;
    letter-spacing: 0;
  }

  .chronicle-page .story-body--enhanced p,
  .chronicle-page .story-body--enhanced .story-paragraph {
    margin-bottom: 1.1em;
  }

  .chronicle-page .choice-group--dynamic-hero,
  .chronicle-page .choice-group--fixed-hero,
  .chronicle-page .fixed-command-shell,
  .chronicle-page .direction-expanded {
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(34, 27, 23, 0.96), rgba(17, 14, 13, 0.98));
  }

  .chronicle-page .direction-board--mobile,
  .chronicle-page .fixed-command-shell--mobile .direction-board {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .chronicle-page .direction-stack--mobile {
    flex: 0 0 132px;
  }

  .chronicle-page .direction-card--mobile {
    min-height: 56px;
    border-radius: 999px;
  }

  .chronicle-page .choice-card,
  .chronicle-page .choice-card--fixed-mobile,
  .chronicle-page .choice-card--fixed-mobile-shell,
  .chronicle-page .choice-action-button {
    min-height: 82px;
    padding: 14px;
    border-radius: 16px;
  }

  .chronicle-page .choice-card--disabled,
  .chronicle-page .recommended-chip--disabled {
    filter: grayscale(.78);
    opacity: .48;
  }

  .chronicle-page .choice-name {
    font-size: 16px;
    line-height: 1.35;
  }

  .chronicle-page .choice-hint {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.62;
  }

  .chronicle-page .choice-forecast,
  .chronicle-page .choice-requirements {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    margin-top: 8px;
    padding: 5px 8px;
    border-radius: 999px;
    font-size: 11px;
    line-height: 1.45;
  }

  .chronicle-page .choice-forecast {
    color: #e7f7df;
    background: rgba(75, 133, 81, 0.2);
  }

  .chronicle-page .choice-requirements {
    color: #f6d4c9;
    background: linear-gradient(90deg, rgba(166, 58, 48, 0.38), rgba(166, 58, 48, 0.12));
  }

  .chronicle-page .choice-requirements--locked {
    color: #ffc7bd;
    background:
      linear-gradient(90deg, rgba(190, 54, 45, 0.48), rgba(190, 54, 45, 0.16)),
      rgba(255, 255, 255, 0.03);
  }

  .chronicle-page .mobile-sheet-mask,
  .chronicle-page .overlay-mask,
  .chronicle-page .glossary-sheet-mask {
    z-index: 90;
    padding:
      env(safe-area-inset-top, 0px)
      env(safe-area-inset-right, 0px)
      env(safe-area-inset-bottom, 0px)
      env(safe-area-inset-left, 0px);
  }

  .chronicle-page .ability-zone--sheet,
  .chronicle-page .auth-guide-sheet,
  .chronicle-page .glossary-sheet,
  .chronicle-page .overlay-panel {
    z-index: 100;
    right: max(0px, env(safe-area-inset-right, 0px));
    bottom: 0;
    left: max(0px, env(safe-area-inset-left, 0px));
    max-height: 78dvh;
    border-radius: 22px 22px 0 0;
    background:
      linear-gradient(180deg, rgba(47, 36, 29, 0.98), rgba(18, 14, 12, 0.99));
  }

  .chronicle-page .ability-zone--sheet {
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  }

  .chronicle-page .ability-zone--sheet .intel-scroll {
    max-height: calc(78dvh - 142px);
  }
}

.chronicle-page .operation-zone {
  background:
    radial-gradient(circle at top right, rgba(214, 171, 107, 0.12), transparent 26%),
    var(--surface-command);
}

.chronicle-page .ability-zone {
  gap: 20px;
}

.chronicle-page .fixed-command-shell {
  grid-template-columns: minmax(240px, 272px) minmax(0, 1fr);
  gap: 20px;
}

.chronicle-page .direction-expanded {
  padding: 20px 20px 22px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  border-radius: 28px;
  background:
    radial-gradient(circle at top right, rgba(215, 175, 117, 0.1), transparent 28%),
    linear-gradient(180deg, rgba(18, 15, 16, 0.98), rgba(10, 10, 11, 0.99));
}

.chronicle-page .recommended-strip {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.chronicle-page .recommended-chip {
  min-height: 96px;
  border-radius: 22px;
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.06),
    0 18px 28px rgba(0, 0, 0, 0.18);
}

.chronicle-page .side-dashboard,
.chronicle-page .intel-hub {
  background:
    radial-gradient(circle at 100% 0, rgba(128, 183, 140, 0.08), transparent 18%),
    var(--surface-intel);
  border-radius: 30px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  box-shadow: var(--shadow-heavy);
}

@media (max-width: 1024px) {
  .chronicle-page .main-grid {
    grid-template-columns: 1fr;
  }
}

.chronicle-page {
  --rpg-bronze: #b98b53;
  --rpg-gold: #e6c48e;
  --rpg-iron: #201816;
  --rpg-iron-deep: #120f10;
  --rpg-blood: #6b201b;
  --rpg-banner: #324537;
  --rpg-parchment: #e8d7ba;
}

.chronicle-page::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(circle at 14% 12%, rgba(164, 103, 51, 0.18), transparent 22%),
    radial-gradient(circle at 80% 10%, rgba(138, 32, 25, 0.12), transparent 20%),
    radial-gradient(circle at 82% 78%, rgba(76, 105, 72, 0.1), transparent 24%);
}

.chronicle-page .page-shell {
  position: relative;
  z-index: 1;
  max-width: 1660px;
  padding: 18px 18px 64px;
}

.chronicle-page .card,
.chronicle-page .title-zone,
.chronicle-page .story-zone,
.chronicle-page .operation-zone,
.chronicle-page .ability-card,
.chronicle-page .intel-hub,
.chronicle-page .side-dashboard,
.chronicle-page .auth-entry {
  border: 1px solid rgba(198, 150, 90, 0.18);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(44, 31, 27, 0.94), rgba(14, 12, 12, 0.98)),
    linear-gradient(135deg, rgba(188, 139, 83, 0.08), transparent 40%);
  box-shadow:
    inset 0 1px 0 rgba(255, 245, 229, 0.06),
    0 22px 46px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(12px);
}

.chronicle-page .title-zone {
  padding: 28px;
  border-radius: 32px;
  background:
    linear-gradient(145deg, rgba(53, 38, 31, 0.98), rgba(16, 12, 13, 0.98)),
    linear-gradient(135deg, rgba(129, 26, 22, 0.12), transparent 32%);
}

.chronicle-page .main-grid {
  display: grid;
  grid-template-columns: minmax(300px, 0.92fr) minmax(0, 1.6fr) minmax(320px, 0.9fr);
  grid-template-areas: 'command story intel';
  gap: 18px;
  align-items: start;
}

.chronicle-page .primary-column {
  display: contents;
}

.chronicle-page .story-zone {
  grid-area: story;
  order: 2;
}

.chronicle-page .operation-zone {
  grid-area: command;
  order: 1;
  position: sticky;
  top: 18px;
  max-height: calc(100vh - 36px);
  overflow: auto;
}

.chronicle-page .ability-zone {
  grid-area: intel;
  order: 3;
  position: sticky;
  top: 18px;
  max-height: calc(100vh - 36px);
  overflow: auto;
  gap: 18px;
}

.chronicle-page .turn-overview {
  display: none !important;
}

.chronicle-page .story-zone {
  padding: 22px;
  background:
    linear-gradient(180deg, rgba(33, 26, 23, 0.98), rgba(12, 11, 11, 0.99)),
    radial-gradient(circle at top center, rgba(222, 184, 130, 0.06), transparent 24%);
}

.chronicle-page .story-scroll {
  border: 1px solid rgba(190, 143, 86, 0.18);
  background:
    linear-gradient(180deg, rgba(45, 34, 29, 0.88), rgba(18, 15, 15, 0.95)),
    radial-gradient(circle at top center, rgba(255, 238, 209, 0.05), transparent 22%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 244, 227, 0.05),
    inset 0 18px 34px rgba(0, 0, 0, 0.18);
}

.chronicle-page .story-body,
.chronicle-page .story-body--enhanced {
  color: #eadbc5;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
}

.chronicle-page .story-tools {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.chronicle-page .operation-zone {
  padding: 18px;
  background:
    linear-gradient(180deg, rgba(28, 21, 20, 0.98), rgba(10, 10, 11, 0.99)),
    linear-gradient(180deg, rgba(117, 28, 22, 0.12), transparent 28%);
}

.chronicle-page .operation-zone .zone-head,
.chronicle-page .story-zone .zone-head,
.chronicle-page .auth-entry .zone-head,
.chronicle-page .intel-hub .zone-head {
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(198, 150, 90, 0.12);
}

.chronicle-page .side-dashboard {
  padding: 16px;
  background:
    linear-gradient(180deg, rgba(21, 21, 23, 0.98), rgba(11, 11, 13, 0.99)),
    linear-gradient(135deg, rgba(72, 95, 70, 0.12), transparent 26%);
}

.chronicle-page .side-dashboard__hero {
  padding: 18px;
  border-radius: 22px;
  background:
    linear-gradient(135deg, rgba(74, 23, 20, 0.3), transparent 34%),
    linear-gradient(180deg, rgba(255, 244, 227, 0.05), rgba(255, 244, 227, 0.02));
}

.chronicle-page .side-dashboard__group--audit {
  border-color: rgba(171, 122, 74, 0.16);
  background:
    linear-gradient(180deg, rgba(77, 31, 26, 0.22), rgba(18, 13, 14, 0.96)),
    linear-gradient(135deg, rgba(236, 196, 136, 0.05), transparent 36%);
}

.chronicle-page .side-dashboard__industry-row--audit {
  align-items: flex-start;
}

.chronicle-page .side-dashboard__group,
.chronicle-page .intel-card,
.chronicle-page .story-briefing__card,
.chronicle-page .story-briefing-summary,
.chronicle-page .battle-return-card,
.chronicle-page .auth-entry-card {
  border: 1px solid rgba(198, 150, 90, 0.12);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.04), rgba(255, 244, 227, 0.015)),
    rgba(19, 16, 16, 0.82);
}

.chronicle-page .tool-button,
.chronicle-page .story-tool,
.chronicle-page .text-route,
.chronicle-page .direction-card,
.chronicle-page .fixed-quick-chip,
.chronicle-page .choice-card,
.chronicle-page .recommended-chip,
.chronicle-page .mobile-bottom-dock__item,
.chronicle-page .mobile-continue-button,
.chronicle-page .story-briefing__card-toggle,
.chronicle-page .donation-panel__channel-tab,
.chronicle-page .intel-tab,
.chronicle-page .mobile-choice-tab,
.chronicle-page .story-briefing__tab {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(183, 136, 79, 0.22);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(119, 80, 47, 0.28), rgba(41, 29, 25, 0.96) 24%, rgba(20, 16, 16, 0.98)),
    linear-gradient(135deg, rgba(231, 196, 142, 0.08), transparent 42%);
  color: #f3e6d2;
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.12),
    inset 0 -1px 0 rgba(0, 0, 0, 0.36),
    0 12px 24px rgba(0, 0, 0, 0.22);
  transition:
    transform .16s ease,
    box-shadow .2s ease,
    border-color .18s ease,
    filter .18s ease,
    background .2s ease;
  cursor: pointer;
}

.chronicle-page .tool-button::after,
.chronicle-page .story-tool::after,
.chronicle-page .choice-card::after,
.chronicle-page .direction-card::after,
.chronicle-page .fixed-quick-chip::after,
.chronicle-page .recommended-chip::after,
.chronicle-page .mobile-bottom-dock__item::after,
.chronicle-page .mobile-continue-button::after,
.chronicle-page .story-briefing__card-toggle::after,
.chronicle-page .donation-panel__channel-tab::after,
.chronicle-page .intel-tab::after,
.chronicle-page .mobile-choice-tab::after,
.chronicle-page .story-briefing__tab::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background:
    radial-gradient(circle at center, rgba(233, 196, 138, 0.24), transparent 42%),
    linear-gradient(120deg, transparent 20%, rgba(255, 246, 228, 0.18) 50%, transparent 80%);
  transform: scale(.88) translateX(-24%);
  transition: opacity .18s ease, transform .22s ease;
}

.chronicle-page .tool-button:hover:not(:disabled),
.chronicle-page .story-tool:hover:not(:disabled),
.chronicle-page .choice-card:hover:not(:disabled),
.chronicle-page .direction-card:hover:not(:disabled),
.chronicle-page .fixed-quick-chip:hover:not(:disabled),
.chronicle-page .recommended-chip:hover:not(:disabled),
.chronicle-page .mobile-bottom-dock__item:hover:not(:disabled),
.chronicle-page .mobile-continue-button:hover:not(:disabled),
.chronicle-page .story-briefing__card-toggle:hover,
.chronicle-page .donation-panel__channel-tab:hover,
.chronicle-page .intel-tab:hover,
.chronicle-page .mobile-choice-tab:hover,
.chronicle-page .story-briefing__tab:hover {
  transform: translateY(-2px) scale(1.01);
  border-color: rgba(228, 187, 129, 0.34);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.14),
    0 18px 30px rgba(0, 0, 0, 0.3),
    0 0 18px rgba(186, 136, 80, 0.18);
  filter: saturate(1.05);
}

.chronicle-page .tool-button:hover::after,
.chronicle-page .story-tool:hover::after,
.chronicle-page .choice-card:hover::after,
.chronicle-page .direction-card:hover::after,
.chronicle-page .fixed-quick-chip:hover::after,
.chronicle-page .recommended-chip:hover::after,
.chronicle-page .mobile-bottom-dock__item:hover::after,
.chronicle-page .mobile-continue-button:hover::after,
.chronicle-page .story-briefing__card-toggle:hover::after,
.chronicle-page .donation-panel__channel-tab:hover::after,
.chronicle-page .intel-tab:hover::after,
.chronicle-page .mobile-choice-tab:hover::after,
.chronicle-page .story-briefing__tab:hover::after {
  opacity: .78;
  transform: scale(1) translateX(18%);
}

.chronicle-page .tool-button:active:not(:disabled),
.chronicle-page .story-tool:active:not(:disabled),
.chronicle-page .choice-card:active:not(:disabled),
.chronicle-page .direction-card:active:not(:disabled),
.chronicle-page .fixed-quick-chip:active:not(:disabled),
.chronicle-page .recommended-chip:active:not(:disabled),
.chronicle-page .mobile-bottom-dock__item:active:not(:disabled),
.chronicle-page .mobile-continue-button:active:not(:disabled),
.chronicle-page .story-briefing__card-toggle:active,
.chronicle-page .donation-panel__channel-tab:active,
.chronicle-page .intel-tab:active,
.chronicle-page .mobile-choice-tab:active,
.chronicle-page .story-briefing__tab:active {
  transform: translateY(1px) scale(.985);
  box-shadow:
    inset 0 3px 14px rgba(0, 0, 0, 0.36),
    0 8px 14px rgba(0, 0, 0, 0.18);
}

.chronicle-page .tool-button--accent,
.chronicle-page .mobile-continue-button,
.chronicle-page .ui-button--primary {
  color: #24170f;
  border-color: rgba(229, 188, 126, 0.4);
  background:
    linear-gradient(180deg, rgba(241, 211, 163, 0.98), rgba(183, 132, 69, 0.98)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0));
  box-shadow:
    inset 0 1px 0 rgba(255, 250, 242, 0.72),
    inset 0 -1px 0 rgba(113, 66, 29, 0.28),
    0 16px 28px rgba(82, 49, 23, 0.24);
}

.chronicle-page .tool-button--subtle,
.chronicle-page .story-tool,
.chronicle-page .story-briefing__card-toggle,
.chronicle-page .intel-tab,
.chronicle-page .mobile-choice-tab,
.chronicle-page .story-briefing__tab {
  color: #ead7bb;
  background:
    linear-gradient(180deg, rgba(81, 56, 40, 0.42), rgba(21, 17, 16, 0.98)),
    linear-gradient(135deg, rgba(230, 192, 135, 0.05), transparent 36%);
}

.chronicle-page .direction-card.active,
.chronicle-page .fixed-quick-chip.active,
.chronicle-page .intel-tab.active,
.chronicle-page .mobile-choice-tab.active,
.chronicle-page .story-briefing__tab.active,
.chronicle-page .mobile-bottom-dock__item.active {
  border-color: rgba(232, 192, 135, 0.36);
  background:
    linear-gradient(180deg, rgba(114, 31, 24, 0.56), rgba(41, 24, 22, 0.96)),
    linear-gradient(135deg, rgba(233, 196, 138, 0.16), transparent 36%);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.16),
    0 18px 30px rgba(0, 0, 0, 0.28),
    0 0 0 1px rgba(233, 196, 138, 0.08);
}

.chronicle-page .recommended-strip {
  grid-template-columns: 1fr;
  gap: 10px;
}

.chronicle-page .recommended-chip {
  min-height: 82px;
  padding: 14px 16px;
  text-align: left;
}

.chronicle-page .fixed-command-shell,
.chronicle-page .fixed-command-shell--hero {
  display: block;
}

.chronicle-page .fixed-command-nav,
.chronicle-page .fixed-command-nav--hero {
  position: static;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.chronicle-page .direction-board,
.chronicle-page .fixed-command-shell .direction-board {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chronicle-page .direction-stack {
  gap: 10px;
}

.chronicle-page .fixed-command-shell .direction-card {
  min-height: 0;
  padding: 16px;
}

.chronicle-page .fixed-command-shell .direction-expanded {
  margin-left: 18px;
  padding: 18px;
  border: 1px solid rgba(198, 150, 90, 0.14);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(23, 18, 18, 0.98), rgba(11, 10, 11, 0.99)),
    linear-gradient(135deg, rgba(84, 26, 22, 0.14), transparent 26%);
}

.chronicle-page .fixed-command-shell .fixed-quick-strip {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.chronicle-page .fixed-command-shell .choice-grid--expanded {
  grid-template-columns: 1fr;
}

.chronicle-page .choice-card--action-rail,
.chronicle-page .fixed-command-shell .choice-card--relation,
.chronicle-page .battle-command-button {
  padding: 16px 18px;
  border-radius: 22px;
}

.chronicle-page .choice-name {
  font-size: 18px;
  color: #f7e8cf;
}

.chronicle-page .choice-hint,
.chronicle-page .choice-forecast,
.chronicle-page .choice-requirements,
.chronicle-page .choice-group-note,
.chronicle-page .story-meta,
.chronicle-page .panel-text,
.chronicle-page .status-tip {
  color: #ccb394;
}

.chronicle-page .choice-forecast {
  color: #b5d7b8;
}

.chronicle-page .choice-requirements {
  color: #e2cfb1;
}

.chronicle-page .choice-requirements--locked {
  color: #d8a28f;
}

.chronicle-page .choice-source,
.chronicle-page .choice-category,
.chronicle-page .status-notes span,
.chronicle-page .title-tags span,
.chronicle-page .title-command-deck__meta span,
.chronicle-page .access-chip {
  border: 1px solid rgba(198, 150, 90, 0.12);
  border-radius: 999px;
  background: rgba(255, 244, 227, 0.04);
  color: #d6bea0;
  padding: 6px 10px;
}

.chronicle-page .choice-source--dynamic {
  border-color: rgba(136, 181, 136, 0.18);
  background: rgba(92, 132, 89, 0.24);
  color: #d5e8d2;
}

.chronicle-page .title-command-deck,
.chronicle-page .war-status-bar,
.chronicle-page .mobile-starter,
.chronicle-page .mobile-stage-switch {
  border: 1px solid rgba(198, 150, 90, 0.14);
  background:
    linear-gradient(180deg, rgba(35, 28, 26, 0.96), rgba(13, 11, 12, 0.98)),
    linear-gradient(135deg, rgba(128, 26, 21, 0.12), transparent 30%);
}

.chronicle-page .title-command-deck__signals,
.chronicle-page .title-crest-strip {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.chronicle-page .title-crest-strip__item,
.chronicle-page .title-command-deck__signal,
.chronicle-page .war-status-bar__chip {
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.06), rgba(255, 244, 227, 0.02)),
    rgba(255, 244, 227, 0.02);
}

.chronicle-page .auth-entry-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.chronicle-page .native-auth-input,
.chronicle-page .ui-textarea,
.chronicle-page .ui-select {
  border: 1px solid rgba(198, 150, 90, 0.18);
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.06), rgba(255, 244, 227, 0.02)),
    rgba(28, 22, 20, 0.94);
  color: #f4eadb;
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.06),
    0 10px 18px rgba(0, 0, 0, 0.16);
}

.chronicle-page .ui-select:focus-within,
.chronicle-page .native-auth-input:focus,
.chronicle-page .ui-textarea:focus {
  border-color: rgba(230, 190, 132, 0.3);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.08),
    0 0 0 1px rgba(230, 190, 132, 0.14),
    0 12px 22px rgba(0, 0, 0, 0.18);
  outline: none;
}

.chronicle-page .intel-hub {
  padding: 18px;
}

.chronicle-page .intel-scroll {
  padding-right: 4px;
}

.chronicle-page .mobile-bottom-dock {
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(25, 19, 18, 0.98), rgba(11, 10, 10, 0.98)),
    linear-gradient(135deg, rgba(100, 26, 22, 0.12), transparent 30%);
}

.chronicle-page .story-briefing {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.chronicle-page .story-briefing__summary-ribbon {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (max-width: 1280px) {
  .chronicle-page .page-shell {
    padding-left: 14px;
    padding-right: 14px;
  }

  .chronicle-page .main-grid {
    grid-template-columns: minmax(280px, 0.95fr) minmax(0, 1.4fr);
    grid-template-areas:
      'story story'
      'command intel';
  }

  .chronicle-page .operation-zone,
  .chronicle-page .ability-zone {
    max-height: none;
  }
}

@media (max-width: 1024px) {
  .chronicle-page .main-grid {
    grid-template-columns: 1fr;
    grid-template-areas:
      'story'
      'command'
      'intel';
  }

  .chronicle-page .story-zone,
  .chronicle-page .operation-zone,
  .chronicle-page .ability-zone {
    position: static;
    max-height: none;
    overflow: visible;
  }

  .chronicle-page .story-tools {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

.chronicle-page .auth-entry-grid,
.chronicle-page .title-command-deck__signals,
.chronicle-page .title-crest-strip,
.chronicle-page .story-briefing,
.chronicle-page .story-briefing__summary-ribbon {
  grid-template-columns: 1fr;
}

.desktop-render-fallback {
  max-width: 960px;
  margin: 24px auto;
  padding: 28px;
}
}

@media (max-width: 640px) {
  .chronicle-page .page-shell {
    padding: 10px 10px 78px;
  }

  .chronicle-page .title-zone,
  .chronicle-page .story-zone,
  .chronicle-page .operation-zone,
  .chronicle-page .side-dashboard,
  .chronicle-page .intel-hub,
  .chronicle-page .auth-entry,
  .chronicle-page .mobile-starter,
  .chronicle-page .mobile-stage-switch {
    border-radius: 22px;
  }

  .chronicle-page .story-tools {
    grid-template-columns: 1fr;
  }

  .chronicle-page .fixed-command-shell .direction-expanded {
    margin-left: 0;
  }

  .chronicle-page .fixed-command-shell .fixed-quick-strip,
  .chronicle-page .war-status-bar__chips,
  .chronicle-page .auth-entry-grid {
    grid-template-columns: 1fr;
  }

  .chronicle-page .choice-name {
    font-size: 17px;
  }
}

.chronicle-page.chronicle-page--crpg-desktop {
  width: 100vw !important;
  height: 100vh !important;
  height: 100dvh !important;
  min-height: 100vh !important;
  min-height: 100dvh !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: #0c0a09 !important;
}

.chronicle-page.chronicle-page--crpg-desktop .page-shell {
  width: 100% !important;
  max-width: none !important;
  height: 100% !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

.chronicle-page.chronicle-page--crpg-desktop .auth-entry {
  display: none !important;
}
</style>
