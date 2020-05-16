// Establish a websocket connection to the server and an array of subprotocols.
const ws = new WebSocket('ws://localhost:3210', ['json', 'xml']);
// Add an event listener that will be triggered when the WebSocket is ready to use. 
ws.addEventListener('open', () => {
    const data = { message: 'Hello from the client!' }
    const json = JSON.stringify(data);
    // Send the JSON data to the WebSocket server.
    ws.send(json);
});
// Add a listener in order to process messages received from the server.
ws.addEventListener('message', event => {
    // The 'event' object is a typical DOM event object, and the message dat sent by the server is stored in the 'data' property.
    const data = JSON.parse(event.data);
    console.log(data);
});