const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const ytpl = require('ytpl');
const Youtube = require('simple-youtube-api');
const client = new Discord.Client();
const youtube = new Youtube(process.env.GOOGLE_API);
const queue = new Map();

var repeat = false;
const {
    degen,
    steinGate,
} = require('./playlist.json');
const {
    quote
} = require('./quotes.json');

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
    else if (message.content.startsWith("`degen")) {
        message.content = '`play ' + degen;
        execute(message, serverQueue);
        return;
    }
/*************************************************************************************************************************************/
    else if (message.content.startsWith("`shuffle")) {
        shuffle(message, serverQueue);
        return;
    }
    else if (message.content.startsWith("`help")) {
        display(message, '```You can currently use the following commands: \n\
            \`play [URL/Text to Search] \n\
            \`skip -Skips current song in queue \n\
            \`stop -Removes all song in queue \n\
            \`song -Displays current song \n\
            \`repeat -Repeat current song until this command is inputted again \n\
            \`queue -Displays current queue of songs \n\
            \`shuffle -Shuffles queue of songs \n\
            \`degen -Plays degenerate playlist```');
        return;
    }

    else {
        display(message, 'You need to enter a valid command!')
    }

    //KEEP FOR REFFERENCE . receivedMsg.channel.send("Message received: " + receivedMsg.content); 

});
async function execute(message, serverQueue) {
    const args = message.content.split(' ');
    const searchString = args.slice(1).join(' ');
    const url = args[1].replace(/<(.+)>/g, '$1');
    const voiceChannel = message.member.voiceChannel;
    if (!voiceChannel) return display(message, 'You need to be in a voice channel to play music!');
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return display(message, 'I need the permissions to join and speak in your voice channel!');
    }
    ytpl(url, async function (err, playlist) {
        if (err) {
            console.log('Single video found. Now attemping to gather information.');
            try {
                var video = await youtube.getVideo(url);
            }
            catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 1);
                    var video = await youtube.getVideoByID(videos[0].id);
                }
                catch (err) {
                    console.log("ERROR: No video found. Will now stop searching for a video from: " + url);
                    display(message, 'No video found.');
                    return;
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
                    console.log('ERROR: Unable to establish connection and play first song. ' + err);
                    queue.delete(message.guild.id);
                    return display(message, err);
                }
            } else {
                try {
                    serverQueue.songs.push(song);
                }
                catch (err) {
                    console.log("ERROR: Unable to add song to queue. " + err);
                    display(message, "Unable to add the video to queue.");
                    return;
                }
                return display(message, `${song.title} has been added to the queue!`);
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
                        if (item['duration']) {
                            const song = {
                                id: item['id'],
                                title: item['title'],
                                url: `https://www.youtube.com/watch?v=${item.id}`
                            };
                            queueContruct.songs.push(song);
                        }
                    } catch (err) {
                        console.log(err);
                    }

                });
                display(message, `**${playlist['title']}** playlist has been added to the queue!`);
                //shuffle(message, queueContruct);
                try {
                    //console.log("First song is: " + queueContruct.songs[0]);
                    var connection = await voiceChannel.join();
                    queueContruct.connection = connection;
                    play(message.guild, queueContruct.songs[0]);
                } catch (err) {
                    console.log("ERROR: Playlist/Joining, playing first playlist song.");
                    display(message, 'I am unable to join, or start the music...');
                    queue.delete(message.guild.id);
                    return display(message, err);
                }

            } else {
                playlist['items'].forEach(function (item, index) {
                    if (item['duration']) {
                        const song = {
                            id: item['id'],
                            title: item['title'],
                            url: `https://www.youtube.com/watch?v=${item.id}`
                        };
                        serverQueue.songs.push(song);
                    }
                });
                display(message, `**${playlist['title']}** playlist has been added to the queue!`);
                //shuffle(message, queueContruct);
            }

        }
    });

    

}

function skip(message, serverQueue) {
    try {
        if (!message.member.voiceChannel) return display(message, 'You have to be in a voice channel to stop the music!');
        if (!serverQueue) return display(message, 'There is no song that I could skip!');
        console.log("Now skipping current song.");
        serverQueue.connection.dispatcher.end();
        display(message, 'Skipping the current song!');
    }
    catch (err) {
        console.log("ERROR: Unable to skip current song! " + err);
        display(message, 'Unable to skip current song.');
    }
}

function stop(message, serverQueue) {
    try {
        if (!message.member.voiceChannel) return display(message, 'You have to be in a voice channel to stop the music!');
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();
        display(message, 'Stop requested. Leaving the voice channel.');
        console.log('Stop requested. Leaving the voice channel.');
    }
    catch (err) {
        console.log('ERROR: Unable to stop the music. ' + err);
        display(message, 'Stop requested. But Unable to complete request.');
    }
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        console.log('No more songs to play now exiting...');
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }
    console.log(song.title + ' is now playing!');

    const dispatcher = serverQueue.connection.playStream(ytdl(song.url), { filter: "audioonly" })
        .on('end', () => {
            console.log(song.title + ' ended!');
            if (serverQueue.voiceChannel.members.array().length <= 1) {
                console.log("NO one is in voice channel.. Leaving...");
                serverQueue.voiceChannel.leave();
                queue.delete(guild.id);
                return;
            }
            console.log('There is still someone in the voice channel.. will continue playing.');
            if (!repeat) {
                serverQueue.songs.shift();
            }
            console.log('Playing next song...');
            play(guild, serverQueue.songs[0]);
        })
        .on('error', error => {
            console.error(error);
        });
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

}
function currentPlaying(message, serverQueue) {
    display(message, 'Currently Playing...' + serverQueue.songs[0].title);
}
function repeatSong(message, serverQueue) {
    if (repeat) {
        repeat = false;
        display(message, 'Will stop repeating...' + serverQueue.songs[0].title + ' until `repeat command is used again.');
    }
    else {
        repeat = true;
        display(message, 'Repeating...' + serverQueue.songs[0].title + ' until `repeat command is used again.');
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
        display(message, '```Current Queue:\n' + q + '```');
    }
    catch (err) {
        console.log("Error: Trying to get Queue");
        display(message, "Queue is Empty");
    }
}
function shuffle(message, serverQueue) {
    try {
        for (let i = serverQueue.songs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * i);
            if (j == 0) {
                continue;
            }
            const temp = serverQueue.songs[i];
            serverQueue.songs[i] = serverQueue.songs[j];
            serverQueue.songs[j] = temp;
        }
        display(message, "Queue has been shuffled.");
        console.log("Queue shuffling completed.");
    }
    catch (err) {
        console.log("ERROR: Unable to shuffle");
        display(message, "There was a problem shuffling.");
    }
}
/*************************************************************************************************************************************/
function display(message, text) {
    if (Math.floor((Math.random() * 10) + 1) <= 4) {
        var q = Math.floor((Math.random() * quote.length));
        text = quote[q] + " And... " + text;
    }
    message.channel.send(text);
    return;
}

client.login(process.env.BOT_TOKEN);





