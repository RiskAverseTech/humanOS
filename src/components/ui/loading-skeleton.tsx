import styles from './loading-skeleton.module.css'

export function Skeleton({ width, height, style }: { width?: string; height?: string; style?: React.CSSProperties }) {
  return <div className={styles.skeleton} style={{ width, height, ...style }} />
}

export function Spinner() {
  return (
    <div className={styles.spinnerCenter}>
      <div className={styles.spinner} />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.titleSkeleton} style={{ width: 280, height: 36 }} />
      <div className={styles.cardGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.cardBody}>
              <div className={styles.skeleton} style={{ height: 32, width: 32 }} />
              <div className={styles.textLine} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.statsRow}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.statCard} />
        ))}
      </div>
      <div className={styles.titleSkeleton} style={{ width: 160 }} />
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.listItem}>
            <div className={styles.skeleton} style={{ width: 20, height: 20 }} />
            <div className={styles.listContent}>
              <div className={styles.textLine} />
            </div>
            <div className={styles.textLineShort} style={{ width: 60 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function NotesListSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.titleBar}>
        <div className={styles.titleSkeleton} />
        <div className={styles.buttonSkeleton} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--space-6)' }}>
        <div className={styles.sidebarSkeleton}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.sidebarItem} />
          ))}
        </div>
        <div>
          <div className={styles.skeleton} style={{ height: 38, marginBottom: 'var(--space-4)' }} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.listItem}>
              <div className={styles.listContent}>
                <div className={styles.textLine} />
                <div className={styles.textLineShort} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function NoteEditorSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.skeleton} style={{ height: 40, width: '60%', marginBottom: 'var(--space-4)' }} />
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <div className={styles.skeleton} style={{ height: 36, width: 150 }} />
        <div className={styles.skeleton} style={{ height: 36, width: 200 }} />
        <div className={styles.skeleton} style={{ height: 36, width: 80 }} />
      </div>
      <div className={styles.skeleton} style={{ height: 36, marginBottom: 'var(--space-2)' }} />
      <div className={styles.skeleton} style={{ height: 300 }} />
    </div>
  )
}

export function VaultSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.titleBar}>
        <div className={styles.titleSkeleton} />
        <div className={styles.buttonSkeleton} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--space-6)' }}>
        <div className={styles.sidebarSkeleton}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.sidebarItem} />
          ))}
        </div>
        <div className={styles.cardGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.card}>
              <div className={styles.cardImage} />
              <div className={styles.cardBody}>
                <div className={styles.textLine} />
                <div className={styles.textLineShort} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ChatSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 'var(--space-4)', height: 'calc(100vh - var(--space-12))', paddingTop: 'var(--space-2)' }}>
      <div style={{ borderRight: '1px solid var(--color-border)', paddingRight: 'var(--space-4)' }}>
        <div className={styles.titleBar}>
          <div className={styles.titleSkeleton} style={{ width: 100 }} />
          <div className={styles.buttonSkeleton} style={{ width: 60 }} />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.listItem}>
            <div className={styles.listContent}>
              <div className={styles.textLine} />
              <div className={styles.textLineShort} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.spinnerCenter}>
        <div className={styles.spinner} />
      </div>
    </div>
  )
}

export function ImagesSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.titleSkeleton} style={{ width: 200, marginBottom: 'var(--space-6)' }} />
      <div className={styles.skeleton} style={{ height: 42, marginBottom: 'var(--space-6)' }} />
      <div className={styles.cardGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.cardImage} style={{ height: 200 }} />
            <div className={styles.cardBody}>
              <div className={styles.textLine} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SettingsSkeleton() {
  return (
    <div className={styles.container} style={{ maxWidth: 700 }}>
      <div className={styles.titleSkeleton} style={{ width: 120, marginBottom: 'var(--space-6)' }} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ marginBottom: 'var(--space-8)', paddingBottom: 'var(--space-6)', borderBottom: '1px solid var(--color-border)' }}>
          <div className={styles.titleSkeleton} style={{ width: 160, marginBottom: 'var(--space-4)' }} />
          <div className={styles.skeleton} style={{ height: 38, marginBottom: 'var(--space-3)' }} />
          <div className={styles.skeleton} style={{ height: 38, marginBottom: 'var(--space-3)' }} />
          <div className={styles.buttonSkeleton} />
        </div>
      ))}
    </div>
  )
}
