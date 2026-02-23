import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <span style={{ fontSize: '4rem' }}>🏠</span>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Page not found</h1>
      <p style={{ color: '#666', fontSize: '0.875rem', maxWidth: 400 }}>
        The page you&apos;re looking for doesn&apos;t exist or you may not have permission to view it.
      </p>
      <Link
        href="/dashboard"
        style={{
          marginTop: '0.5rem',
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#fff',
          backgroundColor: '#2563eb',
          borderRadius: 6,
          textDecoration: 'none',
        }}
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
