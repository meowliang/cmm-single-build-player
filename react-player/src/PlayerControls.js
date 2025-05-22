// src/components/Player/PlayerControls.jsx
import React from 'react';
import './PlayerControls.css';

const PlayerControls = ({ 
  refs, 
  state, 
  onPlayPause, 
  onVolumeChange, 
  onMute, 
  onSeek, 
  onSpeedChange,
  onModeToggle,
  currentTrack 
}) => {
  return (
    <div className="player-controls">
      <button ref={refs.menuBtn} className="control-btn">
        <i className="fas fa-bars"></i>
      </button>
      
      <button ref={refs.prevBtn} className="control-btn">
        <i className="fas fa-backward"></i>
      </button>
      
      <button 
        ref={refs.playPauseBtn} 
        className="control-btn"
        onClick={onPlayPause}
      >
        <i className={`fas fa-${state.isPlaying ? 'pause' : 'play'}`}></i>
      </button>
      
      <button ref={refs.nextBtn} className="control-btn">
        <i className="fas fa-forward"></i>
      </button>

      {/* Mode switch button */}
      <div className="mode-switch">
        {currentTrack?.IsAR && currentTrack?.XR_Scene && (
          <button 
            ref={state.isXRMode ? refs.exitXRBtn : refs.viewXRBtn}
            className="control-btn"
            onClick={onModeToggle}
            style={{ display: state.isXRMode ? 'none' : 'flex' }}
          >
            <p>{state.isXRMode ? 'Exit 360°' : 'View 360°'}</p>
          </button>
        )}
      </div>

      <div className="progress-container">
        <span ref={refs.currentTime}>0:00</span>
        <div className="progress-bar" onClick={onSeek}>
          <div ref={refs.progress} className="progress"></div>
        </div>
        <span ref={refs.duration}></span>
      </div>

      <div className="volume-control">
        <button 
          ref={refs.muteBtn} 
          className="control-btn"
          onClick={onMute}
        >
          <i className={`fas fa-volume-${state.isMuted ? 'mute' : 'up'}`}></i>
        </button>
        
        <input 
          ref={refs.volumeSlider}
          type="range" 
          min="0" 
          max="1" 
          step="0.1" 
          value={state.volume}
          onChange={onVolumeChange}
        />
        
        <button 
          ref={refs.speedBtn} 
          className="control-btn"
          onClick={onSpeedChange}
        >
          {state.playbackSpeed}x
        </button>
      </div>
    </div>
  );
};

export default PlayerControls;