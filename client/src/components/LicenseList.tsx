import { useState, useEffect, useMemo } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';

interface License {
  name: string;
  version: string;
  license: string;
  publisher: string | null;
}

function getPackageUrl(name: string): string {
  return `https://www.npmjs.com/package/${name}`;
}

export function LicenseList() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/licenses.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load licenses');
        return res.json();
      })
      .then((data) => {
        setLicenses(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load');
        setLoading(false);
      });
  }, []);

  const sortedLicenses = useMemo(() => {
    return [...licenses].sort((a, b) => {
      if (a.license === 'MIT' && b.license !== 'MIT') return -1;
      if (b.license === 'MIT' && a.license !== 'MIT') return 1;
      if (a.license === 'Apache 2.0' && b.license !== 'Apache 2.0') return -1;
      if (b.license === 'Apache 2.0' && a.license !== 'Apache 2.0') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [licenses]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px' }}>
        <Loader2 size={16} className="animate-spin" />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading licenses...</span>
      </div>
    );
  }

  if (error) {
    return (
      <p style={{ fontSize: '0.85rem', color: 'var(--color-error)' }}>
        Failed to load licenses: {error}
      </p>
    );
  }

  return (
    <div className="gf-stack gf-stack--sm">
      {/* Summary */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div
          style={{
            background: 'var(--bg-subtle)',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}
        >
          <strong>{licenses.filter((l) => l.license === 'MIT').length}</strong> MIT
        </div>
        <div
          style={{
            background: 'var(--bg-subtle)',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}
        >
          <strong>{licenses.filter((l) => l.license === 'Apache 2.0').length}</strong> Apache 2.0
        </div>
        <div
          style={{
            background: 'var(--bg-subtle)',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}
        >
          <strong>{licenses.filter((l) => l.license === 'ISC').length}</strong> ISC
        </div>
        <div
          style={{
            background: 'var(--bg-subtle)',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}
        >
          <strong>
            {
              licenses.filter(
                (l) => l.license === 'Unknown' || !['MIT', 'Apache 2.0', 'ISC'].includes(l.license)
              ).length
            }
          </strong>{' '}
          Other
        </div>
      </div>

      {/* License List */}
      <div
        style={{
          maxHeight: '400px',
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead
            style={{
              position: 'sticky',
              top: 0,
              background: 'var(--bg-surface)',
              zIndex: 1,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                }}
              >
                Package
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                }}
              >
                Version
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                }}
              >
                License
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '10px 12px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                }}
              >
                Link
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedLicenses.map((pkg, index) => (
              <tr
                key={index}
                style={{
                  borderBottom:
                    index < sortedLicenses.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ fontWeight: 500 }}>{pkg.name}</span>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>v{pkg.version}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      background:
                        pkg.license === 'MIT'
                          ? 'rgba(var(--accent-rgb), 0.15)'
                          : pkg.license === 'Apache 2.0'
                            ? 'rgba(66, 133, 244, 0.15)'
                            : pkg.license === 'ISC'
                              ? 'rgba(34, 197, 94, 0.15)'
                              : 'var(--bg-subtle)',
                      color:
                        pkg.license === 'MIT'
                          ? 'var(--accent)'
                          : pkg.license === 'Apache 2.0'
                            ? '#4285f4'
                            : pkg.license === 'ISC'
                              ? 'var(--color-success)'
                              : 'var(--text-muted)',
                    }}
                  >
                    {pkg.license === 'Unknown' ? 'See package' : pkg.license}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <a
                    href={getPackageUrl(pkg.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--accent)',
                      textDecoration: 'none',
                      fontSize: '0.8rem',
                    }}
                  >
                    npm <ExternalLink size={12} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
