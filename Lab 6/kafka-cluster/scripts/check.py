import subprocess
import json

# ── Màu sắc terminal ────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
RESET  = "\033[0m"

def ok(msg):   print(f"{GREEN}  [PASS]{RESET} {msg}")
def fail(msg): print(f"{RED}  [FAIL]{RESET} {msg}")
def info(msg): print(f"{BLUE}  [INFO]{RESET} {msg}")
def header(msg): print(f"\n{YELLOW}{'='*55}{RESET}\n{YELLOW}  {msg}{RESET}\n{YELLOW}{'='*55}{RESET}")

# ── Hàm chạy lệnh MySQL ─────────────────────────────────────
def mysql(sql):
    result = subprocess.run(
        ["docker", "exec", "mysql-source",
         "mysql", "-ulab6_mysql", "-p12345", "-sN", "-e", sql],
        capture_output=True, text=True
    )
    return result.stdout.strip()

# ── Hàm chạy lệnh PostgreSQL ────────────────────────────────
def pg(sql):
    result = subprocess.run(
        ["docker", "exec", "postgres-target",
         "psql", "-Ulab6_pg", "-dtargetdb", "-tA", "-c", sql],
        capture_output=True, text=True
    )
    return result.stdout.strip()

# KIỂM TRA SỐ DÒNG MỖI BẢNG
header("PHẦN 1: KIỂM TRA SỐ DÒNG MỖI BẢNG")

tables = ["users", "posts", "comments", "tags"]
all_pass = True

print(f"\n  {'Bảng':<12} {'MySQL':>10} {'PostgreSQL':>12} {'Kết quả':>10}")
print(f"  {'-'*48}")

for table in tables:
    mysql_count = int(mysql(f"SELECT COUNT(*) FROM sourcedb.{table};") or 0)
    pg_count    = int(pg(f"SELECT COUNT(*) FROM {table};") or 0)
    match       = mysql_count == pg_count

    status = f"{GREEN}MATCH{RESET}" if match else f"{RED}MISMATCH{RESET}"
    print(f"  {table:<12} {mysql_count:>10} {pg_count:>12}   {status}")

    if not match:
        all_pass = False

print()
if all_pass:
    ok("Tất cả bảng có số dòng khớp nhau")
else:
    fail("Một số bảng có số dòng không khớp — kiểm tra Sink Connector")

# KIỂM TRA TÍNH TOÀN VẸN DỮ LIỆU
header("PHẦN 2: KIỂM TRA TÍNH TOÀN VẸN DỮ LIỆU")

# ── 2.1: user_id trong posts phải tồn tại trong users ───────
print(f"\n  {BLUE}>> Kiểm tra: user_id trong posts có tồn tại trong users?{RESET}")
orphan_posts = int(pg("""
    SELECT COUNT(*) FROM posts p
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.user_id);
""") or 0)

if orphan_posts == 0:
    ok(f"Tất cả user_id trong posts đều tồn tại trong users")
else:
    fail(f"Có {orphan_posts} bản ghi trong posts có user_id không tồn tại trong users")

# ── 2.2: post_id trong comments phải tồn tại trong posts ────
print(f"\n  {BLUE}>> Kiểm tra: post_id trong comments có tồn tại trong posts?{RESET}")
orphan_comments = int(pg("""
    SELECT COUNT(*) FROM comments c
    WHERE NOT EXISTS (SELECT 1 FROM posts p WHERE p.id = c.post_id);
""") or 0)

if orphan_comments == 0:
    ok(f"Tất cả post_id trong comments đều tồn tại trong posts")
else:
    fail(f"Có {orphan_comments} bản ghi trong comments có post_id không tồn tại trong posts")

# ── 2.3: Kiểm tra NULL trong các cột NOT NULL ────────────────
print(f"\n  {BLUE}>> Kiểm tra: giá trị NULL trong các cột NOT NULL{RESET}")

not_null_checks = {
    "users":    ["id", "username", "email", "is_active", "created_at"],
    "posts":    ["id", "user_id", "title", "status", "view_count", "created_at"],
    "comments": ["id", "post_id", "user_id", "content", "created_at"],
    "tags":     ["id", "name", "slug", "created_at"],
}

null_found = False
for table, columns in not_null_checks.items():
    for col in columns:
        null_count = int(pg(f"SELECT COUNT(*) FROM {table} WHERE {col} IS NULL;") or 0)
        if null_count == 0:
            ok(f"{table}.{col} — không có NULL")
        else:
            fail(f"{table}.{col} — có {null_count} giá trị NULL!")
            null_found = True

# TEST REALTIME CDC
header("PHẦN 3: TEST REALTIME CDC")

before = int(pg("SELECT COUNT(*) FROM users;") or 0)

mysql("""
INSERT INTO sourcedb.users(username,email,is_active,created_at)
VALUES ('cdc_test','cdc@test.com',1,NOW());
""")

import time
time.sleep(5)

after = int(pg("SELECT COUNT(*) FROM users;") or 0)

if after == before + 1:
    ok("CDC realtime hoạt động")
else:
    fail("CDC realtime không hoạt động")

# ════════════════════════════════════════════════════════════
# TỔNG KẾT
# ════════════════════════════════════════════════════════════
header("TỔNG KẾT")

issues = []
if not all_pass:       issues.append("Số dòng không khớp giữa MySQL và PostgreSQL")
if orphan_posts > 0:   issues.append("posts có user_id không hợp lệ")
if orphan_comments > 0:issues.append("comments có post_id không hợp lệ")
if null_found:         issues.append("Có giá trị NULL trong cột NOT NULL")

if not issues:
    print(f"\n{GREEN}  ✓ Tất cả kiểm tra PASS — Dữ liệu đồng nhất và toàn vẹn{RESET}\n")
else:
    print(f"\n{RED}  ✗ Phát hiện {len(issues)} vấn đề:{RESET}")
    for i, issue in enumerate(issues, 1):
        print(f"{RED}    {i}. {issue}{RESET}")
    print()
