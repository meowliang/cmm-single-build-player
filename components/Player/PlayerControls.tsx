'use client';

import { FaPlay, FaPause, FaList, Fa360Degrees } from 'react-icons/fa';
import './PlayerControls.css';

interface PlayerControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onMenuToggle: () => void;
  onXRToggle: () => void;
  hasXR: boolean;
  isXRMode: boolean;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  onPlayPause,
  onMenuToggle,
  onXRToggle,
  hasXR,
  isXRMode
}) => {
  return (
    <div className="player-controls">
      <button
        className="control-button play-button"
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <FaPause /> : <FaPlay />}
      </button>

      {hasXR && (
        <button
          className={`control-button xr-button ${isXRMode ? 'active' : ''}`}
          onClick={onXRToggle}
          aria-label="Toggle 360° View"
        >
          <Fa360Degrees />
        </button>
      )}

      <button
        className="control-button menu-button"
        onClick={onMenuToggle}
        aria-label="Toggle Playlist"
      >
        <FaList />
      </button>
    </div>
  );
};

export default PlayerControls; 