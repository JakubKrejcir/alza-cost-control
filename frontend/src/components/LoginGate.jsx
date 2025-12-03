import { useState, useEffect } from 'react';
import api from '../lib/api';

/**
 * LoginGate - Ochrana aplikace heslem
 * Zobrazí login obrazovku, pokud uživatel není přihlášen
 */
export default function LoginGate({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Kontrola existujícího tokenu při načtení
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        await api.post('/auth/verify', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsAuthenticated(true);
      } catch (err) {
        // Token neplatný, smazat
        localStorage.removeItem('auth_token');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await api.post('/auth/login', { password });
      
      if (response.data.success && response.data.token) {
        localStorage.setItem('auth_token', response.data.token);
        setIsAuthenticated(true);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Chyba přihlášení');
      setPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingSpinner}></div>
      </div>
    );
  }

  // Přihlášen - zobraz aplikaci
  if (isAuthenticated) {
    return children;
  }

  // Login formulář
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo / Header */}
        <div style={styles.header}>
          <div style={styles.logoIcon}>🚚</div>
          <h1 style={styles.title}>TransportBrain</h1>
          <p style={styles.subtitle}>Řízení dopravy pro Alzu</p>
        </div>

        {/* Formulář */}
        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Heslo</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Zadejte heslo"
              style={styles.input}
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              ...styles.button,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
            disabled={isSubmitting || !password}
          >
            {isSubmitting ? 'Ověřuji...' : 'Přihlásit se'}
          </button>
        </form>

        {/* Footer */}
        <p style={styles.footer}>
          Přístup pouze pro oprávněné osoby
        </p>
      </div>
    </div>
  );
}

// Logout helper pro použití v aplikaci
export const logout = () => {
  const token = localStorage.getItem('auth_token');
  
  if (token) {
    // Zavolat backend logout (optional, token expiruje sám)
    api.post('/auth/logout', {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
  }
  
  localStorage.removeItem('auth_token');
  window.location.reload();
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    padding: '20px',
  },
  
  card: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
  },
  
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  
  logoIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  
  title: {
    margin: '0 0 8px 0',
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e',
    letterSpacing: '-0.5px',
  },
  
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#6b7280',
  },
  
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  
  input: {
    padding: '14px 16px',
    fontSize: '16px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    ':focus': {
      borderColor: '#3b82f6',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
    },
  },
  
  button: {
    padding: '14px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    marginTop: '8px',
  },
  
  error: {
    padding: '12px 16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '14px',
    textAlign: 'center',
  },
  
  footer: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#9ca3af',
  },
  
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

// CSS pro spinner animaci (přidat do index.css nebo App.css)
const spinnerCSS = `
@keyframes spin {
  to { transform: rotate(360deg); }
}
`;

// Inject spinner CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = spinnerCSS;
  document.head.appendChild(style);
}
