// 동등 채도 팔레트 — 어떤 voice도 시각적으로 우월해 보이지 않게,
// 모든 색은 같은 채도(S)·명도(L)를 쓰고 색상(H)만 다르게 한다.
// (대화주의 무대 원칙: 색의 "강도" 차이로 우열을 암시하지 않는다)

const SAT = 42 // 동일 채도
const LIGHT = 62 // 동일 명도

// 황금각으로 색상환을 고르게 분배 → 인접 군집도 잘 구분됨
export function voiceColor(index) {
  const hue = (index * 137.508) % 360
  return `hsl(${hue.toFixed(1)} ${SAT}% ${LIGHT}%)`
}

export function voiceColorSoft(index) {
  const hue = (index * 137.508) % 360
  return `hsl(${hue.toFixed(1)} ${SAT}% 92%)`
}
