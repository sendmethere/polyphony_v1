import { voiceColor, voiceColorSoft } from '../lib/colors.js'

// 동등 카드. mode:
//  'stage'  → 학생/교사 무대: 크기·색강도·카운트 동등, 우세 은폐
//  'admin'  → 관리자: 내부 지표(인원수) 표시
// density: 'full' (소제목+설명+대표의견) | 'mid' (소제목+설명) | 'min' (소제목)
export default function ClusterCard({
  cluster,
  opinions,
  mode = 'stage',
  showOpinions = false,
  density = 'full',
  isDominant = false,
  onDeleteOpinion,
  onDeleteCluster,
}) {
  const color = voiceColor(cluster.colorIndex ?? 0)
  const soft = voiceColorSoft(cluster.colorIndex ?? 0)
  const members = opinions.filter((o) => cluster.opinionIds?.includes(o.id))

  // 무대(stage)에서는 개수 유추를 막기 위해 예시 의견을 최대 1개만 보여준다.
  // 전체 의견 목록과 외톨이 표시는 관리자(admin) 전용.
  const isAdmin = mode === 'admin'
  const shown = isAdmin ? members : members.slice(0, 1)

  const showSummary = density !== 'min'
  const showExample = density === 'full'

  return (
    <div
      className={`cluster-card ${isAdmin && isDominant ? 'dominant' : ''} ${
        isAdmin && cluster.isOutlier ? 'outlier' : ''
      }`}
      style={{ '--voice': color, '--voice-soft': soft }}
    >
      <div className="card-head">
        <div className="label">{cluster.label}</div>
        {isAdmin && onDeleteCluster && (
          <button
            className="del-btn"
            title="이 군집(과 속한 의견)을 삭제"
            onClick={() => onDeleteCluster(cluster)}
          >
            ✕
          </button>
        )}
      </div>
      {showSummary && cluster.summary && <div className="summary">{cluster.summary}</div>}
      {isAdmin && cluster.isOutlier && showSummary && (
        <div className="outlier-mark">↳ 소수·독립 목소리 (10% 미만)</div>
      )}

      {showOpinions && showExample && shown.length > 0 && (
        <div className="opinions">
          {shown.map((o) => (
            <div className="op" key={o.id}>
              <span>
                {typeof o.score === 'number' && <span className="op-score">{o.score}점</span>}
                {o.text || <span className="muted">(점수만)</span>}
              </span>
              {isAdmin && onDeleteOpinion && (
                <button className="del-btn" title="이 의견 삭제" onClick={() => onDeleteOpinion(o)}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 관리자 전용: 무대에는 절대 노출되지 않는 내부 지표 (접어도 항상 표시) */}
      {isAdmin && (
        <div className="admin-meta">
          의견 {cluster.opinionIds?.length ?? 0}개{isDominant && ' · 최다'}
        </div>
      )}
    </div>
  )
}
