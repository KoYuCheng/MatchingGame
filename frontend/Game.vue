<template>
    <div class="game-container">
        <el-card class="main-card">
            <template #header>
                <div class="header-content">
                    <h1 class="title">量詞配對大戰</h1>
                    <el-tag :type="role === 'A' ? 'danger' : 'success'" effect="dark">
                        {{ role === 'A' ? '老師 (出題者)' : '學生 (應答者)' }}
                    </el-tag>
                </div>
            </template>

            <div v-if="!gameStarted" class="lobby-section">
                <div v-if="!isEditing" class="welcome-view">
                    <div v-if="isHost" class="host-actions">
                        <div style="margin-bottom: 20px;">
                            <span style="margin-right: 10px; font-weight: bold;">學生端顯示：</span>
                            <el-switch v-model="studentDisplayMode" inline-prompt active-text="顯示圖片" inactive-text="顯示名詞文字"
                                active-value="image" inactive-value="text"
                                style="--el-switch-on-color: #13ce66; --el-switch-off-color: #409eff" />
                        </div>
                        <el-button type="primary" size="large" @click="isEditing = true" icon="Edit">編輯教材內容</el-button>
                        <el-button type="success" size="large" @click="requestStart" icon="CaretRight">開始遊戲</el-button>
                    </div>
                    <el-empty v-else description="等待老師調整教材中..." />
                </div>

                <div v-else class="editor-view">
                    <div class="editor-header">
                        <h3>教材清單編輯</h3>
                        <div>
                            <el-link href="https://www.flaticon.com/" type="primary" target="_blank"
                                style="margin-right: 15px;">素材庫</el-link>
                            <el-button type="success" size="small" @click="helpDialogVisible = true">常用教材參考</el-button>
                        </div>
                    </div>

                    <el-table :data="localGameData" style="width: 100%" border stripe>
                        <el-table-column label="序號" width="60" align="center">
                            <template #default="scope">{{ scope.$index + 1 }}</template>
                        </el-table-column>
                        <el-table-column label="量詞 (文字)">
                            <template #default="scope">
                                <el-input v-model="scope.row.quantifier" placeholder="如: 一個" />
                            </template>
                        </el-table-column>
                        <el-table-column label="名詞 (文字提示)">
                            <template #default="scope">
                                <el-input v-model="scope.row.noun" placeholder="如: 小孩" />
                            </template>
                        </el-table-column>
                        <el-table-column label="圖片網址 / 預覽">
                            <template #default="scope">
                                <div class="image-edit-cell">
                                    <el-input v-model="scope.row.img" placeholder="請輸入圖片連結 (URL)" clearable>
                                        <template #prefix>
                                            <el-icon>
                                                <Picture />
                                            </el-icon>
                                        </template>
                                    </el-input>

                                    <div class="mini-preview">
                                        <el-image v-if="scope.row.img" :src="scope.row.img" fit="cover" class="preview-img">
                                            <template #error>
                                                <div class="image-slot-error">無效</div>
                                            </template>
                                        </el-image>
                                        <div v-else class="image-slot-empty">無</div>
                                    </div>
                                </div>
                            </template>
                        </el-table-column>
                        <el-table-column label="操作" width="80" align="center">
                            <template #default="scope">
                                <el-button type="danger" icon="Delete" circle size="small"
                                    :disabled="localGameData.length <= 5" @click="removeRow(scope.$index)" />
                            </template>
                        </el-table-column>
                        <!--<el-table-column label="圖片選擇">
                            <template #default="scope">
                                <el-select v-model="scope.row.img" placeholder="選擇圖片" style="width: 100%">
                                    <el-option v-for="opt in imageOptions" :key="opt" :label="opt" :value="opt">
                                        <div class="select-option">
                                            <img :src="opt" style="width: 20px; height: 20px; margin-right: 10px" />
                                            <span>{{ opt }}</span>
                                        </div>
                                    </el-option>
                                </el-select>
                            </template>
                        </el-table-column>-->
                    </el-table>

                    <div class="add-row-container" style="margin-top: 15px;">
                        <el-button type="info" plain icon="Plus" @click="addRow" style="width: 100%; border-style: dashed;">
                            新增題目 (目前共 {{ localGameData.length }} 題)
                        </el-button>
                    </div>

                    <div class="editor-footer">
                        <el-button type="primary" @click="isEditing = false">完成編輯</el-button>
                    </div>

                    <el-dialog v-model="helpDialogVisible" title="常用教材圖片清單" width="500px">
                        <el-table :data="presetMaterials" style="width: 100%">
                            <el-table-column prop="word" label="名詞" width="100" />
                            <el-table-column label="圖片網址">
                                <template #default="scope">
                                    <el-input v-model="scope.row.url" size="small" readonly>
                                        <template #append>
                                            <el-button @click="copyUrl(scope.row.url)">複製</el-button>
                                        </template>
                                    </el-input>
                                </template>
                            </el-table-column>
                        </el-table>
                    </el-dialog>
                </div>
            </div>

            <div v-else class="game-board">
                <div v-if="isHost" class="admin-controls" style="text-align: right; margin-bottom: 10px;">
                    <el-button type="warning" size="small" @click="handleRestart" icon="RefreshLeft">
                        重新開始
                    </el-button>
                </div>

                <div class="drop-zone">
                    <div class="slot">
                        <p class="slot-label">量詞牌</p>
                        <transition name="el-zoom-in-center">
                            <div v-if="table.quantifierCard" class="game-card quantifier">
                                {{ table.quantifierCard.text }}
                            </div>
                            <div v-else class="card-placeholder">請出牌</div>
                        </transition>
                    </div>

                    <div class="slot">
                        <p class="slot-label">名詞牌</p>
                        <transition name="el-zoom-in-center">
                            <div v-if="table.nounCard" class="game-card noun">
                                <el-image v-if="table.nounCard.displayMode === 'image'" :src="table.nounCard.img"
                                    fit="contain" />
                                <span v-else class="noun-text">{{ table.nounCard.noun }}</span>
                            </div>
                            <div v-else class="card-placeholder">等待學生...</div>
                        </transition>
                    </div>
                </div>

                <el-divider>你的手牌</el-divider>

                <div class="hand-section">
                    <div class="cards-container">
                        <el-card v-for="card in myHand" :key="card.id" class="hand-card selectable" shadow="hover"
                            @click="playCard(card)">
                            <template v-if="role === 'A'">{{ card.text }}</template>
                            <el-image v-if="card.displayMode === 'image'" :src="card.img" fit="contain" />
                            <span v-else class="noun-text">{{ card.noun }}</span>
                        </el-card>
                    </div>
                </div>
            </div>
        </el-card>
    </div>
