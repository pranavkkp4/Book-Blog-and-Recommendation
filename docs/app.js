const { useState, useEffect } = React;

// Use config.js override if present, otherwise default to local dev.
const API_BASE = (window.BOOK_API_BASE || "http://localhost:8000").replace(/\/$/, "");
const DEFAULT_PAGE = window.APP_PAGE || "blog";

const QUESTIONS = [
  {
    id: "enjoyable",
    prompt: "What would you find most enjoyable in a book?",
    type: "choice",
    options: [
      "An adventure story that takes a dark turn",
      "An epic drama with a hero whose life you follow from beginning to end",
      "A compulsive plot with sophisticated twists",
      "A sharply observed portrait of the relationship between two young lovers",
      "A complex story about the secrets kept in a small community",
      "A classic coming-of-age story with a protagonist who struggles with mental health",
      "An eerie, nightmarish tale of a Britain gripped by an unnamed oppressive political movement",
      "A sensitive, complicated character looks back on life and what might have been",
    ],
  },
  {
    id: "holiday_1",
    prompt: "Given the chance, how would you choose to spend your holidays this year?",
    type: "choice",
    options: [
      "On an island somewhere tropical with plenty of jungle to explore",
      "On a road trip across the USA, racing along a highway in a convertible",
      "At a faded luxury hotel somewhere in Europe - a modern day Grand Budapest Hotel",
      "Interrailing around southern Europe, and not just to the tourist hotspots",
      "Somewhere rural, with a village pub and plenty of paths along which to hike",
      "In New York, with a hotel just near Central Park",
      "In an English seaside town, with cream teas and windswept beaches",
      "In the English countryside in high summer",
    ],
  },
  {
    id: "dinner_party",
    prompt: "Who would be the first name on the invitation to your fantasy dinner party?",
    type: "choice",
    options: [
      "Stephen King",
      "David Attenborough",
      "Charles Dickens",
      "Ali Smith",
      "Madonna",
      "James Baldwin",
      "Audre Lorde",
      "Maria Callas",
      "Mike Tyson",
      "Tom Brady",
      "Shanon Sharpe",
      "Skip Bayless",
      "Sabrina Carpenter",
      "Taylor Swift",
      "Lebron James",
      "Terrel Owens",
      "Chad Ochocinco",
    ],
  },
  {
    id: "resolution",
    prompt: "What did you resolve to change this year?",
    type: "choice",
    options: [
      "To spend more time appreciating the magic of the everyday",
      "To make the world a better place in whatever small way I can",
      "To get out into the world, travel and have some fun",
      "To learn more about forgotten histories and political activism",
      "To make time to read my subscription to The New Yorker",
      "To keep up with current affairs",
      "To go on an adventure and take more risks",
      "To head to the library more often, and to read more books",
    ],
  },
  {
    id: "writing_style",
    prompt: "Which type of writing most appeals to you?",
    type: "choice",
    options: [
      "A pacy narrative with twists and turns",
      "Heartbreaking prose and a story driven by character development",
      "All about the action: a fast-moving plot above all",
      "Prose that is rooted in the twenty-first century and how we live our lives",
      "Haunting and restrained literary prose",
      "Conversational, informal first-person narrative",
      "Strange, haunting and otherworldly, conjured with few words",
      "First person narrative - but can you trust the narrator?",
    ],
  },
  {
    id: "fiction_pref",
    prompt: "Do you prefer fiction or nonfiction?",
    type: "choice",
    options: ["Fiction", "Nonfiction"],
  },
  {
    id: "genre",
    prompt: "Which fiction genre are you looking to read next?",
    type: "choice",
    options: [
      "General Fiction",
      "Historical Fiction",
      "Romance",
      "Mystery & Thriller",
      "Science Fiction & Fantasy",
    ],
  },
  {
    id: "last_book",
    prompt: "Tell us the title of the last book you loved",
    type: "text",
    placeholder: "Type the title here",
  },
  {
    id: "length_pref",
    prompt: "Do you prefer long reads or short books?",
    type: "choice",
    options: ["Long reads", "Short reads", "No preference"],
  },
  {
    id: "classic_pref",
    prompt: "Do you like classic or contemporary fiction?",
    type: "choice",
    options: ["Classic", "Contemporary"],
  },
  {
    id: "care_about",
    prompt: "When reading you care most about:",
    type: "choice",
    options: [
      "The characters",
      "The dialogue",
      "The romance",
      "Learning new things",
      "Escaping to a new world",
      "Switching off",
    ],
  },
];

/**
 * Main application component.
 * Controls navigation between blog and recommendation pages.
 */
