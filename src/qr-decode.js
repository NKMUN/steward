import QrWorker from '@/qr2.worker.js'

// Safari does not support hardwareConcurrency, assume 4 cores and consume as many as possible
const availableCores = Math.max((navigator.hardwareConcurrency || 4) - 2, 1)
const nop = () => {}

/*
 * createDecoder returns the following method:
 *   QrScan( ImageData )  =>  a Promise that resolves to {error, result, location, time}
 *
 * < ImageData: browser's native ImageData, acquired from canvasContext.getImageData()
 *
 * => error:
 *     null,      scan successfully
 *     string,    describes the reason of failed scan (pattern not found, corrupted, etc.) depends on underlying scanner
 * => result:
 *     null,      if no code is found
 *     string,    qr code payload, if one is found
 * => location:
 *     { topLeft, topRight, bottomLeft }
 *     qr code corner points pixel location, in {x, y} format
 * => time:
 *     int (number)
 *     milliseconds spend to scan code
 */

// jsQR
function jsqrDecoder() {
  const worker = new QrWorker()
  return function jsqrDecoder(imageData) {
    let startTime = Date.now()

    return new Promise(resolve => {
      worker.postMessage(imageData)
      worker.onmessage = ev => {
        resolve({
          error: ev.data[0],
          result: ev.data[1],
          location: ev.data[2],
          time: Date.now() - startTime
        })
        worker.onmessage = nop
      }
    })
  }
}

/*
 * Load balande Qr Decoder
 *   throttling based on most recent 10 scans, so scans are averaged across video frames
 *
 * > numOfWorkers: number of workers, default CPU cores - 2
 * > decoder: decoder factory method, must returns a compatible QrScan() as mentioned above
 *
 * => returns the following object / interface
 * => {
 *   decode( ImageData )
 *     => true, if queued to be scanned
 *     => false, if throttled (all workers are busy)
 *
 *   callback = function (result, location, time)
 *     should be set by user, called each time a qr code is found
 *       result: payload string
 *       location: qr code corner point location, see the location above
 *       time: milliseconds spent to scan
 *
 *   statCallback = function ( aggregatedStats )
 *     should be set by user, called to emit internal stat update
 * }
 *
 * aggregatedStats: {
 *   freqMs:     int                 computed scan frequency (interval in ms)
 *   perf:       array of int        collected performance samples
 *   workers:    array of {          per worker stat
 *       busy:        true / false        worker is busy
 *       emitting:    true / false        worker emits last result
 *       time:        int (number)        milliseconds spend to last frame
 *       error:       null / string       error string
 *       result:      null / string       null or last payload string
 *   }
 */

function LoadBalandeQrDecode(numOfWorkers = availableCores, decoder = jsqrDecoder) {
  console.log(`spawning ${numOfWorkers} qr workers`)

  function addSample(arr, newSample) {
    const LB_SAMPLE_SIZE = 10
    if (arr.length <= LB_SAMPLE_SIZE) {
      return [...arr, newSample]
    } else {
      return [...arr.slice(1), newSample]
    }
  }

  function decideThrottleTime(arr) {
    if (arr.length === 0) return 0
    const sum = (a, b) => a + b
    return Math.ceil( arr.reduce(sum) / arr.length / numOfWorkers * 1.2 )  // 1.2 accounts for jitter
  }

  const qrs = Array.apply(null, {length: numOfWorkers})
      .map((_, index) => ({
        index,
        decode: new decoder(),
        busy: false,
        error: null,
        result: null,
        time: null
      }) )

  let lastEmittedIndex = -1
  let lastFinishTime = 0   // last emitted timestamp, used to throttle
  let perf = []    // used to throttle scan freq

  const ret = {
    decode(imageData) {
      if (lastFinishTime + decideThrottleTime >= Date.now()) return false    // throttled

      const qr = qrs.find(qr => !qr.busy)
      if (!qr) return false

      qr.busy = true
      qr.decode(imageData).then(
        ({error, result, location, time}) => {
          lastEmittedIndex = qr.index
          lastFinishTime = Date.now()

          qr.error = error
          qr.result = result
          qr.busy = false
          qr.time = time

          perf = addSample(perf, time)

          !error && ret.callback && ret.callback(result, location, time)
          ret.statCallback && ret.statCallback({
            freqMs: decideThrottleTime(perf),
            perf: [...perf],
            workers: qrs.map(qr => ({
              busy: qr.busy,
              emitting: lastEmittedIndex === qr.index,
              time: qr.time,
              error: qr.error,
              result: qr.result
            }) )
          })

        }
      )
      return true
    },
    callback: nop,
    statCallback: nop
  }

  return ret
}

export default LoadBalandeQrDecode
export { createDecoder }
export { nop }