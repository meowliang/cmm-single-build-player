'use client';

import { useState, useEffect } from 'react';
import { usePlaylists } from '../../hooks/usePlaylists';
import PlaylistMenu from './PlaylistMenu';
import PlayerControls from './PlayerControls';
import './Player.css';

const Player = () => {
  const { playlists, isLoading, isError } = usePlaylists();
  const [currentPlaylist, setCurrentPlaylist] = useState(0);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isXRMode, setIsXRMode] = useState(false);

  useEffect(() => {
    if (playlists.length > 0) {
      console.log('Loaded playlists:', playlists);
    }
  }, [playlists]);

  if (isLoading) return <div>Loading player...</div>;
  if (isError) return <div>Error loading playlists</div>;
  if (!playlists.length) return <div>No playlists available</div>;

  const currentPlaylistData = playlists[currentPlaylist];
  const currentTrackData = currentPlaylistData.tracks[currentTrack];

  const handleTrackSelect = (index: number) => {
    setCurrentTrack(index);
    setIsPlaying(true);
  };

  const handlePlaylistSelect = (index: number) => {
    setCurrentPlaylist(index);
    setCurrentTrack(0);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMenu = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const toggleXR = () => {
    if (currentTrackData.IsAR) {
      setIsXRMode(!isXRMode);
    }
  };

  return (
    <div className="player-container">
      <div className="player-content">
        {isXRMode && currentTrackData.IsAR ? (
          <div className="xr-container">
            <video
              src={currentTrackData.XR_Scene}
              autoPlay
              loop
              playsInline
              className="xr-video"
            />
          </div>
        ) : (
          <div className="artwork-container">
            <img
              src={currentTrackData.artwork_url}
              alt={currentTrackData.title}
              className="artwork-image"
            />
          </div>
        )}
        
        <PlayerControls
          isPlaying={isPlaying}
          onPlayPause={togglePlay}
          onMenuToggle={toggleMenu}
          onXRToggle={toggleXR}
          hasXR={currentTrackData.IsAR}
          isXRMode={isXRMode}
        />
      </div>

      <PlaylistMenu
        playlists={playlists}
        currentTrack={currentTrack}
        currentPlaylist={currentPlaylist}
        onTrackSelect={handleTrackSelect}
        onPlaylistSelect={handlePlaylistSelect}
        isVisible={isMenuVisible}
      />

      <audio
        src={currentTrackData.audio_url}
        autoPlay={isPlaying}
        onEnded={() => {
          if (currentTrack < currentPlaylistData.tracks.length - 1) {
            setCurrentTrack(currentTrack + 1);
          } else {
            setIsPlaying(false);
          }
        }}
      />
    </div>
  );
};

export default Player; 