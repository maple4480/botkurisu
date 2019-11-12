const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const Youtube = require('simple-youtube-api');
const client = new Discord.Client();
const youtube = new Youtube(process.env.GOOGLE_API);
const queue = new Map();

var repeat = false;
/*************************************************************************************************************************************/
//When application starts do this:
client.on('ready', () => {
    console.log('Bot is ready...Awaiting Input!');
    client.user.setActivity(". For help: `help"); 
});

/*************************************************************************************************************************************/
//What to do when receive Messages:
client.on('message', (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith("`")) return;

    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith("`play")) {
        execute(message, serverQueue);
        return;
    } else if (message.content.startsWith("`skip")) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith("`stop")) {
        stop(message, serverQueue);
        return;
    } else if (message.content.startsWith("`song")) {
        currentPlaying(message, serverQueue);
        return;
    } else if (message.content.startsWith("`repeat")) {
        repeatSong(message, serverQueue);
        return;
    }
    else if (message.content.startsWith("`queue")) {
        getQueue(message, serverQueue);
        return;
    }
/*************************************************************************************************************************************/

    else if (message.content.startsWith("`help")) {
        message.channel.send('```You can currently use the following commands: \n\
            \`play [URL/Text to Search] \n\
            \`skip -Skips current song in queue \n\
            \`stop -Removes all song in queue \n\
            \`song -Displays current song \n\
            \`repeat -Repeat current song until this command is inputted again \n\
            \`queue -Displays current queue of songs```');
        return;
    }

    else {
        message.channel.send('You need to enter a valid command!')
    }

    //KEEP FOR REFFERENCE . receivedMsg.channel.send("Message received: " + receivedMsg.content); 

});
async function execute(message, serverQueue) {
    const args = message.content.split(' ');
    const searchString = args.slice(1).join(' ');
    const url = args[1].replace(/<(.+)>/g, '$1');
    const voiceChannel = message.member.voiceChannel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel to play music!');
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send('I need the permissions to join and speak in your voice channel!');
    }

    //Tries to use a link if not will perform youtube search.
    try {
        var video = await youtube.getVideo(url);
    }
    catch (error) {
        try {
            var videos = await youtube.searchVideos(searchString, 1);
            var video = await youtube.getVideoByID(videos[0].id);
        }
        catch (err) {
            //console.log(err);
            message.channel.send('No video found.');
        }
    }

    const song = {
        id: video.id,
        title: video.title,
        url: `https://www.youtube.com/watch?v=${video.id}`
    };
    //console.log(song.url);
    console.log(song.title +"...has been added.");
    //If there is no existing serverQ will create one. Otherwise add song to queue.
    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true,
        };
        queue.set(message.guild.id, queueContruct);

        queueContruct.songs.push(song);
        try {
            var connection = await voiceChannel.join();
            queueContruct.connection = connection;
            play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        console.log(serverQueue.songs);
        return message.channel.send(`${song.title} has been added to the queue!`);
    }

}

function skip(message, serverQueue) {
    if (!message.member.voiceChannel) return message.channel.send('You have to be in a voice channel to stop the music!');
    if (!serverQueue) return message.channel.send('There is no song that I could skip!');
    serverQueue.connection.dispatcher.end();
    message.channel.send('Skipping the current song!');
}

function stop(message, serverQueue) {
    if (!message.member.voiceChannel) return message.channel.send('You have to be in a voice channel to stop the music!');
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
    message.channel.send('Queue ended. Leaving the voice channel.');
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection.playStream(ytdl(song.url), { filter: "audioonly" })
        .on('end', () => {
            console.log('Music ended!');
            if (!repeat) {
                serverQueue.songs.shift();
            }
            play(guild, serverQueue.songs[0]);
        })
        .on('error', error => {
            console.error(error);
        });
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

}
function currentPlaying(message, serverQueue) {
    message.channel.send('Currently Playing...' + serverQueue.songs[0].title);
}
function repeatSong(message, serverQueue) {
    if (repeat) {
        repeat = false;
        message.channel.send('Will stop repeating...' + serverQueue.songs[0].title + ' until `repeat command is used again.');
    }
    else {
        repeat = true;
        message.channel.send('Repeating...' + serverQueue.songs[0].title + ' until `repeat command is used again.');
    }
}
function getQueue(message, serverQueue) {
    var q = "";
    for (var i = 0; i < serverQueue.songs.length; i++) {
        if (i == 0) {
            q += '[Currently Playing] ' + serverQueue.songs[i].title + '\n';
        }
        else {
            q += '[' + i + '] ' + serverQueue.songs[i].title + '\n';
        }
    }
    message.channel.send('```Current Queue:\n' + q + '```');
}
/*************************************************************************************************************************************/

client.login(process.env.BOT_TOKEN);





