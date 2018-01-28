import {binarize, locate, extract, decode} from './lib/jsqr'

function invertInplace(u8) {
    for (let i=0; i!==u8.length; ++i)
        u8[i] = !u8[i]
}

function getPayload(binaryImage) {
    const location = locate(binaryImage)
    if (!location) return null

    const payload = extract(binaryImage, location)
    if (!payload) return null

    const decoded = decode(payload.matrix)
    if (!decoded) return null

    return decoded.text
}

onmessage = ev => {
    const imageData = ev.data
    const binaryImage = binarize(imageData.data, imageData.width, imageData.height)
    const payloadPositive = getPayload(binaryImage)
    invertInplace(binaryImage.data)
    const payloadNegative = getPayload(binaryImage)
    // console.log('+: ' + payloadPositive)
    // console.log('-: ' + payloadNegative)

    const ret = payloadPositive || payloadNegative
    if (ret) {
        postMessage([null, ret, null])
    } else {
        postMessage(['pattern not found', null])
    }
}
