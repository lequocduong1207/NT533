# Lab 6 — Kafka Cluster và CDC (Change Data Capture)

Thư mục `kafka-cluster` chứa cấu hình demo dùng Docker Compose để khởi chạy:
- Zookeeper, Kafka broker
- Kafka Connect (source + sink)
- MySQL (source) với thư mục `mysql-init` để khởi tạo dữ liệu
- PostgreSQL (target) với thư mục `postgres-init` để khởi tạo schema

Tập tin quan trọng:
- `docker-compose.yml`: cấu hình các service
- `scripts/check.py`: script Python để kiểm tra tính toàn vẹn dữ liệu và CDC realtime

Chạy thử (từ `Lab 6/kafka-cluster`):

```powershell
docker compose up -d
# Chờ các container khởi động, sau đó kiểm tra
python scripts/check.py
```

Ghi chú:
- Script `scripts/check.py` sử dụng `docker exec` để truy cập container `mysql-source` và `postgres-target`.
- Nếu cần khởi tạo lại dữ liệu, chỉnh các file trong `mysql-init` và `postgres-init` theo yêu cầu.

Người thực hiện: thêm README này và commit các thay đổi.
