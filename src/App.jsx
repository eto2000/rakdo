import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

// Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

const STORAGE_KEY = 'dosirak_current_index'
const STORES_KEY = 'dosirak_stores'

function loadStoresFromStorage() {
  try {
    const saved = localStorage.getItem(STORES_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return null
}

// JSON 입력 화면
function JsonInputScreen({ onSave, onCancel }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const handleSave = () => {
    setError('')
    const trimmed = text.trim()
    if (!trimmed) {
      setError('JSON을 입력해주세요.')
      return
    }
    try {
      const parsed = JSON.parse(trimmed)
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setError('배열 형식의 JSON이어야 합니다.')
        return
      }
      localStorage.setItem(STORES_KEY, JSON.stringify(parsed))
      onSave(parsed)
    } catch {
      setError('JSON 형식이 올바르지 않습니다.')
    }
  }

  return (
    <div className="app">
      <header className="header">
        <span className="header-title">도시락 데이터 입력</span>
        {onCancel && (
          <button className="modal-close" onClick={onCancel} aria-label="취소">✕</button>
        )}
      </header>
      <div className="json-input-screen">
        <p className="json-input-desc">stores.json 내용을 붙여넣으세요.</p>
        <textarea
          className="json-textarea"
          value={text}
          onChange={(e) => { setText(e.target.value); setError('') }}
          placeholder={'[\n  {\n    "상호": "...",\n    "내용": "...",\n    "주소": "..."\n  }\n]'}
          spellCheck={false}
        />
        {error && <p className="json-error">{error}</p>}
        <div className="json-actions">
          {onCancel && (
            <button className="json-cancel-btn" onClick={onCancel}>취소</button>
          )}
          <button className="json-save-btn" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [stores, setStores] = useState(() => loadStoresFromStorage())
  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    const parsed = parseInt(saved, 10)
    const data = loadStoresFromStorage()
    if (data && !isNaN(parsed) && parsed >= 0 && parsed < data.length) return parsed
    return 0
  })

  const [dragging, setDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const [animating, setAnimating] = useState(false)
  const containerRef = useRef(null)
  const SWIPE_THRESHOLD = 60

  const [listOpen, setListOpen] = useState(false)
  const [jsonInputOpen, setJsonInputOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(currentIndex))
  }, [currentIndex])

  const goTo = useCallback((index) => {
    if (!stores || index < 0 || index >= stores.length || animating) return
    setAnimating(true)
    setCurrentIndex(index)
    setTimeout(() => setAnimating(false), 300)
  }, [animating, stores])

  const handlePointerDown = (e) => {
    if (animating) return
    setDragging(true)
    setStartX(e.clientX ?? e.touches?.[0]?.clientX ?? 0)
    setOffsetX(0)
  }

  const handlePointerMove = (e) => {
    if (!dragging) return
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0
    setOffsetX(x - startX)
  }

  const handlePointerUp = () => {
    if (!dragging) return
    setDragging(false)
    if (offsetX < -SWIPE_THRESHOLD && currentIndex < stores.length - 1) goTo(currentIndex + 1)
    else if (offsetX > SWIPE_THRESHOLD && currentIndex > 0) goTo(currentIndex - 1)
    setOffsetX(0)
  }

  const openList = () => setListOpen(true)
  const closeList = () => setListOpen(false)
  const goToFromList = (index) => { goTo(index); closeList() }

  const handleJsonSave = (parsed) => {
    setStores(parsed)
    setCurrentIndex(0)
    setJsonInputOpen(false)
  }

  const handleJsonUpdate = (parsed) => {
    setStores(parsed)
    setCurrentIndex(0)
    setJsonInputOpen(false)
  }

  // 데이터 없으면 입력 화면
  if (!stores) {
    return <JsonInputScreen onSave={handleJsonSave} />
  }

  // JSON 입력 모달 (데이터 교체용)
  if (jsonInputOpen) {
    return <JsonInputScreen onSave={handleJsonUpdate} onCancel={() => setJsonInputOpen(false)} />
  }

  const store = stores[currentIndex] ?? stores[0]
  if (!store) return null

  return (
    <div className="app">
      {/* 헤더 */}
      <header className="header">
        <button className="home-btn" onClick={() => goTo(0)} aria-label="처음으로">⌂</button>
        <span className="header-count">{currentIndex + 1} / {stores.length}</span>
        <div className="header-actions">
          <button className="list-btn" onClick={openList} aria-label="목록 보기">☰</button>
        </div>
      </header>

      {/* 스와이프 영역 */}
      <div
        className="swipe-area"
        ref={containerRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      >
        {/* 카드 */}
        <div
          className={`card ${animating ? 'card-animate' : ''}`}
          style={{
            transform: dragging ? `translateX(${offsetX * 0.3}px)` : 'translateX(0)',
            transition: dragging ? 'none' : 'transform 0.3s ease',
          }}
        >
          <div className="card-header-row">
            <h1 className="store-name">
              {store.상호}
              {store.결제 === '카드' && <span className="card-badge">카</span>}
            </h1>
          </div>
          <div className="divider" />
          <div className="info-row">
            <span className="value note">
              {(store.내용 ?? '').split(/\/+/).map((line, i, arr) => {
                const trimmed = line.trim()
                if (!trimmed) return i < arr.length - 1 ? <br key={i} /> : null
                const phoneRegex = /(\d{2,4}-\d{3,4}-\d{4}|0\d{9,10})/g
                const parts = []
                let last = 0
                let match
                while ((match = phoneRegex.exec(trimmed)) !== null) {
                  if (match.index > last) parts.push(trimmed.slice(last, match.index))
                  const digits = match[0].replace(/-/g, '')
                  parts.push(
                    <a key={match.index} href={`tel:${digits}`} className="phone-link">
                      {match[0]}
                    </a>
                  )
                  last = match.index + match[0].length
                }
                if (last < trimmed.length) parts.push(trimmed.slice(last))
                return <span key={i}>{parts}{i < arr.length - 1 && <br />}</span>
              })}
            </span>
          </div>
          {store.추가 && (
            <div className="info-row">
              <span className="value extra">{store.추가}</span>
            </div>
          )}
          <div className="links">
            <a
              className="link-btn naver"
              href={`nmap://search?query=${encodeURIComponent(store.주소)}&appname=com.dosirak.app`}
              onClick={(e) => e.stopPropagation()}
            >
              네이버지도 검색
            </a>
            <a
              className="link-btn tmap"
              href={`tmap://search?name=${encodeURIComponent(store.주소)}`}
              onClick={(e) => e.stopPropagation()}
            >
              티맵 검색
            </a>
          </div>
        </div>
      </div>

      {/* 목록 모달 */}
      {listOpen && (
        <div className="modal-overlay" onClick={closeList}>
          <div className="list-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">전체 목록</h2>
              <button className="modal-close" onClick={closeList} aria-label="닫기">✕</button>
            </div>
            <ul className="store-list">
              {stores.map((s, i) => (
                <li key={i}>
                  <button
                    className={`store-list-item ${i === currentIndex ? 'store-list-item-active' : ''}`}
                    onClick={() => goToFromList(i)}
                  >
                    <span className="store-list-num">{i + 1}</span>
                    <span className="store-list-name">{s.상호}</span>
                    {i === currentIndex && <span className="store-list-current">●</span>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="list-footer">
              <button className="json-update-btn" onClick={() => { closeList(); setJsonInputOpen(true) }}>
                데이터 교체
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
