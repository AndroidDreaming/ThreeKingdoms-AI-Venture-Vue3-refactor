const ACTION_OUTCOME_RULES = {
  govern: {
    hook: '城中事务',
    summaryTemplate: '我着手整顿{city}的根基，这一回结果是“{tierText}”。',
    tierEffects: {
      great: { governance: 5, supplies: 14, coins: 10, morale: 7, fatigue: 5, influence: 4, renown: 2, strategy: 2 },
      good: { governance: 3, supplies: 9, coins: 6, morale: 4, fatigue: 6, influence: 2, renown: 1, strategy: 1 },
      mixed: { governance: 1, supplies: 5, coins: 3, fatigue: 7, influence: 1 },
      fail: { coins: -6, supplies: -5, morale: -4, fatigue: 8, influence: -2 }
    },
    modes: {
      audit: {
        hook: '清册核账',
        summaryTemplate: '我把{city}手边的钱粮、仓账、人手和缺口先细细翻了一遍，想摸清真正还能调用的底子，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { governance: 4, strategy: 2, coins: 8, supplies: 8, fatigue: 5, influence: 2 },
          good: { governance: 3, strategy: 1, coins: 5, supplies: 5, fatigue: 5, influence: 1 },
          mixed: { governance: 1, coins: 2, fatigue: 6 },
          fail: { coins: -4, influence: -1, fatigue: 8 }
        }
      },
      patrol: {
        hook: '巡乡定纷',
        summaryTemplate: '我亲自去看{city}乡里与街面的秩序，顺手把几桩闹腾的人心和暗里起头的事压了一遍，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { governance: 4, morale: 6, influence: 4, renown: 2, fatigue: 6 },
          good: { governance: 2, morale: 4, influence: 2, renown: 1, fatigue: 7 },
          mixed: { governance: 1, morale: 1, fatigue: 8 },
          fail: { morale: -4, influence: -2, fatigue: 10 }
        }
      },
      granary: {
        hook: '修渠清仓',
        summaryTemplate: '我把渠道、仓口和转运环节重新理了一遍，想让粮秣真正从账面流到手里，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { governance: 4, supplies: 20, coins: 8, morale: 4, fatigue: 7, influence: 2 },
          good: { governance: 3, supplies: 12, coins: 4, morale: 2, fatigue: 8, influence: 1 },
          mixed: { governance: 1, supplies: 6, fatigue: 9 },
          fail: { supplies: -8, coins: -4, fatigue: 10, morale: -2 }
        }
      }
    }
  },
  trade: {
    hook: '商路风向',
    summaryTemplate: '我把手伸向钱粮与商路，这一回结果是“{tierText}”。',
    tierEffects: {
      great: { commerce: 5, coins: 20, supplies: 14, fatigue: 5, influence: 3, renown: 2 },
      good: { commerce: 3, coins: 12, supplies: 8, fatigue: 5, influence: 2, renown: 1 },
      mixed: { commerce: 1, coins: 5, supplies: 3, fatigue: 6, influence: 1 },
      fail: { coins: -8, supplies: -5, fatigue: 8, influence: -2 }
    },
    modes: {
      warehouse: {
        hook: '盘库点货',
        summaryTemplate: '我把现钱、现货和能立刻周转的货路一一盘过，想先从眼前能动的地方挤出活钱，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { commerce: 4, coins: 16, supplies: 10, fatigue: 4, influence: 2 },
          good: { commerce: 3, coins: 10, supplies: 6, fatigue: 5, influence: 1 },
          mixed: { commerce: 1, coins: 4, supplies: 2, fatigue: 6 },
          fail: { coins: -6, fatigue: 8, influence: -1 }
        }
      },
      blackmarket: {
        hook: '偏门货路',
        summaryTemplate: '我绕开明面卡口，去试一条偏门货路，想用险手换快钱和旁处接不到的门路，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { commerce: 4, coins: 22, supplies: 8, influence: 3, renown: 1, fatigue: 6 },
          good: { commerce: 3, coins: 14, supplies: 4, influence: 2, fatigue: 7 },
          mixed: { commerce: 1, coins: 6, influence: 1, fatigue: 8 },
          fail: { coins: -10, influence: -3, renown: -1, fatigue: 10 }
        }
      },
      caravan: {
        hook: '远线商队',
        summaryTemplate: '我把货路往更远的地方压过去，赌的是更大的收益，也赌会不会把新的地界和麻烦一并带回来，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { commerce: 5, coins: 26, supplies: 12, influence: 4, renown: 2, fatigue: 7 },
          good: { commerce: 3, coins: 16, supplies: 7, influence: 2, renown: 1, fatigue: 8 },
          mixed: { commerce: 1, coins: 8, supplies: 2, fatigue: 9 },
          fail: { coins: -12, supplies: -4, influence: -2, fatigue: 11 }
        }
      },
      arms: {
        hook: '军需采办',
        summaryTemplate: '我在{city}采办军需、整点甲械与口粮，先补起军中最缺的那一块，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { commerce: 3, supplies: 20, morale: 3, coins: -10, fatigue: 6, influence: 2, military: 1 },
          good: { commerce: 2, supplies: 12, morale: 2, coins: -8, fatigue: 7, influence: 1, military: 1 },
          mixed: { commerce: 1, supplies: 6, coins: -6, fatigue: 8 },
          fail: { coins: -8, fatigue: 10, influence: -1 }
        }
      }
    }
  },
  diplomacy: {
    hook: '席间试探',
    summaryTemplate: '我试着让别人的条件和我的目的慢慢重合，这一回结果是“{tierText}”。',
    tierEffects: {
      great: { diplomacy: 5, influence: 5, renown: 4, fatigue: 4, strategy: 2 },
      good: { diplomacy: 3, influence: 3, renown: 2, fatigue: 4, strategy: 1 },
      mixed: { diplomacy: 1, influence: 1, fatigue: 5 },
      fail: { influence: -2, fatigue: 6, renown: -1 }
    },
    modes: {
      banquet: {
        hook: '席间会面',
        summaryTemplate: '我借着酒席和场面去试探各路人物的价码与站位，想让真正有分量的话在案边动起来，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { diplomacy: 4, influence: 6, renown: 3, strategy: 1, fatigue: 4 },
          good: { diplomacy: 3, influence: 4, renown: 2, fatigue: 5 },
          mixed: { diplomacy: 1, influence: 2, fatigue: 6 },
          fail: { influence: -3, coins: -2, fatigue: 8 }
        }
      },
      envoy: {
        hook: '递帖通门',
        summaryTemplate: '我先把帖子递进能真正接话的人手里，想给后面的交涉和借势开一道门，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { diplomacy: 4, influence: 4, renown: 2, fatigue: 4 },
          good: { diplomacy: 2, influence: 3, renown: 1, fatigue: 4 },
          mixed: { diplomacy: 1, influence: 1, fatigue: 5 },
          fail: { influence: -2, fatigue: 7 }
        }
      }
    }
  },
  social: {
    hook: '人情往来',
    summaryTemplate: '我去接近那些未来可能影响我的人，这一回结果是“{tierText}”。',
    tierEffects: {
      great: { charm: 4, diplomacy: 2, influence: 3, fatigue: 3, renown: 1 },
      good: { charm: 2, influence: 2, fatigue: 3, diplomacy: 1 },
      mixed: { charm: 1, fatigue: 3, influence: 1 },
      fail: { fatigue: 5, influence: -2 }
    },
    modes: {
      salon: {
        hook: '设席结社',
        summaryTemplate: '我把几路人物邀到同一席上，看谁想靠近、谁想观望、谁想趁机压价，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { charm: 3, diplomacy: 3, influence: 5, renown: 2, fatigue: 4 },
          good: { charm: 2, diplomacy: 2, influence: 3, renown: 1, fatigue: 5 },
          mixed: { charm: 1, influence: 1, fatigue: 6 },
          fail: { influence: -3, coins: -2, fatigue: 8 }
        }
      }
    }
  },
  romance: {
    hook: '灯下私语',
    summaryTemplate: '我把心思放到更近的情分上，试着让一段关系往前走一步，这一回结果是“{tierText}”。',
    tierEffects: {
      great: { charm: 4, influence: 3, morale: 5, coins: -4, fatigue: 4, renown: 2, diplomacy: 1 },
      good: { charm: 2, influence: 2, morale: 3, coins: -3, fatigue: 4, diplomacy: 1 },
      mixed: { charm: 1, coins: -2, fatigue: 4, morale: 1 },
      fail: { influence: -2, morale: -2, coins: -3, fatigue: 6, charm: -1 }
    },
    modes: {
      approach: {
        hook: '借灯试情',
        summaryTemplate: '我借着夜色与空隙去试探对方心意，想把这段关系从熟络慢慢推向更私人的温度，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { charm: 3, morale: 4, influence: 2, coins: -2, fatigue: 4 },
          good: { charm: 2, morale: 2, influence: 1, coins: -2, fatigue: 4 },
          mixed: { charm: 1, morale: 1, coins: -1, fatigue: 4 },
          fail: { morale: -1, coins: -2, fatigue: 6, charm: -1 }
        }
      },
      promise: {
        hook: '试明心迹',
        summaryTemplate: '我不再只绕着气氛兜圈子，而是试着把心意说得更明白些，看对方愿不愿意接住这一句准话，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { charm: 4, morale: 6, influence: 2, coins: -3, fatigue: 4, renown: 1 },
          good: { charm: 2, morale: 4, influence: 1, coins: -3, fatigue: 5 },
          mixed: { morale: 2, coins: -2, fatigue: 5 },
          fail: { morale: -3, influence: -1, coins: -3, fatigue: 7, charm: -1 }
        }
      },
      bond: {
        hook: '共许风雨',
        summaryTemplate: '我试着把这段情分推到真正能并肩担事、互相担风雨的层次，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { charm: 4, morale: 8, influence: 4, diplomacy: 2, coins: -4, fatigue: 5, renown: 2 },
          good: { charm: 2, morale: 5, influence: 2, diplomacy: 1, coins: -4, fatigue: 6, renown: 1 },
          mixed: { morale: 2, influence: 1, coins: -3, fatigue: 6 },
          fail: { morale: -4, influence: -2, coins: -4, fatigue: 8, charm: -1 }
        }
      }
    }
  },
  warpath: {
    hook: '军中试锋',
    summaryTemplate: '我把武学志向压向军旅，试着在战阵和行伍里给自己搏出一条万人敌的路，这一回结果是“{tierText}”。',
    tierEffects: {
      great: { military: 3, troops: 4, morale: 7, renown: 4, supplies: -8, fatigue: 8, battlefieldPrestige: 16 },
      good: { military: 2, troops: 2, morale: 4, renown: 2, supplies: -7, fatigue: 8, battlefieldPrestige: 10 },
      mixed: { military: 1, morale: 1, supplies: -6, fatigue: 9, battlefieldPrestige: 7 },
      fail: { morale: -4, troops: -6, supplies: -6, fatigue: 12, health: -3, battlefieldPrestige: 2 }
    },
    modes: {
      outpost: {
        hook: '前哨军报',
        summaryTemplate: '我带着能用的人手去试探前哨、粮道和斥候线，看看战事到底压到了哪一步，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { military: 3, strategy: 2, morale: 6, renown: 3, supplies: -9, fatigue: 9, battlefieldPrestige: 16 },
          good: { military: 2, strategy: 1, morale: 3, renown: 2, supplies: -8, fatigue: 10, battlefieldPrestige: 11 },
          mixed: { military: 1, strategy: 1, supplies: -7, fatigue: 11, battlefieldPrestige: 7 },
          fail: { morale: -5, supplies: -7, fatigue: 14, health: -3, battlefieldPrestige: 2 }
        }
      },
      join: {
        hook: '投军挂名',
        summaryTemplate: '我去投向对方军中，争一个能随军立功、在阵前站住脚的位置，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { military: 3, troops: 2, morale: 5, renown: 3, supplies: -6, fatigue: 7, battlefieldPrestige: 12 },
          good: { military: 2, troops: 1, morale: 3, renown: 2, supplies: -5, fatigue: 8, battlefieldPrestige: 8 },
          mixed: { military: 1, morale: 1, supplies: -4, fatigue: 9, battlefieldPrestige: 6 },
          fail: { morale: -3, supplies: -4, fatigue: 11, renown: -1, battlefieldPrestige: 2 }
        }
      },
      counsel: {
        hook: '军前进言',
        summaryTemplate: '我当面把战局、粮道和站位掰给对方看，试着让自己的判断真正落到军令里，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { strategy: 4, military: 2, influence: 2, renown: 2, morale: 3, fatigue: 7, battlefieldPrestige: 10 },
          good: { strategy: 2, military: 1, influence: 1, renown: 1, fatigue: 8, battlefieldPrestige: 7 },
          mixed: { strategy: 1, fatigue: 8, battlefieldPrestige: 4 },
          fail: { strategy: -1, influence: -1, fatigue: 10, morale: -2, battlefieldPrestige: 1 }
        }
      },
      assist: {
        hook: '随军助战',
        summaryTemplate: '我不抢主位，只贴着这场战事去补阵脚、顶空当，试着从最硬的地方把自己打进阵前身位，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { military: 3, martialLevel: 1, morale: 5, renown: 3, health: -1, fatigue: 9, battlefieldPrestige: 14 },
          good: { military: 2, morale: 3, renown: 2, health: -1, fatigue: 10, battlefieldPrestige: 9 },
          mixed: { military: 1, morale: 1, fatigue: 10, battlefieldPrestige: 6 },
          fail: { morale: -4, health: -3, fatigue: 13, battlefieldPrestige: 2 }
        }
      },
      logistics: {
        hook: '押送军需',
        summaryTemplate: '我沿着对方军中的粮道、甲械和后路去接军需，试着把真正能决定胜负的后手抓进自己手里，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { military: 2, strategy: 2, supplies: 8, influence: 1, renown: 2, fatigue: 7, battlefieldPrestige: 11 },
          good: { military: 1, strategy: 1, supplies: 5, renown: 1, fatigue: 8, battlefieldPrestige: 8 },
          mixed: { strategy: 1, supplies: 2, fatigue: 8, battlefieldPrestige: 4 },
          fail: { supplies: -5, fatigue: 11, influence: -1, battlefieldPrestige: 1 }
        }
      }
    }
  },
  jianghu: {
    hook: '江湖问剑',
    summaryTemplate: '我不先往官场里挤，而是把脚步踏进江湖、比武和问剑的路上，试着去争那一句天下第一，这一回结果是“{tierText}”。',
    tierEffects: {
      great: { martialLevel: 2, renown: 5, influence: 2, coins: 4, fatigue: 7, jianghuPrestige: 18 },
      good: { martialLevel: 1, renown: 3, influence: 1, coins: 2, fatigue: 7, jianghuPrestige: 12 },
      mixed: { renown: 1, fatigue: 8, jianghuPrestige: 7 },
      fail: { health: -4, fatigue: 10, renown: -1, jianghuPrestige: 2 }
    },
    modes: {
      lodge: {
        hook: '混进茶肆武馆',
        summaryTemplate: '我先挤进江湖人真正说话的地方，想看名号、奇遇和对手会不会自己朝我这边浮出来，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { jianghuPrestige: 14, renown: 3, influence: 2, coins: 2, fatigue: 6 },
          good: { jianghuPrestige: 10, renown: 2, influence: 1, fatigue: 7 },
          mixed: { jianghuPrestige: 5, renown: 1, fatigue: 8 },
          fail: { jianghuPrestige: 1, fatigue: 10, influence: -1 }
        }
      },
      challenge: {
        hook: '挂帖邀战',
        summaryTemplate: '我把名帖挂出去，摆明要请人来试我的手，想让真想踩我、试我或结交我的人都冒出来，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { martialLevel: 1, jianghuPrestige: 18, renown: 5, health: -2, fatigue: 8 },
          good: { martialLevel: 1, jianghuPrestige: 12, renown: 3, health: -2, fatigue: 9 },
          mixed: { jianghuPrestige: 7, renown: 1, fatigue: 10 },
          fail: { health: -5, jianghuPrestige: 2, renown: -1, fatigue: 13 }
        }
      },
      trace: {
        hook: '顺名号追人',
        summaryTemplate: '我顺着城里最响的那一道名号追过去，想看看等着我的是高人、仇家，还是另一条江湖门路，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { jianghuPrestige: 15, renown: 3, strategy: 2, fatigue: 7 },
          good: { jianghuPrestige: 10, renown: 2, strategy: 1, fatigue: 8 },
          mixed: { jianghuPrestige: 5, renown: 1, fatigue: 9 },
          fail: { health: -3, fatigue: 11, jianghuPrestige: 1 }
        }
      }
    }
  },
  martial: {
    hook: '武道进境',
    summaryTemplate: '我把时间砸进了武艺里，这一回结果是“{tierText}”。',
    tierEffects: {
      great: { martialLevel: 3, military: 1, health: -2, fatigue: 7, renown: 2 },
      good: { martialLevel: 2, health: -2, fatigue: 7, renown: 1 },
      mixed: { martialLevel: 1, health: -3, fatigue: 8 },
      fail: { health: -5, fatigue: 10 }
    },
    modes: {
      solo: {
        hook: '闭门磨武',
        summaryTemplate: '我把近几回逼出来的手感和破绽都关进屋里慢慢磨，想让本事真正长成自己的路数，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { martialLevel: 3, martialInsight: 2, health: -2, fatigue: 7, renown: 1 },
          good: { martialLevel: 2, martialInsight: 1, health: -2, fatigue: 7 },
          mixed: { martialLevel: 1, martialInsight: 1, health: -3, fatigue: 8 },
          fail: { health: -5, fatigue: 10 }
        }
      },
      closedoor: {
        hook: '闭关破关',
        summaryTemplate: '我把外面的喧闹先关在门外，逼自己去撞那层迟迟没破开的关口，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { martialLevel: 4, martialInsight: 4, health: -3, fatigue: 8, renown: 2 },
          good: { martialLevel: 2, martialInsight: 2, health: -3, fatigue: 9, renown: 1 },
          mixed: { martialLevel: 1, martialInsight: 1, health: -4, fatigue: 10 },
          fail: { health: -7, fatigue: 12, morale: -2 }
        }
      }
    }
  },
  military: {
    hook: '营中军心',
    summaryTemplate: '我把手伸进兵马与军纪，这一回结果是“{tierText}”。',
    tierEffects: {
      great: { military: 4, morale: 8, supplies: -8, fatigue: 8, renown: 2 },
      good: { military: 2, morale: 4, supplies: -8, fatigue: 9, renown: 1 },
      mixed: { military: 1, morale: 1, supplies: -7, fatigue: 10 },
      fail: { morale: -5, supplies: -8, fatigue: 13, influence: -1 }
    },
    modes: {
      recruit: {
        hook: '募兵蓄卒',
        summaryTemplate: '我在{city}里募人、挑人、压人心，想把能用的新血先攥进自己手里，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { military: 3, morale: 4, supplies: -10, coins: -6, fatigue: 9, renown: 1 },
          good: { military: 2, morale: 2, supplies: -10, coins: -5, fatigue: 10 },
          mixed: { military: 1, supplies: -9, coins: -4, fatigue: 11 },
          fail: { morale: -4, supplies: -10, coins: -3, fatigue: 14, influence: -1 }
        }
      },
      drill: {
        hook: '夜校操练',
        summaryTemplate: '我带着部曲夜里反复排阵、练脚步、练号令，把临敌反应往实战里压一层，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { military: 4, morale: 10, supplies: -9, fatigue: 10, renown: 2 },
          good: { military: 3, morale: 6, supplies: -9, fatigue: 11, renown: 1 },
          mixed: { military: 1, morale: 2, supplies: -8, fatigue: 12 },
          fail: { morale: -6, supplies: -9, fatigue: 15, troops: -4 }
        }
      },
      discipline: {
        hook: '整肃军纪',
        summaryTemplate: '我把最散的地方先抓出来，营里偷滑、暗怠和彼此推诿的一层层往下压，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { military: 3, morale: 12, influence: 2, supplies: -5, fatigue: 8, renown: 1 },
          good: { military: 2, morale: 7, influence: 1, supplies: -5, fatigue: 9 },
          mixed: { military: 1, morale: 3, supplies: -4, fatigue: 10 },
          fail: { morale: -6, influence: -1, supplies: -4, fatigue: 13 }
        }
      },
      camp: {
        hook: '修整营垒',
        summaryTemplate: '我没急着把人往前压，而是先把营寨、哨位、退路和补给线往稳里收，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { military: 4, morale: 8, supplies: 6, fatigue: 8, renown: 1 },
          good: { military: 2, morale: 5, supplies: 3, fatigue: 9 },
          mixed: { military: 1, morale: 2, fatigue: 10 },
          fail: { morale: -4, supplies: -4, fatigue: 13 }
        }
      }
    }
  },
  investigate: {
    hook: '探脉寻踪',
    summaryTemplate: '我把一些线头往更深处追，这一回结果是“{tierText}”。',
    tierEffects: {
      great: { strategy: 4, influence: 3, fatigue: 4, diplomacy: 1 },
      good: { strategy: 2, influence: 2, fatigue: 5 },
      mixed: { strategy: 1, fatigue: 5, influence: 1 },
      fail: { fatigue: 7, influence: -1 }
    },
    modes: {
      terrain: {
        hook: '地势探路',
        summaryTemplate: '我把{city}附近能藏兵、设伏、断路和埋钉的点都摸了一遍，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { strategy: 4, influence: 2, fatigue: 4, diplomacy: 1 },
          good: { strategy: 3, influence: 1, fatigue: 5 },
          mixed: { strategy: 1, fatigue: 6 },
          fail: { fatigue: 7, influence: -1 }
        }
      },
      archive: {
        hook: '翻卷查档',
        summaryTemplate: '我把手边能翻的旧册和旧案理了一遍，想从纸背后把藏着的前因后果一点点抠出来，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { strategy: 5, influence: 3, governance: 1, fatigue: 5 },
          good: { strategy: 3, influence: 2, fatigue: 6 },
          mixed: { strategy: 1, influence: 1, fatigue: 7 },
          fail: { fatigue: 8, influence: -2 }
        }
      },
      historical_lead: {
        hook: '史迹循线',
        summaryTemplate: '我顺着眼前局势背后的旧史实与旧人物找线，想看哪条旧脉络还埋在如今的人心和地界里，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { strategy: 4, diplomacy: 2, influence: 3, renown: 1, fatigue: 5 },
          good: { strategy: 3, diplomacy: 1, influence: 2, fatigue: 6 },
          mixed: { strategy: 1, influence: 1, fatigue: 7 },
          fail: { fatigue: 8, influence: -1 }
        }
      }
    }
  },
  intrigue: {
    hook: '暗线排布',
    summaryTemplate: '我把局面往更深的阴影里推进了一层，这一回结果是“{tierText}”。',
    tierEffects: {
      great: { strategy: 4, diplomacy: 2, influence: 4, fatigue: 6 },
      good: { strategy: 2, influence: 3, fatigue: 7 },
      mixed: { strategy: 1, fatigue: 7, influence: 1 },
      fail: { influence: -2, fatigue: 8, diplomacy: -1 }
    },
    modes: {
      rumor: {
        hook: '放风造势',
        summaryTemplate: '我悄悄丢出一点似真似假的人话，想看谁先急、谁先辩、谁会顺着我的意思自己把口风抖开，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { strategy: 4, influence: 5, diplomacy: 1, fatigue: 6 },
          good: { strategy: 2, influence: 3, fatigue: 7 },
          mixed: { strategy: 1, influence: 1, fatigue: 8 },
          fail: { influence: -3, fatigue: 9, diplomacy: -1 }
        }
      },
      counterspy: {
        hook: '反摸细作',
        summaryTemplate: '我沿着露出来的消息回摸线头，顺着错位的口风去掘谁把眼线塞了进来，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { strategy: 5, influence: 5, diplomacy: 1, fatigue: 7 },
          good: { strategy: 3, influence: 3, fatigue: 8 },
          mixed: { strategy: 1, influence: 1, fatigue: 9 },
          fail: { influence: -4, fatigue: 10, diplomacy: -1 }
        }
      }
    }
  },
  sect: {
    hook: '门中经营',
    summaryTemplate: '我把心思放回山门，慢慢经营门中的人情、路数与位次，这一回结果是“{tierText}”。',
    tierEffects: {
      great: { sectFavor: 8, sectPower: 6, martialLevel: 3, influence: 2, fatigue: 7 },
      good: { sectFavor: 5, sectPower: 4, martialLevel: 1, fatigue: 7 },
      mixed: { sectFavor: 2, sectPower: 1, fatigue: 8 },
      fail: { sectFavor: -4, sectPower: -2, fatigue: 9 }
    },
    modes: {
      recruit: {
        hook: '扩门收人',
        summaryTemplate: '我围着山门周边铺人情、铺名声、铺路数，想看看能不能替这座山门再添几分外缘，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { sectFavor: 8, sectPower: 8, influence: 3, renown: 2, fatigue: 8 },
          good: { sectFavor: 5, sectPower: 5, influence: 2, renown: 1, fatigue: 9 },
          mixed: { sectFavor: 2, sectPower: 2, influence: 1, fatigue: 10 },
          fail: { sectFavor: -4, sectPower: -3, fatigue: 11 }
        }
      },
      inner_drill: {
        hook: '门中演武',
        summaryTemplate: '我回到门中演武场里，把师门路数反复拆解、重练，想把传承里真正能落到手上的东西再吃深一点，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { sectFavor: 5, martialLevel: 3, martialInsight: 3, sectPower: 3, fatigue: 8 },
          good: { sectFavor: 3, martialLevel: 2, martialInsight: 1, sectPower: 2, fatigue: 9 },
          mixed: { sectFavor: 1, martialInsight: 1, fatigue: 10 },
          fail: { sectFavor: -2, health: -3, fatigue: 11 }
        }
      },
      inner_network: {
        hook: '门中走动',
        summaryTemplate: '我没有只顾着练拳练剑，而是去认人、认规矩、认高低，让师长、同门和执事慢慢把我记进眼里，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { sectFavor: 6, influence: 4, diplomacy: 2, sectPower: 3, fatigue: 7 },
          good: { sectFavor: 4, influence: 2, diplomacy: 1, sectPower: 2, fatigue: 8 },
          mixed: { sectFavor: 2, influence: 1, fatigue: 9 },
          fail: { sectFavor: -3, influence: -1, fatigue: 10 }
        }
      },
      outer_visit: {
        hook: '门派外缘',
        summaryTemplate: '我先去别家山门外探口风、递帖子、借场面，想看看有没有人愿意隔着门槛先认一眼，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { diplomacy: 2, influence: 3, renown: 2, jianghuPrestige: 3, fatigue: 6 },
          good: { diplomacy: 1, influence: 2, renown: 1, jianghuPrestige: 2, fatigue: 7 },
          mixed: { influence: 1, jianghuPrestige: 1, fatigue: 8 },
          fail: { influence: -1, renown: -1, fatigue: 9 }
        }
      },
      outer_study: {
        hook: '外缘修行',
        summaryTemplate: '我不急着改换门庭，只借着旁门人物、旧谱残招和对手见识去磨武学的边界，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { martialLevel: 1, martialInsight: 3, renown: 2, jianghuPrestige: 3, fatigue: 7 },
          good: { martialInsight: 2, renown: 1, jianghuPrestige: 2, fatigue: 8 },
          mixed: { martialInsight: 1, jianghuPrestige: 1, fatigue: 9 },
          fail: { health: -2, fatigue: 10 }
        }
      },
      cipher: {
        hook: '拆招悟法',
        summaryTemplate: '我顺着别家的散手、残页和口述去拆招，看哪一层招路能压到自己这套本事上，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { strategy: 3, martialInsight: 3, sectFavor: 3, influence: 2, fatigue: 7 },
          good: { strategy: 2, martialInsight: 2, sectFavor: 2, influence: 1, fatigue: 8 },
          mixed: { strategy: 1, martialInsight: 1, fatigue: 9 },
          fail: { sectFavor: -2, influence: -1, fatigue: 10 }
        }
      }
    }
  },
  rest: {
    hook: '收锋歇息',
    summaryTemplate: '我暂时收住锋芒，把状态往回拽了一截，这一回结果是“{tierText}”。',
    tierEffects: {
      great: { health: 12, fatigue: -20, morale: 5 },
      good: { health: 8, fatigue: -14, morale: 3 },
      mixed: { health: 4, fatigue: -9, morale: 1 },
      fail: { health: 2, fatigue: -4 }
    },
    modes: {
      teahouse: {
        hook: '茶楼小憩',
        summaryTemplate: '我在茶楼里坐了一阵，听着杯盏与闲谈慢慢把神经放松，也顺手捡几句值得记下的风声，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { health: 7, fatigue: -16, morale: 4, strategy: 1 },
          good: { health: 5, fatigue: -12, morale: 2 },
          mixed: { health: 3, fatigue: -8, morale: 1 },
          fail: { health: 1, fatigue: -3 }
        }
      },
      stroll: {
        hook: '夜行城街',
        summaryTemplate: '我趁着夜色沿城街慢慢走了一圈，把胸口压着的闷气散出去，也顺手看看那些白日里没工夫留意的细枝末节，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { health: 6, fatigue: -14, morale: 3, influence: 1 },
          good: { health: 4, fatigue: -10, morale: 2 },
          mixed: { health: 2, fatigue: -7, morale: 1 },
          fail: { fatigue: -2 }
        }
      },
      study: {
        hook: '案前静读',
        summaryTemplate: '我把乱糟糟的念头先摊开，一卷一卷地读，一页一页地记，想让心气和判断重新稳下来，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { health: 5, fatigue: -14, strategy: 3, morale: 2 },
          good: { health: 4, fatigue: -11, strategy: 2, morale: 1 },
          mixed: { health: 2, fatigue: -7, strategy: 1 },
          fail: { fatigue: -3 }
        }
      },
      inn: {
        hook: '投店安睡',
        summaryTemplate: '我找了间稳妥客店，把门一关，先让一夜安睡把前几回积下来的疲态和散乱心气慢慢压下去，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { health: 10, fatigue: -24, morale: 4, coins: -2 },
          good: { health: 7, fatigue: -17, morale: 2, coins: -2 },
          mixed: { health: 4, fatigue: -12, morale: 1, coins: -1 },
          fail: { health: 2, fatigue: -5, coins: -1 }
        }
      },
      medicate: {
        hook: '药汤调息',
        summaryTemplate: '我借药汤、热水和吐纳把筋骨与气息一点点理顺，想把高疲惫和小伤一起按回去，这一回结果是“{tierText}”。',
        tierEffects: {
          great: { health: 12, fatigue: -22, morale: 3, coins: -3 },
          good: { health: 8, fatigue: -16, morale: 2, coins: -2 },
          mixed: { health: 5, fatigue: -11, morale: 1, coins: -1 },
          fail: { health: 3, fatigue: -5, coins: -1 }
        }
      }
    }
  }
};

