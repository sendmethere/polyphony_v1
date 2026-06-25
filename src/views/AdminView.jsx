import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useSession, getMember } from '../hooks/useSession.js'
import { store } from '../lib/store.js'
import { clusterOpinions, proposeFollowups, proposeFirstQuestions, summarizeRetrospective, generateTestOpinions, hasApiKey } from '../lib/ai.js'
import Canvas from '../components/Canvas.jsx'
import Settings from '../components/Settings.jsx'
import PolyphonyMeter from '../components/PolyphonyMeter.jsx'
import SessionRetrospective from '../components/SessionRetrospective.jsx'
import RetrospectiveList from '../components/RetrospectiveList.jsx'
import { hillSummary, scoreDistribution } from '../lib/polyphony.js'
import { exportSessionXlsx } from '../lib/exportXlsx.js'
import Guide from '../components/Guide.jsx'
import PhaseBar from '../components/PhaseBar.jsx'
import ClusterEditor from '../components/ClusterEditor.jsx'

export default function AdminView() {
  const { code } = useParams()
  const nav = useNavigate()
  const { snapshot, loading } = useSession(code)
  const member = getMember(code)

  const [showSettings, setShowSettings] = useState(false)
  const [firstQ, setFirstQ] = useState('')
  const [busy, setBusy] = useState('')
  const [proposal, setProposal] = useState(null) // {clusters:[{label,summary,opinionIds,isOutlier}], offline}
  const [followups, setFollowups] = useState(null) // {diverge:[], converge:[], offline}
  const [nextQ, setNextQ] = useState('')
  const [nextDir, setNextDir] = useState('deepen')
  const [testN, setTestN] = useState(8)
  const [testDiversity, setTestDiversity] = useState('high')
  const [firstSuggestions, setFirstSuggestions] = useState(null)
  const [qType, setQType] = useState('open') // 'open' 서술형 | 'scale' 척도형
  const [qScale, setQScale] = useState(5) // 4 | 5 | 7
  const [qMinLabel, setQMinLabel] = useState('전혀 아니다')
  const [qMaxLabel, setQMaxLabel] = useState('매우 그렇다')
  const [granularity, setGranularity] = useState('balanced') // coarse | balanced | fine
  const [analysisOpen, setAnalysisOpen] = useState(true) // 관리자 뷰 기본 펼침
  const [showEditor, setShowEditor] = useState(false) // 수동 분류 편집기

  const session = snapshot?.session
  const rounds = [...(snapshot?.rounds || [])].sort((a, b) => a.index - b.index)
  const currentRound = rounds.find((r) => r.id === session?.currentRoundId)
  const roundOpinions = (snapshot?.opinions || []).filter((o) => o.roundId === currentRound?.id)
  const students = (snapshot?.participants || []).filter((p) => p.role === 'student')

  if (!member) {
    return (
      <div className="centered stack">
        <div className="banner warn">진행자로 입장하지 않았습니다.</div>
        <button onClick={() => nav('/')}>입장 화면으로</button>
      </div>
    )
  }
  if (loading) return <div className="waiting">불러오는 중…</div>
  if (!session) return <div className="waiting">세션을 찾을 수 없습니다.</div>

  // 현재 라운드 이전까지의 질문/브리핑 맥락 (생성 시 대화 연속성 유지용)
  function priorHistory() {
    return [...rounds]
      .filter((r) => r.id !== currentRound?.id)
      .sort((a, b) => a.index - b.index)
      .map((r) => ({ question: r.question, briefing: r.briefing || '' }))
  }

  // ── 액션들 ──
  function publishFirst() {
    if (!firstQ.trim()) return
    store.addRound(code, {
      question: firstQ.trim(),
      direction: 'seed',
      parentRoundId: null,
      responseType: qType,
      scaleMax: qScale,
      scaleLabels: qType === 'scale' ? { min: qMinLabel, max: qMaxLabel } : null,
    })
    setFirstQ('')
  }

  async function suggestFirst() {
    setBusy('firstSuggest')
    try {
      const res = await proposeFirstQuestions(session.title)
      setFirstSuggestions(res.questions)
    } catch (e) {
      alert('첫 질문 추천 실패: ' + e.message)
    } finally {
      setBusy('')
    }
  }

  function closeCollection() {
    store.updateRound(code, currentRound.id, { status: 'closed' })
  }

  async function seedTestOpinions() {
    setBusy('seeding')
    try {
      const scale =
        currentRound.responseType === 'scale'
          ? { max: currentRound.scaleMax, minLabel: currentRound.scaleLabels?.min, maxLabel: currentRound.scaleLabels?.max }
          : null
      const res = await generateTestOpinions(currentRound.question, {
        n: Math.max(1, Math.min(40, parseInt(testN, 10) || 8)),
        title: session.title,
        history: priorHistory(),
        diversity: testDiversity,
        scale,
      })
      const texts = res.items.map((it) => it.text)
      const scores = res.items.map((it) => it.score)
      store.seedOpinions(code, currentRound.id, texts, scores)
    } catch (e) {
      alert('테스트 의견 생성 실패: ' + e.message)
    } finally {
      setBusy('')
    }
  }

  async function runClustering() {
    setBusy('clustering')
    try {
      const ops = roundOpinions.map((o) => ({ id: o.id, text: o.text }))
      let scaleNote = ''
      if (currentRound.responseType === 'scale') {
        const s = scoreDistribution(currentRound, snapshot.opinions)
        if (s) scaleNote = `${currentRound.scaleMax}점 척도, 응답 ${s.N}개, 중앙값 ${s.median}.`
      }
      const res = await clusterOpinions(ops, {
        question: currentRound.question,
        title: session.title,
        history: priorHistory(),
        scaleNote,
        granularity,
      })
      setProposal({ clusters: res.clusters, briefing: res.briefing || '', offline: res.offline })
    } catch (e) {
      alert('군집화 실패: ' + e.message)
    } finally {
      setBusy('')
    }
  }

  function confirmClusters() {
    const withColor = proposal.clusters.map((c, i) => ({ ...c, colorIndex: i }))
    store.setClusters(code, currentRound.id, withColor, proposal.briefing)
    setProposal(null)
  }

  async function runFollowups() {
    setBusy('followups')
    try {
      const clusters = (snapshot.clusters || []).filter((c) => c.roundId === currentRound.id)
      // 지금까지 오간 질문/브리핑 전체(현재 라운드 포함)를 맥락으로 투입
      const history = [...rounds]
        .sort((a, b) => a.index - b.index)
        .map((r) => ({ question: r.question, briefing: r.briefing || '' }))
      const res = await proposeFollowups(clusters, {
        history,
        question: currentRound.question,
        title: session.title,
      })
      setFollowups(res)
    } catch (e) {
      alert('후속 질문 제안 실패: ' + e.message)
    } finally {
      setBusy('')
    }
  }

  function publishNext() {
    if (!nextQ.trim()) return
    store.addRound(code, {
      question: nextQ.trim(),
      direction: nextDir,
      parentRoundId: currentRound.id,
      responseType: qType,
      scaleMax: qScale,
      scaleLabels: qType === 'scale' ? { min: qMinLabel, max: qMaxLabel } : null,
    })
    setFollowups(null)
    setNextQ('')
  }

  async function endSession() {
    if (!confirm('세션을 종료하면 학생 입력이 잠기고 회고 모드로 전환됩니다. 계속할까요?')) return
    // 즉시 종료(화면 바로 전환) → 회고 요약은 백그라운드로 채운다.
    store.updateSession(code, { status: 'closed' })
    setBusy('closing')
    try {
      const retro = await summarizeRetrospective(snapshot)
      store.updateSession(code, { retrospective: retro.text })
    } catch (e) {
      /* 회고 요약 실패해도 종료는 유지 */
    } finally {
      setBusy('')
    }
  }

  function handleDeleteOpinion(o) {
    if (!confirm('이 의견을 삭제할까요?\n\n"' + o.text + '"')) return
    store.deleteOpinion(code, o.id)
  }

  function handleDeleteCluster(c) {
    if (!confirm(`군집 "${c.label}" 과 거기 속한 의견 ${c.opinionIds?.length || 0}개를 함께 삭제할까요?`)) return
    store.deleteCluster(code, c.id)
  }

  function resumeSession() {
    store.updateSession(code, { status: 'active' })
  }

  function exportXlsx() {
    exportSessionXlsx(snapshot)
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="app-bar">
        <img className="brand-logo" src="/logo.png" alt="Polyphony" />
        <span className="role-tag admin">진행 (관리자)</span>
        <span className="muted tiny">{session.title}</span>
        {session.locked && <span className="banner warn tiny">🔒 잠김 · 읽기 전용</span>}
        <span className="spacer" />
        {!hasApiKey() && <span className="banner warn tiny">API 키 없음 · 오프라인 모드</span>}
        <Link className="linklike tiny" to={`/s/${code}/teacher`} target="_blank">
          모니터링 뷰 ↗
        </Link>
        <SessionRetrospective snapshot={snapshot} />
        <button className="ghost" onClick={() => setShowSettings(true)}>
          ⚙ 설정
        </button>
        <span className="code">{code}</span>
        <button className="ghost" onClick={() => nav('/')} title="메인 화면으로 나가기">
          나가기 ✕
        </button>
      </div>

      <PhaseBar
        round={currentRound}
        sessionClosed={session.status === 'closed'}
        hasProposal={!!proposal}
        hasFollowups={!!followups}
      />

      <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
        {/* 캔버스 (관리자 모드: 내부 지표 표시) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="canvas-toolbar">
            <button className="ghost tiny" onClick={() => setAnalysisOpen((o) => !o)}>
              {analysisOpen ? '🔍 분석 숨기기 ▾' : '🔍 분석 보기 ▸'}
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Canvas
              snapshot={snapshot}
              mode="admin"
              showOpinions
              showBriefing={analysisOpen}
              showMetrics={analysisOpen}
              onDeleteOpinion={handleDeleteOpinion}
              onDeleteCluster={handleDeleteCluster}
            />
          </div>
        </div>

        {/* 진행 패널 */}
        <div style={{ flex: '0 0 340px', borderLeft: '1px solid var(--paper-line)', padding: 18, overflowY: 'auto', minHeight: 0 }}>
          {(() => {
            const clustered =
              currentRound && (snapshot.clusters || []).some((c) => c.roundId === currentRound.id)
            const H = clustered ? hillSummary(currentRound, snapshot.clusters, snapshot.opinions) : null
            return (
              <Guide
                sessionClosed={session.status === 'closed'}
                hasRound={!!currentRound}
                hasProposal={!!proposal}
                hasFollowups={!!followups}
                roundStatus={currentRound?.status}
                opinionCount={roundOpinions.length}
                isScale={currentRound?.responseType === 'scale'}
                diversity={H ? H.openness : null}
                effective={H ? H.h1 : null}
              />
            )
          })()}

          {session.status === 'closed' ? (
            <div className="stack">
              <div className="panel stack">
                <h3>세션 종료됨</h3>
                {session.retrospective && (
                  <div className="banner info tiny" style={{ whiteSpace: 'pre-wrap' }}>
                    {session.retrospective}
                  </div>
                )}
                <div className="row" style={{ gap: 8 }}>
                  <button className="primary" onClick={resumeSession} disabled={session.locked} style={{ flex: 1 }}>
                    {session.locked ? '🔒 잠김' : '세션 재개'}
                  </button>
                  <button onClick={exportXlsx} style={{ flex: 1 }}>
                    .xlsx 내보내기
                  </button>
                </div>
              </div>
              <PolyphonyMeter rounds={rounds} clusters={snapshot.clusters} opinions={snapshot.opinions} />
              <RetrospectiveList snapshot={snapshot} />
            </div>
          ) : !currentRound ? (
            // 1) 첫 질문
            <div className="panel stack">
              <h3>① 첫 질문 발행</h3>
              <button onClick={suggestFirst} disabled={busy === 'firstSuggest'}>
                {busy === 'firstSuggest'
                  ? '추천 생성 중…'
                  : firstSuggestions
                  ? '🔄 다시 추천받기'
                  : '✨ 첫 질문 추천받기'}
              </button>
              {firstSuggestions && (
                <div className="stack" style={{ gap: 6 }}>
                  {firstSuggestions.map((q, i) => (
                    <button
                      key={i}
                      className={`choice ${firstQ === q.text ? 'selected' : ''}`}
                      onClick={() => {
                        setFirstQ(q.text)
                        setQType(q.type)
                        setQScale(q.scaleMax || 5)
                        if (q.type === 'scale') {
                          setQMinLabel(q.minLabel || '전혀 아니다')
                          setQMaxLabel(q.maxLabel || '매우 그렇다')
                        }
                      }}
                    >
                      <TypeBadge q={q} /> {q.text}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                value={firstQ}
                onChange={(e) => setFirstQ(e.target.value)}
                placeholder="학생들에게 던질 첫 질문 (직접 작성하거나 위 추천을 선택·수정)"
              />
              <QTypeSelector qType={qType} setQType={setQType} qScale={qScale} setQScale={setQScale} qMinLabel={qMinLabel} setQMinLabel={setQMinLabel} qMaxLabel={qMaxLabel} setQMaxLabel={setQMaxLabel} />
              <button className="primary" onClick={publishFirst} disabled={!firstQ.trim()}>
                발행 →
              </button>
            </div>
          ) : (
            <div className="stack">
              {/* 세션 도구 — 진행 패널 위 한 행 */}
              <div className="row" style={{ gap: 8 }}>
                <button onClick={endSession} disabled={busy === 'closing' || session.locked} style={{ flex: 1 }}>
                  {busy === 'closing' ? '종료 중…' : session.locked ? '🔒 잠김' : '세션 종료'}
                </button>
                <button onClick={exportXlsx} style={{ flex: 1 }}>
                  .xlsx 내보내기
                </button>
              </div>

              {/* 진행 상태 */}
              <div className="panel stack">
                <h3>라운드 {currentRound.index + 1} 진행</h3>
                <div className="tiny muted">{currentRound.question}</div>
                <div className="divider" />

                {currentRound.status === 'collecting' && (
                  <>
                    <div className="tiny">
                      응답 <b>{roundOpinions.length}</b> / 학생 {students.length}명
                    </div>
                    <button className="primary" onClick={closeCollection} disabled={!roundOpinions.length}>
                      수집 마감
                    </button>
                    <div className="divider" />
                    <div className="row tiny" style={{ justifyContent: 'space-between' }}>
                      <span className="muted">🧪 테스트 의견 생성</span>
                      <input
                        type="number"
                        min="1"
                        max="40"
                        value={testN}
                        onChange={(e) => setTestN(e.target.value)}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10)
                          if (v) setTestN(String(Math.max(1, Math.min(40, v))))
                        }}
                        style={{ width: 64 }}
                      />
                    </div>
                    <div className="row tiny" style={{ gap: 4 }}>
                      <span className="muted" style={{ flex: '0 0 auto' }}>다양성</span>
                      {[
                        { k: 'low', t: '낮음' },
                        { k: 'mid', t: '중간' },
                        { k: 'high', t: '높음' },
                      ].map((o) => (
                        <button
                          key={o.k}
                          className={`choice ${testDiversity === o.k ? 'selected' : ''}`}
                          style={{ padding: '4px 6px', textAlign: 'center' }}
                          onClick={() => setTestDiversity(o.k)}
                        >
                          {o.t}
                        </button>
                      ))}
                    </div>
                    <button onClick={seedTestOpinions} disabled={busy === 'seeding' || session.locked}>
                      {busy === 'seeding' ? '생성 중…' : `가상 학생 의견 ${Math.max(1, Math.min(40, parseInt(testN, 10) || 8))}개 투입 (다양성 ${{ low: '낮음', mid: '중간', high: '높음' }[testDiversity]})`}
                    </button>
                  </>
                )}

                {currentRound.status === 'closed' && !proposal && (
                  <>
                    <div className="row tiny" style={{ gap: 4 }}>
                      <span className="muted" style={{ flex: '0 0 auto' }}>군집화</span>
                      {[
                        { k: 'coarse', t: '묶기' },
                        { k: 'balanced', t: '보통' },
                        { k: 'fine', t: '세밀' },
                      ].map((o) => (
                        <button
                          key={o.k}
                          className={`choice ${granularity === o.k ? 'selected' : ''}`}
                          style={{ padding: '4px 6px', textAlign: 'center' }}
                          onClick={() => setGranularity(o.k)}
                          title={
                            o.k === 'coarse'
                              ? '비슷하면 크게 묶음 (군집 적음)'
                              : o.k === 'fine'
                              ? '미묘한 차이도 나눔 (군집 많음·다양성/엔트로피↑)'
                              : '보통 (3~5개)'
                          }
                        >
                          {o.t}
                        </button>
                      ))}
                    </div>
                    <button className="primary" onClick={runClustering} disabled={busy === 'clustering'}>
                      {busy === 'clustering' ? 'AI 군집화 중…' : '② AI 군집화 실행'}
                    </button>
                  </>
                )}

                {roundOpinions.length > 0 && (
                  <button onClick={() => setShowEditor(true)}>✋ 수동 분류 편집</button>
                )}
              </div>

              {/* 군집 제안 검토 */}
              {proposal && (
                <div className="panel stack">
                  <h3>군집안 검토 {proposal.offline && '· 오프라인'}</h3>
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="tiny muted">📋 의견 브리핑 (200자 이내 · 다음 질문 제안의 맥락이 됩니다)</span>
                    <textarea
                      value={proposal.briefing}
                      maxLength={200}
                      onChange={(e) => setProposal({ ...proposal, briefing: e.target.value })}
                      style={{ minHeight: 60 }}
                    />
                    <span className="tiny muted" style={{ alignSelf: 'flex-end' }}>
                      {proposal.briefing.length}/200
                    </span>
                  </div>
                  <div className="divider" />
                  <p className="tiny muted">라벨을 다듬은 뒤 확정하세요. (우세 표현 금지)</p>
                  {proposal.clusters.map((c, i) => (
                    <div key={i} className="stack" style={{ gap: 4 }}>
                      <input
                        value={c.label}
                        onChange={(e) => {
                          const next = [...proposal.clusters]
                          next[i] = { ...c, label: e.target.value }
                          setProposal({ ...proposal, clusters: next })
                        }}
                      />
                      <div className="tiny muted">
                        의견 {c.opinionIds?.length || 0}개 {c.isOutlier && '· 외톨이'}
                      </div>
                    </div>
                  ))}
                  <button className="primary" onClick={confirmClusters}>
                    군집 확정 (무대에 반영)
                  </button>
                </div>
              )}

              {/* 다음 질문 — AI 제안받기 또는 직접 작성 (군집화 후 항상 표시) */}
              {currentRound.status === 'clustered' && (
                <div className="panel stack">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0 }}>다음 질문</h3>
                    <button className="tiny" onClick={runFollowups} disabled={busy === 'followups'}>
                      {busy === 'followups' ? '생성 중…' : followups ? '🔄 다시 제안' : '✨ AI 제안받기'}
                    </button>
                  </div>

                  {followups && (
                    <>
                      <div className="tiny muted">제안을 고르면 아래에 채워집니다. 직접 고쳐도 됩니다.</div>
                      {[
                        { dir: 'deepen', label: '⤵ 심화 (그렇다면·그런데·그러면)', items: followups.deepen },
                        { dir: 'shift', label: '↔ 전환 (한편·다르게 생각해보면)', items: followups.shift },
                        { dir: 'integrate', label: '⊕ 통합 (여러 생각을 모아 잇기)', items: followups.integrate },
                      ].map((group) => (
                        <div className="stack" style={{ gap: 4 }} key={group.dir}>
                          <div className="tiny" style={{ fontWeight: 600, marginTop: 6 }}>{group.label}</div>
                          {(group.items || []).map((q, i) => (
                            <button
                              key={group.dir + i}
                              className={`choice ${nextQ === q.text && nextDir === group.dir ? 'selected' : ''}`}
                              onClick={() => {
                                setNextQ(q.text)
                                setNextDir(group.dir)
                                setQType(q.type)
                                setQScale(q.scaleMax || 5)
                                if (q.type === 'scale') {
                                  setQMinLabel(q.minLabel || '전혀 아니다')
                                  setQMaxLabel(q.maxLabel || '매우 그렇다')
                                }
                              }}
                            >
                              <TypeBadge q={q} /> {q.text}
                            </button>
                          ))}
                        </div>
                      ))}
                      <div className="divider" />
                    </>
                  )}

                  {/* 방향 라벨 (직접 작성 시에도 분류용) */}
                  <div className="row tiny" style={{ gap: 4 }}>
                    <span className="muted" style={{ flex: '0 0 auto' }}>방향</span>
                    {[
                      { k: 'deepen', t: '심화' },
                      { k: 'shift', t: '전환' },
                      { k: 'integrate', t: '통합' },
                    ].map((d) => (
                      <button
                        key={d.k}
                        className={`choice ${nextDir === d.k ? 'selected' : ''}`}
                        style={{ padding: '4px 6px', textAlign: 'center' }}
                        onClick={() => setNextDir(d.k)}
                      >
                        {d.t}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={nextQ}
                    onChange={(e) => setNextQ(e.target.value)}
                    placeholder="후속 질문을 직접 작성하거나, ✨ AI 제안을 받아 고르세요"
                  />
                  <QTypeSelector qType={qType} setQType={setQType} qScale={qScale} setQScale={setQScale} qMinLabel={qMinLabel} setQMinLabel={setQMinLabel} qMaxLabel={qMaxLabel} setQMaxLabel={setQMaxLabel} />
                  <button className="primary" onClick={publishNext} disabled={!nextQ.trim()}>
                    다음 라운드 발행 →
                  </button>
                </div>
              )}

              <PolyphonyMeter rounds={rounds} clusters={snapshot.clusters} opinions={snapshot.opinions} />
            </div>
          )}
        </div>
      </div>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showEditor && currentRound && (
        <ClusterEditor code={code} round={currentRound} snapshot={snapshot} onClose={() => setShowEditor(false)} />
      )}
    </div>
  )
}

// 추천 질문의 유형 배지 (서술형 / 척도형 N점)
function TypeBadge({ q }) {
  if (q.type === 'scale') {
    return <span className="qbadge scale">척도 {q.scaleMax || 5}점</span>
  }
  return <span className="qbadge open">서술</span>
}

// 질문 유형 선택: 서술형 / 척도형(+4·5·7점 + 양 끝 의미)
function QTypeSelector({ qType, setQType, qScale, setQScale, qMinLabel, setQMinLabel, qMaxLabel, setQMaxLabel }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row tiny" style={{ gap: 4 }}>
        <span className="muted" style={{ flex: '0 0 auto' }}>유형</span>
        <button
          className={`choice ${qType === 'open' ? 'selected' : ''}`}
          style={{ padding: '4px 6px', textAlign: 'center' }}
          onClick={() => setQType('open')}
        >
          서술형
        </button>
        <button
          className={`choice ${qType === 'scale' ? 'selected' : ''}`}
          style={{ padding: '4px 6px', textAlign: 'center' }}
          onClick={() => setQType('scale')}
        >
          척도형(점수+의견)
        </button>
      </div>
      {qType === 'scale' && (
        <>
          <div className="row tiny" style={{ gap: 4 }}>
            <span className="muted" style={{ flex: '0 0 auto' }}>척도</span>
            {[4, 5, 7].map((s) => (
              <button
                key={s}
                className={`choice ${qScale === s ? 'selected' : ''}`}
                style={{ padding: '4px 6px', textAlign: 'center' }}
                onClick={() => setQScale(s)}
              >
                {s}점
              </button>
            ))}
          </div>
          <div className="row tiny" style={{ gap: 4 }}>
            <span className="muted" style={{ flex: '0 0 auto' }}>1점</span>
            <input value={qMinLabel} onChange={(e) => setQMinLabel(e.target.value)} placeholder="예: 전혀 아니다" />
          </div>
          <div className="row tiny" style={{ gap: 4 }}>
            <span className="muted" style={{ flex: '0 0 auto' }}>{qScale}점</span>
            <input value={qMaxLabel} onChange={(e) => setQMaxLabel(e.target.value)} placeholder="예: 매우 그렇다" />
          </div>
        </>
      )}
    </div>
  )
}
