import React from 'react';
import DownloadButton from '../UI/DownloadButton';
import './PlayerControls.css';

const PlayerControls = ({
  state,
  onPlayPause,
  onVolumeChange,
  onToggleMute,
  onSeek,
  onNext,
  onPrevious,
  onPlaybackSpeedChange,
  onCyclePlaybackSpeed,
  onToggleXR,
  onTogglePlaylist
}) => {
  const currentTrack = state.playlist?.tracks[state.currentTrack];
  const isPlaying = state.isPlaying;
  const isXRMode = state.isXRMode;
  const volume = state.volume;
  const isMuted = state.isMuted;
  const playbackSpeed = state.playbackSpeed;
  const showXRButton = currentTrack?.IsAR === true;

  const formatTime = (seconds) => {
    if (typeof seconds === 'string') {
      if (seconds.match(/^\d+:\d{2}$/)) return seconds;
      seconds = parseFloat(seconds);
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    onVolumeChange(newVolume);
  };

  const handleSpeedClick = () => {
    onCyclePlaybackSpeed();
  };

  return (
    <>
      {/* Download Button - Upper Right */}
      <div className="download-button-wrapper">
        <DownloadButton />
      </div>

      {showXRButton && (
        <button 
          className="xr-mode-btn"
          onClick={onToggleXR}
          aria-label={isXRMode ? 'Exit XR mode' : 'Enter XR mode'}
        >
          {isXRMode ? 'Exit 360' : 'View 360'}
        </button>
      )}
      <div className="player-controls">
        {/* Main Controls */}
        <div className="main-controls">
          <button 
            className="control-btn menu-btn"
            onClick={onTogglePlaylist}
            aria-label="Toggle playlist"
          >
            <i className="fas fa-bars"></i>
          </button>

          <div className="playback-controls">
            <button 
              className="control-btn prev-btn"
              onClick={onPrevious}
              aria-label="Previous track"
            >
              <i className="fas fa-step-backward"></i>
            </button>

            <button 
              className="control-btn play-pause-btn"
              onClick={onPlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              <i className={`fas fa-${isPlaying ? 'pause' : 'play'}`}></i>
            </button>

            <button 
              className="control-btn next-btn"
              onClick={onNext}
              aria-label="Next track"
            >
              <i className="fas fa-step-forward"></i>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-container">
          <span className="time current-time">
            {formatTime(state.currentTime || 0)}
          </span>
          <div 
            className="progress-bar"
            onClick={onSeek}
          >
            <div 
              className="progress"
              style={{ width: `${state.progress || 0}%` }}
            />
          </div>
          <span className="time duration">
            {formatTime(state.duration || 0)}
          </span>
        </div>

        {/* Volume Controls */}
        <div className="volume-controls">
          <button 
            className="control-btn volume-btn"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            <i className={`fas fa-volume-${isMuted ? 'mute' : volume > 0.5 ? 'up' : volume > 0 ? 'down' : 'mute'}`}></i>
          </button>
          <input
            type="range"
            className="volume-slider"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            aria-label="Volume control"
          />
        </div>

        {/* Additional Controls */}
        <div className="additional-controls">
          <button 
            className="control-btn speed-btn"
            onClick={handleSpeedClick}
            aria-label="Change playback speed"
            title={`Current speed: ${playbackSpeed}x`}
          >
            {playbackSpeed}x
          </button>
        </div>
      </div>
    </>
  );
};

export default PlayerControls; 