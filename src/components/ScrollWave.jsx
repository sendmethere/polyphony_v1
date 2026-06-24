import { useEffect, useState } from 'react'

// 페이지 읽기 진행도 — Polyphony 시그니처 물결 곡선으로.
// 흐린 물결 위로 색(분홍→보라→파랑) 물결이 스크롤한 만큼 왼쪽부터 그려진다.
// app-bar 안에 두면 바의 밑줄처럼 보이고, 스크롤(sticky)을 따라 움직인다.
const W = 1200, MID = 7, AMP = 5, STEP = 30
const D = (() => {
  let d = `M0,${MID}`
  for (let x = 0; x < W; x += STEP) {
    const dy = (x / STEP) % 2 === 0 ? -AMP : AMP
    d += ` Q${x + STEP / 2},${MID + dy} ${x + STEP},${MID}`
  }
  return d
})()

export default function ScrollWave() {
  const [p, setP] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const max = el.scrollHeight - el.clientHeight
      setP(max > 0 ? Math.min(1, el.scrollTop / max) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])
  return (
    <div className="scroll-wave" aria-hidden="true">
      <svg viewBox={`0 0 ${W} 14`} preserveAspectRatio="none" width="100%" height="14">
        <defs>
          <linearGradient id="sw-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e879a8" />
            <stop offset="50%" stopColor="#9b72cf" />
            <stop offset="100%" stopColor="#5b8def" />
          </linearGradient>
        </defs>
        <path d={D} className="sw-track" fill="none" />
        <path d={D} className="sw-fill" fill="none" stroke="url(#sw-grad)" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - p} />
      </svg>
    </div>
  )
}
