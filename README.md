# Playlists.json S3 URL Updater

This script updates the `playlists.json` file with new S3 URLs from your AWS bucket.

## Prerequisites

1. **AWS Credentials**: Make sure you have AWS credentials configured. You can do this by:
   - Installing the AWS CLI and running `aws configure`
   - Setting environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
   - Using IAM roles if running on EC2

2. **Python Dependencies**: Install the required packages:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

1. **Place the script in the same directory as your `playlists.json` file**

2. **Run the script**:
   ```bash
   python update_playlists.py
   ```

## What the script does

1. **Lists all files** in your S3 bucket under the `2025-06-15-CMM-XRTOUR-CONTENT-FREEZE/` prefix
2. **Categorizes files** by:
   - Playlist name (from folder structure)
   - Chapter number (extracted from filename)
   - File type (audio, artwork, or XR)
3. **Updates URLs** in `playlists.json` for:
   - `audio_url` (from AUDIO/ folder)
   - `artwork_url` (from THUMBNAILS/ folder)
   - `XR_Scene` (from XR-src/ folder)
4. **Saves the updated file** back to disk

## Expected S3 Structure

The script expects your S3 bucket to have this structure:
```
cmm-cloud/
└── 2025-06-15-CMM-XRTOUR-CONTENT-FREEZE/
    ├── Look Up/
    │   ├── AUDIO/
    │   ├── THUMBNAILS/
    │   └── XR-src/
    ├── Coffee Country/
    │   ├── AUDIO/
    │   ├── THUMBNAILS/
    │   └── XR-src/
    ├── Ni de Aquí, ni de Allá/
    │   ├── AUDIO/
    │   ├── THUMBNAILS/
    │   └── XR-src/
    └── Returning to the Harlem of the West/
        ├── AUDIO/
        ├── THUMBNAILS/
        └── XR-src/
```

## Chapter Number Extraction

The script extracts chapter numbers from filenames using these patterns:
- `CH-1`, `CH-2`, `CH-7.5` (matches "CH-" followed by numbers)
- `Chapter 1`, `Chapter 2` (matches "Chapter" followed by numbers)
- `1`, `2`, `7.5` (matches just numbers)

## Output

The script will:
- Show how many files were found in S3
- Display categorized files by playlist and chapter
- Print each URL update as it happens
- Show the total number of URLs updated
- Save the updated `playlists.json` file

## Backup

The script modifies your `playlists.json` file in place. Consider making a backup before running:
```bash
cp playlists.json playlists.json.backup
```
