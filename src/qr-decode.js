import QrWorker from '@/qr.worker.js'

const availableCores = Math.max(navigator.hardwareConcurrency - 2, 1)
const nop = () => {}

function createDecoder() {
  const worker = new QrWorker()

  let startTime = Date.now()
  let lastTime = 0
  let lastError = null
  let lastResult = null
  let busy = false

  const qr = {
    decode(imageData) {
      if (busy) return false
      startTime = Date.now()
      worker.postMessage(imageData)
      busy = true
      return true
    },
    callback: nop,
    statCallback: nop,
    get busy() { return busy },
    get lastTime() { return lastTime },
    get lastError() { return lastError },
    get lastResult() { return lastResult },
}

  worker.onmessage = ev => {
    const [error, result] = ev.data

    busy = false
    lastTime = Date.now() - startTime
    lastError = error
    lastResult = result

    if (!error && qr.callback)
      qr.callback(error, result)
    if (qr.statCallback)
      qr.statCallback({
        time: lastTime,
        error,
        result
      })
  }

  return qr
}

function LoadBalandeQrDecode(numOfWorkers = availableCores) {
  console.log(`spawning ${numOfWorkers} qr workers`)
  const qrs = Array.apply(null, {length: numOfWorkers})
      .map(() => new createDecoder())

  let cur = -1
  let lastEmittedWorker = -1
  const ret = {
    decode(imageData) {
      cur = (cur + 1) % numOfWorkers
      return qrs[cur].decode(imageData)
    },
    callback: nop,
    statCallback: nop
  }

  let aggregatedStat = Array.apply(null, {length: numOfWorkers})
      .map(() => ({}))
  const emitAggregateStat = () => {
    if (!ret.statCallback) return
    ret.statCallback(
      qrs.map((qr, index) => ({
        busy: qr.busy,
        time: qr.lastTime,
        error: qr.lastError,
        result: qr.lastResult,
        emitting: lastEmittedWorker === index
      }) )
    )
  }

  qrs.forEach((qr, index) => {
    qr.callback = (...args) => {
      if (ret.callback) ret.callback(...args)
    }
    qr.statCallback = (stat) => {
      lastEmittedWorker = index
      aggregatedStat[index] = stat
      emitAggregateStat()
    }
  })

  return ret
}

export default LoadBalandeQrDecode
export { createDecoder }
export { nop }