#!/usr/bin/env bash
set -euo pipefail

cat >/tmp/admin.properties <<'EOF'
security.protocol=SASL_SSL
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username="admin" password="12345";
ssl.truststore.location=/etc/kafka/secrets/kafka.truststore.jks
ssl.truststore.password=changeit
ssl.truststore.type=JKS
ssl.endpoint.identification.algorithm=https
EOF

until /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server kafka-1:9094 --command-config /tmp/admin.properties >/dev/null 2>&1; do
  sleep 2
done

/opt/kafka/bin/kafka-acls.sh \
  --bootstrap-server kafka-1:9094 \
  --command-config /tmp/admin.properties \
  --add \
  --allow-principal User:producer \
  --operation Create \
  --operation Describe \
  --operation Write \
  --topic archived-status

/opt/kafka/bin/kafka-acls.sh \
  --bootstrap-server kafka-1:9094 \
  --command-config /tmp/admin.properties \
  --add \
  --allow-principal User:consumer \
  --operation Describe \
  --operation Read \
  --topic archived-status

/opt/kafka/bin/kafka-acls.sh \
  --bootstrap-server kafka-1:9094 \
  --command-config /tmp/admin.properties \
  --add \
  --allow-principal User:consumer \
  --operation Read \
  --group lab-consumer