const STAT_NARRATIVE_RULES = {
  coins: { label: '钱粮', positive: '钱粮又厚了一层', negative: '钱粮又薄了一层' },
  supplies: { label: '粮秣', positive: '粮秣更扎实了些', negative: '粮秣里又空掉了一截' },
  troops: { label: '兵力', positive: '能调动的人手更多了', negative: '手里的兵力又被啃掉了一块' },
  morale: { label: '士气', positive: '众人的气势明显提起来了', negative: '人心里的那口气又散了些' },
  health: { label: '身骨', positive: '身骨缓回来一些', negative: '身骨又吃了亏' },
  fatigue: { label: '疲惫', positive: '疲惫被压下去一些', negative: '疲惫又压上来一层', betterWhenNegative: true },
  renown: { label: '名望', positive: '我的名字又往外传开了一圈', negative: '我的名声被磨掉了一些' },
  influence: { label: '影响', positive: '我能撬动的人和事又多了些', negative: '我能挪动局面的空间被压窄了' },
  governance: { label: '治理', positive: '我对这一摊事的掌控更稳了', negative: '我对这一摊事的把握又虚了一层' },
  commerce: { label: '商路', positive: '我让钱粮周转起来的手感更顺了', negative: '我对商路的把控又散了一截' },
  diplomacy: { label: '外交', positive: '我说的话更容易被人接住了', negative: '我说的话又有些落不到实处' },
  charm: { label: '魅力', positive: '我在人前的吸引力又强了一截', negative: '我在人前的锋面被压下去一些' },
  military: { label: '军略', positive: '我对兵马调度的手感更稳了', negative: '我在军阵上的把握又松了一些' },
  strategy: { label: '谋略', positive: '我对局势的判断更准了', negative: '我对谋划的那层把握又虚了一截' },
  martialLevel: { label: '武艺', positive: '我的武艺明显往上顶了一层', negative: '我的武艺没能压到想要的高度' },
  martialInsight: { label: '武学领悟', positive: '我对路数和火候的理解更深了', negative: '我对这层武学关口的把握又虚了一点' },
  sectFavor: { label: '门中情分', positive: '门里待我的态度更暖了一些', negative: '门里看我的态度又冷下去几分' },
  sectPower: { label: '门派势力', positive: '山门能借到的力更多了一层', negative: '山门如今能借来的势又薄了一些' },
  battlefieldPrestige: { label: '战场威名', positive: '我在军阵里的名字又响了一层', negative: '这场里我还没真正把威名立住' },
  jianghuPrestige: { label: '江湖威名', positive: '我的名号又在江湖里传开了一圈', negative: '我在江湖上的风头还没站稳' }
};

const STAT_IMPACT_PRIORITY = [
  'battlefieldPrestige',
  'jianghuPrestige',
  'renown',
  'troops',
  'morale',
  'supplies',
  'coins',
  'martialLevel',
  'martialInsight',
  'strategy',
  'influence',
  'health',
  'fatigue',
  'sectFavor',
  'sectPower',
  'military',
  'governance',
  'commerce',
  'diplomacy',
  'charm'
];

function getActionOutcomeRule(kind, mode = '') {
  const base = ACTION_OUTCOME_RULES[kind] || null;
  if (!base) return null;
  const key = String(mode || '').trim();
  if (!key || !base.modes || !base.modes[key]) return base;
  const picked = base.modes[key] || {};
  return {
    ...base,
    ...picked,
    tierEffects: picked.tierEffects || base.tierEffects
  };
}

module.exports = {
  ACTION_OUTCOME_RULES,
  STAT_NARRATIVE_RULES,
  STAT_IMPACT_PRIORITY,
  getActionOutcomeRule
};
