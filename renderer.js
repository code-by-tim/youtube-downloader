const { remote, ipcRenderer } = require('electron');
const fs = require('fs');
const ytdl = require('ytdl-core');
var childProcess, ffmpeg;
let storageLocation = undefined;

//Regular expression matching all unallowed characters for a windows path/file + dots in one string.
//Will potentially match several because of the global flag g.
regExp = /[\\\/\*\?\:\<\>\|\"\.]/g;

//Assign important HTML Objects to variables
let formatInput = document.getElementsByName("file-format");
let button = document.getElementById("button");
let urlInput = document.querySelector('.URL-input');
let storageLine = document.getElementById("storageLocation");
let statusLine = document.getElementById("statusLine");
let versionNumber = document.getElementById('versionNumber');
let updateInfo = document.getElementById('updateInfo');
let updateMessageBox = document.getElementById('updateMessageBox');
let updateMessage = document.getElementById('updateMessage');
let updateButton = document.getElementById('update-button');
let closeButton = document.getElementById('close-button');

//Inform the user about the current download status and the storageLocation.
window.onload = function () {
    storageLine.innerHTML = `Downloads saved to: ${storageLocation}`;
    versionNumber.innerHTML = remote.getGlobal('appVersion');
}

//Set storageLocation variable if it was set by user
ipcRenderer.on('storageLocation-set', (event, message) => {
    storageLocation = message;
    storageLine.innerHTML = `Downloads saved to: ${storageLocation}`;
});

/*
 * Event Listener of the download-button. When clicked it checks if audio or video was requested and what the url is.
 * It then calls the respective method to download the video /audio file. If no valid Youtube-Link was given, it informs the user.
 */
button.addEventListener('click', () => {
    var videoRequested = formatInput[0]['checked']; //Audio is checked per default. So if video is false, audio is true.
    var url = urlInput.value;
    
    if(ytdl.validateURL(url) && storageLocation != undefined){
        if(videoRequested){
            downloadVideo(url);
        } else {
            downloadAudio(url);  
        }
    } else {
        if(storageLocation == undefined) {
            statusLine.innerHTML = "Please set a storage location under Settings/Choose storage location";
        } else {
            statusLine.innerHTML = "Please enter a valid YouTube-Link!";
        }
    }
});

//This function removes all unallowed characters from the string, so the string can serve as a filename on windows.
//Unallowed characters are /\*?:"<>| Additionally for this programm: Remove dots.
function getValidPathString (string) {
    return string.replace(regExp , "_");
}

/*
*This function is supposed to get the video title, to catch and react on errors and to provide an alternative video name if necessary.
*It also checks the video title for unallowed characters and changes it if necessary, using the getValidPathString()-function.
*Returns: A resolved Promise, returning the videoTitle
*/
function getVideoTitle(url) {
    let videoTitle;
    try {
        ytdl.getBasicInfo(url).then( (result) => {
            videoTitle = result.player_response.videoDetails.title;
            videoTitle = getValidPathString(videoTitle);
        });
    } catch (error) {
        videoTitle = new Date().getTime();
    }
    return Promise.resolve(videoTitle);
}

/*
 * This function downloads the audio file and saves it with video-title as the filename.
 */
function downloadAudio(url) {
    //Update the status line
    statusLine.innerHTML = "Downloading audio file...";

    getVideoTitle(url).then( (videoTitle) => {
        ytdl(url, {
        quality: '140'
        }).pipe(fs.createWriteStream(`${storageLocation}\\${videoTitle}.m4a`));

        //Inform the user about the successful download
        statusLine.innerHTML = "Download successfull! App is ready for the next download";
    })
    //Inform the user about possible unsuccessful download
    .catch( (reason) => {
        statusLine.innerHTML = "Error! You will find more details in the developer tools."
            + " <p>Please contact the developer.</p>";
    });
}

/*
* This function downloads the video file and saves it with the video-title as the filename.
*To get the maximum resolution and quality, it downloads audio and video seperately and then combines them.
*The video is currently saved as a matroska .mkv file.
*/
function downloadVideo(url) {
    //Update the status line
    statusLine.innerHTML = "Downloading video file...";
    
    try {
        //require the needed libraries if not done yet in former calls of this function
        //The following locig is mainly from an example from github.
        if(childProcess == undefined){
            childProcess = require('child_process');
        }
        if(ffmpeg == undefined){
            ffmpeg = require('ffmpeg-static');
        }

        //Some object needed
        const tracker = {
            start: Date.now(),
            audio: { downloaded: 0, total: Infinity },
            video: { downloaded: 0, total: Infinity },
            merged: { frame: 0, speed: '0x', fps: 0 },
        };
      
        // Get audio and video stream going
    
        var audio = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' })
            .on('progress', (_, downloaded, total) => {
                tracker.audio = { downloaded, total };
        });
        var video = ytdl(url, { filter: 'videoonly', quality: 'highestvideo' })
            .on('progress', (_, downloaded, total) => {
                tracker.video = { downloaded, total };
        });

        // Start the ffmpeg child process
        const ffmpegProcess = childProcess.spawn(ffmpeg, [
            // Remove ffmpeg's console spamming
            '-loglevel', '0', '-hide_banner',
            // Redirect/enable progress messages
            '-progress', 'pipe:3',
            '-i', 'pipe:4',
            '-i', 'pipe:5',
            // Rescale the video
            '-vf', 'scale=320:240',
            // Choose some fancy codes
            '-c:v', 'libx265', '-x265-params', 'log-level=0',
            '-c:a', 'flac',
            // Define output container
            '-f', 'matroska', 'pipe:6',
            ], {
            windowsHide: true,
            stdio: [
            /* Standard: stdin, stdout, stderr */
            'inherit', 'inherit', 'inherit',
            /* Custom: pipe:3, pipe:4, pipe:5, pipe:6 */
            'pipe', 'pipe', 'pipe', 'pipe',
            ],
        });

        ffmpegProcess.on('close', () => {
            process.stdout.write('\n\n\n\n');
            //Inform the user about the successful download
            statusLine.innerHTML = "Download successfull! App is ready for the next download";
        });

        // Link streams
        // FFmpeg creates the transformer streams and we just have to insert / read data
        ffmpegProcess.stdio[3].on('data', chunk => {
            // Parse the param=value list returned by ffmpeg
            const lines = chunk.toString().trim().split('\n');
            const args = {};
            for (const l of lines) {
                const [key, value] = l.trim().split('=');
                args[key] = value;
            }
            tracker.merged = args;
        });
        audio.pipe(ffmpegProcess.stdio[4]);
        video.pipe(ffmpegProcess.stdio[5]);
        getVideoTitle(url).then( (videoTitle) => {
            ffmpegProcess.stdio[6].pipe(fs.createWriteStream(`${storageLocation}\\${videoTitle}.mkv`));
        });

    //Catch errors and inform user
    } catch (error) {
        statusLine.innerHTML = "Error! You will find more details in the developer tools."
            + " <p>Please contact the developer.</p>";
    }
}

//Following Code handles autoUpdates --------------------------------------------------------------------------
ipcRenderer.on('update_available', () => {
    ipcRenderer.removeAllListeners('update_available');
    updateMessage.innerText = 'A new update is available. Downloading now...';
    updateMessageBox.classList.remove('hidden');
});

ipcRenderer.on('update_downloaded', () => {
    ipcRenderer.removeAllListeners('update_downloaded');
    updateMessage.innerText = 'Update Downloaded. Update now?';
    updateButton.classList.remove('hidden');
    updateMessageBox.classList.remove('hidden');
});

//Handle updateMessageBox clicks
closeButton.addEventListener('click', () => {
    updateMessageBox.classList.add('hidden');
    updateInfo.classList.remove('hidden');
});

updateButton.addEventListener('click', () => {
    ipcRenderer.send('quit-and-update');
});