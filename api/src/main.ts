import { BadRequestException, Body, ConflictException, Controller, Get, Headers, Module, NotFoundException, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import db from './database';

const derive = promisify(scrypt);
const kinds = ['tickets', 'customers', 'equipment', 'technicians', 'payments'];
const statuses = ['Mới tiếp nhận', 'Đã phân công', 'Đang thực hiện', 'Hoàn tất', 'Đã hủy'];
const jwt = new JwtService({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '8h' } });

function credentials(body: Record<string, unknown>) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body?.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      typeof password !== 'string' || password.length < 7 || password.length > 128) {
    throw new BadRequestException('Email hợp lệ và mật khẩu từ 7 đến 128 ký tự.');
  }
  return { email, password };
}

function owner(header: string | undefined): number {
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Vui lòng đăng nhập.');
  try { return jwt.verify(header.slice(7), { algorithms: ['HS256'] }).sub; }
  catch { throw new UnauthorizedException('Phiên đăng nhập đã hết hạn.'); }
}

async function recordValues(account: number, kind: string, body: Record<string, unknown>) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const details = typeof body?.details === 'string' ? body.details.trim() : '';
  if (!kinds.includes(kind) || !title || title.length > 200 || details.length > 1000) {
    throw new BadRequestException('Kiểm tra tên và nội dung.');
  }
  if (kind !== 'tickets') return [title, details, '', null, null, null, null];
  const { status, appointment } = body;
  const date = typeof appointment === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(appointment)
    ? new Date(appointment + 'T00:00:00Z') : null;
  if (typeof status !== 'string' || !statuses.includes(status) ||
      (appointment && (!date || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== appointment || date.getUTCFullYear() < 1000))) {
    throw new BadRequestException('Kiểm tra trạng thái và ngày hẹn.');
  }
  const links = [];
  for (const [field, target] of [['customer', 'customers'], ['equipment', 'equipment'], ['technician', 'technicians']]) {
    const value = body[field];
    if (value === null || value === undefined || value === '') { links.push(null); continue; }
    if (!Number.isSafeInteger(value) || !(await db.query(
      'SELECT id FROM records WHERE id=? AND owner=? AND kind=?', [value, account, target],
    )).length) throw new BadRequestException('Thông tin liên kết không hợp lệ.');
    links.push(value);
  }
  return [title, details, status, appointment || null, ...links];
}

async function metadata(account: number, kind: string, body: Record<string, unknown>) {
  const fields: Record<string, string[]> = {
    tickets: ['service', 'start', 'end', 'result', 'cost', 'charge', 'warrantyUntil', 'warrantyScope', 'originalTicket'],
    payments: ['amount', 'originalTicket'],
    customers: ['phone', 'address'],
    equipment: ['category', 'maker', 'model', 'location', 'customerId'],
    technicians: ['phone'],
  };
  const data: Record<string, string> = {};
  for (const field of fields[kind] ?? []) {
    const value = body[field];
    if (value === undefined || value === '') continue;
    if (typeof value !== 'string' || value.length > 1000) throw new BadRequestException('Thông tin hồ sơ không hợp lệ.');
    data[field] = value.trim();
  }
  const time = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  if ((data.start || data.end) && (!body.appointment || !time.test(data.start) || !time.test(data.end) || data.start >= data.end)) {
    throw new BadRequestException('Chọn ngày và khung giờ hợp lệ.');
  }
  if (data.cost && !/^[0-9]{1,12}$/.test(data.cost)) throw new BadRequestException('Chi phí không hợp lệ.');
  if (data.customerId && (!/^[0-9]{1,10}$/.test(data.customerId) || !(await db.query(
    "SELECT id FROM records WHERE id=? AND owner=? AND kind='customers'", [data.customerId, account],
  )).length)) throw new BadRequestException('Khách hàng của thiết bị không hợp lệ.');
  for (const field of ['charge', 'amount']) {
    if (data[field] && !/^[0-9]{1,12}$/.test(data[field])) throw new BadRequestException('Số tiền không hợp lệ.');
  }
  if (data.warrantyUntil) {
    const date = new Date(data.warrantyUntil + 'T00:00:00Z');
    if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== data.warrantyUntil) throw new BadRequestException('Ngày hết hạn không hợp lệ.');
  }
  if (kind === 'payments' && (!Number(data.amount) || !data.originalTicket)) throw new BadRequestException('Chọn phiếu và nhập khoản thu.');
  if (data.originalTicket && (!/^[0-9]{1,10}$/.test(data.originalTicket) || !(await db.query(
    "SELECT id FROM records WHERE id=? AND owner=? AND kind='tickets' AND status='Hoàn tất'", [data.originalTicket, account],
  )).length)) throw new BadRequestException('Phiếu gốc phải đã hoàn tất.');
  return JSON.stringify(data);
}

