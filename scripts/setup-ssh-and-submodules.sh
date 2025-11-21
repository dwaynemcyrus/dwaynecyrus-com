#!/usr/bin/env bash
set -e

echo ">> Setting up SSH for Git submodules"

# 1. Prepare SSH directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 2. Write private key from env (strip any Windows CR if they sneaked in)
echo "$SSH_PRIVATE_KEY" | tr -d '\r' > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519

# 3. SSH config – explicitly tell git/ssh how to talk to GitHub
cat <<EOF > ~/.ssh/config
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  StrictHostKeyChecking no
EOF
chmod 600 ~/.ssh/config

# 4. (Optional but useful) show which key we're using
echo ">> SSH config:"
cat ~/.ssh/config

# 5. Sync submodule config and pull latest
git submodule sync --recursive
git submodule update --init --remote --recursive

echo ">> Submodules updated successfully"
