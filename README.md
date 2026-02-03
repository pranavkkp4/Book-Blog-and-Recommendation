# Book Hub - React + SQL + NLP Recommendations

Two-page web app:
- **Blog**: users submit book reviews (author, title, content, score 0-10, optional cover image). Inputs are validated + sanitized server-side and stored in SQL.
- **Recommendations**: a multi-step quiz (multiple choice + one text question) returns:
  - **Global Recommendation** (from Kaggle books dataset)
  - **Our Recommendation** (from your site's review DB)

Theme: **maroon** + **off-white (#F5F1E8)**.

---

## Tech stack
- Frontend: React 17 (CDN), ReactDOM (CDN), Babel Standalone (in-browser JSX)
- Backend: Python `http.server` (ThreadingHTTPServer)
- Database: SQLite
- NLP: TF-IDF via `scikit-learn` + `pandas`
- Dataset: Kaggle Books (`Books.zip` -> `books.csv`)

---

## Repo structure

- `docs/` - **frontend** (GitHub Pages)
- `backend/` - **backend API** (Render) + SQLite DB + NLP engine

---

## Deploy (GitHub Pages + Render)

### 1) Deploy backend to Render (no card required on free tier)
1. Push this repo to GitHub.
2. In Render, create a **Web Service** and connect this repo.
3. Use these settings:
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `python backend/server.py`
4. Put `Books.zip` into `backend/` before you deploy.
   - The server will auto-extract `books.csv` and build the TF-IDF index.
   - If `Books.zip` is missing, **Global Recommendation** may be unavailable.
5. (Optional) Set a delete passcode:
   - In Render -> **Environment**, add `DELETE_PASSCODE` with your chosen value.

After deploy, Render gives you a URL like:
`https://your-service.onrender.com`

### 2) Point the frontend at Render
Edit:
- `docs/config.js`

Set:
```js
window.BOOK_API_BASE = "https://your-service.onrender.com";
```

Commit + push.

### 3) Enable GitHub Pages
GitHub repo -> **Settings -> Pages**
- Source: `Deploy from branch`
- Branch: `main`
- Folder: `/docs`

---

## Local development

### Backend
```bash
python backend/server.py
```
Backend runs at `http://localhost:8000`.

### Frontend
Open `docs/blog.html` in the browser.
In `docs/config.js`, use:
```js
window.BOOK_API_BASE = "http://localhost:8000";
```

---

## Notes
- SQLite is stored in `backend/database.db`. On free cloud tiers, local disk may reset on redeploy.
- CORS is enabled so GitHub Pages can call the Render API.
- Render free tier services can sleep. First request after idle may take 30-60 seconds.

## Admin delete (passcode)
Reviews can be deleted with a passcode.
- Set `DELETE_PASSCODE` in your Render environment.
- Frontend prompts for it when you click **Delete**.

## Diagnostics
Check dataset loading and feature readiness:
```
GET /api/status
```
Returns:
- `books_csv_exists`
- `books_loaded`
- `books_count`
- `tfidf_ready`
- `delete_passcode_configured`
