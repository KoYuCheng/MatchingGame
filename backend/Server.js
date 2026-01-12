import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // 務必確認這與 Vue 執行的網址一致
        methods: ["GET", "POST"]
    }
});

// 細化的量詞數據
/*const gameData = [
    { id: 1, quantifier: "一個", noun: "小孩", img: "/shinchun.webp" },
    { id: 2, quantifier: "一棵", noun: "樹", img: "/tree.png" },
    { id: 3, quantifier: "兩張", noun: "床", img: "https://example.com/bed.png" },
    { id: 4, quantifier: "兩條", noun: "褲子", img: "https://example.com/pants.png" },
    { id: 5, quantifier: "兩本", noun: "書", img: "https://example.com/book.png" }
];*/

let gameState = {
    players: [],
    table: { quantifierCard: null, nounCard: null }
};

let rooms = {}; //新增房間概念

io.on('connection', (socket) => {
    console.log('新玩家連線:', socket.id);

    socket.on('join_with_role', ({ requestedRole, roomID }) => {

        if (!roomID) return; // 沒給房間號碼不予處理

        socket.join(roomID); // Socket.io 的內建房間功能
        socket.roomID = roomID; // 把房間 ID 綁在 socket 物件上方便後續使用

        // 如果房間還不存在，初始化它
        if (!rooms[roomID]) {
            rooms[roomID] = {
                players: [],
                table: { quantifierCard: null, nounCard: null }
            };
        }

        const currentRoom = rooms[roomID];
        let finalRole = requestedRole;

        // 自動分配邏輯 (同前，但限定在房間內)
        if (!finalRole) {
            const hasTeacher = currentRoom.players.some(p => p.role === 'A');
            finalRole = hasTeacher ? 'B' : 'A';
        }

        currentRoom.players.push({ id: socket.id, role: finalRole });
        socket.emit('assigned_role', finalRole);
        console.log(`房間 [${roomID}] 玩家 ${socket.id} 身份: ${finalRole}`);
    });

    socket.on('teacher_start', ({ customData, displayMode }) => {
        const roomID = socket.roomID;
        const currentRoom = rooms[roomID];
        if (!currentRoom) return;

        // 保存當前房間的顯示模式
        currentRoom.displayMode = displayMode;

        const dataToUse = customData || [];
        const shuffled = [...dataToUse].sort(() => Math.random() - 0.5);

        currentRoom.players.forEach((player) => {
            let handData = [];
            if (player.role === 'A') {
                handData = shuffled.map(item => ({ id: item.id, text: item.quantifier }));
            } else {
                // 學生端：根據老師選的模式決定發送的內容
                handData = shuffled.map(item => ({
                    id: item.id,
                    img: item.img,
                    noun: item.noun,
                    displayMode: displayMode // 告訴前端要顯示什麼
                }));
            }
            io.to(player.id).emit('init_game', { role: player.role, hand: handData });
        });
    });
    /*
        socket.on('teacher_start', (customData) => {
            const roomID = socket.roomID; // 獲取當前 socket 所屬房間
            const currentRoom = rooms[roomID];
    
            if (!currentRoom) {
                console.log(`[${roomID}] 找不到房間，無法開始`);
                return;
            }
    
            console.log(`房間 [${roomID}] 遊戲開始，發放卡牌...`);
    
            // 取得教材資料（優先使用老師傳來的，若無則用預設）
            const dataToUse = customData && customData.length > 0 ? customData : [
                { id: 1, quantifier: "一個", noun: "小孩", img: "/shinchun.webp" },
                { id: 2, quantifier: "一棵", noun: "樹", img: "/tree.png" },
                { id: 3, quantifier: "兩張", noun: "床", img: "/tree2.png" }
            ];
    
            // 洗牌
            const shuffled = [...dataToUse].sort(() => Math.random() - 0.5);
    
            // 遍歷該房間的所有玩家，個別發送手牌
            currentRoom.players.forEach((player) => {
                let handData = [];
                if (player.role === 'A') {
                    // 老師拿到量詞文字
                    handData = shuffled.map(item => ({ id: item.id, text: item.quantifier }));
                } else {
                    // 學生拿到圖片與名詞
                    handData = shuffled.map(item => ({ id: item.id, img: item.img, noun: item.noun }));
                }
    
                // 關鍵：使用 io.to(player.id) 確保只有該玩家收到自己的手牌
                io.to(player.id).emit('init_game', {
                    role: player.role,
                    hand: handData
                });
            });
        });*/

    // 所有的遊戲行為都要改為 .to(roomID) 廣播
    socket.on('play_card', (data) => {
        const roomID = socket.roomID;
        const currentRoom = rooms[roomID];
        if (!currentRoom) return;

        if (data.role === 'A') currentRoom.table.quantifierCard = data.card;
        else if (data.role === 'B') currentRoom.table.nounCard = data.card;

        // 只廣播給同一個房間的人
        io.to(roomID).emit('update_table', currentRoom.table);

        if (currentRoom.table.quantifierCard && currentRoom.table.nounCard) {
            if (currentRoom.table.quantifierCard.id === currentRoom.table.nounCard.id) {
                io.to(roomID).emit('match_success');
            } else {
                io.to(roomID).emit('match_fail');
            }
        }
    });

    socket.on('request_clear_table', () => {
        const roomID = socket.roomID;
        if (rooms[roomID]) {
            rooms[roomID].table = { quantifierCard: null, nounCard: null };
            io.to(roomID).emit('update_table', rooms[roomID].table);
        }
    });

    socket.on('request_restart_game', () => {
        const roomID = socket.roomID;
        const currentRoom = rooms[roomID];

        if (currentRoom) {
            // 1. 重置房間的桌面狀態
            currentRoom.table = { quantifierCard: null, nounCard: null };

            // 2. 向房間內所有人廣播「遊戲重置」指令
            io.to(roomID).emit('force_restart');

            console.log(`房間 [${roomID}] 已由老師重置遊戲`);
        }
    });

    socket.on('disconnect', () => {
        const roomID = socket.roomID;
        if (rooms[roomID]) {
            rooms[roomID].players = rooms[roomID].players.filter(p => p.id !== socket.id);
            // 如果房間沒人了，可以刪除節省記憶體
            if (rooms[roomID].players.length === 0) delete rooms[roomID];
        }
    });
});

server.listen(3000, () => {
    console.log('後端伺服器運行在 http://localhost:3000 (ES Module Mode)');
});