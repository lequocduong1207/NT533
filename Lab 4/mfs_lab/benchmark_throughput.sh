#!/bin/bash

RESULT_FILE="/tmp/throughput_$(date +%Y%m%d_%H%M%S).csv"
TEST_DIR="/mnt/mfs/benchmark_throughput"

mkdir -p $TEST_DIR
echo "type,size_mb,iteration,time_sec,throughput_mb_s" > $RESULT_FILE

SIZES=(1 10 100 500)
ITERATIONS=5

echo "=== MooseFS Throughput Benchmark ==="

# ================= WRITE =================
echo "--- WRITE TEST ---"

for SIZE in "${SIZES[@]}"; do
  echo "Writing ${SIZE}MB..."

  for i in $(seq 1 $ITERATIONS); do
    sync
    echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null 2>&1

    START=$(date +%s.%N)

    dd if=/dev/zero of=$TEST_DIR/test_${SIZE}mb bs=1M count=$SIZE conv=fdatasync 2>/dev/null

    END=$(date +%s.%N)

    TIME=$(echo "$END - $START" | bc)
    THR=$(echo "scale=2; $SIZE / $TIME" | bc)

    echo "write,$SIZE,$i,$TIME,$THR" >> $RESULT_FILE

    rm -f $TEST_DIR/test_${SIZE}mb
  done
done


# ================= READ =================
echo "--- READ TEST ---"

for SIZE in "${SIZES[@]}"; do

  dd if=/dev/zero of=$TEST_DIR/test_${SIZE}mb bs=1M count=$SIZE 2>/dev/null
  sync

  for i in $(seq 1 $ITERATIONS); do
    echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null 2>&1

    START=$(date +%s.%N)

    dd if=$TEST_DIR/test_${SIZE}mb of=/dev/null bs=1M 2>/dev/null

    END=$(date +%s.%N)

    TIME=$(echo "$END - $START" | bc)
    THR=$(echo "scale=2; $SIZE / $TIME" | bc)

    echo "read,$SIZE,$i,$TIME,$THR" >> $RESULT_FILE
  done

  rm -f $TEST_DIR/test_${SIZE}mb
done

echo "DONE: $RESULT_FILE"
