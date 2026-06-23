import { metricLevel } from '../lib/polyphony.js'

// 진행자에게 "다음에 무엇을 할지" 안내하는 헬퍼 — 규칙 기반 의사결정 트리(생성형 아님).
// 현재 세션/라운드 상태와 다양성에 따라 메시지를 고른다.
function decide({ sessionClosed, hasRound, hasProposal, hasFollowups, roundStatus, opinionCount, diversity, effective, isScale }) {
  if (sessionClosed) {
    return { tone: 'done', text: '세션이 종료되었어요. 📜 세션 회고로 대화를 돌아보거나, [세션 재개]·[.xlsx 내보내기]를 쓸 수 있어요.' }
  }
  if (!hasRound) {
    return { tone: 'go', text: '첫 질문을 발행하세요. ✨ "첫 질문 추천받기"로 시작하거나, 직접 작성한 뒤 [발행 →]을 누르세요.' }
  }
  if (hasProposal) {
    return { tone: 'go', text: 'AI가 군집안을 제안했어요. 라벨·브리핑을 다듬은 뒤 [군집 확정]을 누르면 무대에 반영됩니다.' }
  }
  if (roundStatus === 'collecting') {
    if (!opinionCount) {
      return { tone: 'wait', text: '학생들의 응답을 기다리는 중이에요. (미리 보려면 🧪 "테스트 의견 생성"으로 가상 응답을 넣어볼 수 있어요.)' }
    }
    return { tone: 'go', text: `응답이 ${opinionCount}개 모였어요. 충분히 모였다면 [수집 마감]을 누르세요.` }
  }
  if (roundStatus === 'closed') {
    return { tone: 'go', text: '의견 수집이 끝났어요. [② AI 군집화 실행]으로 의견을 묶거나, ✋ 수동 분류 편집으로 직접 분류할 수 있어요. (차이를 더 드러내려면 군집화를 "세밀"로.)' }
  }
  if (roundStatus === 'clustered') {
    const div = diversity != null ? ` (다양성 ${Math.round(diversity * 100)}%` + (effective != null ? `, 유효 ${effective.toFixed(1)}종` : '') + ')' : ''
    const lv = diversity != null ? metricLevel(diversity).key : 'mid'
    const tail = " 아래 '다음 질문'에서 ✨ AI 제안을 받거나 직접 작성해 발행하세요. 혹은 토론을 마치려면 [세션 종료]."
    if (lv === 'low') {
      return {
        tone: 'tip',
        text: `다양성이 낮게 나타났어요${div}. 사실상 한두 종으로 모인 셈이라, 더 다양한 의견이 나올 개방형 질문이나 "전환(다르게 생각해보면…)"을 권해요.${tail}`,
      }
    }
    if (lv === 'high') {
      return {
        tone: 'tip',
        text: `다양한 voice가 살아있어요${div}. 이 차이를 깊이 파는 "심화"나, 여러 목소리를 잇는 "통합"으로 이어가 보세요.${tail}`,
      }
    }
    return {
      tone: 'go',
      text: `여러 voice가 나왔어요${div}.${isScale ? ' 척도형이면 일치도 A·중앙값도 함께 보세요.' : ''}${tail}`,
    }
  }
  return { tone: 'go', text: '진행 패널의 버튼으로 다음 단계를 이어가세요.' }
}

export default function Guide(props) {
  const g = decide(props)
  return (
    <div className={`guide guide-${g.tone}`}>
      <span className="guide-icon">🧭</span>
      <span>{g.text}</span>
    </div>
  )
}
