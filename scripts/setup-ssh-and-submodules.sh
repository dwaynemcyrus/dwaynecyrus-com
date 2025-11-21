#!/usr/bin/env bash
set -e

echo ">> Setting up SSH for Git submodules"

# 1. Prepare SSH directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 2. Write private key from env
echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519

# 3. Add GitHub to known_hosts so SSH doesn't prompt
ssh-keyscan github.com >> ~/.ssh/known_hosts
chmod 644 ~/.ssh/known_hosts

# 4. Sync submodule config
git submodule sync --recursive

# 5. Update/init submodules to latest commit on tracked branch
git submodule update --init --remote --recursive

echo ">> Submodules updated successfully"
