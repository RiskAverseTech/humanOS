import styles from './auth-layout.module.css'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <h1 className={styles.title}>FamilyOS</h1>
          <p className={styles.subtitle}>Your private family hub</p>
        </div>
        {children}
      </div>
    </div>
  )
}
