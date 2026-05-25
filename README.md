# Tổng Quan — Hệ Tính Toán Phân Bố

---

## Lab 1 — Monitoring và Load Balancing

### Nội dung

Lab 1 tập trung vào việc giám sát hệ thống và quan sát cách tải được phân phối giữa các backend. Thông qua file log `monitoring.log`, có thể thấy các request được gửi tuần tự đến nhiều backend khác nhau, đồng thời đo thời gian phản hồi và thống kê tỷ lệ phân phối tải.

### Những việc đã thực hiện

- Gửi request định kỳ đến một endpoint trung gian và ghi lại kết quả.
- Thu thập status code, thời gian phản hồi và backend được chọn mỗi lần.
- Quan sát sự phân phối tải giữa nhiều server backend theo thời gian.
- Đánh giá độ ổn định của hệ thống qua nhiều lần chạy liên tiếp.

### Kiến thức thu được

- Hiểu cách load balancing hoạt động trong thực tế, không chỉ trên lý thuyết.
- Biết cách đọc và phân tích log để kiểm tra phân phối tải và phát hiện bất thường.
- Nhận ra ảnh hưởng của độ trễ từng backend đến trải nghiệm tổng thể của hệ thống.

---

## Lab 2 — Cloud Management UI

### Nội dung

Lab 2 xây dựng một giao diện quản lý cloud bằng React và Vite, giao tiếp với các API cloud thông qua proxy. Ứng dụng hỗ trợ quản lý các tài nguyên như compute, network, router, security group, floating IP và load balancer.

### Những việc đã thực hiện

- Xây dựng frontend bằng React và Vite theo kiến trúc SPA.
- Thiết kế các trang quản lý từng loại tài nguyên cloud.
- Kết nối API thông qua các đường dẫn `/api/*` được proxy nội bộ.
- Đóng gói ứng dụng bằng Docker và Nginx để chạy trên môi trường production.
- Cấu hình reverse proxy để SPA vẫn gọi được backend khi chạy trong container.

### Kiến thức thu được

- Hiểu cách tổ chức một ứng dụng frontend quản trị tài nguyên cloud.
- Biết dùng proxy để tách biệt frontend khỏi backend thật, tránh lộ endpoint.
- Làm quen với quy trình đóng gói và triển khai ứng dụng web bằng Docker và Nginx.
- Hiểu thêm về luồng scale up và scale down của load balancer trên môi trường cloud.

---

## Lab 3 — Container Orchestration

### Nội dung

Lab 3 xoay quanh container orchestration với k3s — một phiên bản Kubernetes nhẹ phù hợp cho môi trường thực hành. Nội dung chính bao gồm triển khai cụm Kubernetes, thiết lập dashboard, xử lý các vấn đề về SSH và DNS, sau đó chạy ứng dụng thực trên cluster.

### Những việc đã thực hiện

- Triển khai cụm k3s với một server node và nhiều agent node.
- Cài đặt và truy cập Kubernetes Dashboard để quan sát trạng thái cluster.
- Xử lý các lỗi thực tế như DNS không phân giải được, hostname sai, SSH key và file hosts.
- Triển khai ứng dụng web có dữ liệu, cụ thể là WordPress kết hợp MySQL.
- Thực hành chạy thêm một hệ thống microservices trên cùng cluster.

### Kiến thức thu được

- Hiểu cách một cluster Kubernetes được hình thành từ nhiều node riêng biệt.
- Biết cách xử lý các vấn đề thường gặp khi join node và cấu hình mạng trong k3s.
- Nắm được quy trình triển khai ứng dụng stateful và stateless trên Kubernetes.
- Có thêm kinh nghiệm vận hành cụm container ở mức hệ thống thực tế.

---

## Lab 4 — MooseFS Benchmark

### Nội dung

Lab 4 làm việc với MooseFS — một hệ thống lưu trữ phân tán — và tập trung vào việc đo hiệu năng. Bộ script benchmark được viết để kiểm tra throughput, latency và khả năng mở rộng, sau đó kết quả được trực quan hóa bằng Python.

### Những việc đã thực hiện

- Chạy các script benchmark để đo throughput, latency và scalability theo từng kịch bản.
- Thu thập dữ liệu kết quả và xuất ra file CSV để xử lý tiếp.
- Dùng thư viện pandas và matplotlib để xử lý và trực quan hóa dữ liệu.
- Tạo các biểu đồ so sánh hiệu năng theo kích thước file và số lượng client đồng thời.

### Kiến thức thu được

- Hiểu cách đánh giá hiệu năng của một hệ thống lưu trữ phân tán một cách bài bản.
- Biết đọc và phân tích dữ liệu benchmark thay vì chỉ nhận xét cảm tính.
- Làm quen với quy trình xử lý và trực quan hóa dữ liệu thí nghiệm bằng Python.
- Nhận ra trade-off giữa throughput, latency và khả năng mở rộng khi tăng tải.

---

## Lab 5 — Kafka Cluster

### Nội dung

Lab 5 triển khai một Kafka KRaft cluster gồm 3 broker trên Docker Compose, tích hợp đầy đủ bảo mật SASL_SSL và phân quyền ACL. Phần thực hành tập trung vào việc cấu hình xác thực, cấp quyền cho từng vai trò client và kiểm thử log compaction.

### Những việc đã thực hiện

- Dựng Kafka cluster 3 broker theo chế độ KRaft, không dùng ZooKeeper.
- Tạo certificate, keystore và truststore cho SASL_SSL bằng script tự động.
- Thiết lập JAAS config và ACL cho 3 vai trò: admin, producer và consumer.
- Viết file cấu hình riêng biệt cho từng vai trò client.
- Kiểm thử producer ghi, consumer đọc và các trường hợp truy cập trái phép.
- Kiểm tra log compaction với topic dạng `compact` và quan sát hành vi cleaner.
- Triển khai Kafka UI để giám sát cluster qua giao diện web.

### Kiến thức thu được

- Hiểu cách vận hành Kafka theo mô hình KRaft — không phụ thuộc ZooKeeper.
- Biết cách bật bảo mật SASL_SSL và phân quyền chi tiết bằng ACL.
- Nắm được vai trò của certificate, truststore và JAAS trong quá trình xác thực.
- Hiểu ý nghĩa và cơ chế hoạt động của log compaction trong hệ thống event streaming.
- Có kinh nghiệm debug thực tế các lỗi phát sinh khi cấu hình bảo mật Kafka.

---

## Tổng Kết

Sau 5 lab, những mảng kiến thức chính được củng cố bao gồm:

| Lab | Chủ đề | Kỹ năng cốt lõi |
|---|---|---|
| Lab 1 | Load Balancing & Monitoring | Đọc log, quan sát phân phối tải |
| Lab 2 | Cloud Management UI | React, Docker, Nginx, API proxy |
| Lab 3 | Container Orchestration | k3s, Kubernetes, deploy ứng dụng |
| Lab 4 | Distributed Storage | Benchmark, phân tích dữ liệu Python |
| Lab 5 | Streaming Platform | Kafka KRaft, SASL_SSL, ACL |

Điểm chung xuyên suốt cả 5 lab là tư duy vận hành hệ thống phân tán trong thực tế — không chỉ dừng lại ở lý thuyết mà phải xử lý được các lỗi phát sinh, hiểu nguyên nhân và tìm cách khắc phục từng bước.

---

## Tài Liệu Liên Quan

- [Lab 1](Lab%201/)
- [Lab 2](Lab%202/)
- [Lab 3](Lab%203/)
- [Lab 4](Lab%204/)
- [Lab 5](Lab%205/)

---