</template>
  
<script setup>
import { ref, onMounted, computed } from 'vue';
import { io } from 'socket.io-client';
import { ElMessageBox, ElMessage } from 'element-plus';

//const socket = io(import.meta.env.VITE_API_URL);
const socket = io(import.meta.env.VITE_API_URL, {
    transports: ['websocket', 'polling'] // 優先使用 websocket
});
const gameStarted = ref(false);
const isEditing = ref(false);
const role = ref('');
const myHand = ref([]);
const table = ref({ quantifierCard: null, nounCard: null });
const studentDisplayMode = ref('image'); // 預設顯示圖片

const localGameData = ref([
    { id: 1, quantifier: "一個", noun: "小孩", img: "/shinchun.webp" },
    { id: 2, quantifier: "兩隻", noun: "貓", img: "https://cdn-icons-png.flaticon.com/128/1998/1998592.png" },
    { id: 3, quantifier: "三張", noun: "桌子", img: "https://cdn-icons-png.flaticon.com/128/15974/15974047.png" },
    { id: 4, quantifier: "四朵", noun: "花", img: "https://cdn-icons-png.flaticon.com/128/346/346167.png" },
    { id: 5, quantifier: "五本", noun: "書", img: "https://cdn-icons-png.flaticon.com/512/2232/2232688.png" }
]);

const imageOptions = ref(['/shinchun.webp', '/tree.png', '/tree2.png', 'light.jpg', 'https://cdn-icons-png.flaticon.com/512/2122/2122458.png', 'https://cdn-icons-png.flaticon.com/512/2232/2232688.png']);

const isHost = computed(() => role.value === 'A');

const getParamsFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return {
        role: params.get('role'),
        room: params.get('room') || 'default-room' // 如果沒給就進預設房
    };
};

