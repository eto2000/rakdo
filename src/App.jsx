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
const STORES_KEY = 'dosirak_stores'

// 로컬스토리지에서 stores 불러오기 (최초 1회만 초기화)
function loadStores() {
  try {
    const saved = localStorage.getItem(STORES_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch {
    // 파싱 실패 시 초기 데이터 사용
  }
  // 최초 실행: 소스 JSON을 로컬스토리지에 저장
  localStorage.setItem(STORES_KEY, JSON.stringify(initialStores))
  return initialStores
}

// 네이버 지도 URL에서 lat/lng 추출
function extractCoordsFromNaverUrl(url) {
  // 형식 1: map.naver.com/p/?lat=37.xxx&lng=127.xxx
  const latMatch = url.match(/[?&]lat=([\d.]+)/)
  const lngMatch = url.match(/[?&]lng=([\d.]+)/)
  if (latMatch && lngMatch) {
    return { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]) }
  }

  // 형식 2: map.naver.com/p/search/.../37.xxx,127.xxx
  const coordsMatch = url.match(/([\d]{2}\.[\d]+),([\d]{3}\.[\d]+)/)
  if (coordsMatch) {
    return { lat: parseFloat(coordsMatch[1]), lng: parseFloat(coordsMatch[2]) }
  }

  return null
}

export default function App() {
  const [stores, setStores] = useState(() => loadStores())

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

  // 수정 모달 상태
  const [editOpen, setEditOpen] = useState(false)
  const [editUrl, setEditUrl] = useState('')
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState(false)

  // 인덱스 변경 시 로컬스토리지 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(currentIndex))
  }, [currentIndex])

  // stores 변경 시 로컬스토리지 저장
  useEffect(() => {
    localStorage.setItem(STORES_KEY, JSON.stringify(stores))
  }, [stores])

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

  const openEdit = (e) => {
    e.stopPropagation()
    setEditUrl('')
    setEditError('')
    setEditSuccess(false)
    setEditOpen(true)
  }

  const closeEdit = () => {
    setEditOpen(false)
    setEditError('')
    setEditSuccess(false)
  }

  const handleEditSave = () => {
    setEditError('')
    setEditSuccess(false)

    const trimmed = editUrl.trim()
    if (!trimmed) {
      setEditError('URL을 입력해주세요.')
      return
    }

    const coords = extractCoordsFromNaverUrl(trimmed)
    if (!coords) {
      setEditError('좌표를 찾을 수 없습니다.\n네이버 지도 URL에 lat/lng 파라미터가 포함되어야 합니다.\n예: https://map.naver.com/p/?lat=37.5&lng=127.1&zoom=17')
      return
    }

    const updated = stores.map((s, i) =>
      i === currentIndex
        ? { ...s, lat: coords.lat, lng: coords.lng, 좌표url: trimmed }
        : s
    )
    setStores(updated)
    setEditSuccess(true)
    setTimeout(() => closeEdit(), 1200)
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
          <div className="card-header-row">
            <h1 className="store-name">{store.상호}</h1>
            <button className="edit-btn" onClick={openEdit} aria-label="좌표 수정">
              수정
            </button>
          </div>
          <div className="divider" />
          <div className="info-row">
            <span className="label">주소</span>
            <span className="value">{store.주소}</span>
          </div>
          <div className="info-row">
            <span className="label">내용</span>
            <span className="value note">{store.내용}</span>
          </div>
          <div className="info-row coords-row">
            <span className="label">좌표</span>
            <span className="value coords-value">
              {store.lat}, {store.lng}
            </span>
          </div>
          <div className="links">
            <button
              className="link-btn naver"
              onClick={(e) => {
                e.stopPropagation()
                const name = encodeURIComponent(store.상호)
                const deeplink = `nmap://route/car?dlat=${store.lat}&dlng=${store.lng}&dname=${name}&appname=com.dosirak.app`
                const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
                const storeUrl = isIOS
                  ? 'https://apps.apple.com/kr/app/naver-map-navigation/id311867728'
                  : 'https://play.google.com/store/apps/details?id=com.nhn.android.nmap'
                const start = Date.now()
                window.location.href = deeplink
                setTimeout(() => {
                  if (Date.now() - start < 2000) {
                    window.open(storeUrl, '_blank')
                  }
                }, 1500)
              }}
            >
              네이버지도 길찾기
            </button>
            <button
              className="link-btn tmap"
              onClick={(e) => {
                e.stopPropagation()
                const name = encodeURIComponent(store.상호)
                const deeplink = `tmap://route?goalx=${store.lng}&goaly=${store.lat}&goalname=${name}&appKey=tmap`
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

      {/* 좌표 수정 모달 */}
      {editOpen && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">좌표 수정</h2>
              <button className="modal-close" onClick={closeEdit} aria-label="닫기">✕</button>
            </div>
            <p className="modal-store-name">{store.상호}</p>
            <p className="modal-desc">
              네이버 지도에서 위치를 찾은 후 URL을 복사해 붙여넣으세요.<br />
              <span className="modal-desc-sub">예: https://map.naver.com/p/?lat=37.5&amp;lng=127.1&amp;zoom=17</span>
            </p>
            <div className="modal-current">
              <span className="modal-current-label">현재 좌표</span>
              <span className="modal-current-value">{store.lat}, {store.lng}</span>
            </div>
            <textarea
              className="modal-input"
              placeholder="네이버 지도 URL을 붙여넣으세요"
              value={editUrl}
              onChange={(e) => {
                setEditUrl(e.target.value)
                setEditError('')
              }}
              rows={3}
              autoFocus
            />
            {editError && (
              <p className="modal-error">{editError}</p>
            )}
            {editSuccess && (
              <p className="modal-success">✓ 좌표가 업데이트되었습니다!</p>
            )}
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={closeEdit}>취소</button>
              <button className="modal-btn save" onClick={handleEditSave}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
