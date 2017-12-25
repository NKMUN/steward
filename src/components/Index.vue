<template>
  <div class="main">

    <Scanner
      ref="scanner"
      @code="handleCode"
      @error="handleCaptureError"
      @internal-stats="val => internalStats = val"
    />

    <NerdView v-if="nerdCounter >= 3" :value="internalStats" />

    <div :class="['stat', displayState]">
      <div class="state">
        <Icon
          @touchend.native.prevent="handleNerd"
          @click.native.prevent="handleNerd"
          class="icon"
          :name="stateIcon"
        />
        <div class="message">
          <div class="title">{{ displayError || "正在扫描" }}</div>
          <div class="description">{{ displayMessage || "" }}</div>
        </div>
      </div>

      <div class="payload">
        <template v-if="payload">
          姓名：{{ payload.name }} <br>
          身份：{{ payload.role.join(', ') }} <br>
          时间：{{ payload.str_reported_at }} {{ payload.str_conclusion }}
        </template>
      </div>

      <div class="status-bar" v-if="token">
        <EventList v-model="currentEvent" />
        <!-- <button
          v-if="fullscreenSupported"
          class="fullscreen"
          @click="toggleFullscreen"
        ><Icon name="arrows-alt" /></button> -->
      </div>
    </div>

  </div>
</template>

