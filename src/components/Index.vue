<template>
  <div class="main">

    <Scanner
      @code="handleCode"
      @error="handleCaptureError"
      @internal-stats="val => internalStats = val"
    />

    <NerdView v-if="userIsNerd" :value="internalStats" />

    <div :class="['stat', state]">
      <div class="state">
        <Icon
          @touchend.native.prevent="handleNerd"
          @click.native.prevent="handleNerd"
          class="icon"
          :name="stateIcon"
        />
        <div class="message">
          <div class="title">{{ lastError || "正在扫描" }}</div>
          <div class="description">{{ lastMessage || "" }}</div>
        </div>
      </div>
      <div class="payload">
        TODO: payload to show <br>
        姓名 <br>
        身份 <br>
        扫描时间 <br>
      </div>
    </div>

    <mt-button
      v-if="fullscreenSupported"
      type="primary"
      class="fullscreen"
      @click="toggleFullscreen"
    ><Icon name="arrows-alt" /></mt-button>
  </div>
</template>

<script>
import Scanner from '@/components/Scanner'
import NerdView from '@/components/NerdView'
import fscreen from 'fscreen'
import 'vue-awesome/icons/spinner'
import 'vue-awesome/icons/exclamation-circle'
import 'vue-awesome/icons/question-circle-o'
import 'vue-awesome/icons/check-circle'
import 'vue-awesome/icons/ban'
import 'vue-awesome/icons/smile-o'
import 'vue-awesome/icons/meh-o'
import 'vue-awesome/icons/frown-o'
import 'vue-awesome/icons/arrows-alt'

import urlParse from 'url-parse'

export default {
  components: {
    Scanner,
    NerdView
  },
  data() {
    return {
      lastResult: null,
      lastError: null,
      lastMessage: null,
      payload: null,    // things to shown on screen
      state: 'idle',
      busy: false,
      toIdleTimeout: null,
      userIsNerd: false,
      nerdCounter: 0,
      internalStats: null
    }
  },
  computed: {
    stateIcon() {
      return ({
        idle: 'smile-o',
        error: 'exclamation-circle',
        warning: 'exclamation-circle',
        success: 'check-circle',
        busy: 'spinner',
        forbidden: 'ban',
        uncertain: 'question-circle-o',
        nerd: 'frown-o',
      })[this.state] || 'meh-o'
    },
    fullscreenSupported() {
      return fscreen.fullscreenEnabled
    }
  },
  methods: {
    handleCaptureError(error) {
      this.state = 'error'
      this.lastError = '未能打开摄像头'
      this.lastMessage = error.message
    },
    async handleCode(payload) {
      // do not scan the same code twice
      console.log(payload)
      if (payload === this.lastResult) return
      this.lastResult = payload
      this.busy = true

      // get object unique identifier
      const {
        hostname,
        pathname,
        query: { auth }
      } = urlParse(payload, {})
      console.log(hostname)
      console.log(pathname)
      console.log(auth)

      // check identifier conforms to format
      const identifier = pathname.slice(1)
      if (!/[a-zA-Z0-9\.]+/.test(identifier)) {
        this.state = 'uncertain'
        this.lastError = '二维码无效'
        this.timeoutToIdle()
      }

      try {
        const {
          body,
          ok,
          status,
          headers
        } = await this.$agent
            .post('/api/checkin')
            .ok( ({ok, status}) => ok || status === 400 )
            .set('X-Steward', 'Steward')
            .send({
              identifier,
              steward: {
                // TODO: local authorization
              }
            })
        if (ok) {
          this.state = 'success'
          this.timeoutToIdle()
        } else {
          // TODO: check custom error code
          if (status === 400 && body.error === 'INVALID_AUTHORIZATION') {
            this.state = 'warning'
            this.lastError = '二维码伪造'
          }
          this.state = 'uncertain'
          this.lastError = body.message || body.error
          this.timeoutToIdle()
        }
      } catch(e) {
        console.log(e)
        this.lastError = '通信故障'
        this.lastMessage = e.message
        this.state = 'error'
        this.timeoutToIdle()
      } finally {
        this.busy = false
      }
    },
    timeoutToIdle(cbk) {
      if (this.toIdleTimeout) clearTimeout(this.toIdleTimeout)
      this.toIdleTimeout = setTimeout(() => {
        this.state = 'idle'
        this.lastError = null
        this.lastResult = null
        this.lastMessage = null
        this.toIdleTimeout = null
        if (cbk) cbk()
      }, 5000)
    },
    handleNerd() {
      if (++this.nerdCounter >= 3) {
        this.userIsNerd = true
      }
      this.state = 'nerd'
      setTimeout(() => this.state = 'idle', 250)
    },
    toggleFullscreen() {
      if (fscreen.fullscreenElement)
        fscreen.exitFullscreen()
      else
        fscreen.requestFullscreen(document.documentElement)
    }
  },
  async mounted() {
    // const STATES = {
    //   idle: 'smile-o',
    //   error: 'exclamation-circle',
    //   warning: 'exclamation-circle',
    //   success: 'check-circle',
    //   busy: 'spinner',
    //   forbidden: 'ban',
    //   uncertain: 'question-circle-o',
    // }
    // while (true) {
    //   for (let key in STATES) {
    //     this.state = key
    //     this.lastError = key
    //     this.lastMessage = 'message'
    //     await new Promise(resolve => setTimeout(resolve, 3000))
    //   }
    // }
  }
}
</script>

