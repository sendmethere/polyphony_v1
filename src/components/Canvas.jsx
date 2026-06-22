import { useEffect, useRef, useState } from 'react'
import ClusterCard from './ClusterCard.jsx'
import ExpandedRound from './ExpandedRound.jsx'
import { roundDiversity, roundShannon, metricBand } from '../lib/polyphony.js'
import LevelDot from './LevelDot.jsx'
import ScaleViz from './ScaleViz.jsx'

const DIR_LABEL = { seed: '시작', deepen: '심화 ⤵', shift: '전환 ↔', integrate: '통합 ⊕' }
const DENSITY_OPTS = [
  { key: 'full', icon: '≣', title: '펼쳐보기 (소제목+설명+대표의견)' },
  { key: 'mid', icon: '≡', title: '접어보기 (소제목+설명)' },
  { key: 'min', icon: '—', title: '더 접어서 보기 (소제목)' },
]

// 가로 스크롤 캔버스 — 라운드를 세로 열로, 시간을 좌→오른쪽으로.
// mode: 'stage' (학생/교사 무대) | 'admin' (관리자, 내부지표)
export default function Canvas({
  snapshot,
  mode = 'stage',
  showOpinions = false,
  showBriefing = false,
  showMetrics = false,
  hideParametric = false,
  onDeleteOpinion,
  onDeleteCluster,
}) {
  const scrollRef = useRef(null)
  const [density, setDensity] = useState({}) // roundId -> 'full'|'mid'|'min'
  const [expandedId, setExpandedId] = useState(null)
  const rounds = [...(snapshot?.rounds || [])].sort((a, b) => a.index - b.index)
  const expandedRound = rounds.find((r) => r.id === expandedId)

  // 새 라운드가 생기면 최신 열로 스크롤
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  }, [rounds.length])

  if (!rounds.length) {
    return (
      <div className="waiting">
        <div className="pulse">아직 발행된 질문이 없습니다. 대화가 곧 시작됩니다…</div>
      </div>
    )
  }

  return (
    <>
    <div className="canvas" ref={scrollRef}>
      {rounds.map((round) => {
        const clusters = (snapshot.clusters || []).filter((c) => c.roundId === round.id)
        const opinions = (snapshot.opinions || []).filter((o) => o.roundId === round.id)
        const dlevel = density[round.id] || 'min'
        // 우세 군집(최다 의견) — 관리자 뷰에서만 강조. 전부 동수면 강조 안 함.
        const counts = clusters.map((c) => c.opinionIds?.length || 0)
        const maxCount = counts.length ? Math.max(...counts) : 0
        const allSame = counts.length > 0 && counts.every((c) => c === counts[0])
        return (
          <div className="round-col" key={round.id}>
            <div className="round-head">
              <div className="kicker-row">
                <span className="kicker">라운드 {round.index + 1}</span>
                {clusters.length > 0 && (
                  <span className="density-ctl">
                    {DENSITY_OPTS.map((o) => (
                      <button
                        key={o.key}
                        className={dlevel === o.key ? 'on' : ''}
                        title={o.title}
                        onClick={() => setDensity((d) => ({ ...d, [round.id]: o.key }))}
                      >
                        {o.icon}
                      </button>
                    ))}
                    <button title="확장해서 보기" onClick={() => setExpandedId(round.id)}>
                      ⤢
                    </button>
                  </span>
                )}
              </div>
              <div className="q">{round.question}</div>
              <div className={`dir ${round.direction}`}>{DIR_LABEL[round.direction] || ''}</div>
              {showMetrics && clusters.length > 0 && (() => {
                const div = roundDiversity(round, snapshot.clusters, snapshot.opinions)
                const sh = roundShannon(round, snapshot.clusters, snapshot.opinions)
                const band = metricBand((div + sh) / 2) // 두 지표 평균 수준으로 배경색
                return (
                  <div
                    className="round-metrics"
                    style={{ background: band.bg, borderColor: band.border }}
                    title="이 질문의 의견 다양성 / 엔트로피 (학생 무대엔 비공개)"
                  >
                    <span><LevelDot value={div} /> 다양성 {Math.round(div * 100)}%</span>
                    <span><LevelDot value={sh} /> 엔트로피 {Math.round(sh * 100)}%</span>
                  </div>
                )
              })()}
              {showMetrics && round.responseType === 'scale' && (
                <ScaleViz round={round} opinions={snapshot.opinions} hideParametric={hideParametric} />
              )}
              {showBriefing && round.briefing && (
                <div className="briefing">📋 {round.briefing}</div>
              )}
            </div>

            <div className="round-body">
            {clusters.length > 0 ? (
              clusters.map((c) => (
                <ClusterCard
                  key={c.id}
                  cluster={c}
                  opinions={opinions}
                  mode={mode}
                  showOpinions={showOpinions}
                  density={dlevel}
                  isDominant={mode === 'admin' && !allSame && (c.opinionIds?.length || 0) === maxCount && maxCount > 0}
                  onDeleteOpinion={onDeleteOpinion}
                  onDeleteCluster={onDeleteCluster}
                />
              ))
            ) : (
              <div className="cluster-card" style={{ '--voice': '#ccc' }}>
                <div className="summary">
                  {round.status === 'collecting'
                    ? `의견 수집 중… ${mode === 'admin' ? `(${opinions.length}개 도착)` : ''}`
                    : mode === 'admin'
                    ? `수집된 의견 ${opinions.length}개 · 군집화 대기 중`
                    : '군집화 대기 중'}
                </div>
                {/* 관리자는 군집화 전에도 모인 의견 원문을 볼 수 있다 (개별 삭제 가능) */}
                {mode === 'admin' && opinions.length > 0 && (
                  <div className="opinions">
                    {opinions.map((o) => (
                      <div className="op" key={o.id}>
                        <span>
                          {typeof o.score === 'number' && <span className="op-score">{o.score}점</span>}
                          {o.text || <span className="muted">(점수만)</span>}
                        </span>
                        {onDeleteOpinion && (
                          <button className="del-btn" title="이 의견 삭제" onClick={() => onDeleteOpinion(o)}>
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        )
      })}
    </div>
    {expandedRound && (
      <ExpandedRound
        round={expandedRound}
        clusters={(snapshot.clusters || []).filter((c) => c.roundId === expandedRound.id)}
        opinions={(snapshot.opinions || []).filter((o) => o.roundId === expandedRound.id)}
        onClose={() => setExpandedId(null)}
      />
    )}
    </>
  )
}
