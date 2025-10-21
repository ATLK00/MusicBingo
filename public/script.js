const socket = io();
let myId, currentRoom, hostId, usedWords = [], playerName;

socket.on("connect", () => (myId = socket.id));

document.getElementById("createRoom").onclick = () => {
  const name = document.getElementById("playerName").value.trim();
  const room = document.getElementById("roomId").value.trim();
  if (!name || !room) return alert("กรุณากรอกชื่อและรหัสห้อง");
  socket.emit("createRoom", { roomId: room, name });
};

document.getElementById("joinRoom").onclick = () => {
  const name = document.getElementById("playerName").value.trim();
  const room = document.getElementById("roomId").value.trim();
  if (!name || !room) return alert("กรุณากรอกชื่อและรหัสห้อง");
  socket.emit("joinRoom", { roomId: room, name });
};

socket.on("roomCreated", (room) => {
  currentRoom = room;
  hostId = myId;
  startGame(true);
});

socket.on("joinedRoom", ({ roomId, host, usedWords: used }) => {
  currentRoom = roomId;
  hostId = host;
  usedWords = used;
  startGame(false);
});

socket.on("wordRandomed", (word) => {
  usedWords.push(word);
  document.getElementById("randomWord").innerText = `📣 ${word}`;
  highlightUsed();
});

socket.on("playerBingo", (name) => {
  document.getElementById("status").innerText = `🎉 ${name} ได้บิงโกแล้ว!`;
});

function startGame(isHost) {
  document.getElementById("login").style.display = "none";
  document.getElementById("gameArea").style.display = "block";
  document.getElementById("hostInfo").innerText = isHost
    ? "👑 คุณคือผู้สร้างห้อง"
    : "🧑‍🤝‍🧑 ผู้เล่นทั่วไป";
  document.getElementById("randomBtn").style.display = isHost ? "inline" : "none";
  renderBoard();
}

document.getElementById("randomBtn").onclick = () => {
  socket.emit("randomWord", currentRoom);
};

document.getElementById("bingoBtn").onclick = () => {
  socket.emit("bingo", currentRoom);
};

function renderBoard() {
  const board = document.getElementById("board");
  board.innerHTML = "";
  const words = [
    "กลอง", "กีตาร์", "ไวโอลิน", "เปียโน",
    "ขลุ่ย", "ทรัมเป็ต", "ฮาร์ป", "คีย์บอร์ด",
    "แซ็กโซโฟน", "ฉิ่ง", "ฉาบ", "ระนาด",
    "อูคูเลเล่", "คาฮอง", "เบส", "แทมบูรีน"
  ].sort(() => Math.random() - 0.5);

  words.forEach(word => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.innerText = word;
    cell.onclick = () => {
      if (!usedWords.includes(word)) return;
      cell.classList.toggle("selected");
    };
    board.appendChild(cell);
  });
}
