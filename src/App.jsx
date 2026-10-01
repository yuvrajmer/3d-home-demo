import { useEffect, useRef, useState } from 'react'

const VIDEOS = ['/videos/1.mp4', '/videos/2.mp4', '/videos/3.mp4'] // 1+2 = main tour, 3 = bedroom (behind the door)
const P0 = 0.04, P1 = 0.92   // main tour: scroll range where video 1+2 play
const BP0 = 0.03, BP1 = 0.96 // bedroom tour: scroll range where video 3 plays

// Door position inside the first frame of video 1 (video size 1280x720)
const DOOR = { x: 613, y: 232, w: 28, h: 171 }
const VW = 1280, VH = 720

// Bedroom captions: [from, to (fraction of bedroom video), title, text]
const BED = [
  [0, 0.42, 'Primary suite', 'A tufted headboard, a private balcony and sunset from the bed.'],
  [0.42, 1.01, 'Spa bath', 'A freestanding tub, a marble-walled glass shower and a window made for morning light.'],
]

// Main landing page. a/b = scroll range where the text is visible (0 to 1)
const ROOMS = [
  { id: 'hero', a: 0, b: 0.05, hero: true },
  { id: 'living', a: 0.06, b: 0.50, nav: 'Living & dining', at: 0.07, title: 'Living & dining',
    text: 'Oak floors, tall windows and a glass dining table that holds the evening light across one open room.' },
  { id: 'gallery', a: 0.52, b: 0.90, nav: 'Gallery wall', at: 0.53, title: 'The gallery wall',
    text: 'A quiet corner of art, warm lamps and a walnut sideboard, framed by a clerestory of sky.' },
  { id: 'visit', a: 0.93, b: 1.01, nav: 'Visit', at: 0.94, title: 'See it in person.',
    text: 'Private viewings are held daily. Leave your details and we will call you back.', last: true },
]

const clamp = x => Math.min(1, Math.max(0, x))
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const maxScroll = () => document.documentElement.scrollHeight - innerHeight
const goTo = (p) => scrollTo({ top: maxScroll() * p, behavior: reduceMotion() ? 'auto' : 'smooth' })
const seek = (v, t) => { if (Math.abs(v.currentTime - t) > 0.03) v.currentTime = t }

