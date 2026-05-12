import pandas as pd
import matplotlib.pyplot as plt

# =========================
# 1. THROUGHPUT
# =========================
df_tp = pd.read_csv("/tmp/throughput_20260428_134331.csv")

tp_group = df_tp.groupby(["size_mb", "type"])["throughput_mb_s"].mean().unstack()

plt.figure()
tp_group.plot(marker="o")
plt.title("MooseFS Throughput Benchmark")
plt.xlabel("File Size (MB)")
plt.ylabel("Throughput (MB/s)")
plt.grid()
plt.savefig("throughput.png")


# =========================
# 2. LATENCY
# =========================
df_lt = pd.read_csv("/tmp/latency_20260428_135230.csv")

lt_group = df_lt.groupby(["size_kb", "type"])["time_ms"].agg(["mean", "std"]).unstack()

plt.figure()
lt_group["mean"].plot(marker="o")
plt.title("MooseFS Latency (Mean)")
plt.xlabel("File Size (KB)")
plt.ylabel("Latency (ms)")
plt.grid()
plt.savefig("latency_mean.png")

plt.figure()
lt_group["std"].plot(marker="o")
plt.title("MooseFS Latency (Std)")
plt.xlabel("File Size (KB)")
plt.ylabel("Latency Std (ms)")
plt.grid()
plt.savefig("latency_std.png")


# =========================
# 3. SCALABILITY
# =========================
df_sc = pd.read_csv("/tmp/scalability_20260428_140037.csv")

plt.figure()
plt.plot(df_sc["clients"], df_sc["throughput_mib_s"], marker="o")
plt.title("MooseFS Scalability - Throughput")
plt.xlabel("Clients")
plt.ylabel("Throughput (MiB/s)")
plt.grid()
plt.savefig("scalability_throughput.png")

plt.figure()
plt.plot(df_sc["clients"], df_sc["speedup"], marker="o")
plt.title("MooseFS Scalability - Speedup")
plt.xlabel("Clients")
plt.ylabel("Speedup")
plt.grid()
plt.savefig("scalability_speedup.png")

print("Done! Charts saved as PNG files.")
