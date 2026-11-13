import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './kiểu-giao-diện-chung.css';
import Management from './trang-quản-lý';
import { demoRecords } from './dữ-liệu-mẫu';

const localPreview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const api = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '') ||
  (localPreview ? 'http://localhost:3000' : '');

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('token') || '');
  const [page, setPage] = useState(() => location.hash.slice(1) || 'dashboard');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function navigate(next) {
    location.hash = next;
  }

  useEffect(() => {
    function updatePage() {
      setPage(location.hash.slice(1) || 'dashboard');
      setError('');
      setShowPassword(false);
    }
    window.addEventListener('hashchange', updatePage);
    return () => window.removeEventListener('hashchange', updatePage);
  }, []);

  function logout() {
    sessionStorage.removeItem('token');
    setToken('');
    setRows([]);
    navigate('login');
  }

  async function request(path, method = 'GET', body, signal) {
    if (!localPreview && !api.startsWith('https://')) {
      throw new Error('Máy chủ dịch vụ chưa được cấu hình. Vui lòng liên hệ quản trị viên.');
    }
    let response;
    try {
      response = await fetch(api + path, {
        method, signal,
        headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: 'Bearer ' + token }) },
        body: body && JSON.stringify(body),
      });
    } catch (failure) {
      if (failure.name === 'AbortError') throw failure;
      throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.');
    }
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && token) logout();
    if (!response.ok) throw new Error(data.message || 'Không thể thực hiện thao tác.');
    return data;
  }

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    async function loadRecords() {
      const signal = controller.signal;
      const records = await request('/records', 'GET', undefined, signal);
      if (signal.aborted) return records;
      setRows(records);
      const starter = records.filter(row => row.kind === 'customers');
      const sample = starter.some(row => row.title === 'Nguyễn Minh Anh');
      if (!records.length || (sample && starter.some(row => row.title === 'Trần Hoàng Nam') && !starter.some(row => row.title === 'Võ Thu Hà'))) {
        const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
        await request('/records/import-starter', 'POST', { rows: demoRecords(today) }, signal);
      }
      if (!records.length || sample) {
        await request('/records/expand-starter', 'POST', {}, signal);
        return request('/records', 'GET', undefined, signal);
      }
      return records;
    }
    loadRecords().then(records => {
      if (!controller.signal.aborted) setRows(records);
    }).catch(failure => {
      if (failure.name !== 'AbortError') setError(failure.message);
    });
    return () => controller.abort();
  }, [token]);

  async function submit(event, action) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try { await action(new FormData(event.currentTarget)); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  if (!token) {
    const registering = page === 'register';
    return <main className="auth">
      <section className="auth-cover">
        <Brand stacked/>
        <div className="auth-orbit auth-orbit-energy" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="13" y="10" width="22" height="33" rx="4"/>
            <path d="M20 10V6h8v4M25 17l-7 11h7l-2 8 7-11h-7z"/>
          </svg>
        </div>
        <div className="auth-orbit auth-orbit-repair" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M37 6a9 9 0 0 0-11 11L7 36a3.5 3.5 0 0 0 5 5l19-19A9 9 0 0 0 42 11l-6 6-5-5z"/>
            <path d="m7 7 5 2 2 5-2 2-5-2-2-5zM13 15l9 9m5 7 10 10a3 3 0 0 0 4-4L31 27"/>
          </svg>
        </div>
      </section>
      <section className="auth-panel"><form onSubmit={event => submit(event, async data => {
        if (registering) {
          const password = data.get('password');
          if (password !== password.trim()) {
            throw new Error('Mật khẩu không được có khoảng trắng ở đầu hoặc cuối.');
          }
          if (password !== data.get('confirmPassword')) throw new Error('Mật khẩu nhập lại không khớp.');
        }
        const result = await request('/auth/' + (registering ? 'register' : 'login'), 'POST', Object.fromEntries(data));
        sessionStorage.setItem('token', result.token);
        setToken(result.token);
        navigate('dashboard');
      })}>
        <h2>{registering ? 'Đăng ký' : 'Đăng nhập'}</h2>
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength="254"/></label>
        <div className="auth-password">
          <label>Mật khẩu<input name="password" type={showPassword ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} required minLength="7" maxLength={registering ? 12 : 128} aria-describedby={registering ? 'password-rules' : undefined}/></label>
          <button type="button" onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</button>
        </div>
        {registering && <>
          <p className="muted password-rules" id="password-rules">Từ 7 đến 12 ký tự. Không đặt khoảng trắng ở đầu hoặc cuối.</p>
          <label>Nhập lại mật khẩu<input name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength="7" maxLength="12"/></label>
        </>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Đang xử lý…' : registering ? 'Đăng ký' : 'Đăng nhập'}</button>
        <p className="muted">{registering ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} <a href={registering ? '#login' : '#register'}>{registering ? 'Đăng nhập' : 'Đăng ký'}</a></p>
      </form></section>
    </main>;
  }

  return <Management brand={<Brand stacked/>} key={token} {...{ page, rows, setRows, error, setError, busy, submit, request, logout }}/>;
}

function Brand({ stacked = false }) {
  return <div className="brand">
    <span aria-hidden="true">❄</span>
    {stacked ? <div className="brand-name">
      <div className="brand-name-first">Điệ</div><div className="brand-name-first">n Lạnh</div>
      <div className="brand-name-second">Quốc Dũng</div>
    </div> : 'Điện Lạnh Quốc Dũng'}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);

