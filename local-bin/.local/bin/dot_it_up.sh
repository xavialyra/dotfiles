#!/bin/bash
# dot_it_up.sh - Correctly moves multiple configs to a single stow package.
set -euo pipefail

# --- User Configuration ---
DOTFILES_ROOT="${DOTFILES_ROOT:-$HOME/dotfiles}"

# --- Functions ---
get_realpath() {
  if command -v realpath &>/dev/null; then
    realpath -s -- "$1"
  elif command -v greadlink &>/dev/null; then
    greadlink -f -- "$1"
  else
    (
      if [ -d "$1" ]; then
        cd -- "$1" && pwd
      elif [ -e "$1" ]; then
        cd -- "$(dirname -- "$1")" && echo "$(pwd)/$(basename -- "$1")"
      else
        echo "Error: Cannot resolve path for non-existent file/dir '$1' without realpath/greadlink." >&2
        return 1
      fi
    ) || return 1
  fi
}

# --- Main Script ---

# --- 1. Input Validation ---
if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <stow_package_name> <path_to_config_1> [path_to_config_2] ..." >&2
  exit 1
fi

APP_NAME="$1"
shift

# --- 2. Initial Setup & Base Directory Detection ---
FIRST_PATH="$1"
FIRST_ABS_PATH=$(get_realpath "$FIRST_PATH")
HOME_REALPATH=$(get_realpath "$HOME")

if [[ "$FIRST_ABS_PATH" == "$HOME_REALPATH"* ]]; then
  ORIGINAL_BASE_ABS_DIR="$HOME_REALPATH"
else
  ORIGINAL_BASE_ABS_DIR="/"
fi
echo "-> Auto-detected base directory for batch: $ORIGINAL_BASE_ABS_DIR"

# --- 3. Pre-flight Checks & Summary Generation (Loop) ---
echo "--- Dotfile Setup Summary ---"
echo "Stow Package:            $APP_NAME"
echo "Stow Target Directory:   $ORIGINAL_BASE_ABS_DIR"
# ... (summary details) ...
echo "-----------------------------------"
echo "The following items will be processed:"

declare -a CONFIG_ABS_PATHS
declare -a TARGET_DOTFILES_PATHS

for config_path_raw in "$@"; do
  config_abs_path=$(get_realpath "$config_path_raw")

  # --- CORRECTED CHECKS START HERE ---

  # 1. Check if the source path exists at all.
  if [ ! -e "$config_abs_path" ]; then
    echo "Error: Source path '$config_path_raw' does not exist. Aborting." >&2
    exit 1
  fi

  # 2. Check if the source path is already a symlink (meaning it might be managed).
  if [ -L "$config_abs_path" ]; then
    echo "Error: Source path '$config_abs_path' is already a symlink. Please unstow or remove it first. Aborting." >&2
    exit 1
  fi

  # 3. Check for conflicts at the DESTINATION inside the dotfiles repo. This is the crucial new check.
  relative_path="${config_abs_path#$ORIGINAL_BASE_ABS_DIR}"
  relative_path="${relative_path#/}"
  target_dotfiles_path="${DOTFILES_ROOT}/${APP_NAME}/${relative_path}"

  if [ -e "$target_dotfiles_path" ]; then
    echo "Error: Destination path '$target_dotfiles_path' already exists in your dotfiles repository. Aborting to prevent data loss." >&2
    exit 1
  fi

  # --- END OF CORRECTED CHECKS ---

  echo "  - From: $config_abs_path"
  echo "    To:   $target_dotfiles_path"

  CONFIG_ABS_PATHS+=("$config_abs_path")
  TARGET_DOTFILES_PATHS+=("$target_dotfiles_path")
done
echo "-----------------------------------"

# --- 4. Confirmation ---
read -p "Proceed with processing all listed items? (y/N): " -n 1 -r REPLY_PROCEED
echo
if [[ ! "$REPLY_PROCEED" =~ ^[Yy]$ ]]; then
  echo "Cancelled by user."
  exit 1
fi

# --- 5. Execution ---
# ... (The rest of the script is correct and remains the same) ...
if [ "$ORIGINAL_BASE_ABS_DIR" != "$HOME_REALPATH" ]; then
  mkdir -p "${DOTFILES_ROOT}/${APP_NAME}"
  echo "-> Recording non-standard target path '$ORIGINAL_BASE_ABS_DIR'..."
  echo "$ORIGINAL_BASE_ABS_DIR" >"${DOTFILES_ROOT}/${APP_NAME}/.stow-target"
fi

for i in "${!CONFIG_ABS_PATHS[@]}"; do
  src="${CONFIG_ABS_PATHS[$i]}"
  dest="${TARGET_DOTFILES_PATHS[$i]}"

  echo "-> Moving '$src' to '$dest'..."
  mkdir -p "$(dirname -- "$dest")"
  mv -- "$src" "$dest"
done

echo "-> Running stow for package '$APP_NAME'..."
(
  cd "$DOTFILES_ROOT"
  stow --verbose --restow --target="$ORIGINAL_BASE_ABS_DIR" "$APP_NAME"
)
echo "✅ All items moved and stowed successfully."

# --- 6. Git Integration ---
echo
read -p "Add changes to Git and commit? (y/N): " -n 1 -r REPLY_GIT
echo
if [[ "$REPLY_GIT" =~ ^[Yy]$ ]]; then
  (
    cd "$DOTFILES_ROOT"
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      echo "Warning: Not a Git repository. Skipping."
      exit 0
    fi
    echo "-> Adding to Git..."
    git add "$APP_NAME"

    COMMIT_MSG="feat($APP_NAME): manage configuration" # Minor tweak to commit message
    read -p "Enter commit message (default: '$COMMIT_MSG'): " USER_COMMIT_MSG
    git commit -m "${USER_COMMIT_MSG:-$COMMIT_MSG}"

    echo "✅ Git commit successful. Remember to 'git push'!"
  )
fi

echo "--- Setup Complete ---"
