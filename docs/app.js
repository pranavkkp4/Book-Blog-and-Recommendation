const { useState, useEffect } = React;

// Use config.js override if present, otherwise default to local dev.
const API_BASE = (window.BOOK_API_BASE || "http://localhost:8000").replace(/\/$/, "");
const DEFAULT_PAGE = window.APP_PAGE || "blog";

/**
 * Main application component.
 * Controls navigation between blog and recommendation pages.
 */
function App() {
  const page = DEFAULT_PAGE;

  return (
    <>
      <header>
        <h1>Book Hub</h1>
        <nav>
          <button
            className={page === "blog" ? "active" : ""}
            onClick={() => {
              if (page !== "blog") {
                window.location.href = "blog.html";
              }
            }}
          >
            Blog
          </button>
          <button
            className={page === "recommend" ? "active" : ""}
            onClick={() => {
              if (page !== "recommend") {
                window.location.href = "recommendation.html";
              }
            }}
          >
            Recommendation
          </button>
        </nav>
      </header>
      <div className="container">
        {page === "blog" && <BlogPage />}
        {page === "recommend" && <RecommendationPage />}
      </div>
    </>
  );
}

/**
 * Blog page component.
 * Contains form for submitting a new review and displays existing reviews.
 */
function BlogPage() {
  const [reviews, setReviews] = useState([]);
  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [score, setScore] = useState(5);
  const [imageFile, setImageFile] = useState(null);
  const [message, setMessage] = useState("");

  // Fetch reviews from server on mount
  useEffect(() => {
    fetchReviews();
  }, []);

  function fetchReviews() {
    fetch(`${API_BASE}/api/reviews`)
      .then((res) => res.json())
      .then((data) => {
        setReviews(data);
      })
      .catch(() => {
        setReviews([]);
      });
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Clear message
    setMessage("");
    // Prepare payload
    const payload = {
      author: author.trim(),
      title: title.trim(),
      content: content.trim(),
      score: parseInt(score, 10),
    };
    if (!payload.author || !payload.title || !payload.content) {
      setMessage("Please fill in all required fields.");
      return;
    }
    const sendData = (imageBase64) => {
      if (imageBase64) {
        payload.image = imageBase64;
      }
      fetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "success") {
            setMessage("Review submitted successfully!");
            // Reset form fields
            setAuthor("");
            setTitle("");
            setContent("");
            setScore(5);
            setImageFile(null);
            // Refresh reviews
            fetchReviews();
          } else if (data.error) {
            setMessage(data.error);
          }
        })
        .catch(() => {
          setMessage("An error occurred while submitting the review.");
        });
    };
    // If an image file was selected, convert it to base64
    if (imageFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        sendData(reader.result);
      };
      reader.readAsDataURL(imageFile);
    } else {
      sendData(null);
    }
  }

  return (
    <div>
      <h2>Share Your Book Review</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author"
          required
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Book Title"
          required
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Your review..."
          rows="5"
          required
        ></textarea>
        <input
          type="number"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          min="0"
          max="10"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0] || null)}
        />
        <button type="submit">Submit Review</button>
        {message && <p>{message}</p>}
      </form>
      <h2>Recent Reviews</h2>
      {reviews.length === 0 && <p>No reviews yet.</p>}
      {reviews.map((review) => (
        <div key={review.id} className="review-card">
          <h3>{review.title}</h3>
          <p>
            <strong>Author:</strong> {review.author}
          </p>
          <p>
            <strong>Score:</strong> {review.score}/10
          </p>
          {review.cover_url && <img src={review.cover_url} alt="Book cover" />}
          <p>{review.content}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Recommendation page component.
 * Contains a simple quiz for the user to describe their preferences.
 * Sends the query to the server and displays global and local recommendations.
 */
function RecommendationPage() {
  const [query, setQuery] = useState("");
  const [globalRec, setGlobalRec] = useState(null);
  const [localRec, setLocalRec] = useState(null);
  const [message, setMessage] = useState("");

  function handleRecommend(e) {
    e.preventDefault();
    setMessage("");
    setGlobalRec(null);
    setLocalRec(null);
    const q = query.trim();
    if (!q) {
      setMessage("Please enter a description of what you like to read.");
      return;
    }
    fetch(`${API_BASE}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    })
      .then((res) => res.json())
      .then((data) => {
        setGlobalRec(data.global);
        setLocalRec(data.local);
      })
      .catch(() => {
        setMessage("An error occurred while retrieving recommendations.");
      });
  }

  return (
    <div>
      <h2>Get Book Recommendations</h2>
      <form onSubmit={handleRecommend}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe your favorite genres, authors, or topics..."
          rows="4"
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "12px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            fontSize: "14px",
          }}
        ></textarea>
        <button type="submit">Recommend Books</button>
        {message && <p>{message}</p>}
      </form>
      {(globalRec || localRec) && (
        <div className="recommendation-result">
          <h3>Recommendations</h3>
          <div>
            <h4>Global Recommendation</h4>
            {globalRec ? (
              <p>
                <strong>{globalRec.title}</strong> by {globalRec.author} (
                {globalRec.year})
              </p>
            ) : (
              <p>Sorry, no global recommendation available.</p>
            )}
          </div>
          <div>
            <h4>Our Recommendation</h4>
            {localRec ? (
              <p>
                <strong>{localRec.title}</strong> by {localRec.author}
              </p>
            ) : (
              <p>
                Sorry our site does not currently have enough data for Our
                Recommendation.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));
