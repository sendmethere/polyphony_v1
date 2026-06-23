import { useState } from 'react'
import { createPortal } from 'react-dom'
import { store } from '../lib/store.js'
import { makeId } from '../lib/id.js'
import { voiceColor, voiceColorSoft } from '../lib/colors.js'

// 수동 분류(군집) 편집 — 분류 생성/수정/삭제 + 의견 넣기/빼기. 저장 시 store.setClusters 로 반영.
export default function ClusterEditor({ code, round, snapshot, onClose }) {
  const opinions = snapshot.opinions.filter((o) => o.roundId === round.id)
  const opText = (id) => opinions.find((o) => o.id === id)
  const existing = snapshot.clusters.filter((c) => c.roundId === round.id)

  const [clusters, setClusters] = useState(() =>
    existing.map((c) => ({ id: c.id, label: c.label, summary: c.summary || '', opinionIds: [...(c.opinionIds || [])] }))
  )

  const unassigned = opinions.filter((o) => !clusters.some((c) => c.opinionIds.includes(o.id)))

  const addCluster = () =>
    setClusters((cs) => [...cs, { id: makeId('c'), label: `분류 ${cs.length + 1}`, summary: '', opinionIds: [] }])
  const delCluster = (id) => setClusters((cs) => cs.filter((c) => c.id !== id))
  const rename = (id, label) => setClusters((cs) => cs.map((c) => (c.id === id ? { ...c, label } : c)))
  const editSummary = (id, summary) => setClusters((cs) => cs.map((c) => (c.id === id ? { ...c, summary } : c)))
  const assign = (opId, clusterId) =>
    setClusters((cs) =>
      cs
        .map((c) => ({ ...c, opinionIds: c.opinionIds.filter((id) => id !== opId) }))
        .map((c) => (c.id === clusterId ? { ...c, opinionIds: [...c.opinionIds, opId] } : c))
    )
  const removeFrom = (opId) =>
    setClusters((cs) => cs.map((c) => ({ ...c, opinionIds: c.opinionIds.filter((id) => id !== opId) })))

  function save() {
    const total = opinions.length
    const out = clusters
      .filter((c) => c.opinionIds.length > 0 || c.label.trim())
      .map((c, i) => ({
        ...c,
        colorIndex: i,
        isOutlier: c.opinionIds.length === 1 || (total > 0 && c.opinionIds.length / total < 0.1),
      }))
    store.setClusters(code, round.id, out, round.briefing || '')
    onClose()
  }

  return createPortal(
    // 바깥 클릭으로 닫히지 않게(편집 중 실수 방지) — 닫기/취소 버튼으로만 닫는다.
    <div className="modal-backdrop">
      <div className="expanded editor" onClick={(e) => e.stopPropagation()}>
        <div className="editor-scroll">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: 0 }}>수동 분류 편집</h2>
              <div className="tiny muted">라운드 {round.index + 1} · {round.question}</div>
            </div>
            <button className="ghost" onClick={onClose}>✕ 닫기</button>
          </div>

          {/* 분류들 */}
          <div className="editor-grid">
            {clusters.map((c) => (
              <div key={c.id} className="cluster-card" style={{ '--voice': voiceColor(c.colorIndex ?? 0), '--voice-soft': voiceColorSoft(c.colorIndex ?? 0) }}>
                <div className="row" style={{ gap: 6 }}>
                  <input value={c.label} onChange={(e) => rename(c.id, e.target.value)} placeholder="분류 이름" />
                  <button className="del-btn" title="분류 삭제" onClick={() => delCluster(c.id)}>✕</button>
                </div>
                <input
                  style={{ marginTop: 6, fontSize: 12 }}
                  value={c.summary}
                  onChange={(e) => editSummary(c.id, e.target.value)}
                  placeholder="한 줄 요약(선택)"
                />
                <div className="opinions" style={{ marginTop: 8 }}>
                  {c.opinionIds.length === 0 && <div className="tiny muted">아직 의견 없음</div>}
                  {c.opinionIds.map((oid) => {
                    const o = opText(oid)
                    return (
                      <div className="op" key={oid}>
                        <span>
                          {typeof o?.score === 'number' && <span className="op-score">{o.score}점</span>}
                          {o?.text || '(삭제됨)'}
                        </span>
                        <button className="del-btn" title="이 분류에서 빼기" onClick={() => removeFrom(oid)}>−</button>
                      </div>
                    )
                  })}
                </div>
                <div className="tiny muted" style={{ marginTop: 4 }}>의견 {c.opinionIds.length}개</div>
              </div>
            ))}
            <button className="choice" style={{ alignSelf: 'start' }} onClick={addCluster}>+ 새 분류 추가</button>
          </div>

          {/* 미분류 의견 */}
          <h3 style={{ marginBottom: 6 }}>미분류 의견 ({unassigned.length})</h3>
          <div className="stack" style={{ gap: 0 }}>
            {unassigned.length === 0 && <div className="tiny muted">모든 의견이 분류에 들어갔습니다.</div>}
            {unassigned.map((o) => (
              <div key={o.id} className="op editor-unassigned">
                <span>
                  {typeof o.score === 'number' && <span className="op-score">{o.score}점</span>}
                  {o.text}
                </span>
                <div className="assign-btns">
                  {clusters.length === 0 ? (
                    <span className="tiny muted">먼저 분류를 추가하세요</span>
                  ) : (
                    clusters.map((c) => (
                      <button
                        key={c.id}
                        className="choice"
                        style={{ padding: '3px 9px' }}
                        onClick={() => assign(o.id, c.id)}
                        title={`"${c.label || '이름 없음'}"에 넣기`}
                      >
                        {c.label || '(이름 없음)'}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="ghost" onClick={onClose}>취소</button>
            <button className="primary" onClick={save}>저장 (무대에 반영)</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
