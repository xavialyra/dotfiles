#!/bin/bash

# Check for URL - always the first mandatory argument for the script itself
if [ -z "$1" ]; then
  echo "Error: Please provide a video URL."
  usage
fi

# Initialize variables
VIDEO_URL="$1"
shift

COOKIE_OPTION_TYPE="" # 'file', 'browser', or 'string'
COOKIE_VALUE=""       # For messages only
# This will store yt-dlp arguments as a list of "key=value" strings for --ytdl-raw-options
YTDL_OPTIONS_LIST=()
MPV_ARGS=("-force-seekable=yes")

# Process named script options (like --from-browser) and general mpv options
# Loop through remaining arguments
while [ "$#" -gt 0 ]; do
  case "$1" in
  --from-browser)
    if [ -z "$2" ]; then
      echo "Error: --from-browser requires a browser name."
      usage
    fi
    COOKIE_OPTION_TYPE="browser"
    YTDL_OPTIONS_LIST+=("cookies-from-browser=$2")
    COOKIE_VALUE="$2" # For messages
    shift 2
    ;;
  --cookie-string)
    if [ -z "$2" ]; then
      echo "Error: --cookie-string requires a cookie string."
      usage
    fi
    COOKIE_OPTION_TYPE="string"
    YTDL_OPTIONS_LIST+=("add-header=Cookie:$2")
    COOKIE_VALUE="$2" # For messages
    shift 2
    ;;
  # Check if the remaining argument is a file that might be a cookie file
  *)
    if [ -z "$COOKIE_OPTION_TYPE" ] && [ -f "$1" ]; then # If it's a file and no cookie type set yet
      COOKIE_OPTION_TYPE="file"
      YTDL_OPTIONS_LIST+=("cookies=$1")
      COOKIE_VALUE="$1" # For messages
      shift 1
    else # All other arguments (not URL, not known script options, not cookie file) are passed to mpv
      MPV_ARGS+=("$1")
      shift 1
    fi
    ;;
  esac
done

# Dependency checks (unchanged)
if ! command -v mpv &>/dev/null; then
  echo "Error: mpv is not installed. Please install it (e.g., sudo apt install mpv or brew install mpv)"
  exit 1
fi

echo "Preparing video playback..."
echo "URL: $VIDEO_URL"

# Construct the final --ytdl-raw-options string
YTDL_RAW_OPTIONS_STRING=""
if [ ${#YTDL_OPTIONS_LIST[@]} -gt 0 ]; then
  # Join all elements in YTDL_OPTIONS_LIST with commas
  IFS=, YTDL_RAW_OPTIONS_STRING="${YTDL_OPTIONS_LIST[*]}"
  MPV_ARGS+=("--ytdl-raw-options=$YTDL_RAW_OPTIONS_STRING")
  echo "YTDL Raw options being passed: $YTDL_RAW_OPTIONS_STRING" # Debugging
fi

# Debugging: Print the command that will be executed
echo "Executing command: mpv ${MPV_ARGS[*]} \"$VIDEO_URL\""

# Execute the command
mpv "${MPV_ARGS[@]}" "$VIDEO_URL"

MPV_EXIT_CODE=$?
if [ $MPV_EXIT_CODE -ne 0 ]; then
  echo "mpv exited with code: $MPV_EXIT_CODE"
  echo "If video playback failed, check the URL, cookie options, or network connection."
fi

echo "Script finished."