<script>
import Scanner from '@/components/Scanner'
import NerdView from '@/components/NerdView'
import EventList from '@/components/EventList'
import fscreen from 'fscreen'
import { mapGetters } from 'vuex'
import dateFormat from 'dateformat'
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
    NerdView,
    EventList
  },
  data() {
    return {
      lastResult: null,
      lastError: null,
      lastMessage: null,
      payload: null,    // things to show on screen
      state: 'idle',
      toIdleTimeout: null,
      nerdCounter: 0,
      nerdSpawning: false,
      internalStats: null,
      currentEvent: null,
    }
  },
  computed: {
    fullscreenSupported() {
      return fscreen.fullscreenEnabled
    },
    ...mapGetters({
      token: 'token',
      org: 'org',
      identifier: 'identifier',
      expires: 'expires'
    }),
    // the following are fuzzy matched for no-token errors
    stateIcon() {
      if (this.nerdSpawning)
        return 'frown-o'
      if (!this.token)
        return 'exclamation-circle'
      return ({
        idle: 'smile-o',
        error: 'exclamation-circle',
        warning: 'exclamation-circle',
        success: 'check-circle',
        busy: 'spinner',
        forbidden: 'ban',
        uncertain: 'question-circle-o',
      })[this.state] || 'meh-o'
    },
    displayError() {
      return this.token || /授权/i.test(this.lastError) ? this.lastError : '尚未取得授权'
    },
    displayMessage() {
      return this.token || /授权/i.test(this.lastError) ? this.lastMessage : '请扫描授权二维码'
    },
    displayState() {
      return this.token ? this.state : 'warning'
    }
  },
  methods: {
    handleCaptureError(error) {
      this.state = 'error'
      this.lastError = '未能打开摄像头'
      this.lastMessage = error.message
    },
    async handleCode(payload) {
      console.log(payload)

      // do not scan the same code twice
      if (payload === this.lastResult) return
      this.lastResult = payload

      if (!this.currentEvent) {
        this.state = 'warning'
        this.lastError = '未选择需签到到活动'
        this.lastMessage = '点击「当前活动」选择'
        this.timeoutToIdle()
        return
      }

      // get object unique identifier
      const {
        hostname,    // not used, may be used to check against domain name
        pathname,
        query: { preauth }
      } = urlParse(payload, {}, true)

      // check for scanner authorization
      if (preauth) {
        return this.handleScannerAuthoriaztion(preauth)
      }

      // check identifier conforms to format
      const identifier = pathname.slice(1)
      if (!/[a-zA-Z0-9_\-\.]+/.test(identifier)) {
        this.state = 'uncertain'
        this.lastError = '二维码无效'
        this.timeoutToIdle()
        return
      }

      if (!this.currentEvent) {
        this.state = 'warning'
        this.lastError = '未选择活动'
        this.lastMessage = '请先选择当前活动'
        return
      }

      this.state = 'busy'
      try {
        const {
          body,
          ok,
          status
        } = await this.$agent
            .post(`/api/orgs/${this.org}/events/${this.currentEvent.id}/records/`)
            .ok( ({ok, status}) => ok || status === 417 || status === 404)
            .set('X-Steward', 'Steward')
            .send({
              identifier,
              steward: this.identifier,
              extra: {}
            })
        if (ok) {
          this.state = 'success'
          body.str_reported_at = dateFormat(new Date(body.record.reported_at), 'yyyy-mm-dd HH:MM')
          body.str_conclusion = body.record.conclusion === 'late'
                                ? '（迟到）'
                                : body.record.conclusion === 'absent'
                                  ? '（缺席）'
                                  : ''
          this.payload = body
          if (status === 200) this.lastError = '签到成功'
          if (status === 208) this.lastError = '已签过到'
        } else if (status === 417 && body.error === 'EVENT_NOT_STARTED') {
          this.state = 'warning'
          this.lastError = '活动尚未开始'
        } else if (status === 417 && body.error === 'EVENT_HAS_ENDED') {
          this.state = 'warning'
          this.lastError = '活动已结束'
        } else if (status === 404 && body.error === 'OBJECT_NOT_FOUND') {
          this.state = 'error'
          this.lastError = '二维码无效'
        } else {
          this.state = 'uncertain'
          this.lastError = body.message || body.error
        }
      } catch(e) {
        console.log(e)
        this.state = 'error'
        this.lastError = '通信故障'
        this.lastMessage = e.message
      } finally {
        this.timeoutToIdle()
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
        this.payload = null
        if (cbk) cbk()
      }, 5000)
    },
    handleNerd() {
      this.nerdCounter += 1
      this.nerdSpawning = true
      setTimeout(() => this.nerdSpawning = false, 250)
    },
    toggleFullscreen() {
      if (fscreen.fullscreenElement)
        fscreen.exitFullscreen()
      else
        fscreen.requestFullscreen(document.documentElement)
    },
    async validateToken() {
      if (!this.token) return false
      // try to validate token online
      try {
        const {
          ok,
          status,
          body
        } = await this.$agent.get(`/api/orgs/${this.org}/stewards/~`)
            .ok( ({status, ok}) => ok || status === 403 )

        if (ok) {
          this.state = 'idle'
          this.lastMessage = `授权到期：${ dateFormat(this.expires, 'yyyy-mm-dd HH:MM') }`
          return true
        }
        if (status === 403) {
          this.state = 'warning'
          this.lastError = '授权已过期'
          this.lastMessage = '请重新扫描授权二维码'
          this.$store.commit('token', null)
          return false
        }
      } catch(e) {
        this.state = 'error'
        this.lastError = '通信故障'
        this.lastMessage = e.message
        return false
      }
    },
    async handleScannerAuthoriaztion(token) {
      // trade for scanner authorization token
      try {
        this.state = 'busy'
        this.lastError = '正在授权…'

        this.$store.commit('token', token)
        await this.$agent.get(`/api/orgs/${this.org}/stewards/~`)

        this.state = 'success'
        this.lastError = '授权成功'
        this.lastMessage = `授权到期：${ dateFormat(this.expires, 'yyyy-mm-dd HH:MM') }`
      } catch(e) {
        this.state = 'error'
        this.lastError = '授权失败'
        this.lastMessage = e.message
        this.$store.commit('token', null)
        this.timeoutToIdle()
      }
    }
  },
  async mounted() {
    await this.validateToken()
  }
}
</script>

<style lang="stylus" scoped>
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
    display: flex
    flex-direction: column
    align-items: stretch
    justify-content: flex-start
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
  .status-bar
    display: flex
    flex-direction: row
    align-items: center
    justify-content: flex-start
    align-self: stretch
    .event-list
      flex-grow: 1
      flex-shrink: 0
    .fullscreen
      flex-shrink: 0
      flex-grow: 0
      height: 24pt
      width: 24pt
      text-align: center
      padding: 0
      color: white
      svg
        display: inline-block
        height: 14pt
        width: 14pt
        padding: 5pt

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
  transition: background-color .5s
  .payload, .state
    color: white
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
</style>