@Controller()
class Api {
  @Get('health') health() { return { ok: true }; }

  @Post('auth/register')
  async register(@Body() body: Record<string, unknown>) {
    const { email, password } = credentials(body);
    if (password.length > 12 || password !== password.trim()) {
      throw new BadRequestException('Mật khẩu cần từ 7 đến 12 ký tự, không có khoảng trắng ở đầu hoặc cuối.');
    }
    if (body.confirmPassword !== password) {
      throw new BadRequestException('Mật khẩu nhập lại không khớp.');
    }
    const salt = randomBytes(16).toString('hex');
    const hash = await derive(password, salt, 64) as Buffer;
    try {
      const result = await db.query('INSERT INTO accounts (email,password) VALUES (?,?)', [email, salt + ':' + hash.toString('hex')]);
      return { token: jwt.sign({ sub: result.insertId }) };
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw new ConflictException('Email đã được đăng ký.');
      throw error;
    }
  }

  @Post('auth/login')
  async login(@Body() body: Record<string, unknown>) {
    const { email, password } = credentials(body);
    const [account] = await db.query('SELECT id,password FROM accounts WHERE email=?', [email]);
    const [salt, hash] = account?.password.split(':') ?? ['0'.repeat(32), '0'.repeat(128)];
    const candidate = await derive(password, salt, 64) as Buffer;
    if (!timingSafeEqual(candidate, Buffer.from(hash, 'hex')) || !account) throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    return { token: jwt.sign({ sub: account.id }) };
  }

  @Get('records')
  list(@Headers('authorization') header: string) {
    return db.query('SELECT id,kind,title,details,status,appointment,customer,equipment,technician,metadata FROM records WHERE owner=? ORDER BY id DESC', [owner(header)]);
  }

