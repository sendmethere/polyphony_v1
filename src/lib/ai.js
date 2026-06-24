// ─────────────────────────────────────────────────────────────
// AI 엔진 (Anthropic Claude) — 관리자 기기에서만 호출.
// API 키는 관리자 브라우저 localStorage 에만 저장. 절대 Firestore/학생 기기로 보내지 않는다.
//
// 핵심 원칙(대화주의): AI 는 결론을 내리는 권위가 아니라 "차이를 드러내는 조력자".
//  - 순위/다수/우세를 매기지 않는다.
//  - 외톨이(어디에도 안 묶이는) 의견을 억지로 흡수하지 않는다.
//
// 키가 없으면 오프라인 휴리스틱 폴백으로 동작(데모 가능, 결과에 offline 표시).
// ─────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'polyphony:settings'
const API_URL = 'https://api.anthropic.com/v1/messages'

export function getSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY)
  return raw ? JSON.parse(raw) : { apiKey: '', model: 'claude-opus-4-8' }
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  return next
}

export function hasApiKey() {
  return !!getSettings().apiKey
}

async function callClaude(prompt, { maxTokens = 2000 } = {}) {
  const { apiKey, model } = getSettings()
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // 프로토타입: 브라우저에서 직접 호출 허용 (배포 시 서버/Cloud Functions 로 이전 권장)
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 300)}`)
  }
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

// 세션 제목 + 이전 질문/브리핑을 하나의 맥락 블록으로 만든다.
// 모든 생성(질문 제안·테스트 답변·회고)에서 대화의 연속성을 유지하기 위해 공통으로 쓴다.
function buildContextBlock(title, history = []) {
  const lines = []
  if (title && title !== '제목 없는 세션') lines.push(`이 토론의 주제: "${title}"`)
  if (history.length) {
    lines.push('지금까지 오간 질문과 답변 브리핑:')
    history.forEach((h, i) => {
      lines.push(`  [${i + 1}] 질문: ${h.question}`)
      if (h.briefing) lines.push(`      브리핑: ${h.briefing}`)
    })
  }
  return lines.length ? lines.join('\n') + '\n\n' : ''
}

// 외톨이(독립/소수 목소리) 판정 — 결정론적·일관적.
// 기준: 혼자(1명)이거나, 그 라운드 전체 의견의 10% 미만인 군집.
const OUTLIER_SHARE = 0.1
function markOutliers(clusters, total) {
  return clusters.map((c) => {
    const n = c.opinionIds?.length || 0
    return { ...c, isOutlier: n === 1 || (total > 0 && n / total < OUTLIER_SHARE) }
  })
}

// 모델 응답에서 JSON 블록만 안전하게 추출
function parseJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('JSON 파싱 실패')
  const slice = body.slice(start, end + 1)
  try {
    return JSON.parse(slice)
  } catch {
    // 모델이 가끔 객체 사이 쉼표를 빠뜨리거나 트레일링 쉼표를 남김 → 흔한 실수만 보정 후 재시도
    const repaired = slice
      .replace(/}\s*{/g, '},{') // 배열 원소 사이 누락된 쉼표
      .replace(/,\s*([}\]])/g, '$1') // 트레일링 쉼표
    return JSON.parse(repaired)
  }
}

// ── 1) 군집화 ──────────────────────────────────────────────
// opinions: [{id, text}]  →  { clusters:[{label,summary,opinionIds}], outliers:[{...}], offline }
// granularity: 'coarse'(크게 묶기) | 'balanced'(보통) | 'fine'(세밀하게 나누기)
const GRANULARITY_RULE = {
  coarse:
    '2. **되도록 크게 묶으세요.** 핵심 입장이 같으면 표현이 달라도 한 군집으로. 사소한 차이로 쪼개지 말고, 대부분 비슷하면 군집은 1~2개로.',
  balanced:
    '2. 핵심 관점이 같으면 묶되, **분명히 다른 이유·근거·방향**이면 별도 군집으로 나누세요. 보통 3~5개 정도가 적당합니다.',
  fine:
    '2. **차이를 적극적으로 살리세요.** 이유·근거·강조점·뉘앙스가 조금이라도 다르면 별도 군집으로 나눠주세요. 군집이 많아져도 좋습니다. (비슷해 보여도 다른 점이 있으면 합치지 마세요.)',
}

export async function clusterOpinions(opinions, { question = '', title = '', history = [], scaleNote = '', granularity = 'balanced' } = {}) {
  if (!opinions.length) return { clusters: [], offline: false }
  if (!hasApiKey()) return { ...offlineCluster(opinions, scaleNote), offline: true }

  const ctx = buildContextBlock(title, history)
  const list = opinions.map((o) => `- [${o.id}] ${o.text}`).join('\n')
  const prompt = `당신은 대화주의(dialogism)에 기반한 토론 도구의 조력자입니다.

