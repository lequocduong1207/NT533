#!/bin/bash

RESULT_FILE="/tmp/scalability_$(date +%Y%m%d_%H%M%S).csv"
TEST_DIR="/mnt/mfs/benchmark_scalability"

mkdir -p $TEST_DIR

echo "clients,total_time_sec,ops_per_sec,throughput_mib_s,speedup" > $RESULT_FILE

CLIENTS=(1 2 4 8 16)

BASE_THROUGHPUT=0

echo "=== Scalability Benchmark ==="

for C in "${CLIENTS[@]}"; do
    echo "Testing $C clients..."

    # cleanup
    rm -rf $TEST_DIR/*
    mkdir -p $TEST_DIR

    START=$(date +%s.%N)

    # chạy song song nhiều client
    for i in $(seq 1 $C); do
    (
        for j in $(seq 1 200); do
            dd if=/dev/zero of=$TEST_DIR/client_${i}_file_${j}.bin bs=1K count=100 \
            conv=fdatasync 2>/dev/null
        done
    ) &
    done

    wait

    END=$(date +%s.%N)

    TIME=$(echo "$END - $START" | bc)

    TOTAL_OPS=$((C * 200))
    OPS_SEC=$(echo "scale=2; $TOTAL_OPS / $TIME" | bc)

    # throughput MB/s (ước lượng 100KB mỗi op)
    THROUGHPUT=$(echo "scale=2; ($TOTAL_OPS * 100) / 1024 / $TIME" | bc)

    # speedup
    if [ "$C" -eq 1 ]; then
        BASE_THROUGHPUT=$THROUGHPUT
        SPEEDUP=1
    else
        SPEEDUP=$(echo "scale=2; $THROUGHPUT / $BASE_THROUGHPUT" | bc)
    fi

    echo "$C,$TIME,$OPS_SEC,$THROUGHPUT,$SPEEDUP" >> $RESULT_FILE

done

echo "DONE: $RESULT_FILE"
