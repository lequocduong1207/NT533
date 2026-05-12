# Kafka KRaft Cluster với SASL_SSL và ACL

Tài liệu này mô tả các bước tuần tự để triển khai và kiểm thử Kafka KRaft cluster với xác thực SASL_SSL và phân quyền ACL trên Docker Compose.

---

## Mục tiêu

Xác nhận các yêu cầu sau đây hoạt động đúng:

- KRaft cluster 3 broker khởi động và ổn định
- Client kết nối qua SASL_SSL (cơ chế PLAIN)
- ACL được thực thi đúng: chỉ producer có thể ghi, chỉ consumer có thể đọc
- Admin có toàn quyền quản trị
- Topic và consumer group đã có ACL phù hợp
- Log compaction hoạt động đúng

---

## Điều kiện tiên quyết

- Đã cài Docker và Docker Compose
- Đang ở thư mục `kafka-cluster`
- Cluster gồm 3 broker KRaft: `kafka-1`, `kafka-2`, `kafka-3`

---

## 1. Khởi động cluster

```bash
docker compose up -d
```

Kiểm tra container đang chạy:

```bash
docker ps
```

Cần thấy đủ các container sau:

- `kafka-1`, `kafka-2`, `kafka-3` — trạng thái `Up`
- `kafka-ui` — trạng thái `Up`
- `kafka-certgen` — trạng thái `Exited` (đã hoàn tất công việc tạo certificate)

**Thông tin các listener:**

| Listener | Giao thức | Cổng |
|---|---|---|
| Client | SASL_SSL | 9094, 9095, 9096 |
| Inter-broker | PLAINTEXT | nội bộ |
| Controller | PLAINTEXT | nội bộ |

---

## 2. Khởi tạo Topic và ACL

Chạy lệnh sau để tạo topic và thiết lập ACL:

```bash
docker exec kafka-1 bash -c '
cat >/tmp/admin.properties <<EOF
security.protocol=SASL_SSL
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username="admin" password="12345";
ssl.truststore.location=/etc/kafka/secrets/kafka.truststore.jks
ssl.truststore.password=changeit
ssl.truststore.type=JKS
EOF

sleep 2

# Tạo topic
/opt/kafka/bin/kafka-topics.sh \
  --create \
  --bootstrap-server kafka-1:9094 \
  --command-config /tmp/admin.properties \
  --topic archived-status \
  --replication-factor 3 \
  --partitions 1

# Thêm ACL cho producer
/opt/kafka/bin/kafka-acls.sh \
  --add \
  --bootstrap-server kafka-1:9094 \
  --command-config /tmp/admin.properties \
  --allow-principal User:producer \
  --operation Create,Describe,Write \
  --topic archived-status

# Thêm ACL cho consumer
/opt/kafka/bin/kafka-acls.sh \
  --add \
  --bootstrap-server kafka-1:9094 \
  --command-config /tmp/admin.properties \
  --allow-principal User:consumer \
  --operation Describe,Read \
  --topic archived-status

# Thêm ACL cho consumer group
/opt/kafka/bin/kafka-acls.sh \
  --add \
  --bootstrap-server kafka-1:9094 \
  --command-config /tmp/admin.properties \
  --allow-principal User:consumer \
  --operation Read \
  --group lab-consumer

# Kiểm tra ACL đã tạo
/opt/kafka/bin/kafka-acls.sh \
  --list \
  --bootstrap-server kafka-1:9094 \
  --command-config /tmp/admin.properties
'
```

---

## 3. Tạo topic với Log Compaction

Vào container `kafka-1` và tạo topic:

```bash
docker exec -it kafka-1 bash

/opt/kafka/bin/kafka-topics.sh \
  --create \
  --topic archived-status \
  --bootstrap-server localhost:9094 \
  --command-config /etc/kafka/admin.properties \
  --partitions 3 \
  --replication-factor 3 \
  --config cleanup.policy=compact \
  --config min.cleanable.dirty.ratio=0.1 \
  --config segment.ms=60000 \
  --config min.compaction.lag.ms=0
```

