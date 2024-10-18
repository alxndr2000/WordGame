const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;
const dbHandler = require('./dbHandler.js');
const sanitizer = require('sanitize');
// Use CORS middleware
app.use(cors());
app.use(express.json());

// Sample route returning JSON
// app.get('/test', (req, res) => {
//     res.json(dbHandler.getRoomData("TEST", "9ABC"));
// });

function sanitizeString(inputString) {
    sanitizer.value(inputString, 'string')
    
}

app.get('/getRoom', async (req, res) => {
    // Extract roomCode and playerKey from query parameters
    const { roomCode, playerKey } = req.query;

    if (!roomCode || !playerKey) {
        return res.status(400).json({ success: false, message: 'Room code and player key are required.' });
    }
    try {
        // Example: Fetch the room data from the database using roomCode
        const roomData = await dbHandler.getRoom(sanitizeString(roomCode), sanitizeString(playerKey));
        
        // Here, you can add logic to validate the playerKey if necessary

        // Return the room data
        res.json({ success: true, ...roomData });
    } catch (error) {
        console.error('Error fetching room data: ', error);
        res.status(500).json({ success: false, message: 'An error occurred while fetching room data.' });
    }
});

app.post('/createRoom', async (req, res) => {
    const { fName } = req.body;
    
    try {
        // Use await to get the resolved value of the promise returned by createRoom
        const result = await dbHandler.createRoom(sanitizeString(fName));

        // Now you can access result.playerKey and result.roomCode
        res.json({
            success: true,
            playerKey: result.playerKey,
            roomCode: result.roomCode
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.post('/startGame', async (req, res) => {
    const { roomCode, playerKey } = req.body;
    try {

        const result = await dbHandler.startGame(sanitizeString(roomCode), sanitizeString(playerKey));

        
        res.json({
            success: true,
            message: "Game Started"
        });
    } catch (error) {
        console.log(error)
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.post('/joinRoom', async (req, res) => {
    const { fName, roomCode, originalPlayerKey } = req.body; // Extract fName and roomCode from request body

    try {
        // Call the joinRoom function and await its result
        const result = await dbHandler.joinRoom(sanitizeString(fName), sanitizeString(roomCode), sanitizeString(originalPlayerKey));

        // Return success response with playerKey and roomCode
        if (result.playerKey == null) {
            res.json({
                success: true,
                rejoin: true,
            });
            return
        }
        res.json({
            success: true,
            rejoin: false,
            playerKey: result.playerKey,
            roomCode: result.roomCode
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});