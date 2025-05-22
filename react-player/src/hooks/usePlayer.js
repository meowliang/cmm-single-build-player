import { useState, useCallback } from 'react';

export const usePlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleTimeUpdate = useCallback((time) => {
    setCurrentTime(time);
  }, []);

  const handleDurationChange = useCallback((newDuration) => {
    setDuration(newDuration);
  }, []);

  const handleVolumeChange = useCallback((newVolume) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const changePlaybackSpeed = useCallback((speed) => {
    setPlaybackSpeed(speed);
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackSpeed,
    togglePlayPause,
    handleTimeUpdate,
    handleDurationChange,
    handleVolumeChange,
    toggleMute,
    changePlaybackSpeed,
  };
};