  @Post('records/import-starter')
  async importStarter(@Headers('authorization') header: string, @Body() body: { rows: Record<string, unknown>[] }) {
    const account = owner(header);
    const rows = body?.rows;
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 60 ||
        rows.some(row => !row || !Number.isSafeInteger(row.id) || typeof row.kind !== 'string' || !kinds.includes(row.kind)) ||
        new Set(rows.map(row => row.id)).size !== rows.length) {
      throw new BadRequestException('Bộ dữ liệu khởi tạo không hợp lệ.');
    }
    return db.transaction(async manager => {
      await manager.query('SELECT id FROM accounts WHERE id=? FOR UPDATE', [account]);
      const existing = await manager.query('SELECT id, kind, title, customer, equipment, status, appointment FROM records WHERE owner=? ORDER BY id FOR UPDATE', [account]);
      if (existing.length) {
        const oldCustomers = ['Nguyễn Minh Anh', 'Trần Hoàng Nam'].map(title =>
          existing.find((row: { kind: string; title: string }) => row.kind === 'customers' && row.title === title));
        const oldTickets = existing.filter((row: { kind: string; customer: number; equipment: number }) =>
          row.kind === 'tickets' && row.equipment && oldCustomers.some(customer => customer?.id === row.customer));
        if (!oldCustomers.every(Boolean) || oldTickets.length !== 12 ||
            existing.some((row: { kind: string; title: string }) => row.kind === 'customers' && row.title === 'Võ Thu Hà') ||
            !oldTickets.some((row: { title: string }) => row.title === 'Vệ sinh máy lạnh') ||
            !oldTickets.some((row: { title: string }) => row.title === 'Kiểm tra tủ lạnh kém lạnh')) return { count: 0 };

        const added = new Map<number, number>();
        for (const kind of ['customers', 'technicians', 'equipment']) {
          for (const row of rows.filter(item => item.kind === kind && Number(item.id) >= 30)) {
            const extra = row.metadata as Record<string, unknown>;
            const values = await recordValues(account, kind, row);
            const data = JSON.parse(await metadata(account, kind, { ...extra, customerId: '' }));
            if (kind === 'equipment') {
              const customer = added.get(Number(extra?.customerId));
              if (!customer) throw new BadRequestException('Thiết bị thiếu khách hàng.');
              data.customerId = String(customer);
            }
            const result = await manager.query(
              'INSERT INTO records (owner,kind,title,details,status,metadata) VALUES (?,?,?,?,?,?)',
              [account, kind, values[0], values[1], '', JSON.stringify(data)],
            );
            added.set(Number(row.id), result.insertId);
          }
        }
        const upcoming = oldTickets.find((row: { title: string }) => row.title === 'Kiểm tra tủ lạnh kém lạnh');
        const completed = oldTickets.filter((row: { status: string }) => row.status === 'Hoàn tất').sort((a: { appointment: string }, b: { appointment: string }) => b.appointment.localeCompare(a.appointment));
        if (added.size !== 30 || completed.length !== 9) throw new BadRequestException('Bộ dữ liệu nâng cấp không hợp lệ.');
        for (const [index, ticket] of completed.entries()) {
          await manager.query('UPDATE records SET customer=?, equipment=?, technician=? WHERE owner=? AND id=?',
            [added.get(30 + index), added.get(50 + index), added.get(40 + index), account, ticket.id]);
        }
        await manager.query('UPDATE records SET customer=?, equipment=? WHERE owner=? AND id=?',
          [added.get(39), added.get(59), account, upcoming.id]);
        const first = oldTickets.find((row: { title: string }) => row.title === 'Vệ sinh máy lạnh');
        const third = oldTickets.find((row: { title: string }) => row.title === 'Kiểm tra máy lạnh chảy nước');
        if (third && first.customer === third.customer) {
          await manager.query('UPDATE records SET title=?, customer=?, equipment=? WHERE owner=? AND id=?',
            ['Kiểm tra tủ lạnh đọng nước', upcoming.customer, upcoming.equipment, account, third.id]);
        }
        return { count: added.size };
      }
      const ids = new Map<unknown, number>();
      const ordered = ['customers', 'technicians', 'equipment', 'tickets', 'payments'];
      for (const kind of ordered) {
        for (const row of rows.filter(item => item.kind === kind)) {
          const extra = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};
          const clean = kind === 'payments' ? {} : JSON.parse(await metadata(account, kind, { ...extra, appointment: row.appointment, customerId: '', originalTicket: '' }));
          const link = (id: unknown) => ids.get(Number(id)) ?? null;
          const values = await recordValues(account, kind, { ...row, customer: null, equipment: null, technician: null });
          if (kind === 'equipment' && extra.customerId) clean.customerId = String(link(extra.customerId));
          if (kind === 'payments') {
            const original = rows.find(item => item.id === Number(extra.originalTicket) && item.kind === 'tickets' && item.status === 'Hoàn tất');
            const amount = typeof extra.amount === 'string' && /^[0-9]{1,12}$/.test(extra.amount) ? Number(extra.amount) : 0;
            if (!original || !amount || !link(original.id)) throw new BadRequestException('Khoản thu khởi tạo không hợp lệ.');
            clean.amount = String(amount);
            clean.originalTicket = String(link(original.id));
          }
          const result = await manager.query(
            'INSERT INTO records (owner,kind,title,details,status,appointment,customer,equipment,technician,metadata) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [account, kind, ...values.slice(0, 4), link(row.customer), link(row.equipment), link(row.technician), JSON.stringify(clean)],
          );
          ids.set(row.id, result.insertId);
        }
      }
      return { count: ids.size };
    });
  }

  @Post('records/expand-starter')
  async expandStarter(@Headers('authorization') header: string) {
    const account = owner(header);
    return db.transaction(async manager => {
      await manager.query('SELECT id FROM accounts WHERE id=? FOR UPDATE', [account]);
      const records = await manager.query('SELECT * FROM records WHERE owner=? ORDER BY id FOR UPDATE', [account]);
      const read = (row: { metadata: any }) => typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {};
      const sampleCustomer = records.find((row: any) => row.kind === 'customers' && row.title === 'Nguyễn Minh Anh' && read(row).phone === '0900000001');
      const anchor = records.find((row: any) => row.kind === 'tickets' && row.title === 'Vệ sinh máy lạnh' && row.customer === sampleCustomer?.id);
      if (!anchor || read(anchor).starterExpanded) return { count: 0 };
      const sampleTitles = ['Thay cảm biến tủ lạnh', 'Vệ sinh máy lạnh phòng khách', 'Xử lý tắc đường thoát nước',
        'Thay quạt dàn lạnh tủ lạnh', 'Bảo dưỡng máy lạnh định kỳ', 'Thay gioăng cửa tủ lạnh',
        'Kiểm tra và xử lý máy lạnh kêu', 'Vệ sinh dàn ngưng tủ lạnh', 'Thay tụ máy lạnh'];
      const sample = sampleTitles.map(title => {
        const matches = records.filter((row: any) => row.kind === 'tickets' && row.status === 'Hoàn tất' &&
          row.title === title && row.details && read(row).result === 'Đã chạy thử và bàn giao cho khách.');
        return matches.length === 1 ? matches[0] : null;
      });
      if (sample.some(row => !row)) return { count: 0 };
      async function collect(id: number, amount: number) {
        await manager.query("INSERT INTO records (owner,kind,title,details,status,metadata) VALUES (?,'payments',?,?,'',?)",
          [account, 'Thanh toán phiếu #' + id, 'Khoản thu bộ hồ sơ khởi tạo', JSON.stringify({ originalTicket: String(id), amount: String(amount) })]);
      }
      for (const [index, row] of sample.entries()) {
        const paid = records.filter((entry: any) => entry.kind === 'payments' && Number(read(entry).originalTicket) === row.id)
          .reduce((sum: number, entry: any) => sum + Number(read(entry).amount), 0);
        const remaining = Number(read(row).charge) - paid - (index === 0 ? 100000 : 0);
        if (remaining > 0) await collect(row.id, remaining);
      }
      const date = new Date();
      for (let index = 0; index < 18; index++) {
        const source = sample[index % sample.length];
        const data = read(source);
        const scheduled = new Date(date);
        scheduled.setUTCDate(scheduled.getUTCDate() - (index < 12 ? 5 + index * 9 : index - 12));
        const status = index < 12 ? 'Hoàn tất' : index < 15 ? 'Đã phân công' : 'Mới tiếp nhận';
        const title = index < 12 ? 'Kiểm tra định kỳ · ' + source.title : 'Kiểm tra thiết bị tại nhà';
        const charge = String(280000 + index % 7 * 65000);
        const result = await manager.query(
          "INSERT INTO records (owner,kind,title,details,status,appointment,customer,equipment,technician,metadata) VALUES (?,'tickets',?,?,?,?,?,?,?,?)",
          [account, title, 'Kiểm tra tình trạng và vận hành thiết bị.', status, scheduled.toISOString().slice(0,10),
            source.customer, source.equipment, index < 15 ? source.technician : null,
            JSON.stringify({ service: data.service, ...(index < 12 ? { charge, result: 'Đã bàn giao cho khách.' } : {}) })],
        );
        if (index < 12) await collect(result.insertId, Number(charge));
      }
      await manager.query("UPDATE records SET metadata=JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.starterExpanded', true) WHERE owner=? AND id=?", [account, anchor.id]);
      return { count: 18 };
    });
  }

  @Post('records/:kind')
  async create(@Headers('authorization') header: string, @Param('kind') kind: string, @Body() body: Record<string, unknown>) {
    const account = owner(header);
    const values = await recordValues(account, kind, body);
    if (kind === 'payments') {
      const payment = JSON.parse(await metadata(account, kind, body));
      return db.transaction(async manager => {
        const [ticket] = await manager.query(
          "SELECT metadata FROM records WHERE id=? AND owner=? AND kind='tickets' AND status='Hoàn tất' FOR UPDATE",
          [payment.originalTicket, account],
        );
        const data = typeof ticket?.metadata === 'string' ? JSON.parse(ticket.metadata) : ticket?.metadata;
        const [receipt] = await manager.query(
          "SELECT COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.amount')) AS UNSIGNED)),0) AS paid FROM records WHERE owner=? AND kind='payments' AND JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.originalTicket'))=?",
          [account, payment.originalTicket],
        );
        if (!data?.charge || Number(payment.amount) > Number(data.charge) - Number(receipt.paid)) {
          throw new BadRequestException('Khoản thu vượt số tiền còn phải thu.');
        }
        const result = await manager.query(
          'INSERT INTO records (owner,kind,title,details,status,metadata) VALUES (?,?,?,?,?,?)',
          [account, kind, values[0], values[1], '', JSON.stringify(payment)],
        );
        return { id: result.insertId };
      });
    }
    const result = await db.query('INSERT INTO records (owner,kind,title,details,status,appointment,customer,equipment,technician,metadata) VALUES (?,?,?,?,?,?,?,?,?,?)', [account, kind, ...values, await metadata(account, kind, body)]);
    return { id: result.insertId };
  }

  @Patch('records/:kind/:id')
  async update(@Headers('authorization') header: string, @Param('kind') kind: string, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const account = owner(header);
    if (kind === 'payments') throw new BadRequestException('Khoản thu đã ghi nhận không thể chỉnh sửa.');
    if (!/^\d+$/.test(id)) throw new BadRequestException('Mã hồ sơ không hợp lệ.');
    const values = await recordValues(account, kind, body);
    const data = await metadata(account, kind, body);
    const result = await db.query('UPDATE records SET title=?,details=?,status=?,appointment=?,customer=?,equipment=?,technician=?,metadata=CASE WHEN JSON_EXTRACT(metadata, \'$.starterExpanded\') IS NOT NULL THEN JSON_SET(?, \'$.starterExpanded\', true) ELSE ? END WHERE owner=? AND kind=? AND id=?', [...values, data, data, account, kind, id]);
    if (!result.affectedRows) throw new NotFoundException('Không tìm thấy hồ sơ.');
    return { ok: true };
  }
}

@Module({ controllers: [Api] })
class App {}

async function start() {
  if (!process.env.DATABASE_URL || (process.env.JWT_SECRET?.length ?? 0) < 32) {
    throw new Error('Configure DATABASE_URL and JWT_SECRET (32+ characters).');
  }
  await db.initialize();
  const app = await NestFactory.create(App);
  const origins = (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',').map(origin => origin.trim()).filter(Boolean);
  app.enableCors({ origin: origins });
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
start().catch(error => { console.error(error); process.exit(1); });


