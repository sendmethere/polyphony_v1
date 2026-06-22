// 현재 사이클 페이즈를 가독성 있게 보여주는 스텝 바.
// 라운드 내 3단계: 의견 수집 → 군집화 → 후속 질문. + 세션 종료/시작 상태.
const STEPS = [
  { key: 'collect', label: '의견 수집' },
  { key: 'cluster', label: '군집화' },
  { key: 'follow', label: '후속 질문' },
]

export default function PhaseBar({ round, sessionClosed, hasProposal, hasFollowups }) {
  let activeKey = null
  let note = ''

  if (sessionClosed) {
    note = '세션이 종료되었습니다.'
  } else if (!round) {
    note = '첫 질문을 발행해 토론을 시작하세요.'
  } else if (round.status === 'collecting') {
    activeKey = 'collect'
    note = '학생들의 의견을 모으는 중입니다.'
  } else if (round.status === 'closed') {
    activeKey = 'cluster'
    note = hasProposal ? '군집안을 검토하고 확정하세요.' : 'AI 군집화를 실행하세요.'
  } else if (round.status === 'clustered') {
    activeKey = 'follow'
    note = hasFollowups ? '후속 질문을 골라 발행하세요.' : '후속 질문을 제안받거나, 토론을 마치세요.'
  }

  const activeIdx = STEPS.findIndex((s) => s.key === activeKey)

  return (
    <div className="phasebar">
      <span className="phasebar-round">
        {sessionClosed ? '종료' : round ? `라운드 ${round.index + 1}` : '시작 전'}
      </span>
      <div className="phasebar-steps">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`phasebar-step ${i === activeIdx ? 'active' : ''} ${
              activeIdx > -1 && i < activeIdx ? 'done' : ''
            }`}
          >
            <span className="phasebar-num">{i + 1}</span>
            {s.label}
          </div>
        ))}
      </div>
      <span className="phasebar-note">{note}</span>
    </div>
  )
}
