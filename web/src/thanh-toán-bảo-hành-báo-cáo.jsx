import React, { useState } from 'react';
import Modal from './hộp-thoại';

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const services = ['Bảo dưỡng', 'Sửa chữa', 'Lắp đặt', 'Kiểm tra', 'Bảo hành'];

export default function Operations({ demo, current, rows, tickets, info, lookup, edit, todayDate, dateText, table,
  options, technicianOptions, request, setRows, submit, busy, createWarranty }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tech, setTech] = useState('');
  const [service, setService] = useState('');
  const [payment, setPayment] = useState(null);
  const completed = tickets.filter(row => row.status === 'Hoàn tất');
  const receipts = rows.filter(row => row.kind === 'payments');
  const matches = row => [row.id, row.title, lookup.get(row.customer)?.title, info(lookup.get(row.customer)).phone]
    .join(' ').toLocaleLowerCase('vi').includes(query.trim().replace(/^#/, '').toLocaleLowerCase('vi'));
  const search = <input type="search" aria-label="Tìm phiếu" placeholder="Mã phiếu, khách hàng, số điện thoại…" value={query} onChange={e => setQuery(e.target.value)}/>;
  const cards = items => <div className="mg-stats">{items.map(([label, value, action]) => action
    ? <button type="button" className="mg-card mg-metric" key={label} onClick={action}>{label}<strong>{value}</strong></button>
    : <div className="mg-card mg-metric" key={label}>{label}<strong>{value}</strong></div>)}</div>;
  const grid = (headers, items) => <div className="mg-scroll"><table><thead><tr>{headers.map(label => <th key={label}>{label}</th>)}</tr></thead>
    <tbody>{items.length ? items : <tr><td colSpan={headers.length} className="mg-empty">Không có dữ liệu phù hợp.</td></tr>}</tbody></table></div>;

  if (current === 'payments') {
    const accounts = completed.map(row => {
      const history = receipts.filter(entry => Number(info(entry).originalTicket) === row.id);
      const paid = history.reduce((sum, entry) => sum + Number(info(entry).amount), 0);
      const charge = info(row).charge === undefined ? null : Number(info(row).charge);
      return { row, history, paid, charge, balance: charge === null ? null : Math.max(0, charge - paid) };
    });
    const total = key => accounts.reduce((sum, item) => sum + (item[key] || 0), 0);
    const selected = accounts.find(item => item.row.id === payment);
    return <>
      {cards([['Tổng tiền phải thu', money(total('charge'))], ['Đã thu', money(total('paid'))], ['Còn phải thu', money(total('balance'))]])}
      <section className="mg-panel"><div className="mg-panel-heading"><h2>Thanh toán theo phiếu hoàn tất</h2></div>
        <div className="mg-filters">{search}</div>
        {grid(['Phiếu', 'Khách hàng', 'Tiền tính cho khách', 'Đã thu', 'Còn phải thu', 'Thao tác'], accounts.filter(item => matches(item.row)).map(item =>
          <tr key={item.row.id}><td><strong>{item.row.title}</strong><small>#{item.row.id}</small></td><td>{lookup.get(item.row.customer)?.title || '—'}</td>
            <td>{item.charge === null ? 'Chưa nhập' : money(item.charge)}</td><td>{money(item.paid)}</td><td>{item.balance === null ? '—' : money(item.balance)}</td>
            <td className="mg-actions">{!demo && <button onClick={() => edit(item.row)}>{item.charge === null ? 'Nhập số tiền' : 'Mở phiếu'}</button>}
              {item.charge !== null && <button onClick={() => setPayment(item.row.id)}>{!demo && item.balance ? 'Ghi nhận thanh toán' : 'Xem khoản thu'}</button>}</td></tr>))}
        {selected && <Modal title={'Khoản thu · Phiếu #' + payment} close={() => { if (!busy) setPayment(null); }}><form className="mg-form" onSubmit={event => submit(event, async data => {
          const amount = String(data.get('amount'));
          if (Number(amount) <= 0 || Number(amount) > selected.balance) throw new Error('Số tiền phải lớn hơn 0 và không vượt số còn phải thu.');
          await request('/records/payments', 'POST', { title: 'Thanh toán phiếu #' + payment, originalTicket: String(payment), amount, details: data.get('details') });
          setPayment(null);
          setRows(await request('/records'));
        })}>
          <div className="mg-wide">{selected.history.length ? <ul>{selected.history.map(entry => <li key={entry.id}>{money(Number(info(entry).amount))}{entry.details && ' · ' + entry.details}</li>)}</ul> : 'Chưa ghi nhận khoản thu.'}</div>
          {!demo && selected.balance > 0 && <><label>Số tiền (đ)<input name="amount" type="number" required min="1" max={selected.balance}/></label>
            <label>Ghi chú<input name="details" maxLength="200"/></label></>}
          <div className="mg-actions"><button type="button" disabled={busy} onClick={() => setPayment(null)}>Đóng</button>
            {!demo && selected.balance > 0 && <button className="mg-primary" disabled={busy}>Lưu khoản thu</button>}</div>
        </form></Modal>}
      </section>
    </>;
  }

  if (current === 'warranty') {
    const soon = new Date(todayDate + 'T00:00:00Z');
    soon.setUTCDate(soon.getUTCDate() + 30);
    const cutoff = soon.toISOString().slice(0, 10);
    const groups = ['Còn hạn', 'Sắp hết hạn', 'Hết hạn'];
    const warranties = completed.filter(row => info(row).warrantyUntil).map(row => {
      const end = info(row).warrantyUntil;
      return { row, end, group: end < todayDate ? groups[2] : end <= cutoff ? groups[1] : groups[0] };
    });
    return <>
      {cards(groups.map(group => [group, warranties.filter(item => item.group === group).length, () => setFilter(group)]))}
      <section className="mg-panel"><div className="mg-panel-heading"><h2>Bảo hành theo phiếu dịch vụ</h2></div>
        <div className="mg-filters">{search}<select aria-label="Tình trạng bảo hành" value={filter} onChange={e => setFilter(e.target.value)}><option value="">Tất cả tình trạng</option>{groups.map(group => <option key={group}>{group}</option>)}</select></div>
        {grid(['Phiếu gốc', 'Khách hàng / Thiết bị', 'Hạng mục', 'Hết hạn', 'Tình trạng', 'Thao tác'], warranties.filter(item => (!filter || filter === item.group) && matches(item.row)).map(({ row, end, group }) =>
          <tr key={row.id}><td><strong>{row.title}</strong><small>#{row.id}</small></td><td>{lookup.get(row.customer)?.title || '—'}<small>{lookup.get(row.equipment)?.title}</small></td>
            <td>{info(row).warrantyScope || '—'}</td><td>{dateText(end)}</td><td><span className="mg-tag">{group}</span></td><td className="mg-actions">
              {!demo && <button onClick={() => edit(row)}>Mở phiếu</button>}{!demo && end >= todayDate && <button onClick={() => createWarranty(row)}>Tạo phiếu bảo hành</button>}</td></tr>))}
      </section>
    </>;
  }

  const period = tickets.filter(row => (!from || row.appointment && row.appointment >= from) &&
    (!to || row.appointment && row.appointment <= to) && (!tech || String(row.technician) === tech) &&
    (!service || info(row).service === service));
  const measures = {
    'Tất cả phiếu': () => true,
    'Phiếu hoàn tất': row => row.status === 'Hoàn tất',
    'Quá hẹn chưa xong': row => row.appointment && row.appointment < todayDate && !['Hoàn tất', 'Đã hủy'].includes(row.status),
  };
  const weeks = new Map();
  for (const row of period) {
    if (!row.appointment) continue;
    const date = new Date(row.appointment + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const monday = date.toISOString().slice(0, 10);
    weeks.set(monday, (weeks.get(monday) || 0) + 1);
  }
  return <>
    <section className="mg-panel mg-report"><div className="mg-filters">
      <label>Từ ngày hẹn <input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label>
      <label>Đến ngày hẹn <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}/></label>
      <select aria-label="Kỹ thuật viên" value={tech} onChange={e => setTech(e.target.value)}><option value="">Tất cả kỹ thuật viên</option>{options(technicianOptions)}</select>
      <select aria-label="Loại dịch vụ" value={service} onChange={e => setService(e.target.value)}><option value="">Tất cả dịch vụ</option>{services.map(value => <option key={value}>{value}</option>)}</select>
    </div></section>
    {cards(Object.entries(measures).map(([label, check]) => [label, period.filter(check).length, () => setFilter(label)]))}
    <div className="mg-overview"><section className="mg-panel"><h2>Số phiếu theo tuần hẹn</h2><div className="mg-bars">
      {!weeks.size && <p>Chưa có phiếu được xếp lịch.</p>}
      {[...weeks].sort(([a], [b]) => a.localeCompare(b)).map(([week, count]) => <div key={week}><span>{dateText(week)}</span><progress aria-label={'Tuần từ ' + dateText(week)} value={count} max={Math.max(...weeks.values())}/><strong>{count}</strong></div>)}
    </div></section><section className="mg-panel"><h2>Khối lượng theo kỹ thuật viên</h2>
      {grid(['Kỹ thuật viên', 'Số phiếu'], technicianOptions.filter(row => !tech || String(row.id) === tech).map(row => <tr key={row.id}><td>{row.title}</td><td>{period.filter(ticket => ticket.technician === row.id).length}</td></tr>))}
    </section></div>
    <section className="mg-panel"><div className="mg-panel-heading"><h2>{filter || 'Tất cả phiếu'}</h2></div>{table(period.filter(measures[filter || 'Tất cả phiếu']), true)}</section>
  </>;
}
