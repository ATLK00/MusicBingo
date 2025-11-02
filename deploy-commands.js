// ไฟล์ deploy-commands.js
const { REST, Routes } = require('discord.js');
const CLIENT_ID = '1358869706311991398'; // **ใส่ Client ID ของ Bot**
const GUILD_ID = '1434339572728201261'; // **ใส่ ID เซิร์ฟเวอร์ Discord**
const token = process.env.DISCORD_TOKEN;

const commands = [
    {
        name: 'link',
        description: 'เริ่มการเชื่อมโยงบัญชี Minecraft',
    },
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('กำลังรีเฟรชคำสั่ง (/) ...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );
        console.log('✅ รีเฟรชคำสั่งสำเร็จ!');
    } catch (error) {
        console.error(error);
    }
})();
