require('dotenv').config();
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;
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

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);

    client.guilds.cache.forEach(guild => {
        guild.channels.cache
            .filter(c => c.isVoiceBased() && c.members.some(m => !m.user.bot))
            .forEach(channel => {
                const connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                    selfDeaf: false
                });

                connections.set(guild.id, connection);

                const player = createAudioPlayer({
                    behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
                });

                player.on('error', error => {
                    console.error('Audio error:', error);
                });

                connection.subscribe(player);
                players.set(guild.id, player);
            });
    });
});

client.on('voiceStateUpdate', (oldState, newState) => {
    if (!oldState.channel && newState.channel && !newState.member.user.bot) {
        announceVoice(newState, 'joined');
    }
    if (oldState.channel && !newState.channel && !newState.member.user.bot) {
        announceVoice(oldState, 'left');
    }
});

function announceVoice(state, action) {
    const guildId = state.guild.id;
    const username = state.member.user.username;
    const text = `${username} ${action} the channel`;

    let connection = connections.get(guildId);
    let player = players.get(guildId);

    if (!connection) {
        const channel = state.guild.channels.cache.find(c => c.isVoiceBased() && c.members.some(m => !m.user.bot));
        if (!channel) return;

        connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guildId,
            adapterCreator: state.guild.voiceAdapterCreator,
            selfDeaf: false
        });

        connections.set(guildId, connection);
    }

    if (!player) {
        player = createAudioPlayer({
            behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
        });

        player.on('error', error => {
            console.error('Audio error:', error);
        });

        connection.subscribe(player);
        players.set(guildId, player);
    }

    const filePath = `./voice-${guildId}.mp3`;
    const tts = new gTTS(text, 'en');

    tts.save(filePath, function(err) {
        if (err) {
            console.error('TTS error:', err);
            return;
        }

        try {
            const resource = createAudioResource(filePath);

            setTimeout(() => {
                player.play(resource);
            }, 500);

        } catch (e) {
            console.error('Play error:', e);
        }
    });
}

client.login(process.env.TOKEN);
