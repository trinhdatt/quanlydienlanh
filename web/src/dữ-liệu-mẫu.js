export function demoRecords(today) {
  const date = offset => {
    const value = new Date(today + 'T00:00:00Z');
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const jobs = [
    ['Thay cảm biến tủ lạnh', 2, 920000, 180],
    ['Vệ sinh máy lạnh phòng khách', 1, 350000, 30],
    ['Xử lý tắc đường thoát nước', 1, 480000, 90],
    ['Thay quạt dàn lạnh tủ lạnh', 2, 780000, 180],
    ['Bảo dưỡng máy lạnh định kỳ', 1, 420000, 30],
    ['Thay gioăng cửa tủ lạnh', 2, 560000, 90],
    ['Kiểm tra và xử lý máy lạnh kêu', 1, 650000, 90],
    ['Vệ sinh dàn ngưng tủ lạnh', 2, 390000, 30],
    ['Thay tụ máy lạnh', 1, 720000, 180],
  ];
  const customers = ['Võ Thu Hà', 'Phan Đức Long', 'Bùi Ngọc Mai', 'Đặng Thanh Tùng', 'Hồ Gia Hân', 'Lý Minh Khôi', 'Đỗ Thảo Vy', 'Vũ Quang Hưng', 'Mai Bảo Trâm', 'Ngô Anh Tuấn'];
  const technicians = ['Đinh Minh Phúc', 'Huỳnh Văn Sơn', 'Trương Đức Thành', 'Cao Quốc Bảo', 'Lâm Thanh Bình', 'Đoàn Hoàng Hải', 'Tạ Anh Dũng', 'Châu Minh Nhật', 'Phùng Hữu Phước', 'Lưu Văn Tài'];
  const districts = ['Tân Bình', 'Gò Vấp', 'Quận 3', 'Bình Thạnh', 'Quận 7', 'Tân Phú', 'Quận 10', 'Quận 11', 'Quận 6', 'Phú Nhuận'];
  const profiles = customers.flatMap((title, i) => {
    const fridge = i < jobs.length ? jobs[i][1] === 2 : true;
    return [
      { id: 30 + i, kind: 'customers', title, metadata: { address: districts[i] } },
      { id: 40 + i, kind: 'technicians', title: technicians[i] },
      { id: 50 + i, kind: 'equipment', title: fridge ? 'Tủ lạnh gia đình' : 'Máy lạnh treo tường',
        metadata: { customerId: String(30 + i), category: fridge ? 'Tủ lạnh' : 'Máy lạnh', maker: fridge ? 'Panasonic' : 'Daikin', location: fridge ? 'Bếp' : 'Phòng khách' } },
    ];
  });
  return [
    ...profiles,
    { id: 1, kind: 'customers', title: 'Nguyễn Minh Anh', metadata: { phone: '0900000001', address: 'Địa chỉ mẫu · Quận 7' } },
    { id: 2, kind: 'customers', title: 'Trần Hoàng Nam', metadata: { phone: '0900000002', address: 'Địa chỉ mẫu · Bình Thạnh' } },
    { id: 3, kind: 'equipment', title: 'Máy lạnh phòng khách', metadata: { customerId: '1', category: 'Máy lạnh', maker: 'Daikin', location: 'Phòng khách' } },
    { id: 4, kind: 'equipment', title: 'Tủ lạnh gia đình', metadata: { customerId: '2', category: 'Tủ lạnh', maker: 'Panasonic', location: 'Bếp' } },
    { id: 5, kind: 'technicians', title: 'Lê Văn Khoa', metadata: { phone: '0900000003' } },
    { id: 6, kind: 'technicians', title: 'Phạm Quốc Huy', metadata: { phone: '0900000004' } },
    { id: 7, kind: 'tickets', title: 'Vệ sinh máy lạnh', customer: 1, equipment: 3, technician: 5, appointment: today, status: 'Đã phân công', metadata: { service: 'Bảo dưỡng', start: '09:00', end: '10:00' } },
    { id: 8, kind: 'tickets', title: 'Kiểm tra tủ lạnh kém lạnh', customer: 39, equipment: 59, appointment: date(1), status: 'Mới tiếp nhận', metadata: { service: 'Kiểm tra' } },
    { id: 9, kind: 'tickets', title: 'Kiểm tra tủ lạnh đọng nước', customer: 2, equipment: 4, technician: 6, appointment: date(-2), status: 'Đang thực hiện', metadata: { service: 'Sửa chữa' } },
    ...[8, 23, 35, 58, 69, 88, 115, 134, 158].map((days, index) => {
      const [title, , charge, warrantyDays] = jobs[index];
      const maintenance = [1, 4, 7].includes(index);
      return {
        id: index + 10, kind: 'tickets', title, customer: 30 + index, equipment: 50 + index, technician: 40 + index,
        appointment: date(-days), status: 'Hoàn tất',
        details: maintenance ? 'Khách yêu cầu bảo dưỡng và kiểm tra hoạt động.' : 'Khách báo thiết bị hoạt động bất thường.',
        metadata: { service: maintenance ? 'Bảo dưỡng' : 'Sửa chữa', charge: String(charge),
          result: 'Đã chạy thử và bàn giao cho khách.', warrantyUntil: date(warrantyDays - days),
          warrantyScope: maintenance ? 'Hạng mục vệ sinh đã thực hiện' : title },
      };
    }),
    { id: 20, kind: 'payments', title: 'Thu một phần phiếu #10', metadata: { originalTicket: '10', amount: '820000' } },
    { id: 21, kind: 'payments', title: 'Thanh toán phiếu vệ sinh máy lạnh', metadata: { originalTicket: '11', amount: '350000' } },
    { id: 22, kind: 'payments', title: 'Thanh toán phiếu thay gioăng cửa', metadata: { originalTicket: '15', amount: '560000' } },
    ...jobs.slice(2).map((job, index) => ({
      id: 70 + index, kind: 'payments', title: 'Thanh toán · ' + job[0],
      metadata: { originalTicket: String(12 + index), amount: String(job[2]) },
    })),
  ].sort((a, b) => b.id - a.id);
}
