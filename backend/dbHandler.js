const { MongoClient } = require("mongodb");
const crypto = require('crypto');
require('dotenv').config()


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


    // Return normal player data
    if (!isImposter) {
        return {
            imposter: false,
            players: redactedPlayerInfo,
            roomState: {
                wordList: room.roomState.wordList,
                realWordIndex: room.roomState.realWordIndex
            }
        };
    }
    // Return imposter data
    return {
        imposter: true,
        players: redactedPlayerInfo,
        roomState: {
            wordList: room.roomState.wordList,
            imposterID: room.roomState.imposterID
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
    // set word list
    await roomsCollection.updateOne(
        { code: roomCode },
        { $set: { 'roomState.wordList': generateWordList() } }
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

function generateWordList() { //fuck you all animals
    return {
        listTitle: "Animals",
        list: [
            "Lion",
            "Tiger",
            "Elephant",
            "Giraffe",
            "Zebra",
            "Penguin",
            "Kangaroo",
            "Panda",
            "Koala",
            "Dolphin",
            "Whale",
            "Shark",
            "Eagle",
            "Owl",
            "Rabbit",
            "Deer",
            "Horse",
            "Wolf",
            "Fox",
            "Bear",
            "Cheetah",
            "Leopard",
            "Turtle",
            "Frog",
            "Crocodile"
        ]
    }
}

roomsJsonData = { // fake data for building the UI out
    rooms: [

        {
            code: "TEST",
            players: [
                {
                    key: "1234",
                    fName: "Alice",
                    id: 0,
                    points: 0,
                    voteTarget: 1, // voted for bob
                    submittedWord: "Smelly" // just a guess since she's the imposter
                },
                {
                    key: "5678",
                    fName: "Bob",
                    id: 1,
                    points: 0,
                    voteTarget: 1,
                    submittedWord: "Long"
                },
                {
                    key: "9ABC",
                    fName: "Carl",
                    id: 2,
                    points: 0,
                    voteTarget: 0, // voted for alice
                    submittedWord: "Africa"
                }
            ],
            roomState: {
                imposterID: 0, // Alice
                wordList: { // Copied in from other DB in real ver
                    listTitle: "Animals",
                    list: [
                        "Lion",
                        "Tiger",
                        "Elephant",
                        "Giraffe",
                        "Zebra",
                        "Penguin",
                        "Kangaroo",
                        "Panda",
                        "Koala",
                        "Dolphin",
                        "Whale",
                        "Shark",
                        "Eagle",
                        "Owl",
                        "Rabbit",
                        "Deer",
                        "Horse",
                        "Wolf",
                        "Fox",
                        "Bear",
                        "Cheetah",
                        "Leopard",
                        "Turtle",
                        "Frog",
                        "Crocodile"
                    ]
                },
                realWordIndex: 2, // Elephant
            }
        }
    ]
}


function getRoomData(roomCode, playerKey) {
    // Find the room with the given roomCode
    const room = roomsJsonData.rooms.find(room => room.code === roomCode);

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
            voteTarget: player.voteTarget,
            submittedWord: player.submittedWord
        })
    });


    // Return normal player data
    if (!isImposter) {
        return {
            imposter: false,
            players: redactedPlayerInfo,
            roomState: {
                wordList: room.roomState.wordList,
                realWordIndex: room.roomState.realWordIndex
            }
        };
    }

    // Return imposter data
    return {
        imposter: true,
        players: redactedPlayerInfo,
        roomState: {
            wordList: room.roomState.wordList,
            imposterID: room.roomState.imposterID
        }
    };
}




module.exports = { getRoomData, createRoom, getRoom, joinRoom, startGame}