const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;
const dbHandler = require('./dbHandler.js');
const sanitizer = require('sanitize');

// Use CORS middleware and JSON parsing
app.use(cors());
app.use(express.json());

// Function to sanitize inputs
function sanitizeString(inputString) {
    return inputString; // TODO: Integrate sanitizer.value(inputString, 'string')
}

// Reusable response formatter
function sendResponse(res, success, data, errorMessage = '') {
    if (success) {
        res.json({ success: true, ...data });
    } else {
        res.status(500).json({ success: false, message: errorMessage });
    }
}

// Reusable function to validate required fields
function validateFields(res, requiredFields) {
    for (const field of requiredFields) {
        if (!field.value) {
            res.status(400).json({ success: false, message: `${field.name} is required.` });
            return false;
        }
    }
    return true;
}

// Route to get room data
app.get('/getRoom', async (req, res) => {
    const { roomCode, playerKey } = req.query;

    if (!validateFields(res, [
        { name: 'Room code', value: roomCode },
        { name: 'Player key', value: playerKey }
    ])) return;

    try {
        const roomData = await dbHandler.getRoom(sanitizeString(roomCode), sanitizeString(playerKey));
        sendResponse(res, true, roomData);
    } catch (error) {
        console.error('Error fetching room data: ', error);
        sendResponse(res, false, {}, 'An error occurred while fetching room data.');
    }
});

// Route to submit a vote
app.post('/submitVote', async (req, res) => {
    const { roomCode, playerKey, pid } = req.body;

    if (!validateFields(res, [
        { name: 'Room code', value: roomCode },
        { name: 'Player key', value: playerKey }
    ])) return;

    try {
        const voteResult = await dbHandler.submitPlayerVote(sanitizeString(roomCode), sanitizeString(playerKey), pid);
        sendResponse(res, true, voteResult);
    } catch (error) {
        console.error('Error submitting vote: ', error);
        sendResponse(res, false, {}, 'An error occurred while submitting the vote.');
    }
});

// Route to create a room
app.post('/createRoom', async (req, res) => {
    const { fName } = req.body;

    try {
        const result = await dbHandler.createRoom(sanitizeString(fName));
        sendResponse(res, true, { playerKey: result.playerKey, roomCode: result.roomCode });
    } catch (error) {
        sendResponse(res, false, {}, error.message);
    }
});

// Route to start the game
app.post('/startGame', async (req, res) => {
    const { roomCode, playerKey } = req.body;

    try {
        await dbHandler.startGame(sanitizeString(roomCode), sanitizeString(playerKey));
        sendResponse(res, true, { message: 'Game started' });
    } catch (error) {
        sendResponse(res, false, {}, error.message);
    }
});

// Route to enable voting
app.post('/enableVoting', async (req, res) => {
    const { roomCode, playerKey } = req.body;

    try {
        await dbHandler.enableVoting(sanitizeString(roomCode), sanitizeString(playerKey));
        sendResponse(res, true, { message: 'Voting enabled' });
    } catch (error) {
        sendResponse(res, false, {}, error.message);
    }
});

// Route to disable voting
app.post('/endVoting', async (req, res) => {
    const { roomCode, playerKey } = req.body;

    try {
        await dbHandler.endVoting(sanitizeString(roomCode), sanitizeString(playerKey));
        sendResponse(res, true, { message: 'Voting disabled' });
    } catch (error) {
        sendResponse(res, false, {}, error.message);
    }
});

// Route to join a room
app.post('/joinRoom', async (req, res) => {
    const { fName, roomCode, originalPlayerKey } = req.body;

    try {
        const result = await dbHandler.joinRoom(sanitizeString(fName), sanitizeString(roomCode), sanitizeString(originalPlayerKey));
        if (result.playerKey === null) {
            sendResponse(res, true, { rejoin: true });
        } else {
            sendResponse(res, true, { rejoin: false, playerKey: result.playerKey, roomCode: result.roomCode });
        }
    } catch (error) {
        sendResponse(res, false, {}, error.message);
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
