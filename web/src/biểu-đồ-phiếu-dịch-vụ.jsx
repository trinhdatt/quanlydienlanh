import React from 'react';

export default function ServiceChart({ tickets, todayDate }) {
  const end = new Date(todayDate + 'T00:00:00Z');
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + index - 5, 1));
    const key = date.toISOString().slice(0, 7);
    return { key, label: 'T' + (date.getUTCMonth() + 1), count: tickets.filter(row => row.status !== 'Đã hủy' && row.appointment?.startsWith(key)).length };
  });
  const step = Math.max(1, Math.ceil(Math.max(...months.map(month => month.count)) / 4));
  const points = months.map(({ count }, i) => [48 + i * 100, 148 - count / (step * 4) * 128]);
  const line = points.map(point => point.join(',')).join(' ');
  return <section className="mg-panel">
    <h2>Phiếu dịch vụ theo tháng hẹn</h2>
    <svg className="mg-chart" viewBox="0 0 585 182" role="img" aria-label={months.map(month => month.key + ': ' + month.count + ' phiếu').join(', ')}>
      <defs><linearGradient id="service-area" x2="0%" y2="100%"><stop stopColor="#48adf2" stopOpacity=".48"/><stop offset="100%" stopColor="#48adf2" stopOpacity=".04"/></linearGradient></defs>
      {[0, 1, 2, 3, 4].map(index => <g key={index}>
        <line x1="48" x2="548" y1={148 - index * 32} y2={148 - index * 32} stroke="#e1e9f2" strokeDasharray="3 3"/>
        <text x="39" y={152 - index * 32} textAnchor="end">{index * step}</text>
      </g>)}
      <polygon points={'48,148 ' + line + ' 548,148'} fill="url(#service-area)"/>
      <polyline points={line} fill="none" stroke="#1687db" strokeWidth="2.5" strokeLinejoin="round"/>
      {points.map(([x, y], index) => <g key={months[index].key}>
        <circle cx={x} cy={y} r="5" fill="#1687db"><title>{months[index].key} · {months[index].count} phiếu</title></circle>
        <text x={x} y="171" textAnchor="middle">{months[index].label}</text>
      </g>)}
    </svg>
  </section>;
}
