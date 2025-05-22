

// State management
const state = {
  currentTrack: 0,
  isPlaying: false,
  isXRMode: false,
  exitingXR: false,
  pendingMessages: [],
  iframeReady: false,
  volume: 1,
  isMuted: false,
  videoElement: null,
  isVideoSynced: false,
};

// DOM Elements
const elements = {
  audioElement: document.getElementById('audioElement'),
  playPauseBtn: document.getElementById('playPauseBtn'),
  muteBtn: document.getElementById('muteBtn'),
  volumeSlider: document.getElementById('volumeSlider'),
  progress: document.getElementById('progress'),
  currentTime: document.getElementById('currentTime'),
  duration: document.getElementById('duration'),
  albumArt: document.getElementById('albumArt'),
  trackTitle: document.getElementById('trackTitle'),
  trackArtist: document.getElementById('trackArtist'),
  viewXRBtn: document.getElementById('viewXRBtn'),
  exitXRBtn: document.getElementById('exitXRBtn'),
  audioContent: document.getElementById('audioContent'),
  xrContent: document.getElementById('xrContent'),
  sceneContainer: document.getElementById('sceneContainer'),
  playlistContainer: document.getElementById('playlistContainer'),
  playlistTracks: document.getElementById('playlistTracks'),
  permissionOverlay: document.getElementById('permissionOverlay'),
  enableMotionBtn: document.getElementById('enableMotionBtn'),
  skipBtn: document.getElementById('skipMotionBtn'),
  videoFrame: document.getElementById('videoFrame'),
  menuBtn: document.getElementById('menuBtn'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  speedBtn: document.getElementById('speedBtn'),

};

let playlist = null;


// Initialize the player
async function initializePlayer() {
      
  try {

      await loadPlaylistData();

        // Initialize tour progress tracking
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  'event': 'tour_started',
  'tour_name': playlist.playlist_name,
  'total_chapters': playlist.tracks.length
});

      setupEventListeners();
      populatePlaylist();
      setupAudioElement();
      checkDeviceOrientation();

          
    // Check permissions and show overlay if needed
    const hasRequestedBefore = localStorage.getItem('hasRequestedMotionPermissions');
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (isIOS && !hasRequestedBefore) {
      elements.permissionOverlay.style.display = 'flex';
    } else {
      elements.permissionOverlay.style.display = 'none';
    }
      
      // Preload XR videos in background
      preloadXRVideos().catch(console.error);
      
      // Load first track
      await loadTrack(0, false);
      
      // Add message listener for iframe communication
      window.addEventListener('message', handleIframeMessages);
  } catch (error) {
      console.error('Error initializing player:', error);

      elements.trackTitle.textContent = 'Error loading playlist';
      elements.trackArtist.textContent = 'Please check your connection';
  }
}

// NEW FUNCTION: Load playlist data from JSON file
async function loadPlaylistData() {
  try {
    const response = await fetch('playlist.json'); // Path to your JSON file
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    playlist = await response.json();
    
    // Validate the loaded data
    if (!playlist || !playlist.playlist_name || !Array.isArray(playlist.tracks)) {
      throw new Error('Invalid playlist data format');
    }
    
    console.log('Playlist data loaded successfully');
  } catch (error) {
    console.error('Failed to load playlist data:', error);
    // Provide fallback empty playlist to prevent errors
    playlist = {
      playlist_name: "Playlist",
      tracks: []
    };
    throw error; // Re-throw so initializePlayer can handle it
  }
}




/********************************* UTILITIES ************************ */




