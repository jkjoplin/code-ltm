# typed: false
# frozen_string_literal: true

class CodeLtm < Formula
  desc "Knowledge management system for AI coding agents"
  homepage "https://github.com/jkjoplin/code-ltm"
  url "https://registry.npmjs.org/code-ltm/-/code-ltm-0.1.0.tgz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  def caveats
    <<~EOS
      code-ltm MCP server is now installed.

      To use with Claude Desktop, add to your config:
        #{pkgetc}/claude_desktop_config.json

        {
          "mcpServers": {
            "code-ltm": {
              "command": "#{opt_bin}/code-ltm"
            }
          }
        }

      Data is stored at ~/.code-ltm/knowledge.db
    EOS
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/code-ltm-cli --version")
  end
end
