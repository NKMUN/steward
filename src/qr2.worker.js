import {binarizeImage, locateQRInBinaryImage, extractQRFromBinaryImage, decodeQR} from 'jsqr'

function invertInplace(u8) {
    for (let i=0; i!==u8.length; ++i)
        u8[i] = !u8[i]
}

onmessage = ev => {
    const imageData = ev.data
    const binaryImage = binarizeImage(imageData.data, imageData.width, imageData.height)
    let location = locateQRInBinaryImage(binaryImage)
    // try positive
    if (!location) {
        // try negative
        invertInplace(binaryImage.data)
        location = locateQRInBinaryImage(binaryImage);
        if (!location) {
            return postMessage(['pattern not found', null])
        }
    }
    const payload = extractQRFromBinaryImage(binaryImage, location);
    if (!payload) {
        return postMessage(['code is corrupted', null])
    }
    const decoded = decodeQR(payload)
    postMessage([null, decoded, location])
}