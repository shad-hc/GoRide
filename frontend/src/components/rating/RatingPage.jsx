import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ratingAPI } from '../../services/api';
import { useAuthStore } from '../../store';
import '../booking/Dashboard.css';

const PASSENGER_TAGS = ['great_passenger','respectful','on_time_pickup','clear_communication'];
const DRIVER_TAGS    = ['great_driving','safe_driving','on_time','clean_vehicle','friendly','good_route'];

const EMOJI = ['😡','😕','😐','😊','🤩'];

export default function RatingPage() {
  const { id: rideId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [score, setScore] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const tags = user?.role === 'passenger' ? DRIVER_TAGS : PASSENGER_TAGS;
  const display = hovered || score;

  const toggleTag = (tag) =>
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const handleSubmit = async () => {
    if (score < 1) { setError('Please select a rating'); return; }
    setIsLoading(true); setError('');
    try {
      await ratingAPI.submit(rideId, { score, comment, tags: selectedTags });
      setSubmitted(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (e) {
      setError(e.error || 'Failed to submit rating');
    } finally { setIsLoading(false); }
  };

  return (
    <div className="rating-page">
      <div className="rating-card animate-slide-up">
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Thanks for rating!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Redirecting you home…</p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 40 }}>{display ? EMOJI[display - 1] : '⭐'}</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginTop: 8 }}>
                {user?.role === 'passenger' ? 'How was your driver?' : 'How was your passenger?'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                Your feedback helps improve the platform
              </p>
            </div>

            {error && <div className="panel-error">{error}</div>}

            {/* Star selector */}
            <div className="stars">
              {[1,2,3,4,5].map((s) => (
                <span
                  key={s}
                  className={`star ${s <= (hovered || score) ? 'active' : ''}`}
                  onClick={() => setScore(s)}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  role="button"
                  aria-label={`Rate ${s} stars`}
                >
                  ⭐
                </span>
              ))}
            </div>

            {score > 0 && (
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                {['Terrible','Poor','Okay','Good','Excellent!'][score - 1]}
              </p>
            )}

            {/* Quick tags */}
            {score >= 4 && (
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  What went well?
                </p>
                <div className="tags-grid">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      className={`tag-btn ${selectedTags.includes(tag) ? 'selected' : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Comment */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Add a comment (optional)</label>
              <textarea
                className="input"
                style={{ resize: 'vertical', minHeight: 80 }}
                placeholder="Share your experience…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
              />
            </div>

            <button className="btn btn-primary full-btn" onClick={handleSubmit} disabled={isLoading || score < 1}>
              {isLoading ? <span className="spinner" /> : '✓ Submit Rating'}
            </button>

            <button
              className="btn btn-ghost full-btn"
              style={{ marginTop: 8 }}
              onClick={() => navigate('/')}
            >
              Skip for now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
