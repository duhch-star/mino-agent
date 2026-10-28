import { useEffect, useRef, useState } from 'react'

const STATES = { idle: 'idle', talk: 'speaking', listen: 'listening', think: 'thinking', encourage: 'encouraging', smile: 'smile' }

/** Approved 2D campus avatar; no GLB, WebGL or rocket fallback. */
export default function CharacterView({ state = 'idle', audioUrl = '', onPlaybackEnd, onPlaybackError, className = '' }) {
  const frame = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const callbacks = useRef({ onPlaybackEnd, onPlaybackError })
  callbacks.current = { onPlaybackEnd, onPlaybackError }

  useEffect(() => {
    if (!loaded) return
    const win = frame.current?.contentWindow
    let api
    try { api = win?.InterviewerAvatar } catch { return }
    if (!api) return
    api.stop()
    api.setState(STATES[state] || 'idle')
    if (!audioUrl) return
    let cancelled = false
    let timer
    // playAudio resolves on playback start; observe the child's audio completion state.
    api.playAudio(audioUrl).then(() => {
      if (cancelled) { api.stop(); return }
      timer = window.setInterval(() => {
        const actual = win.document.getElementById('avatar')?.dataset.state
        if (actual === 'smile' || actual === 'idle') {
          window.clearInterval(timer)
          if (actual === 'smile') callbacks.current.onPlaybackEnd?.()
          else callbacks.current.onPlaybackError?.(new Error('音频播放中断'))
        }
      }, 100)
    }).catch(error => { if (!cancelled) callbacks.current.onPlaybackError?.(error) })
    return () => { cancelled = true; window.clearInterval(timer); api.stop() }
  }, [loaded, state, audioUrl])

  return <div className={`characterView campusCharacter ${className}`}>
    <iframe ref={frame} src="/avatar/index.html?embed=1" title="小北 · AI 面试官动态头像"
      onLoad={() => { try { setLoaded(!!frame.current?.contentWindow?.InterviewerAvatar) } catch { setLoaded(false) } }} allow="autoplay" className="campusAvatarFrame" />
    <div className="campusAvatarName">小北 <span>AI 面试官</span></div>
    <div className="characterState">{{ idle: '准备就绪', talk: '正在提问', listen: '认真倾听', think: '正在思考', encourage: '鼓励与反馈', smile: '微笑' }[state]}</div>
  </div>
}
