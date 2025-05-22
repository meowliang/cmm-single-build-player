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
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setState(prev => ({
        ...prev,
        currentTime: audioRef.current.currentTime,
        progress
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
    if (state.currentTrack < state.playlist?.tracks?.length - 1) {
      handleNext();
    } else {
      setState(prev => ({
        ...prev,
        isPlaying: false,
        currentTime: 0,
        progress: 0
      }));
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (state.isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setState(prev => ({
        ...prev,
        isPlaying: !prev.isPlaying
      }));
    }
  };

  const handleVolumeChange = (value) => {
    if (audioRef.current) {
      const volume = parseFloat(value);
      audioRef.current.volume = volume;
      setState(prev => ({
        ...prev,
        volume,
        isMuted: volume === 0
      }));
    }
  };

  const handleMute = () => {
    if (audioRef.current) {
      const isMuted = !state.isMuted;
      audioRef.current.muted = isMuted;
      setState(prev => ({
        ...prev,
        isMuted
      }));
    }
  };

  const handleSeek = (e) => {
    if (audioRef.current) {
      const progressBar = e.currentTarget;
      const clickPosition = (e.clientX - progressBar.getBoundingClientRect().left) / progressBar.offsetWidth;
      const newTime = clickPosition * audioRef.current.duration;
      audioRef.current.currentTime = newTime;
      setState(prev => ({
        ...prev,
        currentTime: newTime,
        progress: clickPosition * 100
      }));
    }
  };

  const handleNext = () => {
    if (state.currentTrack < state.playlist?.tracks?.length - 1) {
      const nextTrack = state.currentTrack + 1;
      loadTrack(nextTrack);
    }
  };

  const handlePrevious = () => {
    if (state.currentTrack > 0) {
      const prevTrack = state.currentTrack - 1;
      loadTrack(prevTrack);
    }
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 1, 1.5, 2];
    const currentIndex = speeds.indexOf(state.playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];

    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }

    setState(prev => ({
      ...prev,
      playbackSpeed: newSpeed
    }));
  };

  const handleToggleXR = () => {
    setState(prev => ({
      ...prev,
      isXRMode: !prev.isXRMode
    }));
  };

  const togglePlaylist = () => {
    console.log('Toggling playlist visibility. Current state:', isPlaylistVisible);
    setIsPlaylistVisible(prev => {
      const newState = !prev;
      console.log('New playlist visibility state:', newState);
      return newState;
    });
  };

  const handleTrackSelect = (trackIndex) => {
    loadTrack(trackIndex);
    setIsPlaylistVisible(false);
  };

  const handlePlaylistSelect = (playlistIndex) => {
    setState(prev => ({
      ...prev,
      currentPlaylist: playlistIndex,
      currentTrack: 0,
      playlist: playlistData.playlists[playlistIndex]
    }));
    loadTrack(0);
  };

  const loadTrack = (trackIndex) => {
    const track = state.playlist?.tracks[trackIndex];
    if (audioRef.current && track) {
      audioRef.current.src = track.audio_url;
      audioRef.current.load();
      if (state.isPlaying) {
        audioRef.current.play();
      }
      setState(prev => ({
        ...prev,
        currentTrack: trackIndex
      }));
    }
  };

  const currentTrack = state.playlist?.tracks[state.currentTrack];

  return (
    <div className="player" ref={playerRef}>
      <div className="player-container">
        <div className="player-content">
          {state.isXRMode ? (
            <div className="xr-content">
              {/* XR content */}
            </div>
          ) : (
            <div className="audio-content">
              {currentTrack && (
                <>
                  <div className="artwork-container">
                    <img 
                      src={currentTrack.artwork_url} 
                      alt={currentTrack.title}
                      className="artwork-image"
                    />
                  </div>
                  <div className="track-info">
                    <h2 className="playlist-name">{state.playlist?.playlist_name}</h2>
                    <p className="chapter-title">
                      Chapter {currentTrack.chapter}: {currentTrack.title}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="controls-container">
            <PlaylistMenu
              playlists={playlistData.playlists}
              currentTrack={state.currentTrack}
              currentPlaylist={state.currentPlaylist}
              onTrackSelect={handleTrackSelect}
              onPlaylistSelect={handlePlaylistSelect}
              isVisible={isPlaylistVisible}
            />
            <PlayerControls
              state={state}
              onPlayPause={handlePlayPause}
              onVolumeChange={handleVolumeChange}
              onMute={handleMute}
              onSeek={handleSeek}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onSpeedChange={handleSpeedChange}
              onToggleXR={handleToggleXR}
              onTogglePlaylist={togglePlaylist}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Player;