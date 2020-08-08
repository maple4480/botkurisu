const Discord = require('discord.js');
const ytdl = require('ytdl-core-discord');
const ytpl = require('ytpl');
const Youtube = require('simple-youtube-api');
const client = new Discord.Client();
const youtube = new Youtube(process.env.GOOGLE_API);
const queue = new Map();
const botID = process.env.BOT_ID;

var repeat = false;
var events = require('events');
var eventHandler = new events.EventEmitter();
var currentPlaying = false;
var timeoutID;

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
    else if (message.content.startsWith("`pause")) {
        pause(message);
        return;
    }
    else if (message.content.startsWith("`resume")) {
        resume(message);
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
            \`degen -Plays degenerate playlist \n\
            \`pause -Pauses the current song \n\
            \`resume -Will resume music```');
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
    if (args[1] === undefined) {
        return;
    }

    const url = args[1].replace(/<(.+)>/g, '$1');

    const voiceChannel = message.member.voice.channel;
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

            if (queue.get(message.guild.id) == null) {
                console.log("Generating serverQueue..");
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
                display(message, song.title + "...has been added.");

                try {
                    voiceChannel.leave();
                    console.log('Trying to join channel.');
                    var connection = await voiceChannel.join();
                    console.log('Channel joined.');
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
                    if (!currentPlaying) {
                        console.log('Trying to join channel.');
                        var connection = await voiceChannel.join();
                        console.log('Channel joined.');
                        serverQueue.connection = connection;
                        play(message.guild, serverQueue.songs[0]);
                    }
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
            if (queue.get(message.guild.id) == null) {
                console.log('Bot is not playing.. will add new playlist songs to queue.');
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
                    console.log('Trying to join channel.');
                    var connection = await voiceChannel.join();
                    console.log('Channel joined.');
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
            }

        }
    });

    

}

function skip(message, serverQueue) {
    try {
        if (!message.member.voice.channel) return display(message, 'You have to be in a voice channel to stop the music!');
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
        if (!message.member.voice.channel) return display(message, 'You have to be in a voice channel to stop the music!');
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();

        display(message, 'Stop requested.');
        console.log('Stop requested.');
    }
    catch (err) {
        console.log('ERROR: Unable to stop the music. ' + err);
        display(message, 'Stop requested. But Unable to complete request.');
    }
}

async function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        console.log('No more songs left to play.');
        currentPlaying = false;
        timeoutID = setTimeout(function () {
            console.log('Waited long enough, now exiting...');
            serverQueue.voiceChannel.leave();
            queue.delete(guild.id);
        }, 300000);
        console.log("Initiated time out ");
        return;
    }
    console.log(song.title + ' is now playing!');
    clearTimeout(timeoutID);
    console.log('Terminated time out...');

    currentPlaying = true;
    DateTime = new Date();
    console.log(DateTime.getHours() % 12 + ':' + DateTime.getMinutes() + ' - Will now play.');
    try {
        const dispatcher = serverQueue.connection.play(await ytdl(song.url, { filter: format => ['251'], highWaterMark: 1 << 25 }), { type: 'opus' })
            .on('finish', () => {
                console.log('Current Song ended.');

                if (serverQueue.voiceChannel.members.array().length <= 1
                    || serverQueue.voiceChannel.members.get(botID) === undefined) {
                    console.log("No one in voice but me Or...I've been disconnected. Clearing Resources.");
                    serverQueue.voiceChannel.leave();
                    queue.delete(guild.id);
                    console.log('Resources cleared.');
                    return;
                }
            
                if (!repeat) {
                    serverQueue.songs.shift();
                }
                console.log('Playing next song...');
                play(guild, serverQueue.songs[0]);
            })
            .on('error', error => {
                console.error("Error in dispatcher: " + error);
            });
        dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

        if (eventHandler.listeners('pause').length == 0) {
            eventHandler.on('pause', function () {
                dispatcher.pause();
            });
        }
        if (eventHandler.listeners('resume').length == 0) {
            eventHandler.on('resume', function () {
                dispatcher.resume();
            });
        }
    catch (err) {
            console.log("ERROR with play method: "+err)
        }

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
function display(message, text) {
    /*
     * Will add a random quote from quote.json
     * try {
        if (Math.floor((Math.random() * 10) + 1) <= 4) {
            var q = Math.floor((Math.random() * quote.length));
            text = quote[q] + " And... " + text;
        }
    }
    catch (err) {
        console.log("ERROR: Unable to add quote.");
    }*/
    message.channel.send(text);
    return;
}
function pause(message) {
    console.log("Command to pause..");
    try {
        eventHandler.emit('pause');
        display(message, "ZA WARUDO");
    }
    catch (error) {
        console.log("ERROR: Trying to pause music.");
    }
    return;
}
function resume(message) {
    console.log("Command to resume..");
    try {
        eventHandler.emit('resume');
        display(message, "Now Resuming..");
    }
    catch (error) {
        console.log("ERROR: Trying to resume music.");
    }
    return;
}
/*************************************************************************************************************************************/

client.login(process.env.BOT_TOKEN);





