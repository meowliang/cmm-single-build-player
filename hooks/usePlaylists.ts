import useSWR from 'swr';

interface Track {
  chapter: number;
  title: string;
  audio_url: string;
  artwork_url: string;
  playlist: string;
  IsAR: boolean;
  XR_Scene: string;
  duration: string;
}

interface Playlist {
  playlist_name: string;
  tracks: Track[];
}

interface PlaylistsResponse {
  playlists: Playlist[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function usePlaylists() {
  const { data, error, isLoading } = useSWR<PlaylistsResponse>('/api/playlists', fetcher);

  return {
    playlists: data?.playlists || [],
    isLoading,
    isError: error
  };
} 