${ctx}아래는 "${question}" 라는 질문에 대한 학습자들의 의견입니다.

서로 "의미가 비슷한" 의견끼리 군집(cluster)으로 묶어주세요. 다음 원칙을 반드시 지키세요:
1. 순위·다수·우세를 매기지 마세요. 어떤 군집도 "정답"이나 "더 나은 의견"이 아닙니다. 서로 다른 관점일 뿐입니다.
${GRANULARITY_RULE[granularity] || GRANULARITY_RULE.balanced}
3. 어디에도 자연스럽게 속하지 않는 "외톨이(outlier)" 의견은 outliers 로 따로 두세요. 차이는 보존되어야 합니다.
4. 각 군집에는 중립적이고 짧은 라벨과, 그 관점을 요약한 한 문장을 다세요. (어느 관점이 우세하다는 뉘앙스 금지)
5. 이번 라운드에 어떤 의견들이 오갔는지 200자 이내의 짧은 브리핑(briefing)을 쓰세요. 어느 의견이 많았다/우세하다고 쓰지 말고, "어떤 서로 다른 생각들이 나왔는지"를 담담히 요약하세요.
6. **라벨·요약·브리핑은 모두 초등학생도 바로 이해할 수 있는 쉬운 말로 쓰세요.** 어려운 한자어·전문용어·추상적 표현을 피하고, 짧고 친근한 일상어로. (예: "상호작용" 대신 "서로 주고받는 것")
${scaleNote ? `7. 이 질문은 척도형(점수+의견)입니다: ${scaleNote} 브리핑에 점수 분포(평균이 어느 쪽인지, 의견이 얼마나 모였는지/갈렸는지)도 한 줄 자연스럽게 포함하세요.\n` : ''}
의견 목록:
${list}

아래 JSON 형식으로만 답하세요:
{
  "briefing": "200자 이내 브리핑",
  "clusters": [
    { "label": "짧은 라벨", "summary": "이 관점 한 문장 요약", "opinionIds": ["o_xxx", ...] }
  ],
  "outliers": [
    { "label": "그 의견 자체를 가리키는 짧은 라벨", "summary": "왜 독립적인지 한 문장", "opinionIds": ["o_yyy"] }
  ]
}`

  const text = await callClaude(prompt)
  const json = parseJson(text)
  // AI가 clusters/outliers 어느 배열에 넣었든, 외톨이 여부는 우리가 결정론적으로 판정 → 일관성 유지.
  const all = markOutliers([...(json.clusters || []), ...(json.outliers || [])], opinions.length)
  const briefing = (json.briefing || '').slice(0, 200)
  return { clusters: all, briefing, offline: false }
}

// ── 2) 후속 질문 제안 (심화 deepen / 전환 shift) ────────────────
// 지금까지 오간 질문/답변 맥락(history)을 모두 투입해서 생성한다.
// history: [{ question, briefing }]  (시간순, 마지막이 직전 라운드)
// clusters: 직전 라운드 군집 [{label, summary}]
// →  { deepen:[...], shift:[...], offline }
export async function proposeFollowups(clusters, { history = [], question = '', title = '' } = {}) {
  if (!hasApiKey()) return { ...offlineFollowups(clusters), offline: true }

  const ctx = buildContextBlock(title, history)
  const list = clusters.map((c) => `- ${c.label}: ${c.summary}`).join('\n')

  const prompt = `당신은 대화주의 토론 도구의 조력자입니다.

${ctx}직전 질문 "${question}" 에 대한 답변은 아래 군집들로 나타났습니다.
${list}

