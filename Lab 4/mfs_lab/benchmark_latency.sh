#!/bin/bash

RESULT_FILE="/tmp/latency_$(date +%Y%m%d_%H%M%S).csv"
TEST_DIR="/mnt/mfs/benchmark_latency"

mkdir -p $TEST_DIR

echo "type,size_kb,iteration,time_ms" > $RESULT_FILE

SIZES=(1 4 16 64)
ITERATIONS=10

echo "=== MooseFS Latency Benchmark ==="

# ================= WRITE =================
echo "--- WRITE ---"

for SIZE in "${SIZES[@]}"; do
  echo "Write ${SIZE}KB..."

  for i in $(seq 1 $ITERATIONS); do
    FILE=$TEST_DIR/test_${SIZE}kb_$i

    sync
    echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null 2>&1

    START=$(date +%s.%N)

    dd if=/dev/zero of=$FILE bs=1K count=$SIZE conv=fdatasync 2>/dev/null

    END=$(date +%s.%N)

    TIME_MS=$(echo "($END - $START) * 1000" | bc -l)

    echo "write,$SIZE,$i,$TIME_MS" >> $RESULT_FILE

    rm -f $FILE
  done
done


# ================= READ =================
echo "--- READ ---"

for SIZE in "${SIZES[@]}"; do

  FILE=$TEST_DIR/test_${SIZE}kb

  dd if=/dev/zero of=$FILE bs=1K count=$SIZE 2>/dev/null
  sync

  for i in $(seq 1 $ITERATIONS); do
    echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null 2>&1

    START=$(date +%s.%N)

    dd if=$FILE of=/dev/null bs=1K 2>/dev/null

    END=$(date +%s.%N)

    TIME_MS=$(echo "($END - $START) * 1000" | bc -l)

    echo "read,$SIZE,$i,$TIME_MS" >> $RESULT_FILE
  done

  rm -f $FILE
done

echo "DONE: $RESULT_FILE"
