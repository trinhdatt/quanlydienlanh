import React, { useEffect, useState } from 'react';
import './kiểu-trang-quản-lý.css';
import Operations from './thanh-toán-bảo-hành-báo-cáo';
import Modal from './hộp-thoại';
import ServiceChart from './biểu-đồ-phiếu-dịch-vụ';

const pages = { dashboard: 'Tổng quan', tickets: 'Phiếu dịch vụ', schedule: 'Lịch hẹn', customers: 'Khách hàng', equipment: 'Thiết bị', technicians: 'Kỹ thuật viên', payments: 'Thanh toán', warranty: 'Bảo hành', reports: 'Báo cáo vận hành' };
const icons = ['▦', '▤', '◷', '♙', '◇', '⚙', '₫', '✓', '▥'];
const statuses = ['Mới tiếp nhận', 'Đã phân công', 'Đang thực hiện', 'Hoàn tất', 'Đã hủy'];
const profiles = {
  customers: { phone: 'Số điện thoại', address: 'Địa chỉ' },
  equipment: { category: 'Loại thiết bị', maker: 'Hãng', model: 'Model', location: 'Vị trí lắp' },
  technicians: { phone: 'Số điện thoại' },
};
const active = row => !statuses.slice(3).includes(row.status);
const dateText = date => date?.split('-').reverse().join('/') || '—';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
function info(row) {
  return typeof row?.metadata === 'string' ? JSON.parse(row.metadata) || {} : row?.metadata || {};
}

