# Phát hành, backup và restore

Compose hiện tại dành cho local/demo một máy, không cấu hình TLS công khai. Trước deploy production cần HTTPS ingress, APP_ENV=production, APP_ORIGIN=https://domain, JWT_SECRET riêng ≥32 ký tự, PostgreSQL private và volume/object backup. API từ chối secret mặc định, HTTP origin hoặc SQLite trong production. Không bật public port cho database. Cookie Secure chỉ bật production.

## Backup đồng bộ

Chọn maintenance window để tránh thay đổi DB/ảnh trong lúc chụp. Từ root:

```bash
docker compose stop proxy web api
umask 077
mkdir -p backups
docker compose exec -T postgres sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/database.dump
docker compose run --rm --no-deps --entrypoint tar api -C /app/media -czf - . > backups/media.tar.gz
docker compose start api web proxy
```

`backups/` phải private và không commit; sao chép ra thiết bị/storage khác, giữ manifest ngày giờ và image/git version. Tệp dump có dữ liệu tài khoản/password hash nên cần quyền truy cập phù hợp. Không upload ra ngoài hoặc chia sẻ tự động.

## Restore drill vào môi trường tách biệt

Tạo một checkout và Compose project/volumes mới, cấu hình credentials riêng và port khác (override port trong Compose); không chạy restore đè database gốc. Đích là database rỗng. Sau khi PostgreSQL healthy, restore:

```bash
docker compose -p styleai-restore exec -T postgres sh -c 'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < backups/database.dump
docker compose -p styleai-restore run -T --rm --no-deps --entrypoint tar api -C /app/media -xzf - < backups/media.tar.gz
```

Khi restore tar qua stdin cần `-T` cho `compose run` nếu terminal tự cấp TTY. Không bật auto migration vào DB rỗng trước restore dump đã có schema; bootstrap restore chỉ start postgres, sau đó restore, rồi up API/web/proxy. Kiểm tra alembic head, product count, ảnh mẫu, saved Look và đăng nhập. RPO 24h/RTO 4h là mục tiêu đề xuất, chưa đo trên hạ tầng hosting.

## Release/rollback

Backup trước migration; ưu tiên additive schema. Chạy migration job một lần, sau đó start API, kiểm tra readiness và smoke flow. Nếu app lỗi mà schema tương thích, quay lại image trước. Không tự downgrade destructive migration; có thể forward-fix hoặc restore theo quy trình đã kiểm chứng ở môi trường riêng.

## Giới hạn vận hành ban đầu

Một instance API với rate limiter trong memory; nhiều instance cần shared limiter hoặc gateway policy. Chưa có transactional email/password recovery, GDPR-style self-service account deletion, monitoring service ngoài hoặc scheduled retention cleanup. Các TTL session/plan/idempotency đã được kiểm tra khi sử dụng; cleanup dữ liệu cũ cần một maintenance job trước vận hành lâu dài. Storage adapter đang dùng local volume; S3 là extension point chưa triển khai. Chưa có TLS/hosting/cloud deployment tự động.
