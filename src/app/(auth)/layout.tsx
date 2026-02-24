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
          <h1 className={styles.title}>HumanOS</h1>
          <p className={styles.subtitle}>Your private community hub</p>
        </div>
        {children}
      </div>
    </div>
  )
}
