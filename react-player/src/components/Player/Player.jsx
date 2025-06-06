// src/components/Player/Player.jsx
import React, { useState, useEffect, useRef } from 'react';
import PlayerControls from './PlayerControls';
import PlaylistMenu from './PlaylistMenu';
import PermissionOverlay from '../UI/PermissionOverlay';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';
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

  const { 
    hasPermission, 
    showPermissionOverlay, 
    requestPermission, 
    skipPermission,
    error 
  } = useDeviceOrientation();

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
  }, []);

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

  const handleTrackChange = (newTrackIndex) => {
    const newTrack = state.playlist.tracks[newTrackIndex];
    
    // If we're in XR mode, exit it first
    if (state.isXRMode) {
      // Force exit XR mode immediately
      setState(prev => ({
        ...prev,
        isXRMode: false,
        exitingXR: false
      }));
      
      // Remove XR content container and iframe
      const xrContent = document.getElementById('xrContent');
      if (xrContent) {
        // Remove all child elements (including iframe)
        while (xrContent.firstChild) {
          xrContent.removeChild(xrContent.firstChild);
        }
        // Remove the container itself
        xrContent.remove();
      }
      
      // Clear iframe reference
      iframeRef.current = null;
    }
    
    // Update current track
    setState(prev => ({
      ...prev,
      currentTrack: newTrackIndex
    }));
  };

  const playNextTrack = async () => {
    if (!state.playlist?.tracks) return;

    try {
      // Exit XR mode if currently in it
      if (state.isXRMode) {
        await exitXRMode();
      }

      const nextTrackIndex = (state.currentTrack + 1) % state.playlist.tracks.length;
      
      // Update current track
      setState(prev => ({
        ...prev,
        currentTrack: nextTrackIndex
      }));
      
      // Load and play the new track
      if (audioRef.current) {
        const nextTrack = state.playlist.tracks[nextTrackIndex];
        audioRef.current.src = nextTrack.audio_url;
        audioRef.current.load();
        // Ensure we start from beginning
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
        
        // Update playing state
        setState(prev => ({
          ...prev,
          isPlaying: true
        }));
      }
    } catch (error) {
      console.error('Error playing next track:', error);
      setState(prev => ({
        ...prev,
        isPlaying: false
      }));
    }
  };

  const playPreviousTrack = async () => {
    if (!state.playlist?.tracks) return;

    // If we're more than 3 seconds into the track, restart it instead
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    try {
      // Exit XR mode if currently in it
      if (state.isXRMode) {
        await exitXRMode();
      }

      const prevTrackIndex = (state.currentTrack - 1 + state.playlist.tracks.length) % state.playlist.tracks.length;
      
      // Update current track
      setState(prev => ({
        ...prev,
        currentTrack: prevTrackIndex
      }));
      
      // Load and play the new track
      if (audioRef.current) {
        const prevTrack = state.playlist.tracks[prevTrackIndex];
        audioRef.current.src = prevTrack.audio_url;
        audioRef.current.load();
        await audioRef.current.play();
        
        // Update playing state
        setState(prev => ({
          ...prev,
          isPlaying: true
        }));
      }
    } catch (error) {
      console.error('Error playing previous track:', error);
      setState(prev => ({
        ...prev,
        isPlaying: false
      }));
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

  const toggleXR = async () => {
    const currentTrack = state.playlist.tracks[state.currentTrack];
    if (currentTrack.IsAR && currentTrack.XR_Scene) {
      if (state.isXRMode) {
        await exitXRMode();
      } else {
        await enterXRMode();
      }
    }
  };

  const enterXRMode = async () => {
    const currentTrack = state.playlist.tracks[state.currentTrack];
    if (!currentTrack.IsAR || !currentTrack.XR_Scene) {
      console.warn("No XR content available");
      return;
    }

    // Check for device orientation permission on iOS
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        console.warn("Device orientation permission not granted");
        return;
      }
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
      setState(prev => ({
        ...prev,
        isXRMode: true,
        exitingXR: false
      }));

      // Store playback state
      const wasPlaying = state.isPlaying;
      const currentTime = audioRef.current?.currentTime || 0;

      // Setup XR scene with callback when loaded
      setupXRScene(currentTrack.XR_Scene, () => {
        // When scene is loaded, remove loading overlay
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(loadingOverlay);
        }, 500);

        // Sync with audio player
        postMessageToIframe({
          action: 'setTime',
          time: currentTime
        });

        // Restore playback if needed
        if (wasPlaying) {
          setTimeout(() => {
            postMessageToIframe({
              action: 'play',
              time: currentTime
            });
          }, 500);
        }
      });
    } catch (error) {
      console.error('Error entering XR mode:', error);
      document.body.removeChild(loadingOverlay);
      setState(prev => ({
        ...prev,
        isXRMode: false,
        exitingXR: false
      }));
    }
  };

  const exitXRMode = async () => {
    if (!state.isXRMode) return;

    console.log('Exiting XR mode');
    
    // First pause the video
    postMessageToIframe({ action: 'pause' });
    
    // Update state immediately
    setState(prev => ({
      ...prev,
      isXRMode: false,
      exitingXR: true
    }));
    
    // Get current time from iframe
    postMessageToIframe({ action: 'getCurrentTime' });
    
    // Clean up XR content immediately
    const xrContent = document.getElementById('xrContent');
    if (xrContent) {
      xrContent.innerHTML = '';
    }
    
    // Clear iframe reference
    iframeRef.current = null;
    
    // Set a timeout fallback
    setTimeout(() => {
      if (state.exitingXR) {
        console.log('Fallback: completing XR exit');
        completeExitXRMode(0);
      }
    }, 1000);
  };

  const completeExitXRMode = (videoTime) => {
    console.log('Completing XR exit with time:', videoTime);
    
    // Update state
    setState(prev => ({
      ...prev,
      exitingXR: false,
      isXRMode: false
    }));

    // Clean up iframe
    const xrContent = document.getElementById('xrContent');
    if (xrContent) {
      xrContent.innerHTML = '';
      xrContent.style.display = 'none';
    }

    // Show audio content
    const audioContent = document.querySelector('.audio-content');
    if (audioContent) {
      audioContent.style.display = 'flex';
    }

    // Check if we're at the end of the track
    const atEnd = videoTime >= (audioRef.current?.duration - 0.5); // 0.5 second threshold

    // Reset to beginning if at end or if this was triggered by video ended
    const newTime = atEnd ? 0 : videoTime;
    
    if (audioRef.current) {
      if (!atEnd) {
        audioRef.current.currentTime = videoTime;
        if (state.isPlaying) {
          audioRef.current.play().catch(console.error);
        }
      } else {
        // At end - ensure paused state
        audioRef.current.currentTime = 0;
        setState(prev => ({ ...prev, isPlaying: false }));
      }
    }
  };

  const setupXRScene = (videoUrl, onReadyCallback) => {
    // Create or get the XR content container
    let xrContent = document.getElementById('xrContent');
    if (!xrContent) {
      xrContent = document.createElement('div');
      xrContent.id = 'xrContent';
      xrContent.className = 'xr-content';
      document.body.appendChild(xrContent);
    }

    // Clear previous iframe
    xrContent.innerHTML = '';
    
    // Create new iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'videoFrame';
    iframe.className = 'video-frame';
    iframe.allowFullscreen = true;
    xrContent.appendChild(iframe);

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
    
    // Set up iframe content
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

            function syncVideo(time) {
              if (Math.abs(video.currentTime - time) > 0.1) {
                video.currentTime = time;
              }
            }

            function notifyReady() {
              window.parent.postMessage({ 
                type: 'aframeReady'
              }, '*');
            }

            video.addEventListener('loadedmetadata', function() {
              notifyReady();
            });

            video.addEventListener('ended', () => {
              window.parent.postMessage({
                type: 'videoEnded'
              }, '*');
            });
            
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
      setState(prev => ({ ...prev, iframeReady: true }));
      if (onReadyCallback) onReadyCallback();
    };
    
    iframeRef.current = iframe;
  };

  const postMessageToIframe = (message) => {
    if (!state.iframeReady) {
      setState(prev => ({
        ...prev,
        pendingMessages: [...prev.pendingMessages, message]
      }));
      return;
    }
    if (iframeRef.current) {
      iframeRef.current.contentWindow.postMessage(message, '*');
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
      {showPermissionOverlay && (
        <PermissionOverlay
          onEnableMotion={requestPermission}
          onSkip={skipPermission}
          error={error}
        />
      )}
      <div className="player-content">
        <div id="xrContent" className={`xr-content ${state.isXRMode ? 'active' : ''}`}>
          {/* XR iframe will be inserted here */}
        </div>
        <div className={`audio-content ${state.isXRMode ? '' : 'active'}`}>
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