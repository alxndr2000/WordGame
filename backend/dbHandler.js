const { MongoClient } = require("mongodb");
const crypto = require('crypto');
require('dotenv').config()
const wlGen = require('./wordlistGenerator.js');

const uri = `mongodb://${process.env.dbAdminUser}:${process.env.dbAdminPass}@${process.env.dbIP}/${process.env.dbDbName}?authSource=admin`;
console.log(uri);
const client = new MongoClient(uri, {
});

async function connectToDatabase() {
    // Check if the client is already connected
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
    }
    return client.db('gameRoomDB');
}

function generateKey() {
    return crypto.randomBytes(4).toString('hex').toUpperCase(); // Generates a 4-byte random key, similar to "9ABC"
}

async function getRoom(roomCode, playerKey) {
    const db = await connectToDatabase(); // Your database connection function
    const collection = db.collection('rooms'); // Replace with your collection name

    // Find the room based on the roomCode
    const room = await collection.findOne({ code: roomCode });

    if (!room) {
        return { error: "Room not found" };
    }

    // Find the player with the given playerKey
    const player = room.players.find(p => p.key === playerKey);

    if (!player) {
        return { error: "Player not found in room" };
    }

    // Check if the player is the imposter
    const isImposter = player.id === room.roomState.imposterID;

    redactedPlayerInfo = []

    room.players.forEach(player => {
        me = false
        if (playerKey == player.key) {
            me = true
        }
        redactedPlayerInfo.push({
            isYou: me,
            fName: player.fName,
            id: player.id,
            points: player.points,
            voteTarget: player.voteTarget, // voted for bob
            submittedWord: player.submittedWord // just a guess since she's the imposter
        })
    });



    // Return imposter data
    // Return normal player data
    if (!isImposter) {
        return {
            imposter: false,
            players: redactedPlayerInfo,
            roomState: {
                wordList: room.roomState.wordList,
                realWordIndex: room.roomState.realWordIndex,
                votesEnabled: room.roomState.votesEnabled
            }
        };
    }

    // Return imposter data
    return {
        imposter: true,
        players: redactedPlayerInfo,
        roomState: {
            wordList: room.roomState.wordList,
            imposterID: room.roomState.imposterID,
            votesEnabled: room.roomState.votesEnabled
        }
    };

}


async function joinRoom(fName, roomCode, originalPlayerKey) {
    const db = await connectToDatabase();
    const collection = db.collection('rooms'); // Ensure you get the collection reference

    // Find the existing room by roomCode
    const room = await collection.findOne({ code: roomCode });

    // Check if the room exists
    if (!room) {
        throw new Error('Room not found'); // Or handle it in a way that fits your application
    }

    const existingPlayer = room.players.find(player => player.key == originalPlayerKey);
    if (existingPlayer && originalPlayerKey != null) {
        return {
            playerKey: null,
            roomCode: roomCode
        };
    }

    // Generate a new player key
    const playerKey = generateKey();

    // Create a new player object
    const newPlayer = {
        key: playerKey,
        fName: fName,
        id: room.players.length, // Assign an ID based on current players count
        points: 0,
        voteTarget: null,
        submittedWord: null
    };

    // Update the existing room to add the new player
    await collection.updateOne(
        { code: roomCode },
        { $push: { players: newPlayer } } // Use $push to add the new player to the array
    );

    // Return the player's key and the room code
    return {
        playerKey: playerKey,
        roomCode: roomCode
    };
}

