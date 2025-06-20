// src/utils/analytics.js

export const trackEvent = (eventName, eventData) => {
  console.log(`Analytics: About to fire event '${eventName}' with data:`, eventData);
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    ...eventData,
  });
  console.log(`Analytics: Successfully fired event '${eventName}' with data:`, eventData);
};

export const trackTourStarted = (playlist) => {
  console.log('Analytics: trackTourStarted called with playlist:', playlist);
  trackEvent('tour_started', {
    tour_name: playlist.playlist_name,
    total_chapters: playlist.tracks.length,
  });
};

export const trackChapterStarted = (playlist, track, trackIndex) => {
  console.log('Analytics: trackChapterStarted called with:', { playlist: playlist.playlist_name, track: track.title, trackIndex });
  const tourProgress = Math.round(((trackIndex + 1) / playlist.tracks.length) * 100);
  console.log('Analytics: Calculated tour progress:', tourProgress + '%');

  trackEvent('chapter_started', {
    tour_name: playlist.playlist_name,
    chapter_number: track.chapter,
    chapter_title: track.title,
    tour_progress_percent: tourProgress,
  });

  // Track tour progress milestones
  if (tourProgress >= 25 && tourProgress < 50 && !window.tour25Fired) {
    console.log('Analytics: Firing tour_25percent milestone');
    trackEvent('tour_25percent', {
      tour_name: playlist.playlist_name,
      current_chapter: track.chapter,
    });
    window.tour25Fired = true;
  }
  if (tourProgress >= 50 && tourProgress < 75 && !window.tour50Fired) {
    console.log('Analytics: Firing tour_50percent milestone');
    trackEvent('tour_50percent', {
      tour_name: playlist.playlist_name,
      current_chapter: track.chapter,
    });
    window.tour50Fired = true;
  }
  if (tourProgress >= 75 && tourProgress < 100 && !window.tour75Fired) {
    console.log('Analytics: Firing tour_75percent milestone');
    trackEvent('tour_75percent', {
      tour_name: playlist.playlist_name,
      current_chapter: track.chapter,
    });
    window.tour75Fired = true;
  }
};

export const trackAudioProgress = (track, progress) => {
  if (progress >= 25 && !window.audio25Fired) {
    console.log('Analytics: Firing audio_25percent milestone');
    trackEvent('audio_25percent', { track_title: track.title });
    window.audio25Fired = true;
  }
  if (progress >= 50 && !window.audio50Fired) {
    console.log('Analytics: Firing audio_50percent milestone');
    trackEvent('audio_50percent', { track_title: track.title });
    window.audio50Fired = true;
  }
  if (progress >= 75 && !window.audio75Fired) {
    console.log('Analytics: Firing audio_75percent milestone');
    trackEvent('audio_75percent', { track_title: track.title });
    window.audio75Fired = true;
  }
};

export const trackChapterComplete = (playlist, track) => {
  console.log('Analytics: trackChapterComplete called with:', { playlist: playlist.playlist_name, track: track.title });
  trackEvent('chapter_complete', {
    tour_name: playlist.playlist_name,
    chapter_title: track.title,
  });
};

export const trackTourComplete = (playlist) => {
  console.log('Analytics: trackTourComplete called with playlist:', playlist.playlist_name);
  
  // Helper to calculate total duration in H:M:S format
  const calculateTotalTourDuration = () => {
    let totalSeconds = 0;
    playlist.tracks.forEach(track => {
      if (track.duration) {
        const parts = track.duration.split(':').map(Number);
        if (parts.length === 2) {
          totalSeconds += (parts[0] * 60) + parts[1];
        }
      }
    });

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  trackEvent('tour_complete', {
    tour_name: playlist.playlist_name,
    last_chapter: playlist.tracks[playlist.tracks.length - 1].chapter,
    tour_duration: calculateTotalTourDuration(),
  });
};

export const trackView360 = (playlist, track) => {
  console.log('Analytics: trackView360 called with:', { playlist: playlist.playlist_name, track: track.title });
  trackEvent('view_360_clicked', {
    tour_name: playlist.playlist_name,
    track_title: track.title,
    track_chapter: track.chapter,
  });
};

export const trackExit360 = (playlist, track) => {
  console.log('Analytics: trackExit360 called with:', { playlist: playlist.playlist_name, track: track.title });
  trackEvent('exit_360_clicked', {
    tour_name: playlist.playlist_name,
    track_title: track.title,
    track_chapter: track.chapter,
  });
};

// Reset flags for a new track
export const resetTrackAnalyticsFlags = () => {
  console.log('Analytics: Resetting track analytics flags');
  window.audio25Fired = false;
  window.audio50Fired = false;
  window.audio75Fired = false;
  window.chapterCompleteFired = false;
};

// Reset flags for a new tour
export const resetTourAnalyticsFlags = () => {
  console.log('Analytics: Resetting tour analytics flags');
  window.tour25Fired = false;
  window.tour50Fired = false;
  window.tour75Fired = false;
  resetTrackAnalyticsFlags();
}; 