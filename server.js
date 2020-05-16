const http = require('http');
const static = require('node-static');
const file = new static.Server('./');
const server = http.createServer((req, res) => {
    req.addListener('end', () => file.serve(req, res)).resume();
});

const PORT = process.env.PORT || 3210;

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});