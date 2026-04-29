import { useState, useRef, useEffect, useCallback } from 'react'
import stores from './stores.json'
import './App.css'

const STORAGE_KEY = 'dosirak_current_index'

export default function App() {
  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    const parsed = parseInt(saved, 10)
    if (!isNaN(parsed) && parsed >= 0 && parsed < stores.length) {
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

  // 인덱스 변경 시 로컬스토리지 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(currentIndex))
  }, [currentIndex])

  const goTo = useCallback((index) => {
    if (index < 0 || index >= stores.length || animating) return
    setAnimating(true)
    setCurrentIndex(index)
    setTimeout(() => setAnimating(false), 300)
  }, [animating])

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

  const store = stores[currentIndex]

  return (
    <div className="app">
      {/* 헤더 */}
      <header className="header">
        <span className="header-count">{currentIndex + 1} / {stores.length}</span>
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
          <h1 className="store-name">{store.상호}</h1>
          <div className="divider" />
          <div className="info-row">
            <span className="label">주소</span>
            <span className="value">{store.주소}</span>
          </div>
          <div className="info-row">
            <span className="label">내용</span>
            <span className="value note">{store.내용}</span>
          </div>
          <div className="links">
            <a
              href={store.네이버지도url}
              target="_blank"
              rel="noopener noreferrer"
              className="link-btn naver"
              onClick={(e) => e.stopPropagation()}
            >
              네이버지도
            </a>
            <button
              className="link-btn tmap"
              onClick={(e) => {
                e.stopPropagation()
                const name = encodeURIComponent(store.상호)
                const deeplink = `tmap://route?goalx=${store.lng}&goaly=${store.lat}&goalname=${name}&appKey=tmap`
                // 딥링크 시도 후 앱 미설치 시 스토어로 폴백
                const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
                const storeUrl = isIOS
                  ? 'https://apps.apple.com/kr/app/tmap/id431589174'
                  : 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku'
                const start = Date.now()
                window.location.href = deeplink
                setTimeout(() => {
                  if (Date.now() - start < 2000) {
                    window.open(storeUrl, '_blank')
                  }
                }, 1500)
              }}
            >
              티맵 길찾기
            </button>
          </div>
        </div>

        {/* 스와이프 힌트 */}
        <div className="swipe-hint">
          {currentIndex > 0 && <span className="hint-arrow">←</span>}
          <span className="hint-text">스와이프</span>
          {currentIndex < stores.length - 1 && <span className="hint-arrow">→</span>}
        </div>
      </div>

      {/* 하단 네비게이션 */}
      <nav className="bottom-nav">
        <button
          className="nav-btn"
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          aria-label="이전"
        >
          ‹
        </button>

        {/* 인디케이터 도트 */}
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
    </div>
  )
}
