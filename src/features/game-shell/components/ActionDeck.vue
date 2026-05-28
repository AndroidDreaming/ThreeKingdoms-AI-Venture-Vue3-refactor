<template>
  <div class="action-deck">
    <div v-if="view.showSetupChoiceDeck" class="choice-group choice-group--setup">
      <div class="choice-group-head choice-group-head--stacked">
        <div class="panel-title panel-title--small">{{ view.setupChoiceDeckTitle }}</div>
        <div class="choice-group-note">{{ view.setupChoiceDeckSummary }}</div>
      </div>
      <div class="choice-grid choice-grid--setup">
        <button
          v-for="choice in view.setupPhaseChoices"
          :key="`setup-${choice.id}`"
          class="choice-card choice-card--setup"
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
          <div class="choice-hint">{{ choice.hint || '先定这一手，故事才会真正起笔。' }}</div>
        </button>
      </div>
    </div>

    <div
      v-if="view.canShowNarrativeDynamicChoices && view.dynamicChoiceSlots.length"
      class="choice-group choice-group--dynamic-hero"
    >
      <div class="choice-group-head">
        <div>
          <div class="panel-title panel-title--small">当前优先动作</div>
          <div class="choice-group-note">先处理正文刚推到台前的动作，它们通常最贴近这一回的推进点。</div>
        </div>
      </div>

      <div v-if="view.isMobileLayout" class="mobile-choice-switch mobile-choice-switch--dynamic">
        <div class="mobile-swipe-hint" aria-hidden="true">
          <span></span>
          <strong>左右滑动查看当前三手</strong>
        </div>
        <div class="mobile-choice-stage mobile-choice-stage--stacked">
          <template v-for="entry in view.dynamicChoiceSlots" :key="`mobile-priority-${entry.slot}-${entry.type}-${entry.choice ? entry.choice.id : 'draft'}`">
            <button
              v-if="entry.type === 'choice'"
              class="choice-card choice-card--dynamic mobile-choice-card mobile-choice-card--priority"
              :class="{ 'choice-card--disabled': entry.choice.disabled, 'mobile-choice-card--active': view.activeMobileDynamicSlot === entry.slot }"
              :disabled="view.interactionBlocked || entry.choice.disabled"
              @touchstart="view.setActiveMobileDynamicSlot(entry.slot)"
              @click="view.submitChoice(entry.choice)"
            >
              <div class="mobile-choice-card__rank">第 {{ Number(entry.slot || 0) + 1 }} 手</div>
              <div class="choice-top">
                <span class="choice-name">{{ entry.choice.text }}</span>
                <div class="choice-tags">
                  <span class="choice-source choice-source--dynamic">当前回合</span>
                  <span class="choice-category">
                    {{ entry.choice.category || view.dynamicSlotMeta(entry.slot, entry.choice.slotRole).note || '动作' }}
                  </span>
                </div>
              </div>
              <div class="choice-hint">{{ entry.choice.hint || '这一手已经被局势推到台前。' }}</div>
              <div v-if="view.choiceForecastText(entry.choice)" class="choice-forecast">
                {{ view.choiceForecastText(entry.choice) }}
              </div>
              <div class="mobile-choice-card__confirm">点击确定落子</div>
            </button>

            <div
              v-else
              class="choice-card choice-card--dynamic choice-card--placeholder mobile-choice-card mobile-choice-card--priority"
              :class="{ 'choice-card--drafting': entry.type === 'draft', 'mobile-choice-card--active': view.activeMobileDynamicSlot === entry.slot }"
              @touchstart="view.setActiveMobileDynamicSlot(entry.slot)"
            >
              <div class="mobile-choice-card__rank">第 {{ Number(entry.slot || 0) + 1 }} 手</div>
              <div class="choice-top">
                <span class="choice-name">
                  {{ entry.label || '这一手正在成形' }}
                  <span
                    v-if="entry.type === 'draft' && entry.draft && entry.draft.isTyping"
                    class="choice-draft-caret"
                  ></span>
                </span>
                <div class="choice-tags">
                  <span class="choice-source choice-source--dynamic">当前回合</span>
                  <span class="choice-category">
                    {{ view.dynamicSlotMeta(entry.slot, entry.draft && entry.draft.slotRole).note || '铺陈中' }}
                  </span>
                </div>
              </div>
              <div class="choice-hint">{{ entry.hint || '正文还在收束，很快会落出可选动作。' }}</div>
              <div class="choice-placeholder-line"></div>
            </div>
          </template>
          <div class="mobile-choice-dots" aria-hidden="true">
            <span
              v-for="entry in view.dynamicChoiceSlots"
              :key="`priority-dot-${entry.slot}`"
              :class="{ active: view.activeMobileDynamicSlot === entry.slot }"
            ></span>
          </div>
        </div>
      </div>

      <div v-else class="choice-grid choice-grid--desktop-text">
        <template v-for="slot in view.dynamicChoiceSlots" :key="`${slot.slot}-${slot.type}-${slot.choice ? slot.choice.id : 'draft'}`">
          <button
            v-if="slot.type === 'choice'"
            class="choice-card choice-card--textbar choice-card--dynamic"
            :class="{ 'choice-card--disabled': slot.choice.disabled }"
            :disabled="view.interactionBlocked || slot.choice.disabled"
            @click="view.submitChoice(slot.choice)"
          >
            <div class="choice-bar-main">
              <span class="choice-name">{{ slot.choice.text }}</span>
              <span class="choice-cost-line">
                {{ view.choiceForecastText(slot.choice) || view.choiceRequirementsText(slot.choice) || slot.choice.hint || '这一手已经被剧情推到台前。' }}
              </span>
            </div>
            <div class="choice-bar-meta">
              <span class="choice-source choice-source--dynamic">当前回合</span>
              <span class="choice-category">{{ slot.choice.category || view.dynamicSlotMeta(slot.slot, slot.choice.slotRole).note || '动作' }}</span>
            </div>
          </button>

          <div
            v-else
            class="choice-card choice-card--textbar choice-card--dynamic choice-card--placeholder"
            :class="{ 'choice-card--drafting': slot.type === 'draft' }"
          >
            <div class="choice-bar-main">
              <span class="choice-name">
                {{ slot.label || '这一手正在成形' }}
                <span v-if="slot.type === 'draft' && slot.draft && slot.draft.isTyping" class="choice-draft-caret"></span>
              </span>
              <span class="choice-cost-line">{{ slot.hint || '正文还在收束，很快会落出可选动作。' }}</span>
            </div>
            <div class="choice-bar-meta">
              <span class="choice-source choice-source--dynamic">当前回合</span>
              <span class="choice-category">{{ view.dynamicSlotMeta(slot.slot, slot.draft && slot.draft.slotRole).note || '铺陈中' }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="view.showFixedActionDeck" class="choice-group choice-group--fixed-hero">
      <div class="choice-group-head choice-group-head--wide">
        <div>
          <div class="panel-title panel-title--small">{{ view.fixedDeckTitle }}</div>
          <div v-if="view.fixedDeckSummary" class="choice-group-note">{{ view.fixedDeckSummary }}</div>
        </div>
      </div>

      <div v-if="view.showRecommendedFixedChoices" class="recommended-strip recommended-strip--hero">
        <button
          v-for="choice in view.recommendedFixedChoices"
          :key="`recommended-${choice.id}`"
          type="button"
          class="recommended-chip"
          :class="{ 'recommended-chip--disabled': view.interactionBlocked || choice.disabled }"
          :disabled="view.interactionBlocked || choice.disabled"
          @click="view.submitChoice(choice)"
        >
          <span class="recommended-chip__label">{{ choice.text }}</span>
          <small class="recommended-chip__meta">
            {{ choice.category || (choice.source === 'dynamic' ? '剧情' : '行动') }} · {{ view.choiceRequirementsText(choice) || view.choiceForecastText(choice) || choice.hint || '适合先落这一手。' }}
          </small>
        </button>
      </div>

      <div v-if="view.isMobileLayout && view.useDirectionPanel" class="mobile-fixed-board">
        <div class="mobile-fixed-board__head">
          <div>
            <div class="section-kicker">常驻行动</div>
            <div class="panel-title panel-title--small">{{ view.activeFixedPanelTitle }}</div>
          </div>
          <div class="mobile-fixed-board__count">{{ view.visibleFixedChoices.length }} 项</div>
        </div>

        <div class="mobile-swipe-hint mobile-swipe-hint--fixed" aria-hidden="true">
          <span></span>
          <strong>左右滑动切换常驻方向</strong>
        </div>

        <div class="mobile-fixed-board__directions">
          <button
            v-for="direction in view.availableFixedDirections"
            :key="`mobile-direction-${direction.key}`"
            type="button"
            class="mobile-fixed-board__pill"
            :class="{ active: direction.key === view.activeChoiceDirection }"
            :disabled="view.interactionBlocked"
            @click="view.setActiveChoiceDirection(direction.key)"
          >
            <span class="mobile-fixed-board__pill-icon" v-html="direction.icon"></span>
            <span>{{ direction.label }}</span>
            <small>{{ direction.availableCount }}/{{ direction.count }}</small>
          </button>
        </div>

        <div class="mobile-fixed-board__cards">
          <template v-for="choice in view.visibleFixedChoices" :key="`mobile-fixed-${choice.source || 'fixed'}-${choice.id}`">
            <div
              v-if="view.isRelationChoice(choice)"
              class="choice-card choice-card--relation choice-card--fixed-mobile-shell"
              :class="{ 'choice-card--disabled': choice.disabled }"
            >
              <button
                class="choice-action-button choice-action-button--fixed-mobile"
                :disabled="view.interactionBlocked || choice.disabled"
                @click="view.submitChoice(choice)"
              >
                <div class="choice-top">
                  <span class="choice-name">{{ choice.text }}</span>
                  <div class="choice-tags">
                    <span class="choice-source">常驻</span>
                    <span class="choice-category">{{ choice.category || '行动' }}</span>
                  </div>
                </div>
                <div class="choice-hint">{{ view.relationChoiceHint(choice) }}</div>
                <div v-if="view.choiceRequirementsText(choice)" class="choice-requirements" :class="{ 'choice-requirements--locked': choice.disabled }">
                  {{ view.choiceRequirementsText(choice) }}
                </div>
              </button>
              <div class="choice-select-wrap">
                <ui-select
                  class="choice-select choice-select--fixed-mobile"
                  :model-value="view.relationChoiceTargets[view.relationChoiceKey(choice)]"
                  :options="view.relationOptionsForChoice(choice).map(relation => ({ label: view.relationOptionLabel(relation), value: relation.id }))"
                  :disabled="view.interactionBlocked || choice.disabled"
                  :clearable="true"
                  :placeholder="view.relationChoicePlaceholder(choice)"
                  prefix-label="对象"
                  @change="view.setRelationChoiceTarget(choice, $event)"
                />
              </div>
            </div>

            <button
              v-else
              class="choice-card choice-card--fixed-mobile"
              :class="{ 'choice-card--disabled': choice.disabled }"
              :disabled="view.interactionBlocked || choice.disabled"
              @click="view.submitChoice(choice)"
            >
              <div class="choice-top">
                <span class="choice-name">{{ choice.text }}</span>
                <div class="choice-tags">
                  <span class="choice-source">常驻</span>
                  <span class="choice-category">{{ choice.category || '行动' }}</span>
                </div>
              </div>
              <div class="choice-hint">{{ choice.hint || '这一手已经摆上台面。' }}</div>
              <div v-if="view.choiceForecastText(choice)" class="choice-forecast">{{ view.choiceForecastText(choice) }}</div>
              <div v-if="view.choiceRequirementsText(choice)" class="choice-requirements" :class="{ 'choice-requirements--locked': choice.disabled }">
                {{ view.choiceRequirementsText(choice) }}
              </div>
            </button>
          </template>
        </div>
      </div>

      <div
        v-else-if="view.useDirectionPanel"
        class="fixed-command-shell fixed-command-shell--hero"
        :class="{
          'fixed-command-shell--mobile': view.isMobileLayout,
          'fixed-command-shell--expanded': view.showFixedDirectionExpanded
        }"
      >
        <aside class="fixed-command-nav fixed-command-nav--hero">
          <div class="fixed-command-nav__head">
            <div class="section-kicker">常驻指令</div>
            <div class="fixed-command-nav__title">按方向落子</div>
            <div class="fixed-command-nav__summary">{{ view.fixedNavSummary }}</div>
          </div>

          <div class="direction-board" :class="{ 'direction-board--mobile': view.isMobileLayout }">
            <div
              v-for="direction in view.availableFixedDirections"
              :key="direction.key"
              class="direction-stack"
              :class="{
                'direction-stack--active': direction.key === view.activeChoiceDirection && view.showFixedDirectionExpanded,
                'direction-stack--mobile': view.isMobileLayout
              }"
            >
              <button
                type="button"
                class="direction-card"
                :class="{
                  active: direction.key === view.activeChoiceDirection && view.showFixedDirectionExpanded,
                  'direction-card--disabled': view.interactionBlocked,
                  'direction-card--mobile': view.isMobileLayout
                }"
                :disabled="view.interactionBlocked"
                @click="view.setActiveChoiceDirection(direction.key)"
              >
                <div class="direction-top">
                  <span class="direction-mark" v-html="direction.icon"></span>
                  <div class="direction-top__copy">
                    <span class="direction-name">{{ direction.label }}</span>
                    <div class="direction-meta-line">
                      <span class="direction-count">{{ direction.count }} 项</span>
                      <span v-if="direction.availableCount !== direction.count" class="direction-count direction-count--dim">
                        {{ direction.availableCount }} 可点
                      </span>
                    </div>
                  </div>
                </div>
                <div v-if="!view.isMobileLayout" class="direction-hint">{{ direction.summary }}</div>
              </button>

              <transition name="direction-inline">
                <div
                  v-if="direction.key === view.activeChoiceDirection && view.showFixedDirectionExpanded"
                  ref="directionExpandedPanel"
                  class="direction-expanded direction-expanded--hero"
                >
                  <div class="direction-expanded-head">
                    <div>
                      <div class="section-kicker">当前分支</div>
                      <div class="panel-title panel-title--small">{{ view.activeFixedPanelTitle }}</div>
                    </div>
                    <div class="direction-expanded-actions">
                      <div class="direction-expanded-count">{{ view.visibleFixedChoices.length }} 项</div>
                      <button
                        v-if="view.activeFixedGroupFilter"
                        type="button"
                        class="tool-button tool-button--subtle direction-collapse"
                        @click="view.clearActiveFixedGroupFilter"
                      >
                        返回全类
                      </button>
                      <button
                        type="button"
                        class="tool-button tool-button--subtle direction-collapse"
                        @click="view.collapseFixedDirectionPanel"
                      >
                        收起
                      </button>
                    </div>
                  </div>

                  <div class="direction-expanded-summary">{{ view.activeFixedPanelSummary }}</div>

                  <div
                    v-if="view.fixedQuickGroupLinks.length"
                    class="fixed-quick-strip"
                    :class="{ 'fixed-quick-strip--mobile': view.isMobileLayout }"
                  >
                    <button
                      v-for="group in view.fixedQuickGroupLinks"
                      :key="group.key"
                      type="button"
                      class="fixed-quick-chip"
                      :class="{ active: view.activeFixedGroupFilter === group.key, 'fixed-quick-chip--disabled': view.interactionBlocked }"
                      :disabled="view.interactionBlocked"
                      @click="view.setActiveFixedGroupFilter(group.key)"
                    >
                      <span class="fixed-quick-chip__label">{{ group.label }}</span>
                      <small v-if="group.summary && !view.isMobileLayout" class="fixed-quick-chip__summary">{{ group.summary }}</small>
                      <strong class="fixed-quick-chip__count">{{ group.count }}</strong>
                    </button>
                  </div>

                  <div v-if="view.isMobileLayout && view.mobileFixedChoiceSections.length" class="mobile-choice-tabs fixed-mobile-section-tabs">
                    <button
                      v-for="section in view.mobileFixedChoiceSections"
                      :key="`fixed-section-${section.key}`"
                      type="button"
                      class="mobile-choice-tab mobile-choice-tab--fixed"
                      :class="{ active: view.activeMobileFixedSection === section.key }"
                      @click="view.setActiveMobileFixedSection(section.key)"
                    >
                      <span>{{ section.label }}</span>
                      <small>{{ section.choices.length }} 项</small>
                    </button>
                  </div>

                  <div class="fixed-group-stack">
                    <section v-for="group in view.renderedFixedChoiceGroups" :key="group.key" class="fixed-group-block">
                      <div class="fixed-group-head">
                        <div>
                          <div class="section-kicker">{{ view.fixedGroupKicker(group) }}</div>
                          <div class="panel-title panel-title--small">{{ group.label }}</div>
                        </div>
                        <div class="fixed-group-count">{{ group.choices.length }} 项</div>
                      </div>
                      <div class="fixed-group-summary">{{ group.summary }}</div>
                      <div class="choice-grid choice-grid--expanded">
                        <template v-for="choice in group.choices" :key="`${choice.source || 'fixed'}::${choice.id}`">
                          <div
                            v-if="view.isRelationChoice(choice)"
                            class="choice-card choice-card--relation"
                            :class="{
                              'choice-card--dynamic': choice.source === 'dynamic',
                              'choice-card--disabled': choice.disabled,
                              'choice-card--fixed-mobile-shell': view.isMobileLayout
                            }"
                          >
                            <button
                              class="choice-action-button"
                              :class="{ 'choice-action-button--fixed-mobile': view.isMobileLayout }"
                              :disabled="view.interactionBlocked || choice.disabled"
                              @click="view.submitChoice(choice)"
                            >
                              <div class="choice-top">
                                <span class="choice-name">{{ choice.text }}</span>
                                <div class="choice-tags">
                                  <span class="choice-source" :class="{ 'choice-source--dynamic': choice.source === 'dynamic' }">
                                    {{ choice.source === 'dynamic' ? '当前回合' : '常驻' }}
                                  </span>
                                  <span class="choice-category">{{ choice.category || (choice.source === 'dynamic' ? '剧情' : '行动') }}</span>
                                </div>
                              </div>
                              <div class="choice-hint">{{ view.relationChoiceHint(choice) }}</div>
                              <div v-if="(!view.isMobileLayout || choice.source === 'dynamic') && view.choiceForecastText(choice)" class="choice-forecast">
                                {{ view.choiceForecastText(choice) }}
                              </div>
                              <div
                                v-if="view.choiceRequirementsText(choice)"
                                class="choice-requirements"
                                :class="{ 'choice-requirements--locked': choice.disabled }"
                              >
                                {{ view.choiceRequirementsText(choice) }}
                              </div>
                            </button>

                            <div class="choice-select-wrap">
                              <div class="choice-select-label">指定对象</div>
                              <ui-select
                                class="choice-select"
                                :class="{ 'choice-select--fixed-mobile': view.isMobileLayout }"
                                :model-value="view.relationChoiceTargets[view.relationChoiceKey(choice)]"
                                :options="view.relationOptionsForChoice(choice).map(relation => ({ label: view.relationOptionLabel(relation), value: relation.id }))"
                                :disabled="view.interactionBlocked || choice.disabled"
                                :clearable="true"
                                :placeholder="view.relationChoicePlaceholder(choice)"
                                prefix-label="对象"
                                @change="view.setRelationChoiceTarget(choice, $event)"
                              />
                            </div>
                          </div>

                          <button
                            v-else
                            class="choice-card"
                            :class="{
                              'choice-card--dynamic': choice.source === 'dynamic',
                              'choice-card--disabled': choice.disabled,
                              'choice-card--fixed-mobile': view.isMobileLayout,
                              'choice-card--action-rail': !view.isMobileLayout
                            }"
                            :disabled="view.interactionBlocked || choice.disabled"
                            @click="view.submitChoice(choice)"
                          >
                            <div class="choice-top">
                              <span class="choice-name">{{ choice.text }}</span>
                              <div class="choice-tags">
                                <span class="choice-source" :class="{ 'choice-source--dynamic': choice.source === 'dynamic' }">
                                  {{ choice.source === 'dynamic' ? '当前回合' : '常驻' }}
                                </span>
                                <span class="choice-category">{{ choice.category || (choice.source === 'dynamic' ? '剧情' : '行动') }}</span>
                              </div>
                            </div>
                            <div class="choice-hint">{{ choice.hint || '这一手已经摆上台面。' }}</div>
                            <div v-if="(!view.isMobileLayout || choice.source === 'dynamic') && view.choiceForecastText(choice)" class="choice-forecast">
                              {{ view.choiceForecastText(choice) }}
                            </div>
                            <div
                              v-if="view.choiceRequirementsText(choice)"
                              class="choice-requirements"
                              :class="{ 'choice-requirements--locked': choice.disabled }"
                            >
                              {{ view.choiceRequirementsText(choice) }}
                            </div>
                          </button>
                        </template>
                      </div>
                    </section>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <div v-if="view.showCustomActionInput && !view.inBattle" class="custom-box">
      <ui-textarea
        :model-value="view.playerInput"
        :rows="3"
        :disabled="view.interactionBlocked"
        placeholder="也可以直接写：去江陵招募船队、拜访谋士、在襄阳整顿商路……"
        @update:modelValue="view.setPlayerInput($event)"
        @enter="view.submitCustom"
      />
      <div class="custom-actions">
        <div class="custom-tip">自由输入只保留给少量定向动作，常规推进优先点上方动作。</div>
        <ui-button variant="primary" :loading="view.aiLoading" :disabled="view.interactionBlocked" @click="view.submitCustom">
          落子
        </ui-button>
      </div>
    </div>
  </div>
