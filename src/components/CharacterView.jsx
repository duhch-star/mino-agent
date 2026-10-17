import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { XiaominMark } from './XiaominMark.jsx'

// MINO AGENT 3D 模型 URL：把处理好的 .glb 丢到 public/models/xiaomin.glb 即自动生效
const MODEL_URL = '/models/xiaomin.glb'

const STATE_LABEL = { idle: '待机', talk: '讲解中', listen: '倾听中', think: '思考中', encourage: '鼓励中' }

/**
 * 3D 角色视口：优先加载 GLB 并播放动画 + 口型；无模型时降级为 2D 立绘占位。
 * @param {string} state   idle | talk | listen | think | encourage
 * @param {boolean} speaking  是否说话（驱动口型 morph）
 */
export default function CharacterView({ state = 'idle', speaking = false, className }) {
  const containerRef = useRef(null)
  const [failed, setFailed] = useState(false)

  // 用 ref 持有最新 prop，避免动画循环重建
  const stateRef = useRef(state)
  const speakRef = useRef(speaking)
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { speakRef.current = speaking }, [speaking])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let disposed = false
    let cleanup = () => {}

    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return
        try {
          const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
          renderer.outputColorSpace = THREE.SRGBColorSpace

          const scene = new THREE.Scene()
          const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
          camera.position.set(0, 0.6, 4.5)

          scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6))
          const key = new THREE.DirectionalLight(0xffffff, 2.2)
          key.position.set(2, 4, 3)
          scene.add(key)

          const model = gltf.scene
          // 归一化：居中 + 缩放到合适大小
          const box = new THREE.Box3().setFromObject(model)
          const size = box.getSize(new THREE.Vector3())
          const center = box.getCenter(new THREE.Vector3())
          const scale = 2.2 / Math.max(size.x, size.y, size.z, 0.001)
          model.scale.setScalar(scale)
          model.position.sub(center.clone().multiplyScalar(scale))
          model.position.y -= box.min.y * scale
          scene.add(model)

          const mixer = new THREE.AnimationMixer(model)
          const clips = {}
          gltf.animations.forEach(clip => { clips[clip.name.toLowerCase()] = clip })

          // 收集口型 morph（mouthOpen / 各 viseme）
          const mouthTargets = []
          model.traverse(o => {
            if (o.isMesh && o.morphTargetInfluences && o.morphTargetDictionary) {
              Object.entries(o.morphTargetDictionary).forEach(([name, idx]) => {
                if (/mouth|open|jaw|viseme|aa|ee|ih|oh|uh/i.test(name)) mouthTargets.push({ mesh: o, index: idx })
              })
            }
          })

          const setAction = (name) => {
            const clip = clips[name] || Object.values(clips)[0]
            mixer.stopAllAction()
            if (clip) mixer.clipAction(clip).reset().play()
          }
          const lastState = { name: '' }

          const resize = () => {
            const w = container.clientWidth || 1
            const h = container.clientHeight || 1
            renderer.setSize(w, h)
            camera.aspect = w / h
            camera.updateProjectionMatrix()
          }
          resize()
          container.appendChild(renderer.domElement)

          const clock = new THREE.Clock()
          const animate = () => {
            if (disposed) return
            const t = performance.now() / 1000
            // 动作切换
            if (stateRef.current !== lastState.name) {
              lastState.name = stateRef.current
              setAction(stateRef.current)
            }
            // 口型：说话时按正弦驱动，停止时闭合
            const amp = speakRef.current ? 0.25 + 0.75 * Math.abs(Math.sin(performance.now() / 80)) : 0
            mouthTargets.forEach(t => { t.mesh.morphTargetInfluences[t.index] = amp })
            // 轻微待机浮动
            model.position.y = -(box.min.y * scale) + Math.sin(t * 1.5) * 0.04
            mixer.update(clock.getDelta())
            renderer.render(scene, camera)
            requestAnimationFrame(animate)
          }
          animate()
          cleanup = () => {
            mixer.stopAllAction()
            renderer.dispose()
            renderer.domElement.remove()
          }
        } catch {
          setFailed(true)
        }
      },
      undefined,
      () => { if (!disposed) setFailed(true) },
    )

    return () => {
      disposed = true
      cleanup()
    }
  }, [])

  return (
    <div className={`characterView${className ? ' ' + className : ''}`} ref={containerRef}>
      {failed && (
        <div className="characterFallback">
          <div className="characterAvatar"><XiaominMark size={72} /></div>
          <div className="characterName">MINO AGENT</div>
          <div className="characterState">{STATE_LABEL[state] || ''}</div>
        </div>
      )}
    </div>
  )
}
