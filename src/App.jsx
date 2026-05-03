import { useState, useRef, useEffect, useCallback } from 'react'
import initialStores from './stores.json'
import './App.css'

// Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

const STORAGE_KEY = 'dosirak_current_index'

export default function App() {
  const stores = initialStores

  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    const parsed = parseInt(saved, 10)
    if (!isNaN(parsed) && parsed >= 0 && parsed < initialStores.length) {
      return parsed
    }
    return 0
  })

  const [dragging, setDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const [animating, setAnimating] = useState(false)
  const containerRef = useRef(null)
  const SWIPE_THRESHOLD = 60

  // 목록 모달 상태
  const [listOpen, setListOpen] = useState(false)

  // 인덱스 변경 시 로컬스토리지 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(currentIndex))
  }, [currentIndex])

  const goTo = useCallback((index) => {
    if (index < 0 || index >= stores.length || animating) return
    setAnimating(true)
    setCurrentIndex(index)
    setTimeout(() => setAnimating(false), 300)
  }, [animating, stores.length])

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
    if (offsetX < -SWIPE_THRESHOLD && currentIndex < stores.length - 1) {
      goTo(currentIndex + 1)
    } else if (offsetX > SWIPE_THRESHOLD && currentIndex > 0) {
      goTo(currentIndex - 1)
    }
    setOffsetX(0)
  }

  const openList = () => setListOpen(true)
  const closeList = () => setListOpen(false)

  const goToFromList = (index) => {
    goTo(index)
    closeList()
  }

  const store = stores[currentIndex]

  return (
    <div className="app">
      {/* 헤더 */}
      <header className="header">
        <span className="header-count">{currentIndex + 1} / {stores.length}</span>
        <button className="list-btn" onClick={openList} aria-label="목록 보기">
          ☰
        </button>
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
              {store.내용.split(/\/+/).map((line, i, arr) => {
                const trimmed = line.trim()
                if (!trimmed) return i < arr.length - 1 ? <br key={i} /> : null
                // 전화번호 패턴: 하이픈 있는 형식 또는 010/011/016/017/018/019로 시작하는 11자리
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
                return (
                  <span key={i}>{parts}{i < arr.length - 1 && <br />}</span>
                )
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

        {/* 스와이프 힌트 */}
        {/* <div className="swipe-hint">
          {currentIndex > 0 && <span className="hint-arrow">←</span>}
          <span className="hint-text">스와이프</span>
          {currentIndex < stores.length - 1 && <span className="hint-arrow">→</span>}
        </div> */}
      </div>

      {/* 하단 네비게이션 (비활성화)
      <nav className="bottom-nav">
        <button
          className="nav-btn"
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          aria-label="이전"
        >
          ‹
        </button>

        인디케이터 도트
        <div className="dots">
          {stores.map((_, i) => (
            <button
              key={i}
              className={`dot ${i === currentIndex ? 'dot-active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`${i + 1}번째 항목`}
            />
          ))}
        </div>

        <button
          className="nav-btn"
          onClick={() => goTo(currentIndex + 1)}
          disabled={currentIndex === stores.length - 1}
          aria-label="다음"
        >
          ›
        </button>
      </nav>
      */}

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
          </div>
        </div>
      )}
    </div>
  )
}
