import { metricLevel } from '../lib/polyphony.js'

// 진행자에게 "다음에 무엇을 할지" 안내하는 헬퍼 — 규칙 기반 의사결정 트리(생성형 아님).
// 현재 세션/라운드 상태와 다양성에 따라 메시지를 고른다.
function decide({ sessionClosed, hasRound, hasProposal, hasFollowups, roundStatus, opinionCount, diversity, isScale }) {
  if (sessionClosed) {
    return { tone: 'done', text: '세션이 종료되었어요. 📜 세션 회고로 대화를 돌아보거나 .xlsx로 결과를 내보낼 수 있어요.' }
  }
  if (!hasRound) {
    return { tone: 'go', text: '첫 질문을 발행하세요. ✨ "첫 질문 추천받기"로 시작하거나, 직접 작성한 뒤 [발행 →]을 누르세요.' }
  }
  if (hasProposal) {
    return { tone: 'go', text: 'AI가 군집안을 제안했어요. 라벨·브리핑을 다듬은 뒤 [군집 확정]을 누르면 무대에 반영됩니다.' }
  }
  if (hasFollowups) {
    return { tone: 'go', text: '후속 질문 후보 중 하나를 고르거나 직접 다듬은 뒤 [다음 라운드 발행 →]을 누르세요.' }
  }
  if (roundStatus === 'collecting') {
    if (!opinionCount) {
      return { tone: 'wait', text: '학생들의 응답을 기다리는 중이에요. (미리 보려면 🧪 "테스트 의견 생성"으로 가상 응답을 넣어볼 수 있어요.)' }
    }
    return { tone: 'go', text: `응답이 ${opinionCount}개 모였어요. 충분히 모였다면 [수집 마감]을 누르세요.` }
  }
  if (roundStatus === 'closed') {
    return { tone: 'go', text: '의견 수집이 끝났어요. [② AI 군집화 실행]으로 의견을 묶어보세요. 차이를 더 드러내려면 군집화를 "세밀"로 두면 좋아요.' }
  }
  if (roundStatus === 'clustered') {
    const pct = diversity != null ? Math.round(diversity * 100) : null
    const lv = diversity != null ? metricLevel(diversity).key : 'mid'
    const endHint = ' 혹은 토론을 여기서 마치려면 [세션 종료]를 누르세요.'
    if (lv === 'low') {
      return {
        tone: 'tip',
        text: `현재 다양성이 낮게 나타났어요${pct != null ? ` (${pct}%)` : ''}. 더 다양한 의견이 나올 수 있는 개방형 질문이나, "전환(다르게 생각해보면…)" 질문을 제시하는 게 어떨까요? [③ 후속 질문 제안받기]를 눌러보세요.${endHint}`,
      }
    }
    if (lv === 'high') {
      return {
        tone: 'tip',
        text: `다양한 voice가 살아있어요${pct != null ? ` (${pct}%)` : ''}. 이 차이를 더 깊이 들여다보는 "심화" 질문이나, 여러 목소리를 잇는 "통합" 질문으로 이어가 보세요. [③ 후속 질문 제안받기].${endHint}`,
      }
    }
    return {
      tone: 'go',
      text: `여러 voice가 나왔어요${pct != null ? ` (다양성 ${pct}%)` : ''}. [③ 후속 질문 제안받기]로 다음 질문을 받아보세요.${isScale ? ' (척도형은 점수 일치도도 함께 살펴보세요.)' : ''}${endHint}`,
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
