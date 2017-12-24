<template>
  <div class="event-list">
    <mt-cell is-link title="当前活动" :value="value ? value.name : '暂无'" @click.native="expanded = true" />

    <div v-if="expanded" class="fullscreen">
      <mt-header title="当前活动">
        <mt-button icon="back" slot="left" @click.native="expanded = false">返回</mt-button>
      </mt-header>

      <div class="list">
        <div
          v-for="ev in events"
          :key="ev.id"
          :class="{
            cell: true,
            active: ev.id === currentId,
            disabled: eventIsDisabled(ev)
          }"
          @click="handleClick(ev)"
        >
          <div class="cell-wrapper">
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import 'vue-awesome/icons/check'
export default {
  name: 'event-list',
  props: {
    value: {},
    events: {
      type: Array,
      default: () => []
    }
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
    }
  },
  data() {
    return {
      expanded: false,
      now: Date.now(),
    }
  },
  watch: {
    expanded(val) {
      if (val) {
        this.now = Date.now()
        this.$emit('show')
      }else{
        this.$emit('hide')
      }
    }
  },
  methods: {
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
  }
}
</script>

<style lang="stylus" scoped>
.event-list
  .fullscreen
    position: fixed
    z-index: 99999
    top: 0
    left: 0
    height: 100vh
    width: 100vw
    background-color: white
    .list
      overflow-y: scroll
      overflow-x: hidden
    .cell
      padding: 0 10px
      text-align: left
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
    .cell-wrapper
      display: flex
      flex-direction: row
      justify-content: flex-start
      align-items: center
      background-image: linear-gradient(180deg, #d9d9d9, #d9d9d9 50%, transparent 0)
      background-size: 120% 1px
      background-repeat: no-repeat
      background-position: 0 0
      background-origin: border-box
      padding: 2px 0
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
</style>

<style lang="stylus">
.cell-wrapper
  .icon
    svg
      width: 14pt
      height: 14pt
      padding: 5pt
</style>