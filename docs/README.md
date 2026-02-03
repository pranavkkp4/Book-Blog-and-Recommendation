# Frontend (GitHub Pages)

This folder is the **deployed frontend** for GitHub Pages.

## Pages
- `blog.html` - home page (blog)
- `recommendation.html` - recommendations page
- `index.html` - redirects to `blog.html`

## API Base URL
Edit `config.js` and set:
```js
window.BOOK_API_BASE = "https://your-service.onrender.com";
```

For local dev:
```js
window.BOOK_API_BASE = "http://localhost:8000";
```
