import boto3
import json
import re
from urllib.parse import quote

def list_s3_files(bucket_name, prefix=""):
    """List all files in S3 bucket with given prefix"""
    s3 = boto3.client('s3')
    files = []
    
    paginator = s3.get_paginator('list_objects_v2')
    page_iterator = paginator.paginate(Bucket=bucket_name, Prefix=prefix)
    
    for page in page_iterator:
        if 'Contents' in page:
            for obj in page['Contents']:
                files.append(obj['Key'])
    
    return files

def extract_chapter_from_filename(filename):
    """Extract chapter number from filename"""
    # Look for patterns like "CH-1", "CH-2", "Chapter 1", etc.
    patterns = [
        r'CH-(\d+(?:\.\d+)?)',  # CH-1, CH-7.5
        r'Chapter\s+(\d+(?:\.\d+)?)',  # Chapter 1, Chapter 7.5
        r'(\d+(?:\.\d+)?)',  # Just numbers
    ]
    
    for pattern in patterns:
        match = re.search(pattern, filename, re.IGNORECASE)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                continue
    
    return None

def extract_playlist_from_path(s3_path):
    """Extract playlist name from S3 path"""
    # Extract from path like "2025-06-15-CMM-XRTOUR-CONTENT-FREEZE/Look Up/AUDIO/..."
    parts = s3_path.split('/')
    if len(parts) >= 3:
        return parts[1]  # The playlist folder name
    return None

def categorize_files(s3_files):
    """Categorize S3 files by playlist, type, and chapter"""
    categorized = {}
    
    for file_path in s3_files:
        # Skip .DS_Store files
        if '.DS_Store' in file_path:
            continue
            
        # Extract playlist name
        playlist = extract_playlist_from_path(file_path)
        if not playlist:
            continue
            
        # Extract chapter number
        filename = file_path.split('/')[-1]
        chapter = extract_chapter_from_filename(filename)
        if not chapter:
            continue
            
        # Determine file type
        file_type = None
        if '/AUDIO/' in file_path:
            file_type = 'audio'
        elif '/THUMBNAILS/' in file_path:
            file_type = 'artwork'
        elif '/XR-src/' in file_path:
            file_type = 'xr'
            
        if not file_type:
            continue
            
        # Initialize nested structure
        if playlist not in categorized:
            categorized[playlist] = {}
        if chapter not in categorized[playlist]:
            categorized[playlist][chapter] = {}
            
        # Store the file path
        categorized[playlist][chapter][file_type] = file_path
    
    return categorized

def generate_s3_url(bucket_name, file_path):
    """Generate S3 URL for a file"""
    encoded_path = quote(file_path, safe='')
    return f"https://{bucket_name}.s3.us-west-1.amazonaws.com/{encoded_path}"

def update_playlists_json(playlists_data, categorized_files):
    """Update playlists.json with new S3 URLs"""
    updated_count = 0
    
    for playlist in playlists_data['playlists']:
        playlist_name = playlist['playlist_name']
        
        if playlist_name not in categorized_files:
            print(f"Warning: No files found for playlist '{playlist_name}'")
            continue
            
        for track in playlist['tracks']:
            chapter = track['chapter']
            
            if chapter not in categorized_files[playlist_name]:
                print(f"Warning: No files found for chapter {chapter} in '{playlist_name}'")
                continue
                
            chapter_files = categorized_files[playlist_name][chapter]
            
            # Update audio_url
            if 'audio' in chapter_files:
                track['audio_url'] = generate_s3_url('cmm-cloud', chapter_files['audio'])
                updated_count += 1
                print(f"Updated audio for {playlist_name} Chapter {chapter}")
            
            # Update artwork_url
            if 'artwork' in chapter_files:
                track['artwork_url'] = generate_s3_url('cmm-cloud', chapter_files['artwork'])
                updated_count += 1
                print(f"Updated artwork for {playlist_name} Chapter {chapter}")
            
            # Update XR_Scene
            if 'xr' in chapter_files:
                track['XR_Scene'] = generate_s3_url('cmm-cloud', chapter_files['xr'])
                updated_count += 1
                print(f"Updated XR for {playlist_name} Chapter {chapter}")
    
    return updated_count

def main():
    # Load existing playlists.json
    try:
        with open('playlists.json', 'r', encoding='utf-8') as f:
            playlists_data = json.load(f)
    except FileNotFoundError:
        print("Error: playlists.json not found in current directory")
        return
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in playlists.json: {e}")
        return
    
    print("Loading files from S3 bucket 'cmm-cloud'...")
    
    # List all files in the content freeze folder
    base_prefix = "2025-06-15-CMM-XRTOUR-CONTENT-FREEZE/"
    s3_files = list_s3_files('cmm-cloud', base_prefix)
    
    print(f"Found {len(s3_files)} files in S3")
    
    # Categorize files
    categorized_files = categorize_files(s3_files)
    
    print("\nCategorized files by playlist:")
    for playlist, chapters in categorized_files.items():
        print(f"  {playlist}: {len(chapters)} chapters")
        for chapter, files in chapters.items():
            print(f"    Chapter {chapter}: {list(files.keys())}")
    
    # Update playlists.json
    print("\nUpdating playlists.json...")
    updated_count = update_playlists_json(playlists_data, categorized_files)
    
    # Save updated file
    try:
        with open('playlists.json', 'w', encoding='utf-8') as f:
            json.dump(playlists_data, f, indent=2, ensure_ascii=False)
        print(f"\nSuccessfully updated {updated_count} URLs in playlists.json")
    except Exception as e:
        print(f"Error saving playlists.json: {e}")

if __name__ == "__main__":
    main() 