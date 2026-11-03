# Chạy và phát triển local

## Docker Compose

Yêu cầu: Docker Engine/Desktop với Compose v2; trên WSL cần bật integration cho distro đang dùng. Chạy từ root repository:

Windows PowerShell (không cần Python trên host):

```powershell
docker desktop start --timeout 60
docker info --format '{{.OSType}}'
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup_env.ps1
docker compose config --quiet
docker compose up --build -d
docker compose exec api python -m app.seed demo
docker compose exec api python -m app.seed create-admin --email admin@example.com
```

`ExecutionPolicy Bypass` chỉ dùng cho tiến trình này, không thay đổi chính sách máy. Lỗi `Python was not found` ở lệnh `python3` trên Windows không ảnh hưởng luồng Docker khi dùng script PowerShell. Python cho API/seed đã có trong container.

Trước khi chạy Compose, `docker info --format '{{.OSType}}'` phải trả `linux`. Lỗi `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified` nghĩa Docker CLI chưa kết nối được Linux engine; mở Docker Desktop và chờ engine sẵn sàng. Nếu chưa có lệnh `docker desktop`, mở ứng dụng từ Start menu. Không cần đổi image nginx hoặc reset database để sửa lỗi kết nối này. WSL Integration chỉ cần khi chạy Docker từ WSL; các lệnh PowerShell ở trên dùng Docker Desktop trực tiếp. `docker compose config --quiet` không thay thế việc kiểm tra kết nối engine.

Linux/macOS/WSL:

```bash
python3 scripts/setup_env.py
docker compose config --quiet
docker compose up --build -d
docker compose exec api python -m app.seed demo
docker compose exec api python -m app.seed create-admin --email admin@example.com
```

Script đầu tạo `.env` với secret ngẫu nhiên, không ghi đè file có sẵn và không in secret. Lệnh create-admin yêu cầu nhập mật khẩu 12+ ký tự, không có tài khoản/password demo hard-code. Mở **http://localhost:3000**, chọn Tạo tài khoản để dùng với quyền USER. Compose chạy migration một lần trước API; không tự seed người dùng hoặc catalog khi startup.

Nếu báo `port is already allocated`, chọn cổng trống trong `.env`: ví dụ `WEB_PORT=3002` và `APP_ORIGIN=http://localhost:3002`, chạy lại `docker compose up -d`, rồi mở URL mới. Giữ nguyên các secret và volumes hiện có; không cần dừng ứng dụng khác. `WEB_PORT` chỉ đổi cổng proxy Docker, không đổi port nội bộ của Next.js hoặc API. Khi chạy Node/API riêng bằng dev scripts, port mặc định vẫn là 3000/8000.

Seed tạo 1.320 **sản phẩm mô phỏng**, 264 ảnh SVG minh họa tự tạo và 16 outfit rules. Metadata và giá được gắn DEMO; đây chưa phải dataset hàng hóa thực tế. Seed chạy lại không tạo trùng hoặc ghi đè giá/stock admin đã sửa. Catalog và ảnh được lưu trong Docker volumes, restart không làm mất dữ liệu.

```bash
docker compose logs --tail=100 api web
docker compose ps
docker compose stop
docker compose start
```

Không dùng `down -v` nếu cần giữ database/ảnh. Frontend không công khai port API/database. Swagger/OpenAPI có thể xem bằng port-forward API local hoặc `/api/v1` contracts trong repo; proxy mặc định chỉ route business API/media, không public Swagger.

## Chạy riêng để phát triển

Yêu cầu Node.js 22, Python 3.12 có venv/pip, PostgreSQL 16+. Tạo database `fashion_dev`, database test riêng `fashion_test`; đặt credentials của bạn trong biến môi trường, không commit. Ví dụ chuỗi cấu hình: `postgresql+psycopg://<user>:<password>@localhost:5432/fashion_dev`.

Trong Ubuntu/WSL, nếu `venv` báo thiếu ensurepip, cần cài gói `python3.12-venv`/`python3-pip` phù hợp Python đang dùng trước, hoặc dùng luồng Docker ở trên.

```bash
python3 -m venv .venv
.venv/bin/pip install -r apps/api/requirements.txt
source .venv/bin/activate
cd apps/api
export DATABASE_URL='<your-development-database-url>'
export APP_ORIGIN='http://localhost:3000'
export MEDIA_ROOT='./media'
alembic upgrade head
python -m app.seed demo
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Activate virtualenv hoặc dùng absolute path tới binary khi gọi `alembic`, `python`, `uvicorn`. Terminal thứ hai:

```bash
cd apps/web
npm ci
npm run dev
```

Next rewrites `/api/*` và `/media/*` tới `http://127.0.0.1:8000`; có thể đặt API_INTERNAL_URL nếu API ở nơi khác. APP_ORIGIN phải khớp chính xác URL mở trên browser để CSRF/Origin check hợp lệ. Không lưu token ở localStorage. Development API hỗ trợ SQLite cho thử nhanh schema, nhưng test suite integration yêu cầu PostgreSQL; production từ chối SQLite.

## Kiểm tra

```bash
cd apps/api
TEST_DATABASE_URL='<your-fashion_test-postgresql-url>' pytest -q
ruff check app tests
ruff format --check app tests migrations
DATABASE_URL='<your-fashion_test-postgresql-url>' alembic check
```

Tests từ chối database không phải PostgreSQL hoặc không tên `fashion_test`/`styleai_test`. Test API dùng savepoint và rollback từng test; migrations/seed ban đầu là thay đổi có chủ ý trong database test.

Từ root, dùng Python virtualenv:

```bash
python scripts/export_openapi.py
cd apps/web
node ../../scripts/generate-client.mjs
npm run typecheck
npm run build
npm run start
```

E2E yêu cầu API đã migrate/seed và web đang chạy. Chromium là development dependency, không vào production image:

```bash
cd apps/web
npx playwright install --with-deps chromium
npm run test:e2e
```

Test E2E tự tạo tài khoản test và saved Looks; chạy với môi trường development/test riêng, không production. Có desktop và mobile, kiểm tra register → profile → generate → hotspot → replace → save → Like → reload → favorite → catalog/detail; thêm keyboard và reduced motion.

CI workflow đã khai báo trong `.github/workflows/ci.yml`; chạy trên GitHub sau khi repo được đưa lên GitHub. Không có remote repository/CI run bên ngoài nào được tự tạo.
