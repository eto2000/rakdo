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
const SHARE_PARAM = 'd'

function loadStoresFromStorage() {
  try {
    const saved = localStorage.getItem(STORES_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return null
}

// URL-safe base64 인코딩 (한글 등 유니코드 안전)
function encodeData(data) {
  try {
    const json = JSON.stringify(data)
    const bytes = new TextEncoder().encode(json)
    let binary = ''
    bytes.forEach((b) => { binary += String.fromCharCode(b) })
    const base64 = btoa(binary)
    // URL-safe: +→-, /→_, =제거
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  } catch {
    return null
  }
}

// URL-safe base64 디코딩 (한글 등 유니코드 안전)
function decodeData(str) {
  try {
    // URL-safe 복원 + 패딩
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const json = new TextDecoder().decode(bytes)
    return JSON.parse(json)
  } catch {
    return null
  }
}

// 현재 URL에서 공유 파라미터 파싱
function parseSharedData() {
  try {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get(SHARE_PARAM)
    if (!raw) return null
    const data = decodeData(raw)
    if (!Array.isArray(data) || data.length === 0) return null
    return data
  } catch {
    return null
  }
}

// 공유 URL 생성
function buildShareUrl(data) {
  const encoded = encodeData(data)
  if (!encoded) return null
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set(SHARE_PARAM, encoded)
  return url.toString()
}

// URL에서 공유 파라미터 제거
function clearShareParam() {
  const url = new URL(window.location.href)
  url.searchParams.delete(SHARE_PARAM)
  window.history.replaceState({}, '', url.toString())
}

// 공유 수신 확인 모달
function ShareImportModal({ data, onSave, onDismiss }) {
  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="modal share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">공유 데이터 수신</h2>
          <button className="modal-close" onClick={onDismiss} aria-label="닫기">✕</button>
        </div>
        <p className="share-modal-desc">
          공유된 도시락 데이터를 받았습니다.<br />
          <span className="share-modal-count">{data.length}개</span> 항목이 포함되어 있습니다.
        </p>
        <ul className="share-preview-list">
          {data.slice(0, 5).map((s, i) => (
            <li key={i} className="share-preview-item">{s.상호}</li>
          ))}
          {data.length > 5 && (
            <li className="share-preview-more">... 외 {data.length - 5}개</li>
          )}
        </ul>
        <p className="share-modal-warn">저장하면 현재 데이터가 교체됩니다.</p>
        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onDismiss}>무시</button>
          <button className="modal-btn save" onClick={() => onSave(data)}>저장</button>
        </div>
      </div>
    </div>
  )
}

// JSON 입력 화면
function JsonInputScreen({ onSave, onCancel, initialData }) {
  const [text, setText] = useState(() =>
    initialData ? JSON.stringify(initialData, null, 2) : ''
  )
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
  const [startY, setStartY] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const [animating, setAnimating] = useState(false)
  const containerRef = useRef(null)
  const draggingRef = useRef(false)
  const SWIPE_THRESHOLD = 60

  const [listOpen, setListOpen] = useState(false)
  const [jsonInputOpen, setJsonInputOpen] = useState(false)
  const [shareToast, setShareToast] = useState(false) // 공유 URL 복사 완료 토스트
  const [sharedData, setSharedData] = useState(() => parseSharedData()) // 수신된 공유 데이터

  // 앱 로드 시 공유 파라미터가 있으면 URL을 즉시 정리 (이미 파싱했으므로)
  useEffect(() => {
    if (sharedData) {
      clearShareParam()
    }
  }, [])

  // 공유 URL 생성 및 클립보드 복사
  const handleShare = useCallback(() => {
    if (!stores) return
    const url = buildShareUrl(stores)
    if (!url) return
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setShareToast(true)
        setTimeout(() => setShareToast(false), 2500)
      })
    } else {
      // fallback
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2500)
    }
  }, [stores])

  const handleSharedSave = (data) => {
    localStorage.setItem(STORES_KEY, JSON.stringify(data))
    setStores(data)
    setCurrentIndex(0)
    setSharedData(null)
  }

  const handleSharedDismiss = () => {
    setSharedData(null)
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(currentIndex))
  }, [currentIndex])

  // 수평 스와이프 시 상하 바운싱 방지 (passive: false 필요)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onTouchMove = (e) => {
      if (!draggingRef.current) return
      const touch = e.touches?.[0]
      if (!touch) return
      // 수평 이동이 수직보다 크면 스크롤 막기
      e.preventDefault()
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [])

  const goTo = useCallback((index) => {
    if (!stores || index < 0 || index >= stores.length || animating) return
    setAnimating(true)
    setCurrentIndex(index)
    setTimeout(() => setAnimating(false), 300)
  }, [animating, stores])

  const handlePointerDown = (e) => {
    if (animating) return
    draggingRef.current = true
    setDragging(true)
    setStartX(e.clientX ?? e.touches?.[0]?.clientX ?? 0)
    setStartY(e.clientY ?? e.touches?.[0]?.clientY ?? 0)
    setOffsetX(0)
  }

  const handlePointerMove = (e) => {
    if (!dragging) return
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0
    setOffsetX(x - startX)
  }

  const handlePointerUp = () => {
    if (!dragging) return
    draggingRef.current = false
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
    return <JsonInputScreen onSave={handleJsonUpdate} onCancel={() => setJsonInputOpen(false)} initialData={stores} />
  }

  const store = stores[currentIndex] ?? stores[0]
  if (!store) return null

  return (
    <div className="app">
      {/* 수신된 공유 데이터 저장 확인 모달 */}
      {sharedData && (
        <ShareImportModal
          data={sharedData}
          onSave={handleSharedSave}
          onDismiss={handleSharedDismiss}
        />
      )}

      {/* 공유 URL 복사 완료 토스트 */}
      {shareToast && (
        <div className="share-toast">공유 URL이 클립보드에 복사되었습니다</div>
      )}

      {/* 헤더 */}
      <header className="header">
        <button className="home-btn" onClick={() => goTo(0)} aria-label="처음으로">⌂</button>
        <span className="header-count">{currentIndex + 1} / {stores.length}</span>
        <div className="header-actions">
          <button className="share-btn" onClick={handleShare} aria-label="공유">⬆</button>
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
