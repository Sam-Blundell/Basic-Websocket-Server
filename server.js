const http = require('http');
const static = require('node-static');
const file = new static.Server('./');
const { generateAcceptValue } = require('./utils');

const server = http.createServer((req, res) => {
    req.addListener('end', () => file.serve(req, res)).resume();
});

server.on('upgrade', (req, socket) => {
    if (req.headers['upgrade'] !== 'websocket') {
        socket.end('HTTP/1.1 400 Bad Request');
        return
    }
    // Read the websocket key provided by the client: 
    const acceptKey = req.headers['sec-websocket-key'];
    // Generate the response value to use in the response:
    const hash = generateAcceptValue(acceptKey);
    // Write the HTTP response into an array of response lines: 
    const responseHeaders = ['HTTP/1.1 101 Web Socket Protocol Handshake', 'Upgrade: WebSocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${hash}`];
    // read the subprotocol from the client headers:
    const protocol = req.headers['sec-websocket-protocol'];
    // If provided, they'll be formatted as a comma-delimited string of protocol names that the client supports; we'll need to parse the header value, if provided, and see what options the client is offering:
    const protocols = !protocol ? [] : protocol.split(',').map(s => s.trim());
    // To keep it simple, we'll just see if JSON was an option, and if so, include it in the HTTP response:
    if (protocols.includes('json')) {
        // Tell the client that we agree to communicate with JSON data:
        responseHeaders.push('Sec-Websocket-Protocol: json');
    }
    // TODO: handle condition where provided subprotocols are unsupported.

    // Write the response back to the client socket, being sure to append two additional newlines so that the browser recognises the end of the response header and doesn't continue to wait for more header data: 
    socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

    socket.on('data', buffer => {
        const message = parseMessage(buffer);
        console.log(message);
        if (message) {
            socket.write(constructReply({ message: 'Hello from the server' }));
        } else if (message === null) {
            console.log('WebSocket connection closed by the client.');
        }
    });
})

function constructReply(data) {
    const jsonData = JSON.stringify(data);
    const jsonByteLength = Buffer.byteLength(jsonData);
    // > 65535 byte payloads unsupported currently.
    const lengthByteCount = jsonByteLength < 126 ? 0 : 2;
    const payloadLength = lengthByteCount === 0 ? jsonByteLength : 126;
    const buffer = Buffer.alloc(2 + lengthByteCount + jsonByteLength);
    // Write out first bite adding opcode 1 to indicate that the payload contains text data.
    buffer.writeUInt8(0b10000001, 0);
    // Write the length of the JSON payload to the second byte
    buffer.writeUInt8(payloadLength, 1);
    let payloadOffset = 2;
    if (lengthByteCount > 0) {
        buffer.writeUInt16BE(jsonByteLength, 2);
        payloadOffset += lengthByteCount;
    }
    // Write JSON data to the data buffer.
    buffer.write(jsonData, payloadOffset);
    return buffer;
}

function parseMessage(buffer) {
    const firstByte = buffer.readUInt8(0);
    const isFinalFrame = Boolean((firstByte >>> 7) & 0x1);
    const [reserved1, reserved2, reserved3] = [
        Boolean((firstByte >>> 6) & 0x1),
        Boolean((firstByte >>> 5) & 0x1),
        Boolean((firstByte >>> 4) & 0x1)
    ];
    const opCode = firstByte & 0xF;
    // Check if opCode is 0x8 (close) and return null if so.
    if (opCode === 0x8) {
        return null;
    }
    // Currently only handling text frames (opCode 0x1).
    if (opCode !== 0x1) {
        return;
    }
    const secondByte = buffer.readUInt8(1);
    const isMasked = Boolean((secondByte >>> 7) & 0x1);
    // Keep track of position while advancing through buffer.
    let currentOffset = 2;
    let payloadLength = secondByte & 0x7F;
    if (payloadLength > 125) {
        console.log('long');
        if (payloadLength === 126) {
            payloadLength = buffer.readUInt16BE(currentOffset);
            currentOffset += 2;
        } else {
            // If either of these variables are defined, the frame size is huge.
            const leftPart = buffer.readUInt32BE(currentOffset);
            const rightPart = buffer.readUInt32BE(currentOffset += 4);
            // Currently broken, throw error. Shouldn't need a frame this large.
            throw new Error('Large payloads not currently implemented');
        }
    }
    let maskingKey;
    if (isMasked) {
        maskingKey = buffer.readUInt32BE(currentOffset);
        currentOffset += 4;
    }
    // allocate space for data.
    const data = Buffer.alloc(payloadLength);
    // if data was masked we loop through the source buffer one byte at a time performing a XOR comparison.
    if (isMasked) {
        let i, j;
        for (i = 0, j = 0; i < payloadLength; ++i, j = i % 4) {
            // Extract byte mask from masking key.
            const shift = j === 3 ? 0 : (3 - j) << 3;
            const mask = (shift === 0 ? maskingKey : (maskingKey >>> shift)) & 0xFF;
            // Read byte from source buffer
            const source = buffer.readUInt8(currentOffset++);
            // XOR the source byte and write the result to data
            data.writeUInt8(mask ^ source, i);
        }
    } else {
        buffer.copy(data, 0, currentOffset++);
    }
    const jsonData = data.toString('utf8');
    return JSON.parse(jsonData);
}

module.exports = server;