function formatTime(seconds) {
  if (typeof seconds === 'string') {
      if (seconds.match(/^\d+:\d{2}$/)) return seconds;
      seconds = parseFloat(seconds);
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}


function handleIframeMessages(event) {

  if (event.data.type === 'aframeReady') {
      state.iframeReady = true;
      state.pendingMessages.forEach(msg => postMessageToIframe(msg));
      state.pendingMessages = [];
    }
    
  if (event.data.type === 'videoReady') {
      postMessageToIframe({
          action: 'setTime',
          time: elements.audioElement.currentTime
      });
      if (state.isPlaying) {
          postMessageToIframe({ 
              action: 'play',
              time: elements.audioElement.currentTime
          });
      }
  } else if (event.data.type === 'currentTime') {
    if (state.exitingXR) {
      completeExitXRMode(event.data.time);
    }
  }  else if (event.data.type === 'videoEnded') {
      // Video ended - reset time to 0 and play next track
      elements.audioElement.currentTime = 0;
      playNextTrack();
  }
}

// Setup event listeners
function setupEventListeners() {
  // Play/Pause
  elements.playPauseBtn.addEventListener('click', togglePlayPause);

  // Volume control
  elements.muteBtn.addEventListener('click', toggleMute);
  elements.volumeSlider.addEventListener('input', handleVolumeChange);

  // Progress bar
  elements.audioElement.addEventListener('timeupdate', updateProgress);
  elements.progress.parentElement.addEventListener('click', seekTo);

  // XR mode
  elements.viewXRBtn.addEventListener('click', enterXRMode);
  elements.exitXRBtn.addEventListener('click', exitXRMode);

  // Playlist
  // elements.playlistClose.addEventListener('click', togglePlaylist);

  // Device orientation
  elements.enableMotionBtn.addEventListener('click', function() {
    // This direct function call is crucial for iOS
    requestDeviceOrientation();
  });

  elements.skipBtn.addEventListener('click', () => {
    localStorage.setItem('hasRequestedMotionPermissions', 'true');
    elements.permissionOverlay.style.display = 'none';
});

  elements.menuBtn.addEventListener('click', togglePlaylist);
  elements.prevBtn.addEventListener('click', playPreviousTrack);
  elements.nextBtn.addEventListener('click', playNextTrack);
  elements.speedBtn.addEventListener('click', togglePlaybackSpeed);

  elements.playlistTracks.addEventListener('click', (e) => {
      const trackElement = e.target.closest('.playlist-track');
      if (trackElement) {
          const index = parseInt(trackElement.dataset.index);
          loadTrack(index, true); // Enable autoplay for playlist clicks
      }
  });

  // Video frame
  elements.videoFrame.addEventListener('load', () => {
      // When iframe loads, sync with audio
      const video = elements.videoFrame.contentDocument.querySelector('video');
      if (video) {
          video.currentTime = elements.audioElement.currentTime;
          if (!elements.audioElement.paused) {
              video.play();
          }
      }
  });


}

// Audio element setup
function setupAudioElement() {
  elements.audioElement.addEventListener('ended', () => {
    const currentChapter = playlist.tracks[state.currentTrack].chapter;
    
    if (state.currentTrack === playlist.tracks.length - 1) {
      window.dataLayer.push({
        'event': 'tour_complete',
        'tour_name': playlist.playlist_name,
        'last_chapter': currentChapter,
        'tour_duration': calculateTotalTourDuration() // Implement this function
      });
    }

      state.isPlaying = false;
      updatePlayPauseButton();
      // Play next track in audio mode
      playNextTrack();
  });

  elements.audioElement.addEventListener('loadedmetadata', () => {
      elements.duration.textContent = formatTime(elements.audioElement.duration);
  });
}

function calculateTotalTourDuration() {
  let totalSeconds = 0;
  playlist.tracks.forEach(track => {
    const [mins, secs] = track.duration.split(':').map(Number);
    totalSeconds += (mins * 60) + secs;
  });
  return formatDuration(totalSeconds);
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}





/******************************* VIDEO PRELOADER ***************************** */




// Video preloader cache
const videoPreloadCache = new Map();

// Preload XR videos
async function preloadXRVideos() {
  const preloadPromises = [];
  
  for (const track of playlist.tracks) {
      if (track.IsAR && track.XR_Scene && track.XR_Scene.trim() !== "") {
          preloadPromises.push(preloadXRVideo(track.XR_Scene));
      }
  }
  
  await Promise.all(preloadPromises);
  console.log('All XR videos preloaded');
}

// Preload single XR video
async function preloadXRVideo(url) {
  if (videoPreloadCache.has(url)) {
      return true;
  }
  
  return new Promise((resolve) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      video.src = url;
      
      // For faster start, we can just wait for metadata
      video.addEventListener('loadedmetadata', () => {
          videoPreloadCache.set(url, true);
          resolve(true);
      });
      
      video.addEventListener('error', () => {
          console.warn('Failed to preload XR video:', url);
          resolve(false);
      });
      
      // Trigger loading
      video.load();
      
      // Fallback in case events don't fire
      setTimeout(() => {
          if (!videoPreloadCache.has(url)) {
              console.warn('Preload timeout for:', url);
              resolve(false);
          }
      }, 10000);
  });
}

