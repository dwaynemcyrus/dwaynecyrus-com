#!/usr/bin/env bash
set -euo pipefail

echo ">> Setting up SSH for Git submodules"
echo ">> HOME is: $HOME"

# 1. Prepare SSH directory
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

# 2. Write private key from env (strip any CR if present)
echo "$SSH_PRIVATE_KEY" | tr -d '\r' > "$HOME/.ssh/id_ed25519"
chmod 600 "$HOME/.ssh/id_ed25519"

# 3. Trust GitHub host (this avoids interactive host key prompts)
ssh-keyscan github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null || true
chmod 644 "$HOME/.ssh/known_hosts"

# 4. Force git to use our key + options for ALL SSH ops
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/id_ed25519 -o StrictHostKeyChecking=no -o UserKnownHostsFile=$HOME/.ssh/known_hosts"

echo ">> GIT_SSH_COMMAND is: $GIT_SSH_COMMAND"

# 5. Sync submodule config and pull latest
git submodule sync --recursive
git submodule update --init --remote --recursive

echo ">> Submodules updated successfully"
