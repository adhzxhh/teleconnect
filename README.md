# Tools Website

Dark/neon static website for publishing files, images and links.

## GitHub Pages

1. Create a public GitHub repository.
2. Upload `index.html`, `style.css`, `script.js` and `.gitignore`.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select `main` and `/ (root)`, then save.
6. GitHub will provide your Pages URL.

## Telegram integration

The current version uses sample data. The next step is to add a secure Telegram Bot + GitHub Actions workflow so channel posts can be converted into website content automatically.

Never put a Telegram bot token inside `script.js` or any other public file.
