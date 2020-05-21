const server = require('./server');

const PORT = process.env.PORT || 3210;

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});