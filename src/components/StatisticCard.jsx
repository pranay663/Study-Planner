export function StatisticCard({ label, value, detail, icon: Icon, tone }) {
  return (
    <article className="statistic-card">
      <div className={`statistic-icon ${tone}`}><Icon size={17} strokeWidth={1.9} /></div>
      <div className="statistic-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
}