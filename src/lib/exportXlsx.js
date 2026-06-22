import * as XLSX from 'xlsx'
import { roundDiversity, roundShannon, likertStats } from './polyphony.js'

const r2 = (x) => Math.round(x * 100) / 100

// 세션 스냅샷을 .xlsx 로 내보낸다. 시트: 라운드 / 의견 / 군집.
export function exportSessionXlsx(snapshot) {
  const { session, rounds, opinions, clusters, participants } = snapshot
  const nameOf = (id) => participants.find((p) => p.id === id)?.nickname || id
  const sorted = [...rounds].sort((a, b) => a.index - b.index)

  const roundsSheet = sorted.map((r) => {
    const isScale = r.responseType === 'scale'
    const lk = isScale ? likertStats(r, opinions) : null
    return {
      라운드: r.index + 1,
      질문: r.question,
      유형: isScale ? `척도형(${r.scaleMax}점)` : '서술형',
      방향: r.direction,
      브리핑: r.briefing || '',
      다양성: r2(roundDiversity(r, clusters, opinions)),
      엔트로피: r2(roundShannon(r, clusters, opinions)),
      평균: lk ? r2(lk.mean) : '',
      표준편차: lk ? r2(lk.std) : '',
      일치도: lk ? r2(lk.agreement) : '',
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
