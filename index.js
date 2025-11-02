// --- 1. Import Library ---
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

// --- 2. การตั้งค่า Express (API Server) ---
const app = express();
app.use(bodyParser.json());
const PORT = 3000;

// --- 3. การตั้งค่า Discord Bot ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates // **สำคัญมาก** สำหรับการ Mute
    ]
});

// --- 4. ฐานข้อมูลและค่าคงที่ ---
const DB_FILE = './linkedAccounts.json';
let pendingVerifications = {}; // { "discordUserId": "CODE" }
let linkedAccounts = {}; // { "discordUserId": "gamertag" }

const PROXIMITY_RANGE = 15; // ระยะ 15 บล็อก
const PROXIMITY_RANGE_SQUARED = PROXIMITY_RANGE * PROXIMITY_RANGE; 

// Helper Function: คำนวณระยะห่าง
function getDistanceSquared(loc1, loc2) {
    const dx = loc1.x - loc2.x;
    const dy = loc1.y - loc2.y;
    const dz = loc1.z - loc2.z;
    return dx * dx + dy * dy + dz * dz;
}
// --- 5. Logic: คำสั่ง /link ---
// --- 5. Logic: คำสั่ง /link ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'link') return;

    const userId = interaction.user.id;

    // 1. ตรวจสอบว่าเคยเชื่อมโยงไปแล้วหรือยัง (Logic เดิม)
    if (linkedAccounts[userId]) {
        const gamertag = linkedAccounts[userId];
        await interaction.reply({
            content: `คุณได้เชื่อมโยงบัญชีนี้กับ \`${gamertag}\` ใน Minecraft ไปแล้ว ไม่จำเป็นต้องเชื่อมโยงอีกครับ`,
            ephemeral: true
        });
        return; 
    }

    // 2. ถ้ายังไม่เคยเชื่อมโยง (Logic ใหม่)
    const verificationCode = `MC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // **** 🌟 นี่คือส่วนที่เปลี่ยน 🌟 ****
    // เราจะเก็บทั้ง "รหัส" และ "ID ช่องแชท"
    pendingVerifications[userId] = {
        code: verificationCode,
        channelId: interaction.channelId // <-- "จำ" ID ช่องแชทไว้
    };
    // **********************************

    await interaction.reply({
        content: `**ขั้นตอนการยืนยันตัวตน:**\n` +
                 `1. เข้าเซิร์ฟเวอร์ Minecraft\n` +
                 `2. พิมพ์ในช่องแชทว่า: \`/say ${verificationCode}\`\n` +
                 `(รหัสนี้มีอายุ 5 นาที)`,
        ephemeral: true 
    });

    // อัปเดต setTimeout ให้ทำงานกับ Object ใหม่
    setTimeout(() => {
        if (pendingVerifications[userId] && pendingVerifications[userId].code === verificationCode) {
            delete pendingVerifications[userId];
        }
    }, 300000); 
});

// --- 6. API Endpoint: หน้าแรก (สำหรับ UptimeRobot) ---
app.get('/', (req, res) => {
    res.send('🤖 เซิร์ฟเวอร์ Bot ทำงานปกติ!');
});

// --- 7. API Endpoint: /verify (สำหรับ Minecraft) ---
// --- 7. API Endpoint: /verify (สำหรับ Minecraft) ---
app.post('/verify', (req, res) => {
    const { gamertag, code } = req.body;
    if (!gamertag || !code) {
        return res.status(400).json({ status: 'failed', message: 'Missing gamertag or code' });
    }

    // **** 🌟 นี่คือส่วนที่เปลี่ยน 🌟 ****
    let foundUserId = null;
    let foundChannelId = null; // <-- ตัวแปรใหม่สำหรับเก็บ ID ช่องแชท

    // ค้นหาแบบใหม่
    for (const userId in pendingVerifications) {
        const pendingData = pendingVerifications[userId];
        if (pendingData && pendingData.code === code) { // <-- ค้นหาจาก .code
            foundUserId = userId;
            foundChannelId = pendingData.channelId; // <-- ดึง ID ช่องแชทที่จำไว้
            break;
        }
    }
    // **********************************

    if (foundUserId) {
        linkedAccounts[foundUserId] = gamertag;

        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(linkedAccounts, null, 2));
        } catch (err) {
            console.error("!! ไม่สามารถบันทึก DB:", err);
            return res.status(500).json({ status: 'failed', message: 'Server error saving data' });
        }

        delete pendingVerifications[foundUserId];

        client.users.fetch(foundUserId).then(user => {
            console.log(`✅ เชื่อมโยงสำเร็จ: ${user.tag} <-> ${gamertag}`);

            // **** 🌟 นี่คือส่วนที่เปลี่ยน (จาก DM เป็นส่งในแชท) 🌟 ****
            if (foundChannelId) {
                client.channels.fetch(foundChannelId).then(channel => {
                    if (channel && channel.isTextBased()) {
                        // <@${user.id}> คือการ "Mention" ผู้ใช้
                        channel.send(`🎉 <@${user.id}> ได้เชื่อมโยงบัญชีกับ \`${gamertag}\` ใน Minecraft สำเร็จ!`);
                    }
                }).catch(console.error); // ส่งแล้วไม่สนใจ (Fire and Forget)
            } else {
                // ถ้าเกิดฉุกเฉิน หาช่องไม่เจอ ให้ส่ง DM ไปแทน
                user.send(`🎉 การเชื่อมโยงบัญชีสำเร็จ!\nบัญชี Discord ของคุณ (${user.tag}) ได้เชื่อมโยงกับ \`${gamertag}\` ใน Minecraft เรียบร้อยแล้ว`).catch(console.error);
            }
            // ******************************************************

            res.json({ status: 'success', discordUser: user.tag });
        }).catch(err => {
            console.error("!! ไม่สามารถ fetch user:", err);
            res.status(500).json({ status: 'failed', message: 'Server error fetching user' });
        });

    } else {
        console.log(`⚠️ รหัส ${code} ไม่ถูกต้อง`);
        res.status(400).json({ status: 'failed', message: 'Invalid or expired code' });
    }
});

