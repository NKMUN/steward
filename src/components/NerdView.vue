<script>
const statStrLength = 8    // 5 dight time + "ms" + [space]

const buildFlagString = (stat) => {
  // fuzz match error type
  if (!stat) return ''.padStart(statStrLength)
  const { busy, error, emitting } = stat
  const notFound = /not.*?found/i.test(error) ? 'n' : ''
  const corrupt = /corrupt|checksum/i.test(error) ? 'x' : ''
  return `${
    emitting ? '*' : ' '
  }${
    busy ? '$' : ' '
  }${
    error ? 'E' : ' '
  }${
    notFound || corrupt || (error ? '_' : ' ')
  }`.padStart(statStrLength)
}

const buildPerfString = (stat) => {
  if (!stat) return ''.padStart(statStrLength)
  if (!stat.time) return 'nop'.padStart(statStrLength)
  return `${stat.time}ms`.padStart(statStrLength)
}

export default {
  functional: true,
  props: {
    value: { type: Object }
  },
  render(h, ctx) {
    if (!ctx.props.value) return (<pre>No stats available</pre>)

    const {
      freqMs,
      perf,
      workers
    } = ctx.props.value
    const emitting = workers.find(stat => stat.emitting) || {}
    return (
      <pre class="nerd-stat">
        { `thrt: ${ freqMs }ms \n` }
        { `flag: ${ workers.map( buildFlagString ).join(' ')} \n`}
        { `perf: ${ workers.map( buildPerfString ).join(' ')} \n`}
        { ` err: ${ emitting.error || '' } \n`}
        { ` raw: ${ emitting.result || '' } \n` }
        { `   P: ${ perf.join(', ')}`}
      </pre>
    )

  }
}
</script>

<style lang="stylus" scoped>
.nerd-stat
  width: 100%
  max-width: 100%
  background-color: rgba(0, 0, 0, 0.7)
</style>
