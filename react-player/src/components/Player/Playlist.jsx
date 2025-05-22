import React, { forwardRef } from 'react';
import './Playlist.css';

const Playlist = forwardRef(({ tracks, currentTrack, onTrackSelect }, ref) => {
  return (
    <div className="playlist-container" ref={ref}>
      <div className="playlist-header">
        <h3>Playlist</h3>
        <button className="close-btn">
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <div className="playlist-tracks">
        {tracks?.map((track, index) => (
          <div
            key={index}
            className={`playlist-track ${index === currentTrack ? 'active' : ''}`}
            onClick={() => onTrackSelect(index)}
          >
            <div className="track-info">
              <p>{track.chapter}. {track.title}</p>
            </div>
            {track.IsAR && track.XR_Scene && (
              <span className="xr-badge">360°</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

Playlist.displayName = 'Playlist';

export default Playlist;