Kiểm tra topic đã tạo đúng cấu hình chưa:

```bash
/opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9094 \
  --command-config /etc/kafka/admin.properties \
  --describe \
  --topic archived-status
```

Kết quả đúng phải có các config sau:

- `cleanup.policy=compact`
- `min.cleanable.dirty.ratio=0.1`
- `min.compaction.lag.ms=0`
- `segment.ms=60000`

---

## 4. Kiểm thử Producer (có quyền)

```bash
docker exec kafka-1 bash -c '
echo "test-message" | /opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server kafka-1:9094 \
  --topic archived-status \
  --producer-property security.protocol=SASL_SSL \
  --producer-property sasl.mechanism=PLAIN \
  --producer-property "sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username=\"producer\" password=\"12345\";" \
  --producer-property ssl.truststore.location=/etc/kafka/secrets/kafka.truststore.jks \
  --producer-property ssl.truststore.password=changeit \
  --producer-property ssl.truststore.type=JKS
'
```

**Kết quả mong đợi:** Message được gửi thành công, không có thông báo lỗi.

---

## 5. Kiểm thử Consumer (có quyền)

```bash
docker exec kafka-1 bash -c '
timeout 10 /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka-1:9094 \
  --topic archived-status \
  --consumer-property security.protocol=SASL_SSL \
  --consumer-property sasl.mechanism=PLAIN \
  --consumer-property "sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username=\"consumer\" password=\"12345\";" \
  --consumer-property ssl.truststore.location=/etc/kafka/secrets/kafka.truststore.jks \
  --consumer-property ssl.truststore.password=changeit \
  --consumer-property ssl.truststore.type=JKS \
  --from-beginning \
  --group lab-consumer \
  --max-messages 1
'
```

**Kết quả mong đợi:** Consumer nhận được message vừa gửi ở bước trên.

---

## 6. Kiểm thử truy cập trái phép (phải thất bại)

```bash
docker exec kafka-1 bash -c '
cat >/tmp/invalid.properties <<EOF
security.protocol=SASL_SSL
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username="invalid" password="wrong";
ssl.truststore.location=/etc/kafka/secrets/kafka.truststore.jks
ssl.truststore.password=changeit
ssl.truststore.type=JKS
EOF

/opt/kafka/bin/kafka-broker-api-versions.sh \
  --bootstrap-server kafka-1:9094 \
  --command-config /tmp/invalid.properties \
  2>&1 | grep -i "authentication failed" || echo "Truy cập bị từ chối (đúng như mong đợi)"
'
```

**Kết quả mong đợi:** Thông báo `Authentication failed` hoặc `Truy cập bị từ chối`.

---

## 7. Kiểm thử Log Compaction

### Ghi dữ liệu ban đầu

Gửi các message có key trùng lặp để kiểm thử compaction:

```bash
printf "user-1|ACTIVE\nuser-1|PENDING\nuser-1|ARCHIVED\nuser-2|ACTIVE\nuser-2|ARCHIVED\nuser-3|ACTIVE\n" \
  | /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9094 \
    --command-config /etc/kafka/producer.properties \
    --topic archived-status \
    --property parse.key=true \
    --property key.separator='|'
```

Đọc lại toàn bộ topic từ đầu:

```bash
/opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9094 \
  --command-config /etc/kafka/consumer.properties \
  --topic archived-status \
  --from-beginning \
  --max-messages 10 \
  --timeout-ms 5000 \
  --group lab-consumer \
  --property print.key=true \
  --property key.separator='|'
```

### Kích hoạt compaction sớm hơn

Điều chỉnh cấu hình để segment rollover sớm hơn:

