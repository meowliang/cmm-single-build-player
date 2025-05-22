import { useState, useCallback } from 'react';

export const usePlaylist = () => {
  const [playlist, setPlaylist] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadPlaylist = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/playlist.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (!data || !data.playlist_name || !Array.isArray(data.tracks)) {
        throw new Error('Invalid playlist data format');
      }
      
      setPlaylist(data);
      setCurrentTrack(0);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load playlist:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTrack = useCallback((index) => {
    if (!playlist?.tracks?.[index]) return;
    setCurrentTrack(index);
  }, [playlist]);

  return {
    playlist,
    currentTrack,
    isLoading,
    error,
    loadPlaylist,
    loadTrack,
  };
};