이 흐름을 이어받아, 다음 라운드 질문 후보를 세 갈래로 제안하세요. 각 2~3개씩.
- deepen(심화): 방금까지의 이야기를 더 파고드는 질문. "그렇다면…", "그런데…", "그러면…" 같은 말로 자연스럽게 이어서, 직전 답변을 한 걸음 더 들어가게 하세요.
- shift(전환): 같은 주제를 다른 각도에서 보게 하는 질문. "한편…", "다르게 생각해보면…" 같은 말로 시작해, 지금까지 안 나온 관점을 열어주세요.
- integrate(통합): 서로 다른 군집(관점)들을 모아 잇게 하는 질문. "이 여러 생각을 모아보면…", "함께 생각하면…" 같은 말로, 여러 목소리를 한자리에 놓고 보게 하세요. (단, 하나의 정답으로 합치라는 게 아니라 관계를 보게 하는 것)

각 질문은 유형(type)도 정하세요:
- "open"(서술형) 또는 "scale"(척도형: 동의 정도·찬반·정도를 점수로 + 이유 의견). 갈래마다 적어도 하나는 척도형(scale)을 섞어보세요. 척도형이면 scaleMax(4/5/7) 와 양 끝 의미 minLabel(1점)·maxLabel(최고점)도 그 질문에 맞게 정하세요. minLabel/maxLabel에는 "1점:" 같은 접두어를 넣지 말고 의미 문구만.

원칙:
- 반드시 위의 맥락(이전 질문/브리핑)을 이어받아, 대화가 실제로 연결되게 하세요. 갑자기 새로운 주제로 튀지 마세요.
- 정답을 유도하거나 어떤 관점이 옳다고 암시하지 마세요.
- 질문은 쉬운 수준으로. 초등 고학년~중학생도 바로 이해할 짧고 친근한 말로. 어려운 용어 금지.

아래 JSON 형식으로만 답하세요:
{ "deepen": [ {"text":"그렇다면 …?","type":"open"}, {"text":"…","type":"scale","scaleMax":5,"minLabel":"1점의 뜻","maxLabel":"최고점의 뜻"} ], "shift": [ {"text":"…","type":"open"} ], "integrate": [ {"text":"…","type":"open"} ] }`

  const text = await callClaude(prompt)
  const json = parseJson(text)
  return {
    deepen: normalizeQs(json.deepen),
    shift: normalizeQs(json.shift),
    integrate: normalizeQs(json.integrate),
    offline: false,
  }
}

// ── 1.5) 첫 질문(여는 질문) 추천 ────────────────────────────
// topic: 세션 제목/주제  →  { questions:[...], offline }
export async function proposeFirstQuestions(topic = '') {
  if (!hasApiKey()) return { questions: offlineFirstQuestions(topic), offline: true }
  const prompt = `당신은 대화주의(dialogism) 토론을 여는 조력자입니다. ${
    topic ? `주제는 "${topic}" 입니다.` : '아직 주제가 정해지지 않았습니다.'
  }

이 토론을 시작할 "여는 질문(opening question)" 후보를 4개 제안하세요. 유형을 다양하게 섞으세요:
- type "open" (서술형): 자유롭게 생각을 적는 질문.
- type "scale" (척도형): 동의 정도·찬반·정도를 점수로 답하기 좋은 질문. scaleMax 는 4/5/7 중 적절히(보통 5). 척도형도 "왜 그 점수인지" 의견을 함께 받습니다.
  척도형은 반드시 양 끝 의미를 정하세요: minLabel(1점이 뜻하는 것), maxLabel(가장 높은 점수가 뜻하는 것). 그 질문에 맞는 구체적인 말로. (예: "전혀 관심 없다", "매우 관심 있다") minLabel/maxLabel에는 "1점:", "5점:" 같은 접두어를 절대 넣지 말고 의미 문구만 쓰세요.
4개 중 최소 1개는 척도형(scale)으로 만드세요.

원칙:
- 정답이 없는 열린 질문. 사람마다 다르게 답할 수 있어야 합니다.
- 누구나 자기 경험에서 바로 답할 수 있게 쉽고 친근하게. 한 문장, 짧게. 어려운 용어 금지.

