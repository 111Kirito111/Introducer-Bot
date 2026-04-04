require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior } = require('@discordjs/voice');
const gTTS = require('gtts');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

let connections = new Map();
let players = new Map();

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);

    // عند التشغيل: ادخل كل القنوات اللي فيها أعضاء حقيقيين
    client.guilds.cache.forEach(guild => {
        guild.channels.cache
            .filter(c => c.isVoiceBased() && c.members.some(m => !m.user.bot))
            .forEach(channel => {
                const connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator
                });
                connections.set(channel.guild.id, connection);

                const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
                connection.subscribe(player);
                players.set(channel.guild.id, player);
            });
    });
});

// حدث دخول وخروج الأعضاء
client.on('voiceStateUpdate', (oldState, newState) => {
    // دخول عضو حقيقي
    if (!oldState.channel && newState.channel && !newState.member.user.bot) {
        announceVoice(newState, 'joined');
    }
    // خروج عضو حقيقي
    if (oldState.channel && !newState.channel && !oldState.member.user.bot) {
        announceVoice(oldState, 'left');
    }
});

function announceVoice(state, action) {
    const guildId = state.guild.id;
    const username = state.member.user.username;
    const text = `${username} ${action} the channel`;

    let connection = connections.get(guildId);
    let player = players.get(guildId);

    // لو Connection غير موجود: ادخل القناة اللي فيها الأعضاء الحقيقيين
    if (!connection) {
        const channel = state.guild.channels.cache.find(c => c.isVoiceBased() && c.members.some(m => !m.user.bot));
        if (!channel) return; // ما فيش قناة فيها ناس
        connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guildId,
            adapterCreator: state.guild.voiceAdapterCreator
        });
        connections.set(guildId, connection);
    }

    // لو Player غير موجود
    if (!player) {
        player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
        connection.subscribe(player);
        players.set(guildId, player);
    }

    const filePath = `./voice-${guildId}.mp3`;
    const gtts = new gTTS(text, 'en');
    gtts.save(filePath, function() {
        const resource = createAudioResource(filePath);
        player.play(resource);
    });
}

client.login(process.env.TOKEN);