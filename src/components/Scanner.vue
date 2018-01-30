<template>
  <div class="scanner" @click="handleClick()">
    <button v-if="!autoStartCapture" class="debug auto-capture" @click.stop="handleAutoCapture">
      <Icon name="bug" />
    </button>
    <video class="preview blur" ref="video" @loadedmetadata="handleVideoMeta" @playing="startIntervalScan" muted playsinline />
    <svg class="overlay" viewBox="0 0 640 640" shape-rendering="crispEdges">
      <defs>
        <mask id="clip">
          <rect x="-640" y="-640" width="1920" height="1920" fill="white" />
          <rect id="bg" x="120" y="120" width="400" height="400" fill="black"/>
        </mask>
      </defs>
      <rect class="mask" x="-640" y="-640" width="1920" height="1920" mask="url(#clip)" fill="black" fill-opacity="0.6" />
      <path class="inner-edge" d="m120,120 h400v400h-400v-400z" stroke="#57acf1"  stroke-width="4" fill="transparent" />
    </svg>
    <div class="bar" v-if="Boolean(stream)"></div>
    <div class="hint">
      {{ stream ? "将二维码放入框内，即可自动扫描" : error || "摄像头已关闭" }}
    </div>
    <canvas ref="canvas" />
    <input ref="file" @change="scanFile" style="display: none" type="file" capture="camera" accept="image/*">
    <canvas ref="fileCanvas" />
    <!--
      Hack for iOS Safari, need significant DOM update to start playback correctly
      I guess it requires "repaint" to properly start playing
    -->
    <div style="color: rgba(0,0,0,0); position: fixed; top: 0; left: 0">{{ hackDom }}</div>
  </div>
</template>

<script>
import QR from '@/qr-decode.js'
import { nop } from '@/qr-decode.js'
import 'vue-awesome/icons/bug'

const DEV_AUTO_CAPTURE_KEY = 'dev/no-auto-capture'

const qr = new QR()

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
      itvl: null,
      error: null,
      autoStartCapture: !window.localStorage || !window.localStorage.getItem(DEV_AUTO_CAPTURE_KEY),
      supportRealtime: navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
      hackDom: null
    }
  },
  methods: {
    handleClick() {
      if (!this.autoStartCapture || !this.supportRealtime) {
        this.$refs.file.click()
      } else {
        this.stopCapture()
        this.startCapture()
      }
    },
    startIntervalScan() {
      this.itvl = setInterval(() => {
        this.scanFrame()
        // HACK: force a DOM update so iOS safari can playback normally
        //       otherwise, video hangs at first frame
        this.hackDom = Date.now()
      }, 250)
      this.stream.getTracks()[0].onended = () => {
        this.error = "摄像头已关闭，点击这里重新开始扫描"
        this.stopCapture()
      }
      this.state = 'idle'
      this.lastError = '正在扫描'
      this.lastMessage = ''
    },
    startCapture() {
      if (!this.supportRealtime) {
        this.error = '浏览器不支持实时采集，点击这里拍照扫描'
        return
      }
      navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 640 },
          facingMode: { ideal: 'environment' },
          ... this.constraint
        },
        audio: false
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
          alert(error.name + ': ' + error.message)
          this.error = "摄像头已关闭，点击这里重新开始扫描"
        }
      )
    },
    stopCapture() {
      if (!this.stream) return
      clearInterval(this.itvl)
      this.stream.getTracks().forEach(track => {
        track.stop()
        this.stream.removeTrack && this.stream.removeTrack(track)
      })
      this.stream = null
      this.$refs.video.srcObject = null
    },
    handleVideoMeta(ev) {
      // hack for safari's failure to provide height/width in MediaStreamTrack.getSettings()
      const {
        videoWidth: width,
        videoHeight: height
      } = this.$refs.video
      this.$refs.video.width = width
      this.$refs.video.height = height
      const vMin = Math.min(width, height)
      this.$refs.canvas.height = vMin
      this.$refs.canvas.width = vMin
      this.$emit('started')
    },
    scanFile(ev) {
      this.error = '正在识别……'
      const file = ev.target.files[0]
      const reader = new FileReader()
      reader.onload = ev => {
        const { fileCanvas } = this.$refs
        let img = new Image();
        img.src = ev.target.result
        img.onload = ev => {
          const {
            naturalWidth: width,
            naturalHeight: height
          } = img
          // shrink image
          const iMax = Math.max(width, height)
          const scale = Math.min(1280 / iMax, 1)
          const cWidth = Math.floor(width * scale)
          const cHeight = Math.floor(height * scale)
          fileCanvas.width = cWidth
          fileCanvas.height = cHeight
          const ctx = fileCanvas.getContext('2d')
          ctx.drawImage(img, 0, 0, cWidth, cHeight)
          // try to decode until queued
          if (!qr.decode(ctx.getImageData(0, 0, cWidth, cHeight))) {
            const itvl = setInterval(() => {
              const ret = qr.decode(ctx.getImageData(0, 0, cWidth, cHeight))
              if (ret) clearInterval(itvl)
            }, 100)
          }
          this.$refs.file.value = ''
        }
      }
      reader.readAsDataURL(file)
    },
    scanFrame() {
      // compute qr code capture area
      // should be the image presented on screen
      const {video, canvas} = this.$refs
      if (!video || !canvas) return
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
      const startX = (vW - vMin) / 2 + Math.floor(vMin * 0.15)
      const startY = (vH - vMin) / 2 + Math.floor(vMin * 0.15)
      const scanX = Math.floor(vMin * 0.7)
      const scanY = Math.floor(vMin * 0.7)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, startX, startY, scanX, scanY, 0, 0, cW, cH)
      qr.decode(ctx.getImageData(0, 0, cW, cH))
    },
    handleAutoCapture() {
      this.autoStartCapture = true
      this.startCapture()
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
    this.$on('document:visible', () => { this.autoStartCapture && this.startCapture() })
    this.$on('document:hidden', () => { this.stopCapture() })

    this.autoStartCapture && this.startCapture()

    qr.callback = (result, location, time) => {
      this.$emit('code', result, location)
    }
    qr.statCallback = (stat) => {
      if (!this.supportRealtime) {
        const { error } = stat.workers.find($ => $.emitting)
        if (error) this.error = '未能识别：' + error
        else this.error = '识别成功'
      }
      this.$emit('internal-stats', stat)
    }
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
  width: 100vmin
  height: 100vmin
  overflow-x: visible
  overflow-y: hidden
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
.debug.auto-capture
  position: absolute
  bottom: 0
  left: 0
  width: 10vmin
  height: 10vmin
  min-width: 24pt
  min-height: 24pt
  max-width: 48pt
  max-height: 48pt
  text-align: center
  vertical-align: middle
  color: white
  background-color: black
  z-index: 999
canvas
  display: none
@media screen and (orientation: portrait)
  .scanner
    max-height: 600px
@media screen and (orientation: landscape)
  .scanner
    max-width: 540px
    max-height: 540px
    overflow-x: hidden
    overflow-y: visible
</style>
