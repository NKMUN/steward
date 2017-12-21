import {binarizeImage, locateQRInBinaryImage, extractQRFromBinaryImage, decodeQR} from 'jsqr'

onmessage = ev => {
    const imageData = ev.data
    const binaryImage = binarizeImage(imageData.data, imageData.width, imageData.height)
    const location = locateQRInBinaryImage(binaryImage)
    if (!location) {
        return postMessage(['pattern not found', null])
    }
    const payload = extractQRFromBinaryImage(binaryImage, location);
    if (!payload) {
        return postMessage(['code is corrupted', null])
    }
    const decoded = decodeQR(payload)
    postMessage([null, decoded, location])
}