// --- 8. API Endpoint: /update_proximity (สำหรับ Minecraft) ---
app.post('/update_proximity', async (req, res) => {
    const playersInData = req.body; 
    const channelId = process.env.VOICE_CHANNEL_ID; // **⚠️ ต้องตั้งค่าใน Secrets**

    if (!Array.isArray(playersInData)) {
        return res.status(400).json({ message: "Invalid data format" });
    }
    if (!channelId) {
        console.warn("!! VOICE_CHANNEL_ID ยังไม่ได้ตั้งค่าใน Secrets");
        return res.status(500).json({ message: "Server not configured" });
    }

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isVoiceBased()) {
            return res.status(404).json({ message: "Voice channel not found" });
        }

        const membersInVC = channel.members; 
        let playersInVC = new Map(); 

        for (const [memberId, member] of membersInVC) {
            const gamertag = linkedAccounts[memberId];
            if (gamertag) {
                const playerData = playersInData.find(p => p.gamertag === gamertag);
                if (playerData) {
                    playersInVC.set(memberId, { member, ...playerData });
                }
            }
        }

        for (const [memberId, player1] of playersInVC) {
            let isNearSomeone = false;

            for (const [otherMemberId, player2] of playersInVC) {
                if (memberId === otherMemberId) continue; 

                if (player1.dimensionId === player2.dimensionId &&
                    getDistanceSquared(player1.location, player2.location) <= PROXIMITY_RANGE_SQUARED) {
                    isNearSomeone = true;
                    break; 
                }
            }

            // สั่ง Mute หรือ Unmute
            const member = player1.member;
            if (isNearSomeone) {
                if (member.voice.serverMute) member.voice.setMute(false, "Proximity: Near player").catch(e => {});
            } else {
                if (!member.voice.serverMute) member.voice.setMute(true, "Proximity: Too far").catch(e => {});
            }
        }

        // Mute คนที่อยู่ใน VC แต่ไม่อยู่ในเกม (หรือยังไม่ Link)
        for (const [memberId, member] of membersInVC) {
            if (!playersInVC.has(memberId)) {
                if (!member.voice.serverMute) member.voice.setMute(true, "Proximity: Not linked or in-game").catch(e => {});
            }
        }

        res.json({ status: 'ok' });

    } catch (error) {
        console.error("Proximity Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// --- 9. ส่วนเริ่มต้นทำงาน ---
client.on('ready', () => {
    console.log(`✅ Bot ล็อกอินแล้วในชื่อ ${client.user.tag}!`);

    // โหลดฐานข้อมูลที่บันทึกไว้
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        linkedAccounts = JSON.parse(data);
        console.log(`✅ โหลด ${Object.keys(linkedAccounts).length} บัญชีที่เชื่อมโยงแล้ว!`);
    } catch (err) {
        console.log('⚠️ ไม่พบฐานข้อมูลเดิม, กำลังสร้างใหม่...');
        fs.writeFileSync(DB_FILE, JSON.stringify({}));
    }
});

app.listen(PORT, () => {
    console.log(`✅ API Server กำลังรอคำสั่งที่ http://localhost:${PORT}`);
});

client.login(process.env.DISCORD_TOKEN); // **⚠️ ต้องตั้งค่าใน Secrets**
