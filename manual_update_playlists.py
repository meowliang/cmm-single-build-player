import json
import re

def load_playlists():
    """Load the current playlists.json file"""
    try:
        with open('playlists.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print("Error: playlists.json not found in current directory")
        return None
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in playlists.json: {e}")
        return None

def create_url_mapping():
    """Create a mapping of old URLs to new URLs"""
    # This is where you'll define the URL mappings
    # Format: old_url_pattern: new_url_pattern
    
    url_mapping = {
        # Audio URLs - replace old contractor URLs with new ones
        r'https://cmm-cloud-2\.s3\.us-west-1\.amazonaws\.com/WALKING\+TOURS/': 'https://cmm-cloud.s3.us-west-1.amazonaws.com/2025-06-15-CMM-XRTOUR-CONTENT-FREEZE/',
        r'https://cmm-cloud-storage\.s3\.us-east-2\.amazonaws\.com/': 'https://cmm-cloud.s3.us-west-1.amazonaws.com/2025-06-15-CMM-XRTOUR-CONTENT-FREEZE/',
        
        # Specific playlist folder mappings
        r'2025-03-15-DTLA-WALKINGTOUR/2025-03-15-DTLA-AUDIO/': 'Ni de Aquí, ni de Allá/AUDIO/',
        r'2025-03-15-DTLA-WALKINGTOUR/2025-04-14-DTLA-ARTWORK-RESIZED/': 'Ni de Aquí, ni de Allá/THUMBNAILS/',
        r'2025-06-15-CMM-XRTOUR-CONTENT-FREEZE/Ni\+de\+Aqui%CC%81%2C\+ni\+de\+Alla%CC%81/XR-src/': 'Ni de Aquí, ni de Allá/XR-src/',
        
        r'2025-03-15-CHINATOWN/2025-03-15-CHINATOWN-MP3S/': 'Look Up/AUDIO/',
        r'2025-03-15-CHINATOWN/2025-03-25-CHINATOWN-ART/': 'Look Up/THUMBNAILS/',
        r'2025-04-10-CHINATOWN-XR-CHAPTERS/': 'Look Up/XR-src/',
        
        r'2025-03-15-JAPANTOWN/2025-03-15-JAPANTOWN-MP3-AUDIO/': 'Returning to the Harlem of the West/AUDIO/',
        r'2025-03-15-JAPANTOWN/2025-03-15-JAPANTOWN-ART/': 'Returning to the Harlem of the West/THUMBNAILS/',
        r'2025-04-01-JAPANTOWN-XR/': 'Returning to the Harlem of the West/XR-src/',
        
        r'2025-03-18-MISSION-WALKING-TOUR/2025-03-18-MISSION-MP3s/': 'Coffee Country/AUDIO/',
        r'2025-03-18-MISSION-WALKING-TOUR/2025-04-14-MISSION-ART-RESIZED/': 'Coffee Country/THUMBNAILS/',
    }
    
    return url_mapping

def update_urls_in_playlists(playlists_data, url_mapping):
    """Update URLs in the playlists data"""
    updated_count = 0
    
    for playlist in playlists_data['playlists']:
        for track in playlist['tracks']:
            # Update audio_url
            if 'audio_url' in track and track['audio_url']:
                old_url = track['audio_url']
                new_url = apply_url_mapping(old_url, url_mapping)
                if new_url != old_url:
                    track['audio_url'] = new_url
                    updated_count += 1
                    print(f"Updated audio URL: {old_url[:50]}... → {new_url[:50]}...")
            
            # Update artwork_url
            if 'artwork_url' in track and track['artwork_url']:
                old_url = track['artwork_url']
                new_url = apply_url_mapping(old_url, url_mapping)
                if new_url != old_url:
                    track['artwork_url'] = new_url
                    updated_count += 1
                    print(f"Updated artwork URL: {old_url[:50]}... → {new_url[:50]}...")
            
            # Update XR_Scene
            if 'XR_Scene' in track and track['XR_Scene']:
                old_url = track['XR_Scene']
                new_url = apply_url_mapping(old_url, url_mapping)
                if new_url != old_url:
                    track['XR_Scene'] = new_url
                    updated_count += 1
                    print(f"Updated XR URL: {old_url[:50]}... → {new_url[:50]}...")
    
    return updated_count

def apply_url_mapping(url, url_mapping):
    """Apply URL mapping patterns to a URL"""
    new_url = url
    
    for old_pattern, new_pattern in url_mapping.items():
        if re.search(old_pattern, new_url):
            new_url = re.sub(old_pattern, new_pattern, new_url)
            break
    
    return new_url

def save_playlists(playlists_data):
    """Save the updated playlists data"""
    try:
        with open('playlists.json', 'w', encoding='utf-8') as f:
            json.dump(playlists_data, f, indent=2, ensure_ascii=False)
        print("Successfully saved updated playlists.json")
        return True
    except Exception as e:
        print(f"Error saving playlists.json: {e}")
        return False

def main():
    print("Manual Playlists.json URL Updater")
    print("=" * 40)
    
    # Load current playlists
    playlists_data = load_playlists()
    if not playlists_data:
        return
    
    # Create URL mapping
    url_mapping = create_url_mapping()
    
    print(f"Loaded {len(playlists_data['playlists'])} playlists")
    print("Applying URL mappings...")
    
    # Update URLs
    updated_count = update_urls_in_playlists(playlists_data, url_mapping)
    
    print(f"\nUpdated {updated_count} URLs")
    
    # Save updated file
    if save_playlists(playlists_data):
        print("✅ Successfully updated playlists.json with new URLs!")
    else:
        print("❌ Failed to save updated playlists.json")

if __name__ == "__main__":
    main() 