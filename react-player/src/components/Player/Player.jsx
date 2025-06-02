// src/components/Player/Player.jsx
import React, { useState, useEffect, useRef } from 'react';
import PlayerControls from './PlayerControls';
import PlaylistMenu from './PlaylistMenu';
import './Player.css';

// Import playlist data
import playlistData from '../../data/playlist.json';

const Player = () => {
  // State management
  const [state, setState] = useState({
    isPlaying: false,
    currentTrack: 0,
    isXRMode: false,
    exitingXR: false,
    pendingMessages: [],
    iframeReady: false,
    hasOrientationPermission: false,
    orientationPermissionRequested: false,
    playbackSpeed: 1,
    currentPlaylist: 0,
    playlist: null,
    volume: 1,
    isMuted: false,
    videoElement: null,
    isVideoSynced: false,
    showPermissionOverlay: false,
    currentTime: 0,
    duration: 0,
    progress: 0
  });

  const [isPlaylistVisible, setIsPlaylistVisible] = useState(false);
  const audioRef = useRef(null);
  const playerRef = useRef(null);
  const iframeRef = useRef(null);

  // Initialize player with playlist data
  useEffect(() => {
    if (playlistData && playlistData.playlists && playlistData.playlists.length > 0) {
      const firstPlaylist = playlistData.playlists[0];
      console.log('Loading playlist:', firstPlaylist);
      
      // Set up the audio element first
      setupAudioElement();
      
      // Update state with playlist
      setState(prev => ({
        ...prev,
        playlist: firstPlaylist,
        currentPlaylist: 0,
        currentTrack: 0
      }));
    } else {
      console.error('No playlist data available');
    }
  }, []);

  // Handle track initialization after playlist is loaded
  useEffect(() => {
    if (state.playlist?.tracks && state.playlist.tracks.length > 0 && audioRef.current) {
      const firstTrack = state.playlist.tracks[0];
      console.log('Setting first track:', firstTrack);
      
      audioRef.current.src = firstTrack.audio_url;
      audioRef.current.load();
    }
  }, [state.playlist]);

  // Handle iframe messages
  useEffect(() => {
    const handleIframeMessage = (event) => {
      if (event.data.type === 'aframeReady') {
        console.log('A-Frame ready, syncing with audio time');
        setState(prev => ({ ...prev, iframeReady: true }));
        
        // Send any pending messages
        state.pendingMessages.forEach(msg => postMessageToIframe(msg));
        setState(prev => ({ ...prev, pendingMessages: [] }));

        // Sync with current audio time
        if (audioRef.current) {
          postMessageToIframe({
            action: 'setTime',
            time: audioRef.current.currentTime
          });
        }
      } else if (event.data.type === 'videoReady') {
        console.log('Video ready, syncing with audio time');
        if (audioRef.current) {
          postMessageToIframe({
            action: 'setTime',
            time: audioRef.current.currentTime
          });
          if (state.isPlaying) {
            postMessageToIframe({
              action: 'play',
              time: audioRef.current.currentTime
            });
          }
        } else if (event.data.type === 'currentTime') {
          console.log('Received video time:', event.data.time);
          if (state.exitingXR) {
            completeExitXRMode(event.data.time);
          }
        } else if (event.data.type === 'videoEnded') {
          console.log('Video ended, resetting audio');
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
          }
          playNextTrack();
        }
      }
    };

    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, [state.isPlaying, state.exitingXR]);

  const setupAudioElement = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      audioRef.current.addEventListener('ended', handleTrackEnd);
      audioRef.current.addEventListener('error', (e) => {
        console.error('Audio error:', e);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setState(prev => ({
        ...prev,
        currentTime: audioRef.current.currentTime,
        progress: (audioRef.current.currentTime / audioRef.current.duration) * 100
      }));
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      console.log('Audio metadata loaded:', {
        duration: audioRef.current.duration,
        currentTime: audioRef.current.currentTime
      });
      setState(prev => ({
        ...prev,
        duration: audioRef.current.duration
      }));
    }
  };

  const handleTrackEnd = () => {
    if (!state.playlist?.tracks) {
      console.error('No playlist tracks available');
      return;
    }

    if (state.currentTrack < state.playlist.tracks.length - 1) {
      setCurrentTrack(state.currentTrack + 1);
    } else {
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  };

  const setCurrentTrack = (index) => {
    if (!state.playlist?.tracks) {
      console.error('No playlist tracks available');
      return;
    }

    const track = state.playlist.tracks[index];
    if (!track) {
      console.error('Invalid track index:', index);
      return;
    }

    console.log('Setting current track:', track);
    
    // Update state with new track and set playing to true
    setState(prev => ({ 
      ...prev, 
      currentTrack: index,
      isPlaying: true 
    }));

    if (audioRef.current) {
      audioRef.current.src = track.audio_url;
      audioRef.current.load();
      // Autoplay the new track
      audioRef.current.play().catch(e => console.error('Error playing track:', e));
    }
  };

  const playNextTrack = () => {
    if (!state.playlist?.tracks) {
      console.error('No playlist tracks available');
      return;
    }

    if (state.currentTrack < state.playlist.tracks.length - 1) {
      setCurrentTrack(state.currentTrack + 1);
    }
  };

  const playPreviousTrack = () => {
    if (!state.playlist?.tracks) {
      console.error('No playlist tracks available');
      return;
    }

    if (state.currentTrack > 0) {
      setCurrentTrack(state.currentTrack - 1);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !state.playlist?.tracks) {
      console.error('Audio not initialized or no tracks available');
      return;
    }

    const newIsPlaying = !state.isPlaying;
    const currentTrack = state.playlist.tracks[state.currentTrack];
    
    if (newIsPlaying) {
      // Ensure we're at the right track before playing
      if (audioRef.current.src !== currentTrack.audio_url) {
        audioRef.current.src = currentTrack.audio_url;
        audioRef.current.load();
      }
      
      // Play audio
      audioRef.current.play().catch(e => console.error('Error playing audio:', e));
      
      // Sync video if in XR mode
      if (state.isXRMode) {
        postMessageToIframe({
          action: 'play',
          time: audioRef.current.currentTime
        });
      }
    } else {
      // Pause audio
      audioRef.current.pause();
      
      // Pause video if in XR mode
      if (state.isXRMode) {
        postMessageToIframe({ action: 'pause' });
      }
    }
    
    setState(prev => ({ ...prev, isPlaying: newIsPlaying }));
  };

  const toggleXR = () => {
    const currentTrack = state.playlist.tracks[state.currentTrack];
    if (currentTrack.IsAR && currentTrack.XR_Scene) {
      if (state.isXRMode) {
        exitXRMode();
      } else {
        enterXRMode();
      }
    }
  };

  const requestOrientationPermission = async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        setState(prev => ({
          ...prev,
          hasOrientationPermission: permission === 'granted',
          orientationPermissionRequested: true
        }));
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting device orientation permission:', error);
        return false;
      }
    }
    // If the API is not available, assume permission is granted
    setState(prev => ({
      ...prev,
      hasOrientationPermission: true,
      orientationPermissionRequested: true
    }));
    return true;
  };

  const enterXRMode = async () => {
    const currentTrack = state.playlist.tracks[state.currentTrack];
    if (!currentTrack.IsAR || !currentTrack.XR_Scene) return;

    // Request orientation permission if not already granted
    if (!state.hasOrientationPermission && !state.orientationPermissionRequested) {
      const granted = await requestOrientationPermission();
      if (!granted) {
        // Show a message to the user about enabling orientation
        alert('Please enable device orientation access to experience the 360° view. You can enable this in your device settings.');
        return;
      }
    }

    // Get current audio time before entering XR mode
    const currentTime = audioRef.current?.currentTime || 0;
    console.log('Entering XR mode at time:', currentTime);

    setState(prev => ({
      ...prev,
      isXRMode: true,
      exitingXR: false
    }));

    // Setup XR scene with current time
    setupXRScene(currentTrack.XR_Scene, currentTime);
  };

  const exitXRMode = () => {
    if (!state.isXRMode) return;

    console.log('Exiting XR mode');
    
    // First pause the video and get its current time
    postMessageToIframe({ action: 'pause' });
    postMessageToIframe({ action: 'getCurrentTime' });

    setState(prev => ({
      ...prev,
      isXRMode: false,
      exitingXR: true
    }));

    // Fallback timeout in case we don't get the time response
    setTimeout(() => {
      if (state.exitingXR) {
        console.log('Fallback: completing XR exit');
        completeExitXRMode(0);
      }
    }, 1000);
  };

  const completeExitXRMode = (videoTime) => {
    console.log('Completing XR exit, syncing time:', videoTime);
    
    if (audioRef.current) {
      // Ensure we're on the correct track
      const currentTrack = state.playlist.tracks[state.currentTrack];
      if (audioRef.current.src !== currentTrack.audio_url) {
        audioRef.current.src = currentTrack.audio_url;
        audioRef.current.load();
      }

      // Set the audio time to match the video time
      audioRef.current.currentTime = videoTime;
      
      // Resume audio playback if it was playing
      if (state.isPlaying) {
        audioRef.current.play().catch(e => console.error('Error resuming audio:', e));
      }
    }

    setState(prev => ({
      ...prev,
      exitingXR: false,
      isXRMode: false
    }));

    // Remove XR content container
    const xrContent = document.getElementById('xrContent');
    if (xrContent) {
      xrContent.remove();
    }
  };

  const setupXRScene = (videoUrl, startTime = 0) => {
    console.log('Setting up XR scene with video URL:', videoUrl, 'start time:', startTime);
    
    // Create or get the XR content container
    let xrContent = document.getElementById('xrContent');
    if (!xrContent) {
      xrContent = document.createElement('div');
      xrContent.id = 'xrContent';
      xrContent.className = 'xr-content';
      document.body.appendChild(xrContent);
    }

    const iframe = document.createElement('iframe');
    iframe.className = 'video-frame';
    iframe.allowFullscreen = true;
    iframe.srcdoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <title>360 Video</title>
        <script src="https://aframe.io/releases/1.7.1/aframe.min.js"></script>
        <style>
          body { margin: 0; overflow: hidden; }
          .a-canvas { background: #000 !important; }
          .a-loader-title, .a-enter-vr-button, .a-loader { display: none !important; }
          .orientation-message {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            z-index: 9999;
            display: none;
          }
        </style>
      </head>
      <body>
        <div id="orientationMessage" class="orientation-message">
          Please enable device orientation access to experience the 360° view
        </div>
        <a-scene device-orientation-permission-ui="enabled: true"
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
            <a-camera look-controls="pointerLockEnabled: false;
                                  reverseMouseDrag: false;
                                  touchEnabled: true;
                                  magicWindowTrackingEnabled: true">
            </a-camera>
            <a-cursor></a-cursor>
          </a-entity>

          <script>
            const video = document.getElementById('xrVideo');
            const orientationMessage = document.getElementById('orientationMessage');
            console.log('Video element created:', video);
            
            // Check device orientation support
            function checkOrientationSupport() {
              if (typeof DeviceOrientationEvent === 'undefined') {
                console.log('Device orientation not supported');
                return false;
              }
              return true;
            }

            // Handle orientation permission
            function handleOrientationPermission() {
              if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                DeviceOrientationEvent.requestPermission()
                  .then(permission => {
                    if (permission === 'granted') {
                      orientationMessage.style.display = 'none';
                    } else {
                      orientationMessage.style.display = 'block';
                    }
                  })
                  .catch(console.error);
              } else {
                // If the API is not available, assume permission is granted
                orientationMessage.style.display = 'none';
              }
            }

            // Check orientation support and request permission
            if (checkOrientationSupport()) {
              handleOrientationPermission();
            }
            
            function syncVideo(time) {
              if (Math.abs(video.currentTime - time) > 0.1) {
                console.log('Syncing video time:', time);
                video.currentTime = time;
              }
            }

            function notifyReady() {
              console.log('Notifying parent that A-Frame is ready');
              window.parent.postMessage({ type: 'aframeReady' }, '*');
            }

            video.addEventListener('loadedmetadata', function() {
              console.log('Video metadata loaded');
              notifyReady();
              // Set initial time
              syncVideo(${startTime});
              video.play().catch(e => console.error('Video play error:', e));
            });

            video.addEventListener('error', function(e) {
              console.error('Video error:', e);
              window.parent.postMessage({ 
                type: 'videoError',
                error: e.target.error
              }, '*');
            });

            video.addEventListener('ended', () => {
              console.log('Video ended');
              window.parent.postMessage({ type: 'videoEnded' }, '*');
            });
            
            window.addEventListener('message', (event) => {
              if (!video) return;
              
              switch(event.data.action) {
                case 'play':
                  console.log('Play command received');
                  syncVideo(event.data.time || 0);
                  video.play().catch(e => console.error('Video play error:', e));
                  break;
                case 'pause':
                  console.log('Pause command received');
                  video.pause();
                  break;
                case 'setTime':
                  console.log('Set time command received:', event.data.time);
                  syncVideo(event.data.time);
                  break;
                case 'getCurrentTime':
                  console.log('Sending current time:', video.currentTime);
                  window.parent.postMessage({
                    type: 'currentTime',
                    time: video.currentTime
                  }, '*');
                  break;
              }
            });

            if (video.readyState > 3) {
              console.log('Video already loaded');
              notifyReady();
              syncVideo(${startTime});
            }
          </script>
        </a-scene>
      </body>
      </html>
    `;

    xrContent.innerHTML = '';
    xrContent.appendChild(iframe);
    iframeRef.current = iframe;
    
    // Add error handling for iframe loading
    iframe.onload = () => {
      console.log('XR iframe loaded');
    };
    
    iframe.onerror = (error) => {
      console.error('XR iframe error:', error);
    };
  };

  const postMessageToIframe = (message) => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow.postMessage(message, '*');
    } else {
      setState(prev => ({
        ...prev,
        pendingMessages: [...prev.pendingMessages, message]
      }));
    }
  };

  const handleSeek = (event) => {
    if (!audioRef.current || !state.playlist?.tracks) return;

    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickPosition = (event.clientX - rect.left) / rect.width;
    const newTime = clickPosition * audioRef.current.duration;

    // Update audio position
    audioRef.current.currentTime = newTime;

    // If in XR mode, sync video position
    if (state.isXRMode) {
      postMessageToIframe({
        action: 'setTime',
        time: newTime
      });
    }

    // Update state
    setState(prev => ({
      ...prev,
      currentTime: newTime,
      progress: clickPosition * 100
    }));
  };

  const currentTrack = state.playlist?.tracks[state.currentTrack];

  return (
    <div className="player-container" ref={playerRef}>
      <div className="player-content">
        {state.isXRMode && currentTrack?.IsAR ? (
          <div id="xrContent" className="xr-content">
            {/* XR iframe will be inserted here */}
          </div>
        ) : (
          <div className="audio-content">
            <div className="artwork-container">
              <img
                src={currentTrack?.artwork_url}
                alt={currentTrack?.title}
                className="artwork-image"
              />
            </div>
            <div className="track-info">
              <h2 className="playlist-name">{state.playlist?.playlist_name}</h2>
              <h3 className="chapter-title">{currentTrack?.title}</h3>
            </div>
          </div>
        )}
        
        <div className="player-overlay">
          <PlayerControls
            state={state}
            onPlayPause={togglePlay}
            onNext={playNextTrack}
            onPrevious={playPreviousTrack}
            onToggleXR={toggleXR}
            onTogglePlaylist={() => setIsPlaylistVisible(!isPlaylistVisible)}
            onSeek={handleSeek}
          />
        </div>
      </div>

      <PlaylistMenu
        isVisible={isPlaylistVisible}
        playlist={state.playlist}
        currentTrack={state.currentTrack}
        onTrackSelect={setCurrentTrack}
        onClose={() => setIsPlaylistVisible(false)}
      />
    </div>
  );
};

export default Player;