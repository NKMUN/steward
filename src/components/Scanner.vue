<template>
  <div class="scanner">
    <video class="preview blur" ref="video" @timeupdate="scanFrame" @loadedmetadata="handleVideoMeta"/>
    <svg class="overlay" viewBox="0 0 640 640" shape-rendering="crispEdges">
      <path class="mask" d="m0,0 h640v640h-640v-640 m120,120 h400v400h-400v-400z" fill="black" fill-opacity="0.6" fill-rule="evenodd" />
      <path class="inner-edge" d="m120,120 h400v400h-400v-400z" stroke="#57acf1"  stroke-width="4" fill="transparent"/>
    </svg>
    <div class="bar" v-if="Boolean(stream)"></div>
    <div class="hint">
      将二维码放入框内，即可自动扫描
    </div>
    <canvas ref="canvas" />
    <pre class="debugger">
      lastTime: <span id="_dtime"></span>
      lastResult: {{ lastResult }}
    </pre>
  </div>
</template>

<script>
import QrWorker from '@/qr.worker.js'
const qr = new QrWorker()
let startTime = Date.now()
qr.onmessage = ev => {
  document.getElementById('_dtime').innerHTML = `${Date.now() - startTime}`
  const [error, result] = ev.data
  if (!error && qr.callback)
    qr.callback(error, result) 
}

export default {
  props: {
    width: {
      type: Number,
      default: 640
    },
    height: {
      type: Number,
      default: 640
    },
    constraint: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      stream: null,
      lastTime: null,
      lastResult: null
    }
  },
  methods: {
    startCapture() {
      navigator.mediaDevices.getUserMedia({
        video: {
          width: { min: 1280, ideal: 1080 },
          height: { min: 720, ideal: 1920 },
          facingMode: 'environment',
          ... this.constraint
        }
      }).then(
        stream => {
          this.$emit('started', stream)
          this.stream = stream
          this.$refs.video.srcObject = stream
          this.$refs.video.play()
        },
        error => {
          this.$emit('error', error)
          console.log(error)
          alert(error)
        }
      )
    },
    stopCapture() {
      this.stream.getVideoTracks().forEach(track => track.stop())
      this.stream = null
      this.$refs.video.srcObject = null
      qr.callback = () => {}
    },
    handleVideoMeta(ev) {
      // hack for safari's failure to provide height/width in MediaStreamTrack.getSettings()
      const {
        videoWidth: width,
        videoHeight: height
      } = this.$refs.video
      this.$refs.video.width = width
      this.$refs.video.height = height
      const vMin = Math.min(width, height, 480)
      this.$refs.canvas.height = vMin
      this.$refs.canvas.width = vMin
      qr.callback = (err, result) => {
        this.$emit('code', result)
        this.lastResult = result.result
      }
    },
    scanFrame() {
      // compute qr code capture area
      // should be the image presented on screen
      const {video, canvas} = this.$refs
      const {
        width: vW,
        height: vH
      } = video
      const {
        width: cW,
        height: cH
      } = canvas
      const vMin = Math.min(vW, vH)
      const cMin = Math.min(cW, cH)
      const startX = (vW - vMin) / 2 + Math.floor(vMin * 0.2)
      const startY = (vH - vMin) / 2 + Math.floor(vMin * 0.2)
      const scanX = Math.floor(vMin * 0.6)
      const scanY = Math.floor(vMin * 0.6)
      const ctx = canvas.getContext('2d')
      console.log(`${startX}, ${startY}, ${scanX}, ${scanY}, 0, 0, ${cW}, ${cH}`)
      ctx.drawImage(video, startX, startY, scanX, scanY, 0, 0, cW, cH)
      startTime = Date.now()
      qr.postMessage(ctx.getImageData(0, 0, cW, cH))
    }
  },
  mounted() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.$emit('document:visible')
      } else {
        this.$emit('document:hidden')
      }
    })
    this.$on('document:visible', () => { this.startCapture() })
    this.$on('document:hidden', () => { this.stopCapture() })

    this.startCapture()
  },
  beforeDestroy() {
    this.stopCapture()
  }
}
</script>

<style lang="stylus" scoped>
@keyframes bar-scan {
  from {
    top: 20%
  }
  to {
    top: calc(80% - 3pt)
  }
}
.scanner
  display: inline-block
  width: 100%
  max-width: 100vmin
  max-height: 100vmin
  overflow: hidden
  position: relative
  &:after
    content: " "
    display: block
    padding-bottom: 100%
.preview, .overlay
  position: absolute
  height: 100%
  width: 100%
.preview
  object-fit: cover
  z-index: 1
  background-color: black
.overlay
  z-index: 3
.hint
  z-index: 4
  position: absolute
  display: block
  width: 100%
  text-align: center
  top: 85%
  color: white
  font-size: 10pt
.bar
  position: absolute
  top: 20%
  left: 20%
  width: 60%
  height: 2pt
  z-index: 2
  background: linear-gradient(
    to right,
    rgba(30,87,153,0) 0%,
    rgba(30,87,153,0.8) 15%,
    rgba(30,87,153,1) 19%,
    rgba(30,87,153,1) 20%,
    rgba(87, 172, 241, 1) 50%,
    rgba(30,87,153,1) 80%,
    rgba(30,87,153,1) 81%,
    rgba(30,87,153,0.8) 85%,
    rgba(30,87,153,0) 100%
  )
  animation: 2s ease-in-out 0s infinite alternate both running bar-scan
canvas
  position: fixed
  top: 400px
  left: 0
.debugger
  position: fixed
  bottom: 0
  background-color: white
</style>