export default function Management({ brand, page, rows: savedRows, setRows, error, setError, busy, submit, request, logout }) {
  const demo = false;
  const [draft, setDraft] = useState(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('');
  const [status, setStatus] = useState('');
  const [day, setDay] = useState('');
  const [tech, setTech] = useState('');
  const [history, setHistory] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [quick, setQuick] = useState(false);
  const [customer, setCustomer] = useState('');
  const [pendingCustomer, setPendingCustomer] = useState(null);
  const [section, preset = ''] = page.split('/');
  const current = Object.hasOwn(pages, section) ? section : 'dashboard';
  useEffect(() => {
    setDraft(null); setHistory(null); setQuery(''); setView(preset); setStatus(''); setDay(''); setTech('');
  }, [page]);
  const todayDate = today();
  const rows = savedRows;
  const lookup = new Map(rows.map(row => [row.id, row]));
  const tickets = rows.filter(row => row.kind === 'tickets');
  function overlaps(row) {
    const { start, end } = info(row);
    return active(row) && row.appointment && row.technician && start && end && tickets.some(other => {
      const hours = info(other);
      return other.id !== row.id && active(other) && other.technician === row.technician &&
        other.appointment === row.appointment && hours.start && hours.end && start < hours.end && hours.start < end;
    });
  }
  const groups = {
    today: row => row.appointment === todayDate && active(row),
    unassigned: row => !row.technician && active(row),
    overdue: row => row.appointment && row.appointment < todayDate && active(row),
    upcoming: row => row.appointment && row.appointment >= todayDate && active(row),
  };
  const stats = [
    ['today', 'Lịch hôm nay', '◷', 'Cần thực hiện hôm nay'],
    ['unassigned', 'Chưa giao thợ', '♙', 'Đang chờ phân công'],
    ['overdue', 'Quá hẹn', '!', 'Cần kiểm tra tiến độ'],
  ];
  const ticketPage = ['dashboard', 'tickets', 'schedule'].includes(current);
  const operations = ['payments', 'warranty', 'reports'].includes(current);
  const source = current === 'dashboard' ? tickets.slice(0, 6)
    : current === 'schedule' ? tickets.filter(row => row.appointment && row.status !== statuses[4]).sort((a, b) => (a.appointment + (info(a).start || '')).localeCompare(b.appointment + (info(b).start || '')))
    : rows.filter(row => row.kind === current);
  const normalized = query.trim().toLocaleLowerCase('vi');
  const list = source.filter(row => {
    const person = lookup.get(row.customer);
    return (!view || groups[view]?.(row)) && (!status || row.status === status) &&
      (!day || row.appointment === day) && (!tech || String(row.technician) === tech) &&
      [row.title, row.details, person?.title, info(person).phone, ...Object.values(info(row))]
        .join(' ').toLocaleLowerCase('vi').includes(normalized);
  });
  function edit(row) {
    if (demo) return;
    setError(''); setHistory(null); setQuick(row.kind === 'tickets' && !row.id && !row.customer); setCustomerSearch(''); setPendingCustomer(null);
    setCustomer(String(row.customer || '')); setDraft(row);
  }
  const create = () => edit({ kind: ticketPage ? 'tickets' : current, status: statuses[0] });
  function close() { setDraft(null); setError(''); }
  const customerOptions = rows.filter(row => row.kind === 'customers');
  const technicianOptions = rows.filter(row => row.kind === 'technicians');
  const model = info(draft);
  const options = items => items.map(row => <option key={row.id} value={row.id}>{row.title}</option>);
  function table(items, isTicket) {
    return <div className="mg-scroll"><table><thead><tr>{(isTicket
      ? ['Phiếu dịch vụ', 'Khách hàng / Địa chỉ', 'Thiết bị', 'Lịch hẹn', 'Kỹ thuật viên', 'Trạng thái', '']
      : ['Hồ sơ', 'Thông tin', '']).map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{items.map(row => {
        const data = info(row);
        const person = lookup.get(row.customer);
        return <tr key={row.id}><td><strong>{row.title}</strong>{isTicket && <small>#{row.id}{data.service && ' · ' + data.service}</small>}</td>
          {isTicket ? <><td>{person?.title || '—'}<small>{info(person).address}</small></td>
          <td>{lookup.get(row.equipment)?.title || '—'}</td><td>{dateText(row.appointment)}<small>{data.start && data.start + ' – ' + data.end}</small>{overlaps(row) && <span className="mg-tag mg-tag-2">Trùng lịch thợ</span>}</td>
          <td>{lookup.get(row.technician)?.title || 'Chưa giao'}</td>
          <td><span className={'mg-tag mg-tag-' + statuses.indexOf(row.status)}>{row.status}</span></td></>
          : <td>{[data.phone, data.address, data.category, data.maker, data.model, data.location, lookup.get(Number(data.customerId))?.title].filter(Boolean).join(' · ') || row.details || '—'}</td>}
          <td className="mg-actions">{!isTicket && <button onClick={() => setHistory(row)}>Xem hồ sơ</button>}{!demo && <button onClick={() => edit(row)}>Chỉnh sửa</button>}</td></tr>;
      })}{!items.length && <tr><td className="mg-empty" colSpan={isTicket ? 7 : 3}>Không có dữ liệu phù hợp.</td></tr>}</tbody></table></div>;
  }
  async function save(form) {
    const values = Object.fromEntries(form);
    const { newName, newPhone, newAddress, ...record } = values;
    for (const field of ['customer', 'equipment', 'technician']) {
      if (field in record) record[field] = Number(record[field]) || null;
    }
    if (quick && (newName || pendingCustomer)) {
      const id = pendingCustomer || (await request('/records/customers', 'POST', {
        title: newName, phone: newPhone, address: newAddress,
      })).id;
      setPendingCustomer(id);
      record.customer = id;
    }
    if (draft.kind === 'tickets' && record.technician && record.status === statuses[0]) record.status = statuses[1];
    const url = '/records/' + draft.kind + (draft.id ? '/' + draft.id : '');
    await request(url, draft.id ? 'PATCH' : 'POST', record);
    try { setRows(await request('/records')); }
    catch { close(); throw new Error('Đã lưu. Tải lại trang để cập nhật danh sách.'); }
    close();
  }

  return <div className="mg">
    <aside className="mg-nav">
      <div className="mg-brand">{brand}</div>
      <nav aria-label="Điều hướng quản lý">{Object.entries(pages).map(([key, label], i) =>
        <a href={'#' + key} key={key} aria-current={current === key ? 'page' : undefined}><span aria-hidden="true">{icons[i]}</span>{label}</a>)}</nav>
      <button className="mg-logout" onClick={logout}>↪ Đăng xuất</button>
    </aside>
    <main className="mg-main">
      <header className="mg-top"><strong>{pages[current]}</strong><time dateTime={todayDate}>{dateText(todayDate)}</time></header>
      <div className="mg-content">
        <div className="mg-heading"><h1>{pages[current]}</h1>{current !== 'dashboard' && !operations && !demo && <button className="mg-primary" onClick={create}>＋ {ticketPage ? 'Tạo phiếu' : 'Thêm hồ sơ'}</button>}</div>
        {error && !draft && <p className="error" role="alert">{error}</p>}
    {history && <Modal close={() => setHistory(null)} title={history.title}>
      <div className="mg-history"><p>{Object.values(info(history)).filter(value => value !== info(history).customerId).join(' · ') || history.details}</p>
      {history.kind === 'customers' && <><h3>Thiết bị</h3><p>{rows.filter(row => row.kind === 'equipment' && Number(info(row).customerId) === history.id).map(row => row.title).join(', ') || 'Chưa có thiết bị.'}</p></>}
      <h3>{history.kind === 'technicians' ? 'Phiếu đang phụ trách' : 'Lịch sử dịch vụ'}</h3>
      {table(tickets.filter(row => history.kind === 'customers' ? row.customer === history.id : history.kind === 'equipment' ? row.equipment === history.id : row.technician === history.id && active(row)), true)}</div>
    </Modal>}
    {draft && <Modal close={() => { if (!busy) close(); }} title={(draft.id ? 'Chỉnh sửa · ' : 'Tạo mới · ') + pages[draft.kind]}>
      <form onSubmit={event => submit(event, save)}>
        <div className="mg-form">
          <label>{draft.kind === 'tickets' ? 'Tiêu đề phiếu' : 'Tên hồ sơ'}<input name="title" required maxLength="200" defaultValue={draft.title}/></label>
          {Object.entries(profiles[draft.kind] || {}).map(([field, label]) => <label key={field}>{label}<input name={field} type={field === 'phone' ? 'tel' : 'text'} maxLength="200" defaultValue={model[field]}/></label>)}
          {draft.kind === 'equipment' && <label>Khách hàng<select name="customerId" defaultValue={model.customerId || ''}><option value="">Chưa chọn</option>{options(customerOptions)}</select></label>}
          {draft.kind === 'tickets' && <>
            <label>Loại công việc<select name="service" defaultValue={model.service || ''}><option value="">Chọn loại công việc</option><option>Bảo dưỡng</option><option>Sửa chữa</option><option>Lắp đặt</option><option>Kiểm tra</option><option>Bảo hành</option></select></label>
            <div className="mg-quick"><button type="button" disabled={Boolean(pendingCustomer)} onClick={() => setQuick(!quick)}>{quick ? 'Tìm khách đã có' : '＋ Thêm nhanh khách hàng'}</button></div>
            {!quick && <>
              <label>Tìm khách theo tên hoặc số điện thoại<input type="search" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}/></label>
              <label>Khách hàng<select name="customer" value={customer} onChange={e => setCustomer(e.target.value)}><option value="">Chưa chọn</option>{options(customerOptions.filter(row => String(row.id) === customer || [row.title, info(row).phone].join(' ').toLocaleLowerCase('vi').includes(customerSearch.trim().toLocaleLowerCase('vi'))))}</select></label>
            </>}
            {quick && <><label>Tên khách mới<input name="newName" required maxLength="200" readOnly={Boolean(pendingCustomer)}/></label><label>Số điện thoại<input type="tel" name="newPhone" maxLength="40" readOnly={Boolean(pendingCustomer)}/></label><label>Địa chỉ<input name="newAddress" maxLength="200" readOnly={Boolean(pendingCustomer)}/></label></>}
            <label>Thiết bị<select key={quick ? 'new' : customer} name="equipment" defaultValue={!quick && customer === String(draft.customer || '') ? draft.equipment || '' : ''}><option value="">Chưa chọn</option>{options(rows.filter(row => row.kind === 'equipment' && (!info(row).customerId || !quick && String(info(row).customerId) === customer || !quick && row.id === draft.equipment && customer === String(draft.customer || ''))))}</select></label>
            <label>Kỹ thuật viên<select name="technician" defaultValue={draft.technician || ''}><option value="">Chưa phân công</option>{options(technicianOptions)}</select></label>
            <label>Trạng thái<select name="status" defaultValue={draft.status}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Ngày hẹn<input name="appointment" type="date" defaultValue={draft.appointment || ''}/></label>
            <label>Từ giờ<input name="start" type="time" defaultValue={model.start}/></label>
            <label>Đến giờ<input name="end" type="time" defaultValue={model.end}/></label>
            {model.originalTicket && <input type="hidden" name="originalTicket" value={model.originalTicket}/>}
            <label>Số tiền tính cho khách (đ)<input name="charge" inputMode="numeric" pattern="[0-9]{1,12}" defaultValue={model.charge}/></label>
            <label>Bảo hành đến ngày<input name="warrantyUntil" type="date" defaultValue={model.warrantyUntil}/></label>
            <label>Hạng mục bảo hành<input name="warrantyScope" maxLength="200" defaultValue={model.warrantyScope}/></label>
            <label>Chi phí (đ)<input name="cost" inputMode="numeric" pattern="[0-9]{1,12}" maxLength="12" defaultValue={model.cost}/></label>
          </>}
          <label className="mg-wide">{draft.kind === 'tickets' ? 'Yêu cầu của khách / Tình trạng thiết bị' : 'Ghi chú'}<textarea name="details" rows="3" maxLength="1000" defaultValue={draft.details}/></label>
          {draft.kind === 'tickets' && <label className="mg-wide">Kết quả xử lý<textarea name="result" rows="3" maxLength="1000" defaultValue={model.result}/></label>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <footer><button type="button" onClick={close} disabled={busy}>Đóng</button><button className="mg-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button></footer>
      </form>
    </Modal>}
        {current === 'dashboard' && <><div className="mg-stats">{stats.map(([key, label, icon, note]) =>
          <a key={key} className={'mg-card mg-' + key} href={'#tickets/' + key}><b aria-hidden="true">{icon}</b><div>{label}<strong>{tickets.filter(groups[key]).length}</strong><small>{note}</small></div></a>)}</div>
          <div className="mg-overview"><ServiceChart tickets={tickets} todayDate={todayDate}/>
          <section className="mg-panel"><h2>Lịch hôm nay</h2><div className="mg-agenda">{tickets.filter(groups.today).sort((a, b) => (info(a).start || '').localeCompare(info(b).start || '')).slice(0, 5).map(row =>
            <button key={row.id} disabled={demo} onClick={() => edit(row)}><strong>{row.title}</strong><small>{info(row).start || 'Chưa xếp giờ'} · {lookup.get(row.technician)?.title || 'Chưa giao thợ'}</small></button>)}
            {!tickets.some(groups.today) && <p>Chưa có việc cần thực hiện hôm nay.</p>}<a href="#schedule/today">Xem lịch hôm nay →</a></div></section></div></>}
        {operations ? <Operations key={current + demo} {...{ demo, current, rows, tickets, info, lookup, edit, todayDate, dateText, table, options, technicianOptions, request, setRows, submit, busy }}
          createWarranty={row => edit({ kind: 'tickets', status: statuses[0], title: 'Bảo hành · ' + row.title, customer: row.customer, equipment: row.equipment, metadata: { service: 'Bảo hành', originalTicket: String(row.id) } })}/> : <section className="mg-panel">
          <div className="mg-panel-heading"><h2>{current === 'dashboard' ? 'Phiếu gần đây' : 'Danh sách ' + pages[current].toLowerCase()}</h2>{current === 'dashboard' && <a href="#tickets">Xem tất cả →</a>}</div>
          {current !== 'dashboard' && <div className="mg-filters">
            <input aria-label="Tìm kiếm" type="search" placeholder="Tìm tên, số điện thoại…" value={query} onChange={e => setQuery(e.target.value)}/>
            {ticketPage && <>
              <select aria-label="Nhóm công việc" value={view} onChange={e => setView(e.target.value)}><option value="">Tất cả công việc</option><option value="today">Hôm nay</option><option value="upcoming">Sắp tới</option><option value="overdue">Quá hẹn</option><option value="unassigned">Chưa giao thợ</option></select>
              <select aria-label="Trạng thái" value={status} onChange={e => setStatus(e.target.value)}><option value="">Mọi trạng thái</option>{statuses.map(value => <option key={value}>{value}</option>)}</select>
              <input aria-label="Ngày hẹn" type="date" value={day} onChange={e => setDay(e.target.value)}/>
              <select aria-label="Kỹ thuật viên" value={tech} onChange={e => setTech(e.target.value)}><option value="">Tất cả kỹ thuật viên</option>{options(technicianOptions)}</select>
            </>}
          </div>}
          {table(list, ticketPage)}
        </section>}
      </div>
    </main>

  </div>;
}