</template>

<script>
import UiButton from '@/shared/ui/UiButton.vue';
import UiSelect from '@/shared/ui/UiSelect.vue';
import UiTextarea from '@/shared/ui/UiTextarea.vue';

export default {
  name: 'ActionDeck',
  components: {
    UiButton,
    UiSelect,
    UiTextarea
  },
  props: {
    view: {
      type: Object,
      required: true
    }
  },
  methods: {
    getDirectionExpandedElement() {
      const ref = this.$refs.directionExpandedPanel;
      return Array.isArray(ref) ? ref[0] || null : ref || null;
    }
  }
};
</script>

<style scoped lang="less">
.action-deck {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.choice-group--setup,
.choice-group--dynamic-hero,
.choice-group--fixed-hero {
  position: relative;
  padding: 16px;
  border: 1px solid rgba(224, 189, 137, 0.12);
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(214, 171, 107, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(26, 20, 19, 0.84), rgba(17, 14, 15, 0.94));
  box-shadow: inset 0 1px 0 rgba(255, 244, 227, 0.05);
}

.choice-group--setup {
  border-color: rgba(218, 159, 94, 0.2);
  background:
    radial-gradient(circle at top left, rgba(168, 68, 52, 0.12), transparent 30%),
    linear-gradient(180deg, rgba(29, 21, 18, 0.92), rgba(16, 13, 14, 0.98));
}

.choice-group--dynamic-hero::after,
.choice-group--setup::after,
.choice-group--fixed-hero::after {
  content: '';
  position: absolute;
  inset: auto 16px 0 auto;
  width: 120px;
  height: 1px;
  background: linear-gradient(90deg, rgba(223, 185, 129, 0), rgba(223, 185, 129, 0.42));
}

.choice-group-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.choice-group-head--stacked {
  display: grid;
}

.choice-grid {
  display: grid;
  gap: 10px;
}

.choice-grid--setup {
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
}

.choice-card {
  width: 100%;
  min-height: 74px;
  padding: 13px 14px;
  border: 1px solid rgba(224, 189, 137, 0.14);
  border-radius: 16px;
  background: rgba(255, 244, 227, 0.045);
  color: #f0ddbd;
  font: inherit;
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
  transition: transform .16s ease, border-color .18s ease, background .18s ease, opacity .18s ease, filter .18s ease;
}

.choice-card:active {
  transform: scale(.985);
}

.choice-card--setup {
  min-height: 112px;
  border-color: rgba(221, 154, 92, 0.22);
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.075), rgba(255, 244, 227, 0.035)),
    rgba(96, 39, 30, 0.12);
}

