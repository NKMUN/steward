<template>
  <div class="main">
    
    <Scanner
      @code="handleCode"
      @error="handleCaptureError"
      @internal-stats="(t, e) => {intTime = t; intError = e}"
    />

    <div :class="['stat', state]">
      <div class="state">
        <Icon
          @touchend.native.prevent="handleNerd"
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
      <pre class="nerds" v-if="userIsNerd">You must be a nerd!
    last: {{ lastResult }}
    perf: {{ intTime }}ms
     raw: {{ intError }}</pre>
    </div>
    
  </div>
</template>

<script>
import Scanner from '@/components/Scanner'
import 'vue-awesome/icons/spinner'
import 'vue-awesome/icons/exclamation-circle'
import 'vue-awesome/icons/question-circle-o'
import 'vue-awesome/icons/check-circle'
import 'vue-awesome/icons/ban'
import 'vue-awesome/icons/smile-o'
import 'vue-awesome/icons/meh-o'
import 'vue-awesome/icons/frown-o'

import urlParse from 'url-parse'

export default {
  components: {
    Scanner
  },
  data() {
    return {
      intTime: null,   // internal stat
      intError: null,  // internal stat
      lastResult: null,
      lastError: null,
      lastMessage: null,
      payload: null,    // things to shown on screen
      state: 'idle',
      busy: false,
      toIdleTimeout: null,
      userIsNerd: false,
      nerdCounter: 0
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
    }
  },
  methods: {
    handleCaptureError(error) {
      this.state = 'error'
      this.lastError = '未能打开摄像头'
      this.lastMessage = error.message
    },
    async handleCode(qrCode) {
      // do not scan the same code twice
      console.log(qrCode)
      if (qrCode.result === this.lastResult) return
      this.lastResult = qrCode.result
      this.busy = true
      
      // get object unique identifier
      const {
        hostname,
        pathname,
        query: { auth }
      } = urlParse(qrCode.result, {})
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
  .scanner
    flex-grow: 0
    flex-shrink: 0
  .stat
    flex-grow: 1
    align-self: stretch
  .icon
    margin: 12pt
    width: 40pt
    height: 40pt
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
        font-size: 18pt
        margin-top: 13pt
        margin-bottom: 11pt
        font-weight: bolder
      .description
        font-size: 10pt
        flex-grow: 1
  .payload
    margin: 1em 12pt
    flex-grow: 1
  .nerds
    margin: 1em 12pt
    font-size: 9pt
.stat
  color: white
  transition: background-color .5s
  .icon
    transition: color .5s
  &.idle, &.busy
    background-color: #00458a
    .icon
      color: #c5e2ff
  &.error, &.forbidden
    background-color: #5f1b1b
    .icon
      color: #ffa7a7
  &.warning, &.uncertain
    background-color: #672b00
    .icon
      color: #fff9c7
  &.busy
    .icon
      animation: 2s linear 0s infinite normal both running spin
  &.success
    background-color: #294a40
    .icon
      color: #86f74f
  &.nerd
    background-color: #333
</style>