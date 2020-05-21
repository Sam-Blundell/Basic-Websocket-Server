const crypto = require('crypto');

const generateAcceptValue = (acceptKey) => {
    return crypto
        .createHash('sha1')
        .update(acceptKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'binary')
        .digest('base64');
}

module.exports = { generateAcceptValue }