아래 JSON 형식으로만 답하세요:
{ "questions": [ { "text": "질문", "type": "open" }, { "text": "질문", "type": "scale", "scaleMax": 5, "minLabel": "1점의 뜻", "maxLabel": "최고점의 뜻" } ] }`
  const text = await callClaude(prompt, { maxTokens: 900 })
  const json = parseJson(text)
  return { questions: normalizeQs(json.questions), offline: false }
}

// 추천 질문 항목을 {text, type, scaleMax, minLabel, maxLabel} 로 정규화
function normalizeQs(arr) {
  return (arr || []).map((q) => {
    if (typeof q === 'string') return { text: q, type: 'open', scaleMax: 5 }
    const type = q.type === 'scale' ? 'scale' : 'open'
    const o = { text: q.text || '', type, scaleMax: q.scaleMax || 5 }
    if (type === 'scale') {
      // AI가 라벨에 "1점:", "5점 :" 같은 접두어를 붙여 보내는 경우가 있어 제거(중첩 방지)
      const stripPt = (s) => (s || '').replace(/^\s*\d+\s*점\s*[:：]?\s*/, '').trim()
      o.minLabel = stripPt(q.minLabel) || '전혀 아니다'
      o.maxLabel = stripPt(q.maxLabel) || '매우 그렇다'
      // 질문 텍스트에 양 끝 의미를 한 번만 덧붙임 (이미 "N점:" 패턴이 있으면 건너뜀)
      if (!/\d\s*점\s*[:：]/.test(o.text)) {
        o.text = `${o.text} (1점: ${o.minLabel} ~ ${o.scaleMax}점: ${o.maxLabel})`
      }
    }
    return o
  })
}

function offlineFirstQuestions(topic) {
  const t = topic && topic !== '제목 없는 세션' ? topic : '이 주제'
  return [
    { text: `${t}에 대해, 여러분이 가장 먼저 떠오르는 생각은 무엇인가요?`, type: 'open', scaleMax: 5 },
    { text: `${t}에 대해 얼마나 관심이 있나요?`, type: 'scale', scaleMax: 5, minLabel: '전혀 관심 없다', maxLabel: '매우 관심 있다' },
    { text: `${t}와 관련해 인상 깊었던 경험이 있나요?`, type: 'open', scaleMax: 5 },
    { text: `${t}이(가) 중요하다고 어느 정도 생각하나요?`, type: 'scale', scaleMax: 7, minLabel: '전혀 안 중요하다', maxLabel: '매우 중요하다' },
  ]
}

// ── 3) 종료 회고 요약 (비위계적 voice 지도) ──────────────────
export async function summarizeRetrospective(snapshot) {
  const { rounds, clusters } = snapshot
  if (!hasApiKey()) {
    return {
      text:
        '[오프라인 요약] 이 세션에서 다음과 같은 서로 다른 voice들이 등장했습니다:\n' +
        clusters.map((c) => `• ${c.label} — ${c.summary}`).join('\n'),
      offline: true,
    }
  }
  const lines = rounds
    .map((r) => {
      const cs = clusters.filter((c) => c.roundId === r.id)
      return `[라운드 ${r.index + 1}] ${r.question}\n` + cs.map((c) => `  - ${c.label}: ${c.summary}`).join('\n')
    })
    .join('\n\n')
  const prompt = `아래는 대화주의 토론 세션의 전체 전개입니다.

${lines}