.choice-card--disabled {
  opacity: .48;
  filter: grayscale(.65);
  cursor: not-allowed;
}

.choice-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.choice-tags {
  display: inline-flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px;
}

.choice-source,
.choice-category {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 3px 7px;
  border: 1px solid rgba(224, 189, 137, 0.16);
  border-radius: 999px;
  color: #d9c5a7;
  background: rgba(255, 244, 227, 0.055);
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}

.choice-hint,
.choice-forecast,
.choice-requirements {
  margin-top: 8px;
}

.choice-group-note,
.direction-hint,
.direction-expanded-summary,
.fixed-command-nav__summary,
.fixed-group-summary,
.choice-hint,
.choice-cost-line,
.custom-tip,
.recommended-chip__meta {
  font-size: 12px;
  line-height: 1.6;
}

.choice-name {
  font-size: 16px;
  line-height: 1.42;
}

.recommended-chip__label,
.direction-name,
.fixed-command-nav__title {
  font-size: 15px;
  font-weight: 700;
}

.choice-group--dynamic-hero {
  border-color: rgba(93, 162, 137, 0.22);
  background:
    radial-gradient(circle at top right, rgba(83, 154, 137, 0.14), transparent 30%),
    linear-gradient(180deg, rgba(24, 37, 33, 0.9), rgba(16, 19, 18, 0.96));
}

