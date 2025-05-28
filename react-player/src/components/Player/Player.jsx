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
    showPermissionOverlay: false,
    currentTime: 0,
    duration: 0,
    progress: 0,
    playbackSpeed: 1,
    currentPlaylist: 0,
    playlist: null
  });

  const [isPlaylistVisible, setIsPlaylistVisible] = useState(false);
  const audioRef = useRef(null);
  const playerRef = useRef(null);
  const iframeRef = useRef(null);

  // Initialize player with playlist data
  useEffect(() => {
    try {
      if (playlistData && playlistData.playlists && playlistData.playlists.length > 0) {
        setState(prev => ({
          ...prev,
          playlist: playlistData.playlists[0],
          currentPlaylist: 0
        }));
        setupAudioElement();
      } else {
        console.error('No playlist data available');
      }
    } catch (error) {
      console.error('Error loading playlist data:', error);
    }
  }, []);

  // Handle iframe messages
  useEffect(() => {
    const handleIframeMessage = (event) => {
      if (event.data.type === 'aframeReady') {
        setState(prev => ({ ...prev, iframeReady: true }));
        state.pendingMessages.forEach(msg => postMessageToIframe(msg));
        setState(prev => ({ ...prev, pendingMessages: [] }));
      } else if (event.data.type === 'videoReady') {
        postMessageToIframe({
          action: 'setTime',
          time: audioRef.current?.currentTime || 0
        });
        if (state.isPlaying) {
          postMessageToIframe({
            action: 'play',
            time: audioRef.current?.currentTime || 0
          });
        }
      } else if (event.data.type === 'currentTime') {
        if (state.exitingXR) {
          completeExitXRMode(event.data.time);
        }
      } else if (event.data.type === 'videoEnded') {
        audioRef.current.currentTime = 0;
        playNextTrack();
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
      setState(prev => ({
        ...prev,
        duration: audioRef.current.duration
      }));
    }
  };

  const handleTrackEnd = () => {
    if (state.currentTrack < state.playlist.tracks.length - 1) {
      setCurrentTrack(state.currentTrack + 1);
    } else {
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  };

  const setCurrentTrack = (index) => {
    setState(prev => ({ ...prev, currentTrack: index }));
    if (audioRef.current) {
      audioRef.current.src = state.playlist.tracks[index].audio_url;
      audioRef.current.load();
      if (state.isPlaying) {
        audioRef.current.play();
      }
    }
  };

  const playNextTrack = () => {
    if (state.currentTrack < state.playlist.tracks.length - 1) {
      setCurrentTrack(state.currentTrack + 1);
    }
  };

  const playPreviousTrack = () => {
    if (state.currentTrack > 0) {
      setCurrentTrack(state.currentTrack - 1);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (state.isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    }
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

  const enterXRMode = () => {
    const currentTrack = state.playlist.tracks[state.currentTrack];
    if (!currentTrack.IsAR || !currentTrack.XR_Scene) return;

    setState(prev => ({
      ...prev,
      isXRMode: true,
      exitingXR: false
    }));

    // Setup XR scene
    setupXRScene(currentTrack.XR_Scene);
  };

  const exitXRMode = () => {
    if (!state.isXRMode) return;

    setState(prev => ({
      ...prev,
      isXRMode: false,
      exitingXR: true
    }));

    postMessageToIframe({ action: 'getCurrentTime' });

    // Fallback timeout
    setTimeout(() => {
      if (state.exitingXR) {
        completeExitXRMode(0);
      }
    }, 1000);
  };

  const completeExitXRMode = (videoTime) => {
    setState(prev => ({
      ...prev,
      exitingXR: false,
      isXRMode: false
    }));

    if (audioRef.current) {
      const atEnd = videoTime >= (audioRef.current.duration - 0.5);
      audioRef.current.currentTime = atEnd ? 0 : videoTime;
      
      if (!atEnd && state.isPlaying) {
        audioRef.current.play();
      }
    }
  };

  const setupXRScene = (videoUrl) => {
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
            <a-camera look-controls="pointerLockEnabled: false;
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
              window.parent.postMessage({ type: 'aframeReady' }, '*');
            }

            video.addEventListener('loadedmetadata', function() {
              notifyReady();
            });

            video.addEventListener('ended', () => {
              window.parent.postMessage({ type: 'videoEnded' }, '*');
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

    const xrContent = document.getElementById('xrContent');
    if (xrContent) {
      xrContent.innerHTML = '';
      xrContent.appendChild(iframe);
      iframeRef.current = iframe;
    }
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
        
        <PlayerControls
          state={state}
          onPlayPause={togglePlay}
          onNext={playNextTrack}
          onPrevious={playPreviousTrack}
          onToggleXR={toggleXR}
          onTogglePlaylist={() => setIsPlaylistVisible(!isPlaylistVisible)}
        />
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