// Preload current and next track's XR video
async function preloadAdjacentXRVideos(currentIndex) {
  const tracksToPreload = [];
  
  // Current track
  if (playlist.tracks[currentIndex]?.IsAR && playlist.tracks[currentIndex]?.XR_Scene) {
      tracksToPreload.push(playlist.tracks[currentIndex].XR_Scene);
  }
  
  // Next track
  const nextIndex = (currentIndex + 1) % playlist.tracks.length;
  if (playlist.tracks[nextIndex]?.IsAR && playlist.tracks[nextIndex]?.XR_Scene) {
      tracksToPreload.push(playlist.tracks[nextIndex].XR_Scene);
  }
  
  await Promise.all(tracksToPreload.map(url => preloadXRVideo(url)));
}




/****************************** XR MODE ******************************** */



async function enterXRMode() {
  const currentTrack = playlist.tracks[state.currentTrack];
  const videoUrl = currentTrack.XR_Scene;

    // Track 360° button click
    window.dataLayer.push({
      'event': 'view_360_clicked',
      'tour_name': playlist.playlist_name,
      'track_title': currentTrack.title,
      'track_chapter': currentTrack.chapter
    });
  
  if (!currentTrack.IsAR || !currentTrack.XR_Scene) {
      console.warn("No XR content available");
      return;
  }

   // Show loading state
   const loadingOverlay = document.createElement('div');
   loadingOverlay.className = 'xr-loading-overlay';
   loadingOverlay.innerHTML = `
      <div class="xr-loading-message" style="color: white; text-align: center;">
      Loading 360° experience...<br>
      This may take up to 20 seconds on slower connections
    </div>
    <div class="xr-loading-spinner"></div>
   `;
   document.body.appendChild(loadingOverlay);

  try {
          // Update state FIRST
          state.isXRMode = true;
          state.exitingXR = false;

                // Setup UI
      elements.audioContent.style.display = 'none';
      elements.xrContent.style.display = 'block';
      elements.viewXRBtn.style.display = 'none';
      elements.exitXRBtn.style.display = 'flex';

          // Store playback state
    const wasPlaying = !elements.audioElement.paused;
    const currentTime = elements.audioElement.currentTime;

      // Preload video first
      const videoReady = await preloadXRVideo(currentTrack.XR_Scene);
      if (!videoReady) throw new Error('Video failed to load');

          // Setup XR scene with callback when loaded
    setupXRScene(videoUrl, () => {
      // When scene is loaded, remove loading overlay
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(loadingOverlay);
      }, 500);

      // Sync with audio player
      postMessageToIframe({
        action: 'setTime',
        time: elements.audioElement.currentTime
      });

      // // Setup scene
      // setupXRScene(currentTrack.XR_Scene);
      
      // Restore playback if needed
      if (wasPlaying) {
          setTimeout(() => {
              postMessageToIframe({
                  action: 'play',
                  time: elements.audioElement.currentTime
              });
          }, 500);
        }
      });

  } catch (error) {
      console.error('Failed to enter XR mode:', error);
         loadingOverlay.innerHTML = `
      <div class="xr-loading-message" style="color: white; text-align: center;">
        Failed to load 360° content<br>
        <button onclick="window.location.reload()" 
                style="margin-top:20px;padding:10px 20px;
                      background:var(--blue);border:none;
                      border-radius:5px;color:white;">
          Try Again
        </button>
      </div>
    `;
    setTimeout(() => completeExitXRMode(elements.audioElement.currentTime), 2000);
  }
}