.choice-group--fixed-hero {
  border-color: rgba(224, 189, 137, 0.12);
}

.choice-source--dynamic {
  color: #d8fff1;
  border-color: rgba(93, 189, 153, 0.28);
  background: rgba(61, 145, 119, 0.2);
}

.direction-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.direction-stack--mobile {
  gap: 8px;
}

.direction-inline-enter-active,
.direction-inline-leave-active {
  transition: opacity .22s ease, transform .22s ease, max-height .26s ease;
  overflow: hidden;
}

.direction-inline-enter-from,
.direction-inline-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  max-height: 0;
}

.direction-inline-enter-to,
.direction-inline-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 2200px;
}

.direction-expanded--hero {
  margin-top: 0;
  background:
    radial-gradient(circle at top left, rgba(215, 175, 117, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(23, 18, 18, 0.96), rgba(14, 11, 12, 0.98));
}

.recommended-strip--hero {
  margin-bottom: 2px;
}

.mobile-fixed-board {
  position: relative;
  display: grid;
  gap: 12px;
}

.mobile-fixed-board::before,
.mobile-fixed-board::after {
  content: '';
  position: absolute;
  top: 74px;
  z-index: 2;
  width: 26px;
  height: 50px;
  pointer-events: none;
}

.mobile-fixed-board::before {
  left: -2px;
  background: linear-gradient(90deg, rgba(31, 24, 20, 0.96), rgba(31, 24, 20, 0));
}

.mobile-fixed-board::after {
  right: -2px;
  background: linear-gradient(270deg, rgba(31, 24, 20, 0.96), rgba(31, 24, 20, 0));
}

.mobile-choice-switch--dynamic {
  position: relative;
}

.mobile-choice-switch--dynamic::before,
.mobile-choice-switch--dynamic::after {
  content: '';
  position: absolute;
  top: 34px;
  z-index: 2;
  width: 28px;
  height: 52px;
  pointer-events: none;
}

.mobile-choice-switch--dynamic::before {
  left: -2px;
  background: linear-gradient(90deg, rgba(20, 34, 30, 0.96), rgba(20, 34, 30, 0));
}

.mobile-choice-switch--dynamic::after {
  right: -2px;
  background: linear-gradient(270deg, rgba(20, 34, 30, 0.96), rgba(20, 34, 30, 0));
}

.mobile-swipe-hint {
  display: none;
}

.mobile-fixed-board__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mobile-fixed-board__count {
  flex: 0 0 auto;
  padding: 6px 9px;
  border-radius: 999px;
  background: rgba(255, 244, 227, 0.06);
  color: #d8c29f;
  font-size: 12px;
}

.mobile-fixed-board__directions {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.mobile-fixed-board__directions::-webkit-scrollbar {
  display: none;
}

.mobile-fixed-board__pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  min-height: 46px;
  padding: 8px 10px;
  border: 1px solid rgba(224, 189, 137, 0.13);
  border-radius: 999px;
  background: rgba(255, 244, 227, 0.045);
  color: #d9c5a7;
  font: inherit;
  cursor: pointer;
  transition: transform .16s ease, color .18s ease, background .18s ease, border-color .18s ease;
  touch-action: manipulation;
}

.mobile-fixed-board__pill:active {
  transform: scale(.96);
}

.mobile-fixed-board__pill.active {
  color: #fff2dc;
  border-color: rgba(207, 74, 62, 0.34);
  background:
    linear-gradient(180deg, rgba(146, 45, 38, 0.34), rgba(87, 31, 28, 0.18)),
    rgba(255, 244, 227, 0.06);
}

.mobile-fixed-board__pill-icon {
  width: 18px;
  height: 18px;
  color: currentColor;
}

.mobile-fixed-board__pill-icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.mobile-fixed-board__pill small {
  color: rgba(230, 207, 174, 0.72);
  font-size: 11px;
}

.mobile-fixed-board__cards {
  display: grid;
  gap: 10px;
}

.choice-card--textbar .choice-bar-main {
  gap: 6px;
}

.custom-actions {
  align-items: center;
}

.custom-tip {
  max-width: 72%;
}

@media (max-width: 820px) {
  .choice-group--setup,
  .choice-group--dynamic-hero,
  .choice-group--fixed-hero {
    padding: 14px;
    border-radius: 22px;
  }

  .choice-group--dynamic-hero {
    box-shadow:
      inset 0 1px 0 rgba(221, 255, 241, 0.08),
      0 16px 30px rgba(15, 45, 37, 0.18);
  }

  .choice-group-head {
    margin-bottom: 10px;
  }

  .choice-grid--setup {
    grid-template-columns: 1fr;
  }

  .choice-card--setup {
    min-height: 104px;
    padding: 14px;
  }

  .mobile-swipe-hint {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin: -2px 0 8px;
    color: rgba(216, 255, 241, 0.74);
    font-size: 11px;
    line-height: 1;
  }

  .mobile-swipe-hint span {
    position: relative;
    width: 26px;
    height: 12px;
    border-radius: 999px;
    border: 1px solid rgba(111, 211, 172, 0.32);
  }

  .mobile-swipe-hint span::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 5px;
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: rgba(216, 255, 241, 0.82);
    animation: dynamicSwipeDot 1.6s ease-in-out infinite;
  }

  .mobile-swipe-hint strong {
    font-weight: 500;
  }

  .mobile-swipe-hint--fixed {
    color: rgba(245, 211, 166, 0.76);
    margin-bottom: 0;
  }

  .mobile-swipe-hint--fixed span {
    border-color: rgba(214, 174, 116, 0.34);
  }

  .mobile-swipe-hint--fixed span::before {
    background: rgba(245, 211, 166, 0.86);
  }

  .mobile-choice-tabs--dynamic {
    scroll-snap-type: x proximity;
    padding-inline: 18px;
    margin-inline: -14px;
  }

  .mobile-fixed-board__directions {
    scroll-snap-type: x proximity;
    padding-inline: 18px;
    margin-inline: -14px;
  }

  .mobile-fixed-board__pill {
    scroll-snap-align: start;
  }

  .mobile-choice-tabs--dynamic .mobile-choice-tab {
    scroll-snap-align: start;
  }

  .choice-group-note,
  .fixed-command-nav__summary,
  .fixed-group-summary,
  .direction-expanded-summary {
    display: none;
  }

  .custom-tip {
    max-width: none;
  }
}

