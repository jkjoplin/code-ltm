# Homebrew Formula for code-ltm

This directory contains the Homebrew formula for installing code-ltm.

## Setup: Create a Homebrew Tap

To distribute via Homebrew, create a tap repository:

### 1. Create the tap repository

Create a new GitHub repository named `homebrew-tap` (or `homebrew-code-ltm`):

```bash
# On GitHub, create: jkjoplin/homebrew-tap
```

### 2. Add the formula

Copy `code-ltm.rb` to the tap repository:

```bash
git clone https://github.com/jkjoplin/homebrew-tap.git
cp homebrew/code-ltm.rb homebrew-tap/Formula/code-ltm.rb
cd homebrew-tap
git add Formula/code-ltm.rb
git commit -m "Add code-ltm formula"
git push
```

### 3. Update the SHA256

After publishing to npm, get the SHA256:

```bash
# Download the tarball and compute SHA
curl -sL https://registry.npmjs.org/code-ltm/-/code-ltm-0.1.0.tgz | shasum -a 256
```

Update the `sha256` field in `code-ltm.rb` with the actual value.

## Installation (for users)

Once the tap is set up:

```bash
# Add the tap
brew tap jkjoplin/tap

# Install code-ltm
brew install code-ltm
```

Or in one command:

```bash
brew install jkjoplin/tap/code-ltm
```

## Updating the Formula

When releasing a new version:

1. Publish new version to npm: `npm publish`
2. Get the new SHA256: `curl -sL https://registry.npmjs.org/code-ltm/-/code-ltm-X.Y.Z.tgz | shasum -a 256`
3. Update `code-ltm.rb`:
   - Change `url` to new version
   - Update `sha256`
4. Commit and push to the tap repository

## Local Testing

Test the formula locally before publishing:

```bash
# Install from local formula file
brew install --build-from-source ./homebrew/code-ltm.rb

# Or test with audit
brew audit --strict --new-formula ./homebrew/code-ltm.rb
```

## Alternative: GitHub Release Source

If you prefer to use GitHub releases instead of npm:

```ruby
url "https://github.com/jkjoplin/code-ltm/archive/refs/tags/v0.1.0.tar.gz"
sha256 "SHA256_OF_GITHUB_TARBALL"

def install
  system "npm", "install", *std_npm_args
  bin.install_symlink Dir["#{libexec}/bin/*"]
end
```

Note: The npm tarball is preferred as it only contains the published files (no dev dependencies or source).