function App() {
  const page = DEFAULT_PAGE;

  return (
    <div className="app">
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
    </div>
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
  const [loadError, setLoadError] = useState("");

  // Fetch reviews from server on mount
  useEffect(() => {
    fetchReviews();
  }, []);

  function fetchReviews() {
    fetch(`${API_BASE}/api/reviews`)
      .then((res) => res.json())
      .then((data) => {
        setReviews(data);
        setLoadError("");
      })
      .catch(() => {
        setReviews([]);
        setLoadError(
          "Backend may be waking up. If you're using Render's free tier, wait 30-60 seconds and refresh."
        );
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

  function handleDelete(reviewId) {
    const passcode = window.prompt("Enter delete passcode:");
    if (!passcode) {
      return;
    }
    if (!window.confirm("Delete this review? This cannot be undone.")) {
      return;
    }
    fetch(`${API_BASE}/api/reviews/${reviewId}`, {
      method: "DELETE",
      headers: {
        "X-Delete-Passcode": passcode,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "deleted") {
          setMessage("Review deleted.");
          fetchReviews();
        } else if (data.error) {
          setMessage(data.error);
        } else {
          setMessage("Unable to delete review.");
        }
      })
      .catch(() => {
        setMessage("An error occurred while deleting the review.");
      });
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
        <div>
          <input
            type="number"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            min="0"
            max="10"
          />
          <small className="helper-text">
            Score from 0 to 10 to rate the book.
          </small>
        </div>
        <div className="file-input">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files[0] || null)}
          />
          <small className="helper-text">
            Optional: upload a cover image for the book.
          </small>
        </div>
        <button type="submit">Submit Review</button>
        {message && <p className="alert alert-success">{message}</p>}
      </form>
      <h2>Recent Reviews</h2>
      {loadError && <p className="alert alert-warning">{loadError}</p>}
      {reviews.length === 0 && <p>No reviews yet.</p>}
      {reviews.map((review) => (
        <div key={review.id} className="review-card">
          <h3>{review.title}</h3>
          <button
            className="delete-btn"
            type="button"
            onClick={() => handleDelete(review.id)}
          >
            Delete
          </button>
          <p>
            <strong>Author:</strong> {review.author}
          </p>
          <p>
            <strong>Score:</strong> {review.score}/10
          </p>
          {review.cover_url && (
            <img src={`${API_BASE}${review.cover_url}`} alt="Book cover" />
          )}
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
  const total = QUESTIONS.length;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(() => QUESTIONS.map(() => ""));
  const [globalRec, setGlobalRec] = useState(null);
  const [localRec, setLocalRec] = useState(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const current = QUESTIONS[step];
  const currentAnswer = answers[step] || "";

  function updateAnswer(value) {
    setAnswers((prev) => {
      const next = [...prev];
      next[step] = value;
      return next;
    });
    setGlobalRec(null);
    setLocalRec(null);
    setShowResults(false);
    if (message) {
      setMessage("");
    }
  }

  function canProceed() {
    if (!current) {
      return false;
    }
    if (current.type === "text") {
      return currentAnswer.trim().length > 0;
    }
    return currentAnswer !== "";
  }

  function buildQuery() {
    return QUESTIONS.map((question, index) => {
      const answer = (answers[index] || "").trim();
      if (!answer) {
        return "";
      }
      return `${question.prompt} ${answer}`;
    })
      .filter(Boolean)
      .join(" . ");
  }

  function submitRecommendations() {
    if (isSubmitting) {
      return;
    }
    const queryText = buildQuery();
    if (!queryText) {
      setMessage("Please answer the questions before submitting.");
      return;
    }
    setIsSubmitting(true);
    setMessage("");
    setGlobalRec(null);
    setLocalRec(null);
    setShowResults(false);
    fetch(`${API_BASE}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: queryText }),
    })
      .then((res) => res.json())
      .then((data) => {
        setGlobalRec(data.global);
        setLocalRec(data.local);
        setShowResults(true);
      })
      .catch(() => {
        setMessage(
          "Backend may be waking up. If you're using Render's free tier, wait 30-60 seconds and try again."
        );
        setShowResults(false);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  function goNext() {
    if (!canProceed()) {
      setMessage(
        current && current.type === "text"
          ? "Please enter a response to continue."
          : "Please choose an option to continue."
      );
      return;
    }
    setMessage("");
    if (step < total - 1) {
      setStep(step + 1);
      return;
    }
    submitRecommendations();
  }

  function goBack() {
    if (step > 0) {
      setStep(step - 1);
      setMessage("");
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    goNext();
  }

  return (
    <div>
      <h2>Get Book Recommendations</h2>
      <form onSubmit={handleFormSubmit}>
        <div className="quiz-card">
          <div className="progress">
            <div
              className="progress-bar"
              style={{
                width: `${Math.round(((step + 1) / total) * 100)}%`,
              }}
            ></div>
          </div>
          <div className="progress-text">
            Question {step + 1} of {total}
          </div>
          <h3 className="question-title">{current.prompt}</h3>
          {current.type === "choice" ? (
            <div className="choice-grid">
              {current.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`choice-button${
                    currentAnswer === option ? " selected" : ""
                  }`}
                  onClick={() => updateAnswer(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <input
              className="text-input"
              type="text"
              value={currentAnswer}
              onChange={(e) => updateAnswer(e.target.value)}
              placeholder={current.placeholder || "Type your answer"}
            />
          )}
          {message && <p className="alert alert-warning">{message}</p>}
          <div className="nav-row">
            <button
              type="button"
              className="secondary-btn"
              onClick={goBack}
              disabled={step === 0}
            >
              {"< Back"}
            </button>
            <button
              type="submit"
              className="primary-btn"
              disabled={!canProceed() || isSubmitting}
            >
              {step < total - 1
                ? "Next >"
                : isSubmitting
                ? "Finding..."
                : "Get Recommendations"}
            </button>
          </div>
        </div>
      </form>
      {showResults && (
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
          {!globalRec && !localRec && (
            <p className="alert alert-warning">
              We couldn't generate recommendations yet. Make sure the Kaggle
              dataset is loaded on the backend and at least three reviews exist
              for local recommendations.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));
