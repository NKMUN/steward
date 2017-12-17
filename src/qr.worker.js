import QrCode from 'qrcode-reader'

const qr = new QrCode()

qr.callback = (err, result) => {
    postMessage([err, result])
}

onmessage = ev => {
    qr.decode(ev.data)
}