async function startGame(roomCode, playerKey) {
    // connect
    const db = await connectToDatabase();
    const roomsCollection = db.collection('rooms');

    const room = await roomsCollection.findOne({ code: roomCode });

    if (!room) {
        return { error: "Room not found" };
    }
    
    const player = room.players.find(p => p.key === playerKey);

    if (player.id) {
        return { error: "Player not found in room" };
    }

    if (player.id!=0) {
        return { error: "Player not admin" };
    }


    // reset player votes
    await roomsCollection.updateOne(
        { code: roomCode },
        { $set: { 'players.$[].voteTarget': null } } // Use $[] to update all array elements
    );


    // set word list
    await roomsCollection.updateOne(
        { code: roomCode },
        { $set: { 'roomState.wordList': wlGen.getRandomWordList() } }
    );
    
    // set word Index
    await roomsCollection.updateOne(
        { code: roomCode },
        { $set: { 'roomState.realWordIndex': Math.floor(Math.random() * 25) } }
    );
    
    // set imposter ID

    const playerList = await room.players
    const randomPlayerIndex = Math.floor(Math.random() * playerList.length);
    const newImposterID = playerList[randomPlayerIndex].id;


    await roomsCollection.updateOne(
        { code: roomCode },
        { $set: { 'roomState.imposterID': newImposterID } }
    );

}

async function enableVoting(roomCode, playerKey) {
    // connect
    const db = await connectToDatabase();
    const roomsCollection = db.collection('rooms');

    const room = await roomsCollection.findOne({ code: roomCode });

    if (!room) {
        return { error: "Room not found" };
    }
    
    const player = room.players.find(p => p.key === playerKey);

    if (player.id) {
        return { error: "Player not found in room" };
    }

    if (player.id!=0) {
        return { error: "Player not admin" };
    }
    // enable voting for the room
    await roomsCollection.updateOne(
        { code: roomCode },
        { $set: { 'roomState.votesEnabled': true } }
    );

}

async function endVoting(roomCode, playerKey) {
    // connect
    const db = await connectToDatabase();
    const roomsCollection = db.collection('rooms');

    const room = await roomsCollection.findOne({ code: roomCode });

    if (!room) {
        return { error: "Room not found" };
    }
    
    const player = room.players.find(p => p.key === playerKey);

    if (player.id) {
        return { error: "Player not found in room" };
    }

    if (player.id!=0) {
        return { error: "Player not admin" };
    }
    // enable voting for the room
    await roomsCollection.updateOne(
        { code: roomCode },
        { $set: { 'roomState.votesEnabled': false } }
    );

}

async function submitPlayerVote(roomCode, playerKey, targetID) {
    // connect to the database

    const db = await connectToDatabase();
    const roomsCollection = db.collection('rooms');

    // find the room by roomCode
    const room = await roomsCollection.findOne({ code: roomCode });

    if (!room) {
        return { error: "Room not found" };
    }
    
    // find the player by playerKey in the room's players array
    const playerIndex = room.players.findIndex(p => p.key === playerKey);

    if (playerIndex === -1) {
        return { error: "Player not found in room" };
    }

    // Update the player's voteTarget
    const update = await roomsCollection.updateOne(
        { code: roomCode, 'players.key': playerKey },
        { $set: { 'players.$.voteTarget': targetID } }
    );

    // Ensure the operation was successful
    if (update.modifiedCount === 0) {
        return { error: "Failed to update vote target" };
    }

    return { success: true };
}

async function createRoom(fName) {
    const db = await connectToDatabase();
    const roomsCollection = db.collection('rooms');

    // Create a new room code
    const roomCode = generateKey(); // Example: "ABCD"

    // Create a new player with the provided fname
    const playerKey = generateKey(); // Generate player key

    const newRoom = {
        code: roomCode,
        players: [
            {
                key: playerKey,
                fName: fName,
                id: 0,
                points: 0,
                voteTarget: null,
                admin: true,
                submittedWord: null
            }
        ],
        roomState: {
            votesEnabled: false,
            imposterID: null,
            wordList: null,
            realWordIndex: null
        }
    };

    // Insert the new room into the collection
    await roomsCollection.insertOne(newRoom);
    // Return the player's key and the room code
    return {
        playerKey: playerKey,
        roomCode: roomCode
    };
}







module.exports = { createRoom, getRoom, joinRoom, startGame, enableVoting, endVoting, submitPlayerVote }