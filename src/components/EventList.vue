<template>
  <div class="event-list">
    <mt-cell is-link title="当前活动" :value="value ? value.name : '暂无'" @click.native="expanded = true" />

    <div v-if="expanded" class="fullscreen">
      <mt-header title="当前活动">
        <mt-button icon="back" slot="left" @click.native="expanded = false">返回</mt-button>
      </mt-header>

      <mt-loadmore :top-method="fetchEvents" :bottom-all-loaded="true" ref="loadmore">
        <ul class="list" v-if="events && events.length">
          <li
            v-for="ev in events"
            :key="ev.id"
            :class="{
              cell: true,
              active: ev.id === currentId,
              disabled: eventIsDisabled(ev)
            }"
            @click="handleClick(ev)"
          >
            <div class="icon">
              <Icon name="check" v-if="ev.id === currentId" />
            </div>
            <div class="content">
            <h5 class="title">{{ ev.name }}</h5>
              <div class="status">
                <span v-if="ev.start_at > now">尚未开始</span>
                <span v-if="ev.end_at < now">已经结束</span>
                <span v-if="ev.start_at <= now && ev.end_at >= now">进行中…</span>
              </div>
            </div>
          </li>
        </ul>

        <div class="empty-list" @click="fetchEvents" v-else>
          <div class="icon">
            <Icon name="refresh" />
          </div>
          <div class="content">
            <p>暂无可签到活动</p>
            <p class="hint">下拉刷新</p>
          </div>
        </div>
      </mt-loadmore>

    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import 'vue-awesome/icons/check'
import 'vue-awesome/icons/refresh'

export default {
  name: 'event-list',
  props: {
    value: {}
  },
  computed: {
    currentId() {
      if (this.value) {
        return this.events.find(ev => ev.id === this.value.id).id
      } else {
        return null
      }
    },
    radioOptions() {
      return this.events.map(ev => ({
        label: ev.name,
        value: ev.id
      }) )
    },
    ...mapGetters({
      org: 'org',
    })
  },
  data() {
    return {
      expanded: false,
      now: Date.now(),
      events: []
    }
  },
  methods: {
    async fetchEvents() {
      this.events = await this.$agent.get(`/api/orgs/${this.org}/events/`).body()
      this.now = Date.now()
      // guess default event
      if (!this.value) {
        const defaultEvent = this.events
            .filter( ev => ev.start_at <= Date.now() )
            .filter( ev => ev.end_at >= Date.now() )
            .sort( (a, b) => a.start_at - b.start_at )
            [0]
        this.$emit('input', defaultEvent)
      }
      this.$refs.loadmore && this.$refs.loadmore.onTopLoaded()
    },
    handleSelection(val) {
      this.events.findOne(ev => ev.id === val)
    },
    eventIsDisabled(ev) {
      return ev.start_at > Date.now() || ev.end_at < Date.now()
    },
    handleClick(ev) {
      if (!this.eventIsDisabled(ev) && ev.id !== this.currentId) {
        this.$emit('input', ev)
        this.$emit('change', ev)
        setTimeout(() => { this.expanded = false }, 33)
      }
    }
  },
  mounted() {
    this.$emit('input', null)
    this.fetchEvents()
  }
}
</script>

<style lang="stylus" scoped>
.fullscreen
  position: fixed
  z-index: 99999
  top: 0
  left: 0
  height: 100vh
  width: 100vw
  background-color: white
  display: flex
  flex-direction: column
  align-items: stretch
  justify-content: flex-start
.mint-loadmore
  flex-grow: 1
  flex-shrink: 0
.mint-header
  flex-grow: 0
  flex-shrink: 0
.cell
  margin: 0 10px
  padding: 2px 0
  display: flex
  flex-direction: row
  justify-content: flex-start
  align-items: center
  background-image: linear-gradient(180deg, #d9d9d9, #d9d9d9 50%, transparent 0)
  background-size: 120% 1px
  background-repeat: no-repeat
  background-position: 0 0
  background-origin: border-box
  &:first-child
    margin-top: 4px
  &:last-child
    margin-bottom: 4px
  .title
    font-weight: bolder
    font-size: 12pt
  .status
    font-size: 9pt
  &:hover .title
    text-decoration: underline
  .icon
    flex-grow: 0
    flex-shrink: 0
    width: 24pt
    height: 24pt
    color: #26a2ff
    margin-right: 4px
  .content
    flex-grow: 1
    flex-shrink: 0
.empty-list
  text-align: center
  padding: 6px 10px
  .icon
    margin: 4px
    color: #26a2ff
  .hint
    font-size: 9pt
</style>

<style lang="stylus">
.event-list
  .list, .empty-list
  .icon
    svg
      width: 14pt
      height: 14pt
      padding: 5pt
</style>