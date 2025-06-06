import React, { useState } from 'react';
import './PermissionOverlay.css';

const PermissionOverlay = ({ onEnableMotion, onSkip, error }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleEnableMotion = async () => {
    setIsLoading(true);
    try {
      await onEnableMotion();
    } catch (err) {
      console.error('Error enabling motion:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="permission-overlay">
      <div className="permission-content">
        <div className="icon-container">
          <i className="fas fa-vr-cardboard"></i>
        </div>

        <h2>Immersive 360° Experience</h2>

        <p>This experience uses your device's motion sensors to create an immersive 360° environment.</p>

        <div className="feature-list">
          <div className="feature-item">
            <i className="fas fa-music"></i>
            <span>High-quality audio</span>
          </div>
          <div className="feature-item">
            <i className="fas fa-vr-cardboard"></i>
            <span>360° visuals</span>
          </div>
          <div className="feature-item">
            <i className="fas fa-mobile-alt"></i>
            <span>Motion controls</span>
          </div>
        </div>

        <div className="permission-steps">
          <p><strong>When prompted:</strong></p>
          <ul>
            <li>Tap "Allow" to enable motion and orientation access</li>
            <li>For the best experience, use headphones and move around</li>
          </ul>
        </div>

        {error && (
          <div className="permission-error">
            <p>{error}</p>
          </div>
        )}

        <div className="permission-buttons">
          <button 
            className={`primary-button ${isLoading ? 'loading' : ''}`}
            onClick={handleEnableMotion}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                <span>Requesting Permission...</span>
              </>
            ) : (
              <strong>Start Experience</strong>
            )}
          </button>
          <button 
            className="secondary-button"
            onClick={onSkip}
            disabled={isLoading}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionOverlay;
