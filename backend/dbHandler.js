const { MongoClient } = require("mongodb");
const crypto = require('crypto');
require('dotenv').config();
const wlGen = require('./wordlistGenerator.js');

// Create a reusable MongoDB URI connection
const uri = `mongodb://${process.env.dbAdminUser}:${process.env.dbAdminPass}@${process.env.dbIP}/${process.env.dbDbName}?authSource=admin`;
console.log(uri);
const client = new MongoClient(uri);

// Connect to the database (reused across functions)
async function connectToDatabase() {
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
    }
    return client.db('gameRoomDB');
}

// Generate a 4-byte random key
function generateKey() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Reusable function to fetch a room from the database
async function fetchRoom(roomCode) {
    const db = await connectToDatabase();
    const collection = db.collection('rooms');
    return await collection.findOne({ code: roomCode });
}

// Reusable function to validate player
function validatePlayer(room, playerKey) {
    const player = room.players.find(p => p.key === playerKey);
    if (!player) return { error: "Player not found in room" };
    return player;
}

// Fetch room data and return redacted info
async function getRoom(roomCode, playerKey) {
    const room = await fetchRoom(roomCode);
    if (!room) return { error: "Room not found" };

    const player = validatePlayer(room, playerKey);
    if (player.error) return player;

    const isImposter = player.id === room.roomState.imposterID;
    const redactedPlayerInfo = room.players.map(p => ({
        isYou: p.key === playerKey,
        fName: p.fName,
        id: p.id,
        points: p.points,
        voteTarget: p.voteTarget,
        submittedWord: p.submittedWord
    }));

    return {
        imposter: isImposter,
        players: redactedPlayerInfo,
        roomState: isImposter
            ? { wordList: room.roomState.wordList, imposterID: room.roomState.imposterID, votesEnabled: room.roomState.votesEnabled }
            : { wordList: room.roomState.wordList, realWordIndex: room.roomState.realWordIndex, votesEnabled: room.roomState.votesEnabled }
    };
}

// Add a new player to the room
async function joinRoom(fName, roomCode, originalPlayerKey) {
    const room = await fetchRoom(roomCode);
    if (!room) throw new Error('Room not found');

    const existingPlayer = room.players.find(p => p.key === originalPlayerKey);
    if (existingPlayer && originalPlayerKey) return { playerKey: null, roomCode };

    const playerKey = generateKey();
    const newPlayer = {
        key: playerKey,
        fName,
        id: room.players.length,
        points: 0,
        voteTarget: null,
        submittedWord: null
    };

    const db = await connectToDatabase();
    const collection = db.collection('rooms');
    await collection.updateOne({ code: roomCode }, { $push: { players: newPlayer } });

    return { playerKey, roomCode };
}

// Start a game and set up room state
async function startGame(roomCode, playerKey) {
    const room = await fetchRoom(roomCode);
    if (!room) return { error: "Room not found" };

    const player = validatePlayer(room, playerKey);
    if (player.error) return player;
    if (player.id !== 0) return { error: "Player not admin" };

    const db = await connectToDatabase();
    const collection = db.collection('rooms');

    await collection.updateOne({ code: roomCode }, { $set: { 'players.$[].voteTarget': null } });
    await collection.updateOne({ code: roomCode }, { $set: { 'roomState.wordList': wlGen.getRandomWordList() } });
    await collection.updateOne({ code: roomCode }, { $set: { 'roomState.realWordIndex': Math.floor(Math.random() * 25) } });

    const randomPlayerIndex = Math.floor(Math.random() * room.players.length);
    const newImposterID = room.players[randomPlayerIndex].id;
    await collection.updateOne({ code: roomCode }, { $set: { 'roomState.imposterID': newImposterID } });
}

// Enable or disable voting
async function setVoting(roomCode, playerKey, enable) {
    const room = await fetchRoom(roomCode);
    if (!room) return { error: "Room not found" };

    const player = validatePlayer(room, playerKey);
    if (player.error) return player;
    if (player.id !== 0) return { error: "Player not admin" };

    const db = await connectToDatabase();
    const collection = db.collection('rooms');
    await collection.updateOne({ code: roomCode }, { $set: { 'roomState.votesEnabled': enable } });
}

// Alias functions for enabling and disabling voting
async function enableVoting(roomCode, playerKey) {
    return setVoting(roomCode, playerKey, true);
}

async function endVoting(roomCode, playerKey) {
    return setVoting(roomCode, playerKey, false);
}

// Submit a player's vote
async function submitPlayerVote(roomCode, playerKey, targetID) {
    const room = await fetchRoom(roomCode);
    if (!room) return { error: "Room not found" };

    const player = validatePlayer(room, playerKey);
    if (player.error) return player;

    const db = await connectToDatabase();
    const collection = db.collection('rooms');
    const update = await collection.updateOne({ code: roomCode, 'players.key': playerKey }, { $set: { 'players.$.voteTarget': targetID } });

    if (update.modifiedCount === 0) return { error: "Failed to update vote target" };
    return { success: true };
}

// Create a new room
async function createRoom(fName) {
    const playerKey = generateKey();
    const roomCode = generateKey();

    const newRoom = {
        code: roomCode,
        players: [{ key: playerKey, fName, id: 0, points: 0, voteTarget: null, admin: true, submittedWord: null }],
        roomState: { votesEnabled: false, imposterID: null, wordList: null, realWordIndex: null }
    };

    const db = await connectToDatabase();
    const collection = db.collection('rooms');
    await collection.insertOne(newRoom);

    return { playerKey, roomCode };
}

module.exports = { createRoom, getRoom, joinRoom, startGame, enableVoting, endVoting, submitPlayerVote };