export default function App() {
  const videoRefs = useRef([])
  const inBedRef = useRef(false)
  const busyRef = useRef(false)
  const curRef = useRef(0)
  const [progress, setProgress] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [activeVideo, setActiveVideo] = useState(0)
  const [inBed, setInBed] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [doorBox, setDoorBox] = useState(null)

  useEffect(() => {
    Promise.all(videoRefs.current.map(v => new Promise(r => {
      if (v.readyState >= 2) r(); else v.addEventListener('loadeddata', r, { once: true })
      setTimeout(r, 8000)
    }))).then(() => setLoaded(true))
  }, [])

  // keep the door button exactly over the door at any screen size
  useEffect(() => {
    const layout = () => {
      const W = innerWidth, H = innerHeight, s = Math.max(W / VW, H / VH)
      const ox = (W - VW * s) / 2, oy = (H - VH * s) / 2, pad = 6
      setDoorBox({
        left: ox + DOOR.x * s - pad, top: oy + DOOR.y * s - pad,
        width: DOOR.w * s + pad * 2, height: DOOR.h * s + pad * 2,
        origin: `${ox + (DOOR.x + DOOR.w / 2) * s}px ${oy + (DOOR.y + DOOR.h / 2) * s}px`,
      })
    }
    layout(); addEventListener('resize', layout)
    return () => removeEventListener('resize', layout)
  }, [])

  // longer page for the main tour, shorter for the bedroom tour
  const pageHeight = inBed ? '500vh' : '800vh'

  // scroll -> video time (main tour = video 1+2, bedroom = video 3)
  useEffect(() => {
    let raf, lastIdx = -1
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (busyRef.current) return
      const vs = videoRefs.current
      const m = maxScroll()
      const p = m > 0 ? clamp(scrollY / m) : 0
      curRef.current = reduceMotion() ? p : curRef.current + (p - curRef.current) * 0.1
      const cur = curRef.current

      if (inBedRef.current) {
        const v = vs[2], D = v.duration || 16
        seek(v, Math.min(clamp((cur - BP0) / (BP1 - BP0)) * D, D - 0.04))
        setProgress(cur)
        return
      }
      const d = [vs[0].duration || 10, vs[1].duration || 10]
      let t = clamp((cur - P0) / (P1 - P0)) * (d[0] + d[1])
      const idx = t <= d[0] ? 0 : 1
      if (idx === 1) t -= d[0]
      seek(vs[0], idx === 0 ? Math.min(t, d[0] - 0.04) : d[0])
      seek(vs[1], idx === 1 ? Math.min(t, d[1] - 0.04) : 0)
      if (idx !== lastIdx) { lastIdx = idx; setActiveVideo(idx) }
      setProgress(cur)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  const enterBedroom = () => {
    if (inBedRef.current || busyRef.current) return
    busyRef.current = true
    document.body.style.overflow = 'hidden'
    const fast = reduceMotion()
    const v = videoRefs.current[2]
    v.currentTime = 0
    setZoom(true) // camera flies into the door
    setTimeout(() => { // bedroom fades in OVER the zoom: no black gap
      v.style.transition = 'none'; v.style.transform = 'scale(1.14)'; void v.offsetWidth
      v.style.transition = 'opacity .9s ease, transform 1.4s cubic-bezier(.2,.6,.2,1)'
      v.style.transform = 'scale(1)'
      setActiveVideo(2)
    }, fast ? 0 : 900)
    setTimeout(() => {
      scrollTo(0, 0); curRef.current = 0
      v.style.transition = ''; v.style.transform = ''
      document.body.style.overflow = ''
      inBedRef.current = true; busyRef.current = false
      setInBed(true); setZoom(false); setProgress(0)
    }, fast ? 50 : 2350)
  }

  const exitBedroom = () => {
    inBedRef.current = false
    setInBed(false); setActiveVideo(0); setProgress(0)
    curRef.current = 0
    scrollTo(0, 0)
  }

  const navItems = ROOMS.filter(r => r.nav)
  const activeNav = navItems.reduce((a, r, i) => (progress >= r.at - 0.02 ? i : a), -1)
  const showDoor = !inBed && !zoom && progress < 0.02
  const bedP = clamp((progress - BP0) / (BP1 - BP0))
  const bedCap = BED.find(x => bedP >= x[0] && bedP < x[1]) || BED[BED.length - 1]

  return (
    <div className={progress < 0.05 && !inBed ? 'hero' : ''}>
      <div style={{ height: pageHeight }} />

      <div id="stage">
        {VIDEOS.map((src, i) => (
          <video key={src} ref={el => (videoRefs.current[i] = el)} src={src}
            className={`${i <= activeVideo ? 'on' : ''} ${i === 0 && zoom ? 'zoom' : ''}`}
            style={i === 0 && doorBox ? { transformOrigin: doorBox.origin } : undefined}
            muted playsInline preload="auto" />
        ))}
        <div id="scrim" />
      </div>

      <header>
        <div className="logo">Oak Hill House</div>
        <button className="btn" onClick={() => goTo(1)}>Book a viewing</button>
      </header>

      {doorBox && (
        <div className={`door ${showDoor ? 'show' : ''}`}
          style={{ left: doorBox.left, top: doorBox.top, width: doorBox.width, height: doorBox.height }}>
          <button onClick={enterBedroom} aria-label="Step into the bedroom">+</button>
          <span className="tag">Step into the bedroom</span>
        </div>
      )}

      {ROOMS.map(r => (
        <section key={r.id}
          className={`cap ${r.hero ? 'hero' : ''} ${!inBed && !zoom && progress >= r.a && progress < r.b ? 'on' : ''}`}>
          {r.hero ? (
            <>
              <h2>Walk in. <em>Stay awhile.</em></h2>
              <p>A light-filled modern home, toured room by room. Scroll to step inside, or open the bedroom door.</p>
              <div className="hint"><i />Scroll to enter</div>
            </>
          ) : (
            <>
              <h2>{r.title}</h2>
              <p>{r.text}</p>
              {r.last && (
                <>
                  <div className="specs">
                    <span><b>4</b>Bedrooms</span><span><b>3½</b>Bathrooms</span><span><b>2</b>Living areas</span>
                  </div>
                  <p style={{ marginTop: 28 }}>
                    <a className="btn" href="mailto:hello@example.com?subject=Viewing%20request">Request a viewing</a>
                  </p>
                </>
              )}
            </>
          )}
        </section>
      ))}

      {/* Bedroom captions (scroll-driven) */}
      <section className={`cap ${inBed ? 'on' : ''} ${progress < 0.04 ? 'start' : ''}`} id="bed">
        <h2>{bedCap[2]}</h2>
        <p>{bedCap[3]}</p>
        <div className="hint"><i />Scroll to explore</div>
      </section>

      <nav className="nav" aria-label="Rooms">
        {navItems.map((r, i) => (
          <button key={r.id} className={i === activeNav ? 'on' : ''} onClick={() => goTo(r.at)}>{r.nav}</button>
        ))}
      </nav>

      <button id="back" className="btn" onClick={exitBedroom}
        style={{ opacity: inBed ? 1 : 0, pointerEvents: inBed ? 'auto' : 'none' }}>Back to entrance</button>

      <div id="bar" style={{ width: `${progress * 100}%` }} />
      <div id="load" className={loaded ? 'off' : ''}>Opening the door…</div>
    </div>
  )
}
