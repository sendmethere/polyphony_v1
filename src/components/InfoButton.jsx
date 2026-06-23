import { useState } from 'react'

// 작은 (i) 버튼 + 클릭 시 설명 모달. title/children 으로 내용 주입.
export default function InfoButton({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="info-btn" title="설명 보기" onClick={() => setOpen(true)}>
        i
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal stack info-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, flex: '0 0 auto' }}>{title}</h3>
            <div className="info-body">{children}</div>
            <div className="row" style={{ justifyContent: 'flex-end', flex: '0 0 auto' }}>
              <button className="primary" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
