<script>
const statStrLength = 8    // 5 dight time + "ms" + [space]
const buildFlagString = (stat) => {
  if (!stat) return ''.padStart(statStrLength)
  const { busy, error, emitting } = stat
  return `${
    emitting ? '*' : ' '
  }${
    busy ? '$' : ' '
  }${
    error ? 'E' : ' '
  }`.padStart(statStrLength)
}

const buildPerfString = (stat) => {
  if (!stat) return ''.padStart(statStrLength)
  return `${stat.time}ms`.padStart(statStrLength)
}

export default {
  functional: true,
  props: {
    value: { type: Array }
  },
  render(h, ctx) {
    const value = ctx.props.value
    if (value instanceof Array) {
      const emitting = value.find(stat => stat.emitting) || {}
      return (
        <pre class="nerd-stat">
          { `flag: ${value.map( buildFlagString ).join(' ')} \n`}
          { `perf: ${ value.map( buildPerfString ).join(' ')} \n`}
          { ` err: ${ emitting.error || '' } \n`}
          { ` raw: ${ emitting.result && emitting.result.result || '' } \n` }
        </pre>
      )
    } else {
      return (
        <pre>No stats available</pre>
      )
    }
  }
}
</script>

<style lang="stylus" .scoped>
.nerd-stat
  max-width: 100%
</style>
