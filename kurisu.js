const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const ytpl = require('ytpl');
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
    ytpl(url, async function (err, playlist) {
        if (err) {
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
            console.log(song.title + "...has been added.");

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
                    //console.log(err);
                    queue.delete(message.guild.id);
                    return message.channel.send(err);
                }
            } else {
                serverQueue.songs.push(song);
                //console.log(serverQueue.songs);
                return message.channel.send(`${song.title} has been added to the queue!`);
            }
        }
        else {
            console.log("Playlist detected: " + url);
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

                playlist['items'].forEach(function (item, index) {
                    try {
                        const song = {
                            id: item['id'],
                            title: item['title'],
                            url: `https://www.youtube.com/watch?v=${item.id}`
                        };

                        queueContruct.songs.push(song);
                    } catch (err) {
                        console.log(err);
                    }

                });
                message.channel.send(`**${playlist['title']}** has been added to the queue!`);
                try {
                    //console.log("First song is: " + queueContruct.songs[0]);
                    var connection = await voiceChannel.join();
                    queueContruct.connection = connection;
                    play(message.guild, queueContruct.songs[0]);
                } catch (err) {
                    console.log("ERROR: Playlist/Joining, playing first playlist song.");
                    queue.delete(message.guild.id);
                    return message.channel.send(err);
                }

            } else {
                playlist['items'].forEach(function (item, index) {
                    const song = {
                        id: item['id'],
                        title: item['title'],
                        url: `https://www.youtube.com/watch?v=${item.id}`
                    };
                    serverQueue.songs.push(song);
                    //count = index + 1; //Starts at 0 so add 1 to show correct count.
                });
            }

        }
    });

    

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
            if (serverQueue.voiceChannel.members.array().length <= 1) {
                console.log("NO one is in voice channel.. Leaving...");
                serverQueue.voiceChannel.leave();
                queue.delete(guild.id);
                return;
            }
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
    try {
        var q = "";
        for (var i = 0; i < serverQueue.songs.length; i++) {
            if (i == 0) {
                q += '[Currently Playing] ' + serverQueue.songs[i].title + '\n';
            }
            else {
                q += '[' + i + '] ' + serverQueue.songs[i].title + '\n';
            }
            if (i == 10) {
                q += '[...' + serverQueue.songs.length + ' more]\n';
                break;
            }
        }
        message.channel.send('```Current Queue:\n' + q + '```');
    }
    catch (err) {
        console.log("Error: Trying to get Queue");
        message.channel.send("Queue is Empty");
    }
}
/*************************************************************************************************************************************/

client.login(process.env.BOT_TOKEN);





