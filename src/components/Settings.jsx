import { useState } from 'react'
import { getSettings, saveSettings } from '../lib/ai.js'

const MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (정밀)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (경량·빠름)' },
]

// API 키·모델 설정. 키는 이 브라우저 localStorage 에만 저장된다(관리자 기기 전용).
export default function Settings({ onClose }) {
  const init = getSettings()
  const [apiKey, setApiKey] = useState(init.apiKey)
  const [model, setModel] = useState(init.model)

  function save() {
    saveSettings({ apiKey: apiKey.trim(), model })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal stack" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0 }}>설정</h3>
        <div className="banner info tiny">
          API 키는 <b>이 브라우저(관리자 기기)</b>에만 저장되며, 학생·교사 기기나 서버로
          전송되지 않습니다. 키가 없어도 <b>오프라인 휴리스틱</b>으로 사이클을 시험할 수 있습니다.
        </div>
        <label className="stack tiny">
          <span className="muted">Anthropic API 키</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
          />
        </label>
        <label className="stack tiny">
          <span className="muted">모델</span>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="ghost" onClick={onClose}>
            취소
          </button>
          <button className="primary" onClick={save}>
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
