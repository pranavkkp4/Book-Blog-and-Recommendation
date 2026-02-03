import http.server
import json
import os
import sqlite3
import urllib.parse
import re
import base64
import time
import threading
import mimetypes

from io import BytesIO

try:
    import pandas as pd
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import linear_kernel
except ImportError:
    # sklearn and pandas should be available in the environment. If they are
    # missing, the recommendations endpoint will fallback to a simple match.
    pd = None
    TfidfVectorizer = None
    linear_kernel = None


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'static')
UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')
DATA_DIR = os.path.join(BASE_DIR, 'data', 'books_data')
DB_PATH = os.path.join(BASE_DIR, 'database.db')

# Ensure uploads directory exists
os.makedirs(UPLOADS_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Database setup and helper functions
# ---------------------------------------------------------------------------

def init_db():
    """Initialize the SQLite database if it doesn't already exist."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            score INTEGER NOT NULL,
            cover_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()


def insert_review(author: str, title: str, content: str, score: int, cover_path: str | None):
    """Insert a new review into the database."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "INSERT INTO reviews (author, title, content, score, cover_path) VALUES (?, ?, ?, ?, ?)",
        (author, title, content, score, cover_path),
    )
    conn.commit()
    conn.close()


def fetch_reviews():
    """Retrieve all reviews from the database ordered by newest first."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM reviews ORDER BY created_at DESC")
    rows = c.fetchall()
    conn.close()
    result = []
    for row in rows:
        cover_url = None
        if row['cover_path']:
            # Build a URL path that can be requested from the uploads endpoint
            filename = os.path.basename(row['cover_path'])
            cover_url = f"/uploads/{urllib.parse.quote(filename)}"
        result.append({
            'id': row['id'],
            'author': row['author'],
            'title': row['title'],
            'content': row['content'],
            'score': row['score'],
            'cover_url': cover_url,
            'created_at': row['created_at'],
        })
    return result


# ---------------------------------------------------------------------------
# Recommendation engine setup
# ---------------------------------------------------------------------------

class RecommendationEngine:
    """
    A simple content-based recommendation engine using TF-IDF on book titles.

    It loads the Kaggle dataset at initialization and computes TF-IDF vectors
    for the titles. When queried with a piece of text, it returns the book
    whose title is most similar to the query.
    """

    def __init__(self):
        self.books_df = None
        self.vectorizer = None
        self.tfidf_matrix = None
        self.load_data()

    def load_data(self):
        """
        Load the Kaggle book dataset and build a TF‑IDF model on the titles and authors.

        If the CSV file is not present but a Books.zip archive exists in the
        project root, the archive will be extracted to the data/books_data
        directory. This allows the dataset to be omitted from version control
        while still being used at runtime if the user provides the archive.
        """
        # Only attempt to load data if pandas and sklearn are available
        if pd is None or TfidfVectorizer is None:
            return
        books_csv_path = os.path.join(DATA_DIR, 'books.csv')
        # If the CSV doesn't exist, try to extract it from Books.zip
        if not os.path.exists(books_csv_path):
            archive_path = os.path.join(BASE_DIR, 'Books.zip')
            if os.path.exists(archive_path):
                # Attempt extraction
                try:
                    import zipfile
                    with zipfile.ZipFile(archive_path, 'r') as zf:
                        # Extract only the books.csv file into DATA_DIR
                        for member in zf.namelist():
                            if member.endswith('books.csv'):
                                zf.extract(member, os.path.join(BASE_DIR, 'data'))
                                # Move to the expected location if necessary
                                extracted_path = os.path.join(BASE_DIR, 'data', member)
                                dest_path = books_csv_path
                                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                                os.replace(extracted_path, dest_path)
                                break
                except Exception:
                    pass
        # After possible extraction, check again
        if not os.path.exists(books_csv_path):
            return
        try:
            # The books.csv file uses semicolon as delimiter and latin‑1 encoding
            self.books_df = pd.read_csv(
                books_csv_path,
                sep=';',
                encoding='latin-1',
                usecols=['ISBN', 'Book-Title', 'Book-Author', 'Year-Of-Publication'],
                dtype=str,
            ).dropna()
            # Combine title and author to provide a richer text corpus
            corpus = (
                self.books_df['Book-Title'].fillna('') + ' ' +
                self.books_df['Book-Author'].fillna('')
            ).astype(str).tolist()
            self.vectorizer = TfidfVectorizer(stop_words='english')
            self.tfidf_matrix = self.vectorizer.fit_transform(corpus)
        except Exception:
            # If loading fails, set to None
            self.books_df = None
            self.vectorizer = None
            self.tfidf_matrix = None

    def recommend_global(self, query: str) -> dict | None:
        """Return a global recommendation from the Kaggle dataset.

        The function returns a dictionary with the keys: title, author, year, isbn.
        If the dataset isn't loaded or the model isn't ready, it returns None.
        """
        if self.books_df is None or self.vectorizer is None:
            return None
        if not query:
            return None
        query_vec = self.vectorizer.transform([query])
        # Compute cosine similarities between the query and all titles
        cosine_similarities = linear_kernel(query_vec, self.tfidf_matrix).flatten()
        if cosine_similarities.size == 0:
            return None
        best_idx = cosine_similarities.argmax()
        if best_idx < 0 or best_idx >= len(self.books_df):
            return None
        row = self.books_df.iloc[best_idx]
        return {
            'title': row['Book-Title'],
            'author': row['Book-Author'],
            'year': row['Year-Of-Publication'],
            'isbn': row['ISBN'],
        }

    def recommend_local(self, query: str, reviews: list) -> dict | None:
        """Return a recommendation based on user-submitted reviews.

        The reviews list should contain dictionaries with at least 'title', 'author',
        and 'content' keys. The recommendation is the title whose content or title
        is most similar to the query using TF-IDF. If there aren't enough reviews,
        return None.
        """
        # Require at least 3 reviews to make a meaningful recommendation
        if reviews is None or len(reviews) < 3:
            return None
        # Build a corpus from titles + contents
        texts = [r['title'] + ' ' + r['content'] for r in reviews]
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf = vectorizer.fit_transform(texts)
        query_vec = vectorizer.transform([query])
        similarities = linear_kernel(query_vec, tfidf).flatten()
        if similarities.size == 0:
            return None
        best_idx = similarities.argmax()
        if best_idx < 0 or best_idx >= len(reviews):
            return None
        rec = reviews[best_idx]
        return {
            'title': rec['title'],
            'author': rec['author'],
        }


# Initialize database and recommendation engine at module import
init_db()
RECOMMENDER = RecommendationEngine()


# ---------------------------------------------------------------------------
# HTTP request handler
# ---------------------------------------------------------------------------

class BookServerHandler(http.server.BaseHTTPRequestHandler):
    server_version = "BookServer/1.0"

    def end_headers(self):
        # Always set CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        # Respond to preflight requests for CORS
        self.send_response(200)
        self.end_headers()

    def send_json(self, data: dict | list, status: int = 200):
        response = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def sanitize_text(self, text: str) -> str:
        """Basic sanitation to remove HTML tags and limit length."""
        if not isinstance(text, str):
            return ''
        # Remove script tags
        text = re.sub(r'<\s*script[^>]*>(.*?)<\s*/\s*script>', '', text, flags=re.IGNORECASE | re.DOTALL)
        # Remove any remaining HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        # Trim whitespace and limit length to 5000 characters
        text = text.strip()[:5000]
        return text

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/reviews':
            # Return all reviews as JSON
            try:
                reviews = fetch_reviews()
                self.send_json(reviews)
            except Exception as e:
                self.send_json({'error': 'Failed to fetch reviews', 'detail': str(e)}, status=500)
            return

        # Serve uploaded images
        if path.startswith('/uploads/'):
            filename = path[len('/uploads/'):]
            # Prevent directory traversal
            filename = os.path.basename(filename)
            file_path = os.path.join(UPLOADS_DIR, filename)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                ctype, _ = mimetypes.guess_type(file_path)
                try:
                    with open(file_path, 'rb') as f:
                        data = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', ctype or 'application/octet-stream')
                    self.send_header('Content-Length', str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                except Exception:
                    self.send_response(500)
                    self.end_headers()
            else:
                self.send_response(404)
                self.end_headers()
            return

        # Serve static files
        if path.startswith('/static/'):
            # Remove the leading slash
            rel_path = path[len('/'):]  # 'static/...' -> relative path inside STATIC_DIR
            file_path = os.path.join(STATIC_DIR, rel_path[len('static/'):])
            if os.path.exists(file_path) and os.path.isfile(file_path):
                ctype, _ = mimetypes.guess_type(file_path)
                try:
                    with open(file_path, 'rb') as f:
                        data = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', ctype or 'application/octet-stream')
                    self.send_header('Content-Length', str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                except Exception:
                    self.send_response(500)
                    self.end_headers()
            else:
                self.send_response(404)
                self.end_headers()
            return

        # Default: serve the index page for root or any other unknown path (SPA)
        if path == '/' or path == '' or not path.startswith('/api'):
            index_path = os.path.join(STATIC_DIR, 'index.html')
            if os.path.exists(index_path):
                try:
                    with open(index_path, 'rb') as f:
                        data = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html')
                    self.send_header('Content-Length', str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                except Exception:
                    self.send_response(500)
                    self.end_headers()
            else:
                self.send_response(404)
                self.end_headers()
            return

        # If none of the above matched, return 404
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else b''

        # POST to create a new review
        if path == '/api/reviews':
            try:
                data = json.loads(body.decode('utf-8'))
            except Exception:
                self.send_json({'error': 'Invalid JSON'}, status=400)
                return
            # Extract and sanitize fields
            author = self.sanitize_text(data.get('author', ''))
            title = self.sanitize_text(data.get('title', ''))
            content = self.sanitize_text(data.get('content', ''))
            # Score should be an integer between 0 and 10
            try:
                score = int(data.get('score', 0))
            except Exception:
                score = 0
            if score < 0:
                score = 0
            if score > 10:
                score = 10
            # Validate required fields
            if not author or not title or not content:
                self.send_json({'error': 'Missing required fields'}, status=400)
                return
            # Handle optional image (base64 encoded)
            image_b64 = data.get('image')
            cover_path = None
            if image_b64:
                try:
                    header, _, b64data = image_b64.partition(',')
                    # Determine extension based on MIME type in data URI header
                    ext = 'png'
                    if ';base64' in header and 'image/' in header:
                        mime = header.split(';')[0].split(':')[1]
                        ext = mime.split('/')[-1]
                    # Generate a unique filename
                    timestamp = int(time.time() * 1000)
                    filename = f"cover_{timestamp}.{ext}"
                    file_path = os.path.join(UPLOADS_DIR, filename)
                    with open(file_path, 'wb') as f:
                        f.write(base64.b64decode(b64data))
                    cover_path = file_path
                except Exception:
                    # If decoding fails, ignore the image
                    cover_path = None
            # Insert into DB
            try:
                insert_review(author, title, content, score, cover_path)
                self.send_json({'status': 'success'})
            except Exception as e:
                self.send_json({'error': 'Failed to save review', 'detail': str(e)}, status=500)
            return

        # POST to get recommendations
        if path == '/api/recommendations':
            try:
                data = json.loads(body.decode('utf-8'))
            except Exception:
                self.send_json({'error': 'Invalid JSON'}, status=400)
                return
            query = self.sanitize_text(data.get('query', ''))
            # Compute global recommendation
            global_rec = None
            local_rec = None
            try:
                global_rec = RECOMMENDER.recommend_global(query)
            except Exception:
                global_rec = None
            try:
                all_reviews = fetch_reviews()
                local_rec = RECOMMENDER.recommend_local(query, all_reviews)
            except Exception:
                local_rec = None
            # If local_rec is None, we return a message instead of an object
            response = {}
            if global_rec:
                response['global'] = global_rec
            else:
                response['global'] = None
            if local_rec:
                response['local'] = local_rec
            else:
                response['local'] = None
            self.send_json(response)
            return

        # Unknown POST endpoint
        self.send_response(404)
        self.end_headers()


def run_server(host: str = '0.0.0.0', port: int = 8000):
    """Run the HTTP server."""
    server_address = (host, port)
    httpd = http.server.ThreadingHTTPServer(server_address, BookServerHandler)
    print(f"Starting server at http://{host}:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == '__main__':
    # Render (and many PaaS platforms) provide the port via the PORT env var.
    port = int(os.environ.get('PORT', '8000'))
    run_server(host='0.0.0.0', port=port)