@keyframes dynamicSwipeDot {
  0%,
  100% {
    transform: translateX(0);
    opacity: .52;
  }
  45% {
    transform: translateX(10px);
    opacity: 1;
  }
}

@media (max-width: 820px) {
  .mobile-choice-switch--dynamic::before,
  .mobile-choice-switch--dynamic::after {
    display: none;
  }

  .mobile-choice-stage--stacked {
    display: grid;
    gap: 12px;
    max-height: ~"min(65vh, 560px)";
    overflow-y: auto;
    padding: 2px 2px 6px;
    scroll-snap-type: y proximity;
    -webkit-overflow-scrolling: touch;
  }

  .mobile-choice-card--priority {
    position: relative;
    min-height: 136px;
    padding: 16px 15px 15px;
    border-radius: 18px;
    scroll-snap-align: start;
    transform-origin: center;
    transition:
      transform .16s ease,
      box-shadow .18s ease,
      border-color .18s ease,
      background .18s ease;
    overflow: hidden;
  }

  .mobile-choice-card--priority::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background:
      radial-gradient(circle at var(--tap-x, 50%) var(--tap-y, 50%), rgba(236, 211, 168, .2), transparent 34%),
      linear-gradient(180deg, rgba(255, 244, 227, .04), transparent 45%);
    opacity: 0;
    pointer-events: none;
    transition: opacity .16s ease;
  }

  .mobile-choice-card--priority:active {
    transform: scale(.975);
    box-shadow: 0 10px 28px rgba(0, 0, 0, .34);
  }

  .mobile-choice-card--priority:focus {
    z-index: 2;
    transform: scale(1.018);
    outline: none;
    box-shadow:
      0 18px 42px rgba(0, 0, 0, .42),
      0 0 0 1px rgba(226, 183, 117, .34);
  }

  .mobile-choice-card--priority:active::before {
    opacity: 1;
  }

  .mobile-choice-card--active {
    border-color: rgba(226, 183, 117, .42);
    background:
      radial-gradient(circle at 16% 0%, rgba(219, 174, 109, .14), transparent 32%),
      linear-gradient(180deg, rgba(39, 28, 22, .96), rgba(18, 14, 13, .98));
  }

  .mobile-choice-card__rank {
    width: fit-content;
    margin-bottom: 9px;
    padding: 4px 8px;
    border-radius: 999px;
    color: #f0d8b3;
    background: rgba(255, 244, 227, .07);
    border: 1px solid rgba(214, 174, 116, .16);
    font-size: 11px;
    font-weight: 800;
    line-height: 1;
  }

  .mobile-choice-card__confirm {
    margin-top: 12px;
    color: rgba(239, 218, 184, .82);
    font-size: 12px;
    font-weight: 800;
    line-height: 1.2;
  }

  .mobile-choice-dots {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: center;
    gap: 7px;
    padding: 8px 0 2px;
    background: linear-gradient(180deg, transparent, rgba(18, 14, 13, .9) 42%);
  }

  .mobile-choice-dots span {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: rgba(209, 196, 169, .28);
    transition: width .16s ease, background .16s ease;
  }

  .mobile-choice-dots span.active {
    width: 20px;
    background: #d5a766;
  }

  .recommended-strip--hero {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    overflow: visible;
  }

  .recommended-chip {
    min-height: 92px;
    border-radius: 17px;
    white-space: normal;
    text-align: left;
  }
}
</style>
