# Quản lý bảo dưỡng và sửa chữa điện lạnh

Ứng dụng quản lý khách hàng, thiết bị, kỹ thuật viên, lịch hẹn và phiếu dịch vụ. Mỗi tài khoản có dữ liệu riêng.

## Các mục trong thư mục dự án

| Mục | Dùng để làm gì |
| --- | --- |
| `web/src/` | Mã giao diện, gồm các màn hình và định dạng hiển thị. |
| `api/src/` | Mã máy chủ, xử lý đăng nhập, dữ liệu và kết nối MySQL. |
| `web/index.html` | Tệp HTML dùng để mở giao diện. |
| `api/.env.example` và `web/.env.example` | Mẫu cấu hình để tạo tệp `.env` trên máy. |
| `package.json` | Khai báo các lệnh chạy dự án và thư viện cần cài. Có một tệp ở thư mục gốc và một tệp cho mỗi phần `web`, `api`. |
| `package-lock.json` | Ghi lại phiên bản chính xác của các thư viện để npm cài nhất quán. |
| `web/vercel.json` và `render.yaml` | Cấu hình đưa giao diện lên Vercel và máy chủ lên Render. |
| `.gitignore` | Danh sách tệp và thư mục Git bỏ qua, gồm cả tệp `.env` chứa thông tin cấu hình riêng. |

VS Code ẩn `node_modules` (thư viện đã cài), `.npm-cache` (bộ nhớ đệm npm) và `dist` (kết quả tạo bản chạy) khỏi cây thư mục. Có thể hiện lại trong mục **Files: Exclude** của phần cài đặt vùng làm việc.

## Xem trước giao diện đăng nhập và đăng ký

Dùng Node.js từ phiên bản 22.12. Tại thư mục gốc, chạy:

~~~sh
npm ci
npm run build
npm run preview
~~~

Mở địa chỉ Vite in ra. Để gửi biểu mẫu hoặc sử dụng các màn hình quản lý, hãy chạy cả máy chủ và MySQL theo phần dưới.

## Chạy đầy đủ trên máy

1. Dùng MySQL 8 và tạo cơ sở dữ liệu rỗng, ví dụ `dienlanh`.
2. Sao chép `api/.env.example` thành `api/.env` và `web/.env.example` thành `web/.env`. Điền chuỗi kết nối MySQL vào `DATABASE_URL` trong `api/.env`. Tạo khóa ký bằng lệnh sau và điền kết quả vào `JWT_SECRET`.

   ~~~sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ~~~

3. Tại thư mục gốc, chạy các lệnh sau để cài thư viện, tạo bản chạy và thiết lập các bảng trong cơ sở dữ liệu.

   ~~~sh
   npm ci
   npm run build
   npm run migrate -w api
   ~~~

4. Mở hai cửa sổ dòng lệnh tại thư mục gốc. Chạy `npm run api` ở cửa sổ thứ nhất và `npm run web` ở cửa sổ thứ hai.
5. Mở [giao diện trên máy](http://localhost:5173), đăng ký tài khoản rồi tạo khách hàng, thiết bị và kỹ thuật viên để liên kết với phiếu dịch vụ.

## Đưa lên mạng

1. Đưa mã nguồn và `package-lock.json` lên GitHub. Git bỏ qua các tệp `.env` thật.
2. Tạo MySQL trên Aiven. Dùng địa chỉ kết nối bắt đầu bằng `mysql://` làm `DATABASE_URL` và dùng chứng chỉ CA dạng PEM của cơ sở dữ liệu đó làm `DB_CA` để xác minh kết nối TLS.
3. Tạo dịch vụ web trên Render từ kho mã nguồn hoặc dùng Blueprint với `render.yaml`. Dùng thư mục gốc của dự án, lệnh tạo bản chạy `npm ci && npm run build -w api` và lệnh khởi động `npm run start -w api`. Thiết lập `DATABASE_URL`, `DB_CA`, `JWT_SECRET` và `WEB_ORIGIN`. Giá trị `WEB_ORIGIN` là địa chỉ HTTPS chính xác của giao diện Vercel, bỏ dấu gạch chéo cuối.
4. Chạy `npm run migrate -w api` trước lần khởi động đầu tiên và mỗi khi có thay đổi cấu trúc cơ sở dữ liệu. Có thể chạy từ máy đã tạo bản chạy với `api/.env` trỏ tới Aiven. Khi máy chủ sẵn sàng, đường dẫn `/health` trả về `{"ok":true}`.
5. Trên Vercel, nhập cùng kho mã nguồn, chọn thư mục `web` và khung ứng dụng Vite. Đặt `VITE_API_URL` thành địa chỉ HTTPS của máy chủ Render, bỏ dấu gạch chéo cuối. Triển khai lại sau khi đổi biến này để Vite dùng địa chỉ mới. Đăng ký tài khoản và thử tạo phiếu sau khi triển khai.