async function exitXRMode() {
  if (!state.isXRMode) return;

  const currentTrack = playlist.tracks[state.currentTrack];

      // Track exit 360° button click
      window.dataLayer.push({
        'event': 'exit_360_clicked',
        'tour_name': playlist.playlist_name,
        'track_title': currentTrack.title,
        'track_chapter': currentTrack.chapter
      });
    
  
  console.log('Exiting XR mode');
  state.isXRMode = false;

    // Update UI immediately
    elements.viewXRBtn.style.display = 'flex';
    elements.exitXRBtn.style.display = 'none';
    
  
  // Stop trying to communicate with the iframe
  state.exitingXR = true;
  
  // Get current time from iframe
  postMessageToIframe({ action: 'getCurrentTime' });
  
  // Set a timeout fallback
  setTimeout(() => {
      if (state.exitingXR) {
          completeExitXRMode(0);
      }
  }, 1000);
}

function completeExitXRMode(videoTime) {
  console.log('Completing XR exit');
  state.exitingXR = false;
  state.isXRMode = false; // Ensure state is clean

  const currentTrack = playlist.tracks[state.currentTrack];
  const showXRButton = currentTrack.IsAR && currentTrack.XR_Scene && currentTrack.XR_Scene.trim() !== "";
  
  // Update UI
  elements.audioContent.style.display = 'flex';
  elements.xrContent.style.display = 'none';
  elements.viewXRBtn.style.display = 'flex';
  elements.exitXRBtn.style.display = 'none';
  
  
  // Clean up iframe
  elements.xrContent.innerHTML = '';

  // Check if we're at the end of the track
  const atEnd = videoTime >= (elements.audioElement.duration - 0.5); // 0.5 second threshold

  // Reset to beginning if at end or if this was triggered by video ended
  const newTime = atEnd ? 0 : videoTime;
  elements.audioElement.currentTime = newTime;
  
  if (!atEnd) {
      elements.audioElement.currentTime = videoTime;
      if (state.isPlaying) {
          elements.audioElement.play().catch(console.error);
      }
  } else {
      // At end - ensure paused state
      elements.audioElement.currentTime = 0;
      state.isPlaying = false;
      updatePlayPauseButton();
  }

    // Reset XR mode state
    state.isXRMode = false;
}