이 대화를 회고하는 글을 써주세요. 단, 절대 "어떤 의견이 우세했다/이겼다/결론이다"라고 쓰지 마세요. 대신 "이 대화 안에 어떤 서로 다른 목소리(voice)들이 살아있었는지", "어디서 차이가 갈라지고(divergence) 어디서 만났는지(convergence)"를 비위계적으로 그려주세요. 결론이 아니라 "차이의 지도"입니다. 한국어로 4~6문장.`
  const text = await callClaude(prompt, { maxTokens: 1000 })
  return { text: text.trim(), offline: false }
}

// ── (테스트용) 가상 학생 의견 생성 ─────────────────────────
// question 에 대해 서로 다른 관점의 짧은 의견 n개를 생성. 군집화 테스트용.
// title/history(이전 질문+브리핑)를 맥락으로 넣어, 답변이 대화 흐름을 잃지 않게 한다.
// diversity: 'high' | 'mid' | 'low'. scale: 척도형이면 { max, minLabel, maxLabel }, 서술형이면 null.
// 반환: { items: [{ text, score|null }], offline }  — 척도형은 점수와 "그 점수에 맞는 이유"가 한 쌍.
export async function generateTestOpinions(question, { n = 8, title = '', history = [], diversity = 'high', scale = null } = {}) {
  if (!hasApiKey()) {
    return { items: offlineTestOpinions(question, n, diversity, scale), offline: true }
  }
  const ctx = buildContextBlock(title, history)
  const DIVERSITY_RULE = {
    high: '- 관점을 최대한 다양하게 갈라지게: 서로 동의하지 않는 입장을 많이, 완전히 동떨어진 외톨이 의견도 2~3개 섞어줘.',
    mid: '- 관점을 적당히 2~3갈래로 나눠줘: 몇 개의 비슷한 입장 무리가 생기되, 그 안에서 조금씩 다르게.',
    low: '- 관점을 거의 한두 갈래로 수렴시켜줘: 대부분 비슷한 입장을 말하고, 표현만 조금씩 달라지게. 강한 반대는 넣지 마.',
  }
  const scaleBlock = scale
    ? `이 질문은 ${scale.max}점 척도형입니다. 1점 = "${scale.minLabel || '전혀 아니다'}", ${scale.max}점 = "${scale.maxLabel || '매우 그렇다'}".
각 학생은 1~${scale.max} 중 점수(score)를 고르고, **그 점수와 방향이 반드시 일치하는 이유**(text, 1~2문장)를 적어야 합니다. (낮은 점수 → 부정적/소극적 이유, 높은 점수 → 긍정적/적극적 이유. 점수와 이유가 모순되면 안 됨.)
${DIVERSITY_RULE[diversity]} 점수 분포도 이 다양성 규칙을 따르게 하세요(low=점수가 한두 값에 몰림, high=전 범위로 퍼지고 양 극단 포함).`
    : `${DIVERSITY_RULE[diversity] || DIVERSITY_RULE.high}\n각 답변은 1~2문장의 구어체 한국어.`

  const fmt = scale
    ? `{ "items": [ { "score": 4, "text": "그 점수를 준 이유" }, ... ] }`
    : `{ "items": [ { "text": "답변" }, ... ] }`

  const BATCH = 10
  const all = []
  let remaining = n
  while (remaining > 0) {
    const take = Math.min(BATCH, remaining)
    const prompt = `${ctx}지금 이 교실에서 "${question}" 라는 질문이 새로 나왔어. 위의 대화 흐름을 이어받아, 서로 다른 학생 ${take}명의 답변을 만들어줘.

원칙:
- 위 대화 맥락을 이어받아, 갑자기 딴 얘기로 새지 말 것. 지금 질문에 대한 답이어야 함.
- 구어체 한국어, 학생이 직접 쓴 듯 자연스럽게.
${scaleBlock}