```bash
/opt/kafka/bin/kafka-configs.sh \
  --bootstrap-server localhost:9094 \
  --command-config /etc/kafka/admin.properties \
  --entity-type topics \
  --entity-name archived-status \
  --alter \
  --add-config segment.ms=1000,min.cleanable.dirty.ratio=0.01,segment.bytes=1024
```

Gửi thêm message để buộc broker tạo segment mới:

```bash
printf "user-1|STATE-4xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\nuser-1|STATE-5xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\nuser-2|STATUS-4yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy\nuser-2|STATUS-5yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy\n" \
  | /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9094 \
    --command-config /etc/kafka/producer.properties \
    --topic archived-status \
    --property parse.key=true \
    --property key.separator='|'
```

### Quan sát log cleaner

```bash
docker logs kafka-1 2>&1 | grep -i "cleaner\|compact\|cleaning"
```

### Kiểm tra kết quả sau compaction

```bash
/opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9094 \
  --command-config /etc/kafka/consumer.properties \
  --topic archived-status \
  --from-beginning \
  --max-messages 20 \
  --timeout-ms 5000 \
  --group lab-consumer \
  --property print.key=true \
  --property key.separator='|'
```

**Kết quả mong đợi:** Mỗi key chỉ còn một bản ghi — trạng thái mới nhất.

---

## 8. Giao diện Kafka UI

Truy cập trình duyệt tại:

```
http://localhost:8080
```

**Thông tin đăng nhập:**

| Người dùng | Mật khẩu | Quyền |
|---|---|---|
| admin | 12345 | Toàn quyền |
| producer | 12345 | Chỉ ghi vào `archived-status` |
| consumer | 12345 | Chỉ đọc `archived-status`, group `lab-consumer` |

---

## 9. Cấu trúc thư mục

```
kafka-cluster/
├── docker-compose.yml        # Cấu hình Docker Compose (KRaft, SASL_SSL, ACL)
├── kafka_server_jaas.conf    # Cấu hình JAAS (xác thực PLAIN cho admin/producer/consumer)
├── admin.properties          # Cấu hình client cho role admin
├── producer.properties       # Cấu hình client cho role producer
├── consumer.properties       # Cấu hình client cho role consumer
├── scripts/
│   └── generate-certs.sh     # Script tạo TLS certificate tự động
└── README.md                 # Tài liệu này
```

---

## 10. Xử lý sự cố

### Broker không khởi động được

Kiểm tra log:

```bash
docker logs kafka-1 --tail 100
```

Các nguyên nhân thường gặp:

- **PKIX path building failed** — CN của certificate không khớp hostname. Giải pháp: đổi `KAFKA_INTER_BROKER_LISTENER_NAME` sang `PLAINTEXT`.
- **super.users issue** — Thêm `ANONYMOUS` vào danh sách super user nếu cần.
- **ACL timeout** — Broker đang là leader của partition `__cluster_metadata`, cần chờ authorizer load xong ACL.

### Producer/Consumer không có quyền truy cập

Kiểm tra lần lượt:

1. Username và password có đúng không
2. ACL đã được thêm chưa
3. Topic đã được tạo chưa
4. Consumer group có quyền READ không

### Xóa toàn bộ dữ liệu để bắt đầu lại

```bash
docker compose down
docker volume rm kafka-cluster_kafka_certs_v2
docker compose up -d
```

---

## Ghi chú thực tế

Log compaction không xảy ra ngay lập tức nếu segment hiện tại chưa được đóng (inactive). Nếu consumer vẫn thấy nhiều message cũ, hãy:

- Chờ thêm vài phút
- Gửi thêm message để broker tạo segment mới
- Kiểm tra lại bằng công cụ `kafka-dump-log.sh` trên segment cũ

Nếu gặp lỗi xác thực, kiểm tra:

- Broker đang chạy đúng cổng `9094`
- File `*.properties` đã được mount vào container `kafka-1`
- Dùng đúng user: `producer` để ghi, `consumer` để đọc, `admin` cho các lệnh quản trị