function setupXRScene(videoUrl, onReadyCallback) {
  // Clear previous iframe
  elements.xrContent.innerHTML = '';
  
  // Create new iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'videoFrame';
  iframe.className = 'video-frame';
  iframe.allowFullscreen = true;
  elements.xrContent.appendChild(iframe);

    // Add CSS to hide A-Frame UI elements
    const hideUI = `
    <style>
      .a-loader-title, .a-enter-vr-button, .a-loader {
        display: none !important;
      }
      body {
        background-color: #182F48 !important;
      }
    </style>
  `;
  
    // Set up iframe content with enhanced sync
    iframe.srcdoc = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="apple-mobile-web-app-capable" content="yes">
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
      <title>360 Video</title>
      <script src="https://aframe.io/releases/1.7.1/aframe.min.js"></script>
      ${hideUI}
      <style>
        body { margin: 0; overflow: hidden; }
        .a-canvas { background: #000 !important; }
      </style>
    </head>
    <body>
      <a-scene device-orientation-permission-ui
               loading-screen="enabled: false"
               vr-mode-ui="enabled: false"> 
        <a-assets>
          <video id="xrVideo"
                 src="${videoUrl}"
                 crossorigin="anonymous"
                 playsinline
                 webkit-playsinline
                 muted
                 autoplay
                 preload="auto"
                 xr-layer>
          </video>
        </a-assets>
        
        <a-videosphere src="#xrVideo" rotation="0 -90 0"></a-videosphere>
      
        <a-entity position="0 1.6 0">
          <a-camera
              look-controls="pointerLockEnabled: false;
                          reverseMouseDrag: false;
                          touchEnabled: true;
                          magicWindowTrackingEnabled: true">
          </a-camera>
          <a-cursor></a-cursor>
        </a-entity>

        <script>
          const video = document.getElementById('xrVideo');
          video.muted = true;

          // Enhanced sync function
          function syncVideo(time) {
            if (Math.abs(video.currentTime - time) > 0.1) {
              video.currentTime = time;
            }
          }

          // Notify parent when ready
          function notifyReady() {
            window.parent.postMessage({ 
              type: 'aframeReady'
            }, '*');
          }

          // Handle metadata loaded
          video.addEventListener('loadedmetadata', function() {
            notifyReady();
          });

          // Handle video ended
          video.addEventListener('ended', () => {
            window.parent.postMessage({
              type: 'videoEnded'
            }, '*');
          });
          
          // Handle parent messages
          window.addEventListener('message', (event) => {
            if (!video) return;
            
            switch(event.data.action) {
              case 'play':
                syncVideo(event.data.time || 0);
                video.play().catch(e => console.log('Video play error:', e));
                break;
              case 'pause':
                video.pause();
                break;
              case 'setTime':
                syncVideo(event.data.time);
                break;
              case 'getCurrentTime':
                window.parent.postMessage({
                  type: 'currentTime',
                  time: video.currentTime
                }, '*');
                break;
            }
          });

          // If already loaded, notify immediately
          if (video.readyState > 3) {
            notifyReady();
          }
        </script>
      </a-scene>
    </body>
    </html>
  `;

  // Handle iframe load event
  iframe.onload = () => {
    state.iframeReady = true;
    if (onReadyCallback) onReadyCallback();
  };
  
}

function postMessageToIframe(message) {
  if (!state.iframeReady) {
    state.pendingMessages.push(message); // Queue messages
    return;
  }
  const iframe = document.querySelector('.video-frame');
  iframe?.contentWindow?.postMessage(message, '*');
}


/********************************* PLAYER CONTROLS **************************** */

// Unified play/pause control
function togglePlayPause() {
  state.isPlaying = !state.isPlaying;
  updatePlayPauseButton();

    // Track play/pause events
    // window.dataLayer.push({
    //   'event': state.isPlaying ? 'audio_play' : 'audio_pause',
    //   'track_title': playlist.tracks[state.currentTrack].title,
    //   'track_chapter': playlist.tracks[state.currentTrack].chapter
    // });
  
  if (state.isPlaying) {
      elements.audioElement.play().catch(console.error);
      if (state.isXRMode) {
          postMessageToIframe({
              action: 'play',
              time: elements.audioElement.currentTime
          });
      }
  } else {
      elements.audioElement.pause();
      if (state.isXRMode) {
          postMessageToIframe({ action: 'pause' });
      }
  }
}

// Track navigation
async function playNextTrack() {
  if (!playlist?.tracks?.length) return;

  try {
      // Show loading indicator
      elements.playPauseBtn.innerHTML = '⏳';
      
      // Exit XR mode if currently in it
      if (state.isXRMode) {
          await exitXRMode();
      }

      const nextTrack = (state.currentTrack + 1) % playlist.tracks.length;
      await loadTrack(nextTrack, true); // Pass true to autoplay

       // Ensure we start from beginning
       elements.audioElement.currentTime = 0;
      
      // Auto-play the new track in audio mode
      await elements.audioElement.play();
      state.isPlaying = true;
      updatePlayPauseButton();
      
      // Update UI to show current track
      highlightCurrentTrack();
  } catch (error) {
      console.error('Error playing next track:', error);
      state.isPlaying = false;
      updatePlayPauseButton();
  }
}

// Helper function to highlight current track in playlist
function highlightCurrentTrack() {
  const tracks = elements.playlistTracks.querySelectorAll('.playlist-track');
  tracks.forEach((track, index) => {
      if (index === state.currentTrack) {
          track.classList.add('active');
      } else {
          track.classList.remove('active');
      }
  });
}
async function playPreviousTrack() {
  if (!playlist?.tracks?.length) return;

  // If we're more than 3 seconds into the track, restart it instead
  if (elements.audioElement.currentTime > 3) {
      elements.audioElement.currentTime = 0;
      updateProgress();
      return;
  }
  
  const prevTrack = (state.currentTrack - 1 + playlist.tracks.length) % playlist.tracks.length;
  await loadTrack(prevTrack);

   // Auto-play the new track
   try {
      await elements.audioElement.play();
      state.isPlaying = true;
      updatePlayPauseButton();
      
      // If in XR mode, sync the video
      if (state.isXRMode) {
          postMessageToIframe({
              action: 'play',
              time: elements.audioElement.currentTime
          });
      }
  } catch (error) {
      console.error('Error autoplaying previous track:', error);
  }

}


// Volume control
function toggleMute() {
  state.isMuted = !state.isMuted;
  elements.audioElement.muted = state.isMuted;
  if (state.videoElement) {
      state.videoElement.muted = state.isMuted;
  }
  elements.muteBtn.innerHTML = state.isMuted ? '<i class="fas fa-volume-mute">' : '<i class="fas fa-volume-up"></i>';
}

function handleVolumeChange(e) {
  const volume = e.target.value;
  elements.audioElement.volume = volume;
  if (state.videoElement) {
      state.videoElement.volume = volume;
  }
  state.volume = volume;
  elements.muteBtn.innerHTML = volume > 0 ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute">';
}

// Playback speed control
function togglePlaybackSpeed() {
  const speeds = [1, 1.5, 2];
  const currentSpeed = elements.audioElement.playbackRate;
  const currentIndex = speeds.indexOf(currentSpeed);
  const nextIndex = (currentIndex + 1) % speeds.length;
  const newSpeed = speeds[nextIndex];
  
  elements.audioElement.playbackRate = newSpeed;
  if (state.videoElement) {
      state.videoElement.playbackRate = newSpeed;
  }
  
  elements.speedBtn.textContent = `${newSpeed}x`;
  
  // Show speed change feedback
  const feedback = document.createElement('div');
  feedback.textContent = `Playback speed: ${newSpeed}x`;
  feedback.style.position = 'absolute';
  feedback.style.bottom = '60px';
  feedback.style.left = '50%';
  feedback.style.transform = 'translateX(-50%)';
  feedback.style.backgroundColor = 'rgba(0,0,0,0.7)';
  feedback.style.color = 'white';
  feedback.style.padding = '5px 10px';
  feedback.style.borderRadius = '5px';
  feedback.style.zIndex = '100';
  elements.playerContainer.appendChild(feedback);
  
  setTimeout(() => {
      feedback.style.opacity = '0';
      feedback.style.transition = 'opacity 0.5s';
      setTimeout(() => feedback.remove(), 500);
  }, 1000);
}

// Update seekTo function to handle iframe
function seekTo(e) {
  const progressBar = e.currentTarget;
  const clickPosition = e.offsetX / progressBar.offsetWidth;
  const newTime = clickPosition * elements.audioElement.duration;
  
  elements.audioElement.currentTime = newTime;
  
  if (state.isXRMode) {
      postMessageToIframe({
          action: 'setTime',
          time: newTime
      });

      // If playing, ensure video continues after seek
    if (state.isPlaying) {
      setTimeout(() => {
        postMessageToIframe({
          action: 'play',
          time: newTime
        });
      }, 100);
  }
}
}

function cleanupXRScene() {
  elements.sceneContainer.innerHTML = '';
}

function syncVideoWithAudio() {
  if (state.videoElement && elements.audioElement) {
      state.videoElement.currentTime = elements.audioElement.currentTime;
      if (state.isPlaying) {
          state.videoElement.play().catch(error => {
              console.error('Error playing video:', error);
          });
      }
      state.isVideoSynced = true;
  }
}

// State for tracking progress events
const progressState = {
  chapterCompleteFired: false,
  percent25Fired: false,
  percent50Fired: false,
  percent75Fired: false
};

function resetProgressState() {
  progressState.chapterCompleteFired = false;
  progressState.percent25Fired = false;
  progressState.percent50Fired = false;
  progressState.percent75Fired = false;
}

// Update progress bar
function updateProgress() {
  const currentTime = elements.audioElement.currentTime;
  const duration = elements.audioElement.duration || playlist.tracks[state.currentTrack].duration;

  if (duration) {
      const progressPercent = (currentTime / duration) * 100;
      elements.progress.style.width = `${progressPercent}%`;
      elements.currentTime.textContent = formatTime(currentTime);

    // Track progress milestones
    if (progressPercent >= 25 && !progressState.percent25Fired) {
      console.log("25% complete");
      progressState.percent25Fired = true;
      window.dataLayer.push({
        'event': 'audio_25percent',
        'track_title': playlist.tracks[state.currentTrack].title
      });
    }
    if (progressPercent >= 50 && !progressState.percent50Fired) {
      console.log("50% complete");
      progressState.percent50Fired = true;
      window.dataLayer.push({
        'event': 'audio_50percent',
        'track_title': playlist.tracks[state.currentTrack].title
      });
    }
    if (progressPercent >= 75 && !progressState.percent75Fired) {
      console.log("75% complete");
      progressState.percent75Fired = true;
      window.dataLayer.push({
        'event': 'audio_75percent',
        'track_title': playlist.tracks[state.currentTrack].title
      });
    }
    if (progressPercent >= 99.5 && (duration - currentTime) < 1 && !progressState.chapterCompleteFired) { // Use 99 to avoid multiple triggers
      console.log("chapter complete");
      progressState.chapterCompleteFired = true;
      window.dataLayer.push({
        'event': 'chapter_complete',
        'tour_name': playlist.playlist_name,
        'chapter_title': playlist.tracks[state.currentTrack].title
      });
    }
  }
  
  // Sync video time if in XR mode
  if (state.isXRMode) {
      postMessageToIframe({
          action: 'setTime',
          time: currentTime
      });
  }
}

// Helper to get video time (will be async in real implementation)
function getVideoCurrentTime() {
  // In real implementation, this would use postMessage
  return elements.audioElement.currentTime; // Fallback
}


function updatePlayPauseButton() {
  elements.playPauseBtn.innerHTML = state.isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
}




/******************************* PLAYLIST MANAGEMENT ***************************** */




// Playlist management
function populatePlaylist() {
  elements.playlistTracks.innerHTML = playlist.tracks.map((track, index) => `
      <div class="playlist-track" data-index="${index}">
          <div><p>${track.chapter}. ${track.title}</p></div>

             ${track.IsAR && track.XR_Scene && track.XR_Scene.trim() !== "" ? 
            '<span class="xr-badge">360°</span>' : ''}
      </div>
  `).join('');

  elements.playlistTracks.addEventListener('click', (e) => {
      const trackElement = e.target.closest('.playlist-track');
      if (trackElement) {
          const index = parseInt(trackElement.dataset.index);
          loadTrack(index);
      }
  });
}

async function loadTrack(index, shouldAutoplay = false) {

  resetProgressState();

  const newChapter = playlist.tracks[index].chapter;
  const totalChapters = playlist.tracks.length;
  
  // Calculate overall progress
  const tourProgress = Math.round((index / totalChapters) * 100);
  
  // Track chapter change
  window.dataLayer.push({
    'event': 'chapter_started',
    'tour_name': playlist.playlist_name,
    'chapter_number': newChapter,
    'chapter_title': playlist.tracks[index].title,
    'tour_progress_percent': tourProgress
  });

  // Track milestone completions
  if (tourProgress >= 25 && tourProgress < 30) {
    window.dataLayer.push({
      'event': 'tour_25percent',
      'tour_name': playlist.playlist_name,
      'current_chapter': newChapter
    });
  }
  if (tourProgress >= 50 && tourProgress < 55) {
    window.dataLayer.push({
      'event': 'tour_50percent',
      'tour_name': playlist.playlist_name,
      'current_chapter': newChapter
    });
  }
  if (tourProgress >= 75 && tourProgress < 80) {
    window.dataLayer.push({
      'event': 'tour_75percent',
      'tour_name': playlist.playlist_name,
      'current_chapter': newChapter
    });
  }
  
  const track = playlist.tracks[index];
  if (!track) return; // Safety check

  state.currentTrack = index;
  state.isPlaying = false;

  // Reset XR mode if switching tracks
  if (state.isXRMode) {
      await exitXRMode(); // Make sure we wait for exit to complete
  }

  elements.audioElement.src = track.audio_url;
  elements.albumArt.src = track.artwork_url;
  elements.trackTitle.textContent = `Chapter ${track.chapter}: ${track.title}`;
  elements.trackArtist.textContent = `${track.playlist}`;
  elements.duration.textContent = track.duration || '0:00';

// Show View 360° button only if track has XR content AND we're not in XR mode
const showXRButton = track.IsAR && track.XR_Scene && track.XR_Scene.trim() !== "";
elements.viewXRBtn.style.display = (showXRButton && !state.isXRMode) ? 'flex' : 'none';
elements.exitXRBtn.style.display = state.isXRMode ? 'flex' : 'none';


  // Wait for audio to be ready
  await new Promise((resolve) => {
      const onCanPlay = () => {
          elements.audioElement.removeEventListener('canplaythrough', onCanPlay);
          resolve();
      };
      elements.audioElement.addEventListener('canplaythrough', onCanPlay);
      elements.audioElement.load();
  });

  // Only autoplay if explicitly requested
  if (shouldAutoplay) {
      try {
          await elements.audioElement.play();
          state.isPlaying = true;
      } catch (error) {
          console.error('Autoplay blocked:', error);
          state.isPlaying = false;
      }
  }

  preloadAdjacentXRVideos(index).catch(console.error);

  updatePlayPauseButton();

}

function togglePlaylist() {
  elements.playlistContainer.classList.toggle('open');
  
  // Update menu button state
  if (elements.playlistContainer.classList.contains('open')) {
      elements.menuBtn.textContent = '✕';
      elements.menuBtn.style.fontSize = '1.5rem';
  } else {
      elements.menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
  }
}



/************************** DEVICE ORIENTATION ******************************* */



// Device orientation
function checkDeviceOrientation() {
  // Only show overlay on iOS Safari that supports the API
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  const hasRequestedBefore = localStorage.getItem('hasRequestedMotionPermissions');
  
  if (isIOS && 
      typeof DeviceOrientationEvent !== 'undefined' && 
      typeof DeviceOrientationEvent.requestPermission === 'function' && 
      !hasRequestedBefore) {
    elements.permissionOverlay.style.display = 'flex';
  } else {
    elements.permissionOverlay.style.display = 'none';
  }
}

function requestDeviceOrientation() {
  // This must be called directly from a click handler
  if (typeof DeviceOrientationEvent !== 'undefined' && 
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    
    DeviceOrientationEvent.requestPermission()
      .then(permissionState => {
        if (permissionState === 'granted') {
          localStorage.setItem('hasRequestedMotionPermissions', 'true');
          elements.permissionOverlay.style.display = 'none';
          
          // Also request motion permission if available
          if (typeof DeviceMotionEvent !== 'undefined' && 
              typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission();
          }
        }
      })
      .catch(console.error);
  } else {
    // Non-iOS or older browser
    localStorage.setItem('hasRequestedMotionPermissions', 'true');
    elements.permissionOverlay.style.display = 'none';
  }
}

function showPermissionFeedback(message) {
  // Remove any existing feedback first
  const existingFeedback = document.querySelector('.permission-feedback');
  if (existingFeedback) existingFeedback.remove();
  
  const feedback = document.createElement('div');
  feedback.className = 'permission-feedback';
  feedback.textContent = message;
  elements.permissionOverlay.appendChild(feedback);
  
  setTimeout(() => {
    feedback.style.opacity = '0';
    setTimeout(() => feedback.remove(), 500);
  }, 3000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePlayer);