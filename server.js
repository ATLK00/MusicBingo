import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {}; // เก็บข้อมูลห้องและ host

io.on("connection", (socket) => {
  console.log("✅ Connected:", socket.id);

  socket.on("createRoom", ({ roomId, name }) => {
    rooms[roomId] = { host: socket.id, players: {}, usedWords: [] };
    rooms[roomId].players[socket.id] = name;
    socket.join(roomId);
    socket.emit("roomCreated", roomId);
    console.log(`${name} created room ${roomId}`);
  });

  socket.on("joinRoom", ({ roomId, name }) => {
    if (rooms[roomId]) {
      rooms[roomId].players[socket.id] = name;
      socket.join(roomId);
      socket.emit("joinedRoom", {
        roomId,
        host: rooms[roomId].host,
        usedWords: rooms[roomId].usedWords,
      });
      io.to(roomId).emit("playerList", Object.values(rooms[roomId].players));
    } else {
      socket.emit("errorMsg", "❌ ห้องนี้ไม่มีอยู่");
    }
  });

  socket.on("randomWord", (roomId) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;

    const allWords = [
      "กลอง", "กีตาร์", "ไวโอลิน", "เปียโน",
      "ขลุ่ย", "ทรัมเป็ต", "ฮาร์ป", "คีย์บอร์ด",
      "แซ็กโซโฟน", "ฉิ่ง", "ฉาบ", "ระนาด",
      "อูคูเลเล่", "คาฮอง", "เบส", "แทมบูรีน"
    ];

    let available = allWords.filter(w => !room.usedWords.includes(w));
    if (available.length === 0) return io.to(roomId).emit("allUsed");

    const word = available[Math.floor(Math.random() * available.length)];
    room.usedWords.push(word);

    io.to(roomId).emit("wordRandomed", word);
  });

  socket.on("bingo", (roomId) => {
    const playerName = rooms[roomId]?.players[socket.id];
    if (playerName) io.to(roomId).emit("playerBingo", playerName);
  });

  socket.on("disconnect", () => {
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.players[socket.id]) delete room.players[socket.id];
      if (Object.keys(room.players).length === 0) delete rooms[roomId];
    }
  });
});

server.listen(3000, () => console.log("🚀 Server running on port 3000"));