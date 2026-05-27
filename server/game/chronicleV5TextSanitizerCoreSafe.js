const TOKENS = {
  yanwuA: '\u5a75\u72b3\u6d18\u59ca\u5f52\ue517',
  yanwuB: '\u6fe0\u7535\u59f5\u5a32\u6a3a\ue74f\u8930\u639d\u6546',
  yanwuLegacy: '\u6fe0\u66df\u68b9\u9852',
  menguiA: '\u95c2\u509a\u5036\u9354',
  menguiB: '\u95c2\u509a\u5038\u934a\u5815\u5d1d\u5be4',
  menguiLegacy: '\u95c2\u5098\u528f',
  menpaiA: '\u95c2\u509a\u5036\u9354\u5d85\u01ce',
  menpaiB: '\u95c2\u509a\u5038\u934a\u5815\u5d1d\u5ba5\u5433',
  menpaiLegacy: '\u95c2\u5098\u528d\u5a23',
  noSectA: '\u95c1\u54c4\u5570\u6fde\u20ac\u6fe1\ue0ab\u525f\u5bee\ue1c0\u60a9\u94cf\ue0a4\u5132',
  noSectB: '\u95c2\u4f78\u642b\u935f\u7248\u7e5b\u9227\ue101\u4fca\u9850\ue0a2\u58b4\u7035\ue1c5\u5663\u93ae\u2545\u6439\u9850\u3085\u529c',
  noSectLegacy: '\u95ba\u51aa\u5a00\u59ab\ue104\u5f2e\u9418\u866b\u70e6',
  soloA: '\u95c1\u7ed8\u746f\u9353\u6fcb\u5d35\u5a4a\u581f\u5690\u95bf\u65bf\u58bd\u942d',
  soloB: '\u95c2\u4f7a\u7caf\u941f\ue21e\u5d1c\u5a75\u5b2a\u5439\u6fe0\u5a42\u724a\u9364\u6130\u67e8\u93c2\u57ae\u2494\u95bb',
  soloLegacy: '\u95bb\u6b18\u525d\u9364\u6ec8\u61df\u9514\u5267\u77ca',
  restA: '\u95c1\u6d3b\u53ce\u9358\u85c9\u2593\u8e47\u6d98\u7a97\u6fe1\ue21d\ue18a\u7ef1',
  restB: '\u95c2\u4f79\u693f\u9359\u5ea8\u5d22\u9498\u5922\u6794\u97eb\u56e8\u7a11\u7ed0\u6941\u4fca\u9856\u6fd0\u553a\u7f01',
  restLegacy: '\u95bb\ue167\u53bd\u5a08\u5fdb\u5d30\u59af\u8bb3\u7d16',
  shaolinA: '\u940f\u5fd4\u57b6\u940f\u52ef\u68bb\u928a\ue7d1\u6f50\u6fde',
  wudangA: '\u6fee\u6fd3\u7b91\u7f0d\u5b2e\u68bb\u928a\ue7d1\u6f50\u6fde'
};

const punctuationTail = '[^\\s,.;:!?，。；：、！？]{0,6}';

const REPLACEMENTS = [
  [new RegExp(`(?:${TOKENS.yanwuA}|${TOKENS.yanwuB}|${TOKENS.yanwuLegacy})\\??`, 'g'), '演武'],
  [new RegExp(`(?:${TOKENS.menguiA}|${TOKENS.menguiB}|${TOKENS.menguiLegacy})${punctuationTail}`, 'g'), '门规'],
  [new RegExp(`(?:${TOKENS.menpaiA}|${TOKENS.menpaiB}|${TOKENS.menpaiLegacy})\\??`, 'g'), '门派'],
  [new RegExp(`(?:${TOKENS.noSectA}|${TOKENS.noSectB}|${TOKENS.noSectLegacy})`, 'g'), '无门无派'],
  [new RegExp(`(?:${TOKENS.soloA}|${TOKENS.soloB}|${TOKENS.soloLegacy})\\??`, 'g'), '独自苦练'],
  [new RegExp(`(?:${TOKENS.restA}|${TOKENS.restB}|${TOKENS.restLegacy})\\??`, 'g'), '短暂歇息'],
  [new RegExp(`${TOKENS.shaolinA}\\??`, 'g'), '少林门规'],
  [new RegExp(`${TOKENS.wudangA}\\??`, 'g'), '武当门规'],
  [/\u951b[?？]/g, '，'],
  [/\u9286[?？]/g, '。'],
  [/少林门规派/g, '少林门规'],
  [/武当门规派/g, '武当门规']
];

const MOJIBAKE_MARKERS = new RegExp([
  TOKENS.yanwuA,
  TOKENS.yanwuB,
  TOKENS.yanwuLegacy,
  TOKENS.menguiA,
  TOKENS.menguiB,
  TOKENS.menguiLegacy,
  TOKENS.menpaiA,
  TOKENS.menpaiB,
  TOKENS.menpaiLegacy,
  TOKENS.noSectA,
  TOKENS.noSectB,
  TOKENS.noSectLegacy,
  TOKENS.soloA,
  TOKENS.soloB,
  TOKENS.soloLegacy,
  TOKENS.restA,
  TOKENS.restB,
  TOKENS.restLegacy,
  TOKENS.shaolinA,
  TOKENS.wudangA,
  '[\\uE000-\\uF8FF\\uFFFD]'
].join('|'));

function sanitizeChronicleText(value, fallback = '') {
  const text = String(value || '').trim();
  if (!text) return fallback;

  const sanitized = REPLACEMENTS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text
  )
    .replace(/[\uE000-\uF8FF\uFFFD]+/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return sanitized || fallback;
}

function hasObviousMojibake(value) {
  return MOJIBAKE_MARKERS.test(String(value || ''));
}

module.exports = {
  sanitizeChronicleText,
  hasObviousMojibake
};
