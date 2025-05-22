import React, { useEffect } from 'react';
import './PlaylistMenu.css';

const PlaylistMenu = ({ 
  playlists, 
  currentTrack, 
  currentPlaylist,
  onTrackSelect,
  onPlaylistSelect,
  isVisible 
}) => {
  useEffect(() => {
    console.log('PlaylistMenu props:', {
      playlists,
      currentTrack,
      currentPlaylist,
      isVisible
    });
  }, [playlists, currentTrack, currentPlaylist, isVisible]);

  if (!playlists || playlists.length === 0) {
    console.warn('No playlists available');
    return null;
  }

  const currentPlaylistData = playlists[currentPlaylist];
  if (!currentPlaylistData || !currentPlaylistData.tracks) {
    console.warn('No tracks available in current playlist');
    return null;
  }

  console.log('Current playlist data:', currentPlaylistData);

  return (
    <div className={`playlist-menu ${!isVisible ? 'hidden' : ''}`}>
      <div className="playlist-menu-content">
        <div className="playlist-selector">
          {playlists.map((playlist, index) => (
            <button
              key={playlist.playlist_name}
              className={`playlist-tab ${index === currentPlaylist ? 'active' : ''}`}
              onClick={() => onPlaylistSelect(index)}
            >
              {playlist.playlist_name}
            </button>
          ))}
        </div>

        <div className="tracks-list">
          {currentPlaylistData.tracks.map((track, index) => (
            <button
              key={`${track.chapter}-${track.title}`}
              className={`track-item ${index === currentTrack ? 'active' : ''}`}
              onClick={() => onTrackSelect(index)}
            >
              <div className="track-info">
                <span className="track-title">
                  {track.chapter}. {track.title}
                  {track.IsAR && (
                    <span className="ar-icon" title="360° View Available">
                      <i className="fas fa-360-degrees"></i>
                    </span>
                  )}
                </span>
              </div>
              <span className="track-duration">{track.duration}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlaylistMenu; 