아래 JSON 형식으로만 답해줘:
${fmt}`
    const text = await callClaude(prompt, { maxTokens: take * 160 + 400 })
    const json = parseJson(text)
    const items = (json.items || []).map((it) => ({
      text: it.text || '',
      score: scale && typeof it.score === 'number' ? Math.max(1, Math.min(scale.max, Math.round(it.score))) : null,
    }))
    all.push(...items)
    remaining -= take
  }
  return { items: all.slice(0, n), offline: false }
}

function offlineTestOpinions(question, n, diversity = 'high', scale = null) {
  // 척도형: 점수와 "그 점수에 맞는 이유"를 한 쌍으로 생성
  if (scale) {
    const max = scale.max
    const minL = scale.minLabel || '전혀 아니다'
    const maxL = scale.maxLabel || '매우 그렇다'
    const out = []
    for (let i = 0; i < n; i++) {
      let v
      if (diversity === 'low') v = Math.round((max + 1) / 2) + ((i % 3) - 1)
      else if (diversity === 'mid') v = 2 + ((i * 2) % Math.max(1, max - 1))
      else v = 1 + (i % max)
      v = Math.max(1, Math.min(max, v))
      const ratio = (v - 1) / (max - 1)
      let text
      if (ratio <= 0.25) text = `${v}점. "${minL}" 쪽에 가까워. 별로 그렇게 느끼진 않아.`
      else if (ratio >= 0.75) text = `${v}점. "${maxL}" 쪽이야. 꽤 그렇다고 생각해.`
      else text = `${v}점. 중간쯤이야. 그럴 때도, 아닐 때도 있어.`
      out.push({ text, score: v })
    }
    return out
  }
  // 서술형
  const diverse = [
    '나는 이게 제일 중요하다고 생각해. 다른 건 부차적이야.',
    '솔직히 잘 모르겠어. 경우에 따라 다른 것 같아.',
    '정반대로 생각해. 그건 오히려 문제를 키울 수 있어.',
    '맥락이 중요하지. 상황마다 답이 달라질 거야.',
    '개인의 자유가 우선이라고 봐.',
    '공동체 전체를 먼저 생각해야 한다고 생각해.',
    '경험상 그건 이상적인 얘기일 뿐이야.',
    '데이터나 근거가 있어야 믿을 수 있어.',
    '감정과 관계가 핵심이라고 느껴.',
    '아무도 말 안 하지만, 사실 돈 문제 아닐까?',
    '시간이 지나면 자연스럽게 풀릴 일 같아.',
    '제도나 규칙을 바꿔야 진짜 해결돼.',
  ]
  let pool
  if (diversity === 'low') pool = ['나는 이게 제일 중요하다고 생각해.', '맞아, 이게 가장 중요한 것 같아.', '나도 비슷해. 이게 핵심이지.', '응 이게 제일 중요해.']
  else if (diversity === 'mid') pool = diverse.slice(0, 4)
  else pool = diverse
  const out = []
  for (let i = 0; i < n; i++) out.push({ text: pool[i % pool.length], score: null })
  return out
}

// ── 오프라인 휴리스틱 폴백 ──────────────────────────────────
// 단어 겹침 기반의 아주 단순한 군집화. (키 없이 사이클 데모용)
function offlineCluster(opinions, scaleNote = '') {
  const tokens = (t) =>
    new Set(
      t
        .toLowerCase()
        .replace(/[.,!?。、！？]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1)
    )
  const groups = []
  for (const o of opinions) {
    const ot = tokens(o.text)
    let placed = false
    for (const g of groups) {
      const overlap = [...ot].filter((w) => g.tokens.has(w)).length
      if (overlap >= 1) {
        g.opinionIds.push(o.id)
        for (const w of ot) g.tokens.add(w)
        placed = true
        break
      }
    }
    if (!placed) groups.push({ tokens: ot, opinionIds: [o.id], seed: o.text })
  }
  let clusters = []
  for (const g of groups) {
    clusters.push({
      label: g.seed.slice(0, 18) + (g.seed.length > 18 ? '…' : ''),
      summary: '(오프라인) 단어가 겹치는 의견들',
      opinionIds: g.opinionIds,
    })
  }
  clusters = markOutliers(clusters, opinions.length)
  let briefing = '[오프라인] 이런 생각들이 나왔어요: ' + clusters.map((c) => c.label).join(' / ')
  if (scaleNote) briefing += ` ${scaleNote}`
  briefing = briefing.slice(0, 200)
  return { clusters, briefing }
}

function offlineFollowups(clusters) {
  const first = clusters[0]?.label || '이 주제'
  const second = clusters[1]?.label || '다른 생각'
  return {
    deepen: [
      { text: `그렇다면, "${first}"는 왜 그렇게 생각하게 됐나요?`, type: 'open', scaleMax: 5 },
      { text: `그런데, 그 생각에 얼마나 확신하나요?`, type: 'scale', scaleMax: 5, minLabel: '전혀 확신 없다', maxLabel: '매우 확신한다' },
    ],
    shift: [
      { text: `한편, 다르게 생각해보면 아무도 말 안 한 점은 뭘까요?`, type: 'open', scaleMax: 5 },
      { text: `한편, 입장을 바꿔 보면 어떻게 보일까요?`, type: 'open', scaleMax: 5 },
    ],
    integrate: [
      { text: `이 여러 생각을 모아보면, "${first}"와 "${second}"는 어떻게 이어질까요?`, type: 'open', scaleMax: 5 },
      { text: `서로 다른 생각들에 얼마나 공감하나요?`, type: 'scale', scaleMax: 5, minLabel: '전혀 공감 안 된다', maxLabel: '매우 공감한다' },
    ],
  }
}
