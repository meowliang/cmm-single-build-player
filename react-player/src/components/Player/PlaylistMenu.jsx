import React from 'react';
import './PlaylistMenu.css';

const PlaylistMenu = ({ 
  playlist, 
  currentTrack, 
  onTrackSelect,
  isVisible,
  onClose
}) => {
  if (!playlist || !playlist.tracks) {
    console.warn('No playlist data available');
    return null;
  }

  return (
    <div className={`playlist-menu ${isVisible ? 'visible' : ''}`}>
      <div className="playlist-menu-content">
        <div className="playlist-header">
          <h3>{playlist.playlist_name}</h3>
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="tracks-list">
          {playlist.tracks.map((track, index) => (
            <button
              key={`${track.chapter}-${track.title}`}
              className={`track-item ${index === currentTrack ? 'active' : ''}`}
              onClick={() => onTrackSelect(index)}
            >
              <div className="track-info">
                <span className="track-title">
                  {track.chapter}. {track.title}
                  {track.IsAR && track.XR_Scene && (
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