const helpDialogVisible = ref(false)
// 準備好的常用名詞與圖片網址
const presetMaterials = ref([
    { word: '蘋果', url: 'https://cdn-icons-png.flaticon.com/512/415/415733.png' },
    { word: '香蕉', url: 'https://cdn-icons-png.flaticon.com/512/2909/2909761.png' },
    { word: '芒果', url: 'https://cdn-icons-png.flaticon.com/128/13523/13523334.png' },
    { word: '蛋糕', url: 'https://cdn-icons-png.flaticon.com/128/9997/9997743.png' },
    { word: 'Pizza', url: 'https://cdn-icons-png.flaticon.com/128/6978/6978255.png' },
    { word: '大象', url: 'https://cdn-icons-png.flaticon.com/128/7743/7743300.png' },
    { word: '貓', url: 'https://cdn-icons-png.flaticon.com/128/1998/1998592.png' },
    { word: '狗', url: 'https://cdn-icons-png.flaticon.com/128/1998/1998627.png' },
    { word: '桌子', url: 'https://cdn-icons-png.flaticon.com/128/15974/15974047.png' },
    { word: '花', url: 'https://cdn-icons-png.flaticon.com/128/346/346167.png' },
    { word: '紙', url: 'https://cdn-icons-png.flaticon.com/128/2541/2541984.png' },
    { word: '卡片', url: 'https://cdn-icons-png.flaticon.com/128/9334/9334539.png' },
    { word: '書', url: 'https://cdn-icons-png.flaticon.com/512/2232/2232688.png' },
    { word: '筆', url: 'https://cdn-icons-png.flaticon.com/128/1250/1250925.png' },
    { word: '車', url: 'https://cdn-icons-png.flaticon.com/128/3097/3097180.png' },
    { word: '衣服', url: 'https://cdn-icons-png.flaticon.com/128/3746/3746120.png' },
    { word: '裙子', url: 'https://cdn-icons-png.flaticon.com/128/1774/1774825.png' },
    { word: '帽子', url: 'https://cdn-icons-png.flaticon.com/128/1974/1974214.png' },
    { word: '襪子', url: 'https://cdn-icons-png.flaticon.com/128/843/843877.png' },

    // 繼續增加...
])

// 複製網址到剪貼簿的功能
const copyUrl = (url) => {
    navigator.clipboard.writeText(url).then(() => {
        ElMessage({
            message: '網址已複製！',
            type: 'success',
        })
    })
}

onMounted(async () => {

    //const myRequestedRole = getRoleFromUrl();
    const { role: roleParam, room: roomID } = getParamsFromUrl();




    let requestedRole = (roleParam || '').toUpperCase();
    if (requestedRole !== 'A' && requestedRole !== 'B') requestedRole = null;

    let userName = '';
    try {
        if (requestedRole === 'B') {
            const { value: name } = await ElMessageBox.prompt('請輸入名字', '歡迎加入遊戲', {
                confirmButtonText: '進入遊戲',
                cancelButtonText: '匿名進入',
                inputPlaceholder: '例如：王小明',
                inputPattern: /\S+/,
                inputErrorMessage: '名字不能為空'
            });
            userName = name || "匿名玩家";
        } else if (requestedRole === 'A') {
            userName = '老師';
        } else {
            userName = '訪客';
        }
    } catch {
        userName = "匿名玩家";
    }


    const upperRole = roleParam ? roleParam.toUpperCase() : null;

    if (upperRole === 'A') {
        requestedRole = 'A';
    } else if (upperRole === 'B') {
        requestedRole = 'B';
    }

    socket.emit('join_with_role', { requestedRole, roomID, userName });

    socket.on('assigned_role', (assignedRole) => {
        role.value = assignedRole;
        console.log(`成功加入房間，身份為: ${assignedRole === 'A' ? '老師' : '學生'}`);
    });

    socket.on('init_game', (data) => {
        gameStarted.value = true;
        myHand.value = data.hand;
    });

    socket.on('update_table', (newTable) => { table.value = newTable; });

    socket.on('match_success', async () => {
        const q = table.value.quantifierCard?.text || '';
        const n = table.value.nounCard?.noun || '';
        const solver = table.value.nounCard?.playerName || '某個同學';
        const fullAnswer = `${q}${n}`;

        await ElMessageBox.alert(
            `${solver} 配對成功！正確答案就是：【${fullAnswer}】`,
            '配對成功',
            {
                type: 'success',
                confirmButtonText: '確定',
                center: true,
            }
        );
        socket.emit('request_clear_table');
    });

    socket.on('match_fail', async () => {
        await ElMessageBox.alert('哎呀，答錯了，再試一次！', '配對失敗', { type: 'error', confirmButtonText: '再試一次' });
        socket.emit('request_clear_table');
    });

    socket.on('force_restart', () => {
        // 重置前端狀態，回到大廳頁面
        gameStarted.value = false;
        myHand.value = [];
        table.value = { quantifierCard: null, nounCard: null };
        ElMessage.warning('老師已重置遊戲');
    });
});