<style lang="stylus">
@keyframes spin {
  from {
    transform: rotate(0)
  }
  to {
    transform: rotate(360deg)
  }
}
.main
  display: flex
  flex-direction: column
  align-items: center
  justify-content: stretch
  height: 100%
  width: 100%
  background-color: rgb(32, 32, 32, 0)
  .scanner
    flex-grow: 0
    flex-shrink: 0
  .stat
    flex-grow: 1
    align-self: stretch
  .icon
    margin: 1rem
    width: 3rem
    height: 3rem
  .state
    display: flex
    flex-direction: row
    align-items: flex-start
    justify-content: center
    .icon
      flex-shrink: 0
      flex-grow: 0
    .message
      flex-grow: 1
      align-self: stretch
      display: flex
      flex-direction: column
      align-items: stretch
      justify-content: flex-start
      margin-left: 2ch
      .title
        flex-shrink: 0
        flex-grow: 0
        font-size: 1.3rem
        margin-top: 1rem
        margin-bottom: 0
        font-weight: bolder
      .description
        font-size: 0.8rem
        flex-grow: 1
  .payload
    margin: 1rem 1rem
    flex-grow: 1
  .nerd-stat
    position: fixed
    top: 0
    left: 0
    margin: 0
    padding: .5rem 1rem
    font-size: .75rem
    z-index: 9999
    color: rgba(255, 255, 255, 0.8)
  .fullscreen
    position: fixed
    bottom: 0
    right: 0
    z-index: 9999
    height: 24pt
    width: 24pt
    text-align: center
    padding: 0
    .svg
      display: inline-block
      height: 16pt
      width: 16pt

@media screen and (orientation: landscape)
  .main
    flex-direction: row
    .nerd-stat
      top: initial
      bottom: 0
    .fullscreen
      top: 0
      bottom: initial

@media screen and (min-width: 768px)
  html
    font-size: 150%

.stat
  color: white
  transition: background-color .5s
  .icon
    transition: color .5s
  &.idle, &.busy
    background-color: #409eff
    .icon
      color: #bae3ff
  &.error, &.forbidden
    background-color: #f56c6c
    .icon
      color: #ffedeb
  &.warning, &.uncertain
    background-color: #e6a23c
    .icon
      color: #ffebbd
  &.busy
    .icon
      animation: 2s linear 0s infinite normal both running spin
  &.success
    background-color: #67c23a
    .icon
      color: #cbe8b5
  &.nerd
    background-color: #333
</style>