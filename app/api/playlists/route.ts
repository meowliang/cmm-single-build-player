import { NextResponse } from 'next/server';
import playlists from '../../../playlists.json';

export async function GET() {
  return NextResponse.json(playlists);
} 