const requestStart = () => {
    socket.emit('teacher_start', {
        customData: localGameData.value,
        displayMode: studentDisplayMode.value
    });
};

const playCard = (card) => {
    socket.emit('play_card', {
        role: role.value,
        card: { ...card } // 包含 id, img, noun, displayMode 等
    });
};

const handleRestart = () => {
    ElMessageBox.confirm(
        '確定要重置所有玩家的遊戲狀態並回到大廳嗎？',
        '重新開始',
        {
            confirmButtonText: '確定',
            cancelButtonText: '取消',
            type: 'warning',
        }
    ).then(() => {
        socket.emit('request_restart_game');
    }).catch(() => { });
};

const addRow = () => {
    const newId = localGameData.value.length > 0
        ? Math.max(...localGameData.value.map(item => item.id)) + 1
        : 1;

    localGameData.value.push({
        id: newId,
        quantifier: "",
        noun: "",
        img: ""
    });

    ElMessage.success('已新增一組題目欄位');
};

// 刪除指定索引的資料
const removeRow = (index) => {
    localGameData.value.splice(index, 1);
};

</script>
  
<style scoped>
.game-container {
    max-width: 900px;
    margin: 40px auto;
    padding: 0 20px;
}

.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.title {
    margin: 0;
    font-size: 24px;
    color: #409EFF;
}

.editor-footer {
    margin-top: 20px;
    text-align: right;
}

.editor-header {
    display: flex;
    /* 開啟 Flexbox 佈局 */
    align-items: center;
    /* 垂直居中對齊 */
    gap: 15px;
    /* 設定標題與連結之間的間距 */
    margin-bottom: 15px;
    /* 與下方表格的距離 */
}

.drop-zone {
    display: flex;
    justify-content: center;
    gap: 50px;
    margin-bottom: 40px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 12px;
}

.slot {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.slot-label {
    font-weight: bold;
    color: #606266;
    margin-bottom: 10px;
}

/* 虛線框 */
.card-placeholder {
    width: 120px;
    height: 160px;
    border: 2px dashed #dcdfe6;
    border-radius: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #909399;
    background: #fff;
}

/* 實體牌 */
.game-card {
    width: 120px;
    height: 160px;
    border: 1px solid #409EFF;
    border-radius: 8px;
    background: #fff;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 1.5rem;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    position: relative;
}

.game-card .el-image {
    width: 90%;
    height: 90%;
}

/* 手牌區 */
.cards-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 15px;
    margin-top: 20px;
}

.hand-card {
    width: 100px;
    height: 140px;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: transform 0.2s;
}

.hand-card:hover {
    transform: translateY(-10px);
}

.hand-card .el-image {
    width: 100%;
    height: 100%;
}

.select-option {
    display: flex;
    align-items: center;
}

.image-edit-cell {
    display: flex;
    align-items: center;
    gap: 10px;
}

.mini-preview {
    width: 40px;
    height: 40px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
    background: #f5f7fa;
}

.preview-img {
    width: 100%;
    height: 100%;
}

.image-slot-error,
.image-slot-empty {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    font-size: 10px;
    color: #909399;
}

.player-name-tag {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    font-size: 12px;
    padding: 4px 0;
    text-align: center;
    font-weight: normal;
}

.teacher-tag {
    background: rgba(245, 108, 108, 0.8);
    /* 老師用紅色系 */
}

.student-tag {
    background: rgba(103, 194, 58, 0.8);
    /* 學生用綠色系 */
}
</style>

