import * as XLSX from 'xlsx'
import { roundReport } from './polyphony.js'

const r2 = (x) => Math.round(x * 100) / 100

// 세션 스냅샷을 .xlsx 로 내보낸다. 시트: 라운드 / 의견 / 군집. (지표 정의는 stat.md)
export function exportSessionXlsx(snapshot) {
  const { session, rounds, opinions, clusters, participants } = snapshot
  const nameOf = (id) => participants.find((p) => p.id === id)?.nickname || id
  const sorted = [...rounds].sort((a, b) => a.index - b.index)

  const roundsSheet = sorted.map((r) => {
    const isScale = r.responseType === 'scale'
    const { hill: H, dist } = roundReport(r, clusters, opinions)
    return {
      라운드: r.index + 1,
      질문: r.question,
      유형: isScale ? `척도형(${r.scaleMax}점)` : '서술형',
      방향: r.direction,
      브리핑: r.briefing || '',
      'N(참여)': H ? H.N : '',
      'Hill0 풍부도': H ? H.h0 : '',
      'Hill1 실효의견수': H ? r2(H.h1) : '',
      'Hill2 실효지배수': H ? r2(H.h2) : '',
      '개방성(Hill1/N)': H ? r2(H.openness) : '',
      '균형성(Hill1/Hill0)': H && H.evenness != null ? r2(H.evenness) : '',
      '우점도 d': H ? r2(H.d) : '',
      '소수의견 1-d': H ? r2(H.minority) : '',
      '척도 중앙값': dist ? dist.median : '',
    }
  })

  const opinionsSheet = opinions.map((o) => {
    const r = rounds.find((x) => x.id === o.roundId)
    const cl = clusters.find((c) => c.opinionIds?.includes(o.id))
    return {
      라운드: (r?.index ?? -1) + 1,
      질문: r?.question || '',
      닉네임: nameOf(o.participantId),
      점수: typeof o.score === 'number' ? o.score : '',
      의견: o.text || '',
      소속군집: cl?.label || '',
    }
  })

  const clustersSheet = clusters.map((c) => {
    const r = rounds.find((x) => x.id === c.roundId)
    return {
      라운드: (r?.index ?? -1) + 1,
      군집: c.label,
      요약: c.summary || '',
      의견수: c.opinionIds?.length || 0,
      외톨이: c.isOutlier ? 'Y' : '',
    }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(roundsSheet), '라운드')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(opinionsSheet), '의견')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clustersSheet), '군집')
  XLSX.writeFile(wb, `polyphony-${session.id}.xlsx`)
}
