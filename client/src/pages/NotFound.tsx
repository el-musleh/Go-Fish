import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="gf-page-center">
      <div className="gf-card" style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '3rem', marginBottom: 8 }}>404</p>
        <h1 className="gf-card-title">Page not found</h1>
        <p className="gf-muted" style={{ marginBottom: 24 }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/" className="gf-button gf-button--primary">
          Go home
        </Link>
      </div>
    </div>
  );
}
