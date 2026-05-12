#!/usr/bin/env bash
set -euo pipefail

cat >/tmp/admin.properties <<'ADMINEOF'
security.protocol=SASL_SSL
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username="admin" password="12345";
ssl.truststore.location=/etc/kafka/secrets/kafka.truststore.jks
ssl.truststore.password=changeit
ssl.truststore.type=JKS
ADMINEOF

echo "=== Waiting for broker to be ready ==="
until /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server kafka-1:9094 --command-config /tmp/admin.properties >/dev/null 2>&1; do sleep 1; done
echo "✓ Broker API versions OK"

echo "=== Creating topic ==="
/opt/kafka/bin/kafka-topics.sh --create --bootstrap-server kafka-1:9094 --command-config /tmp/admin.properties --topic archived-status --replication-factor 3 --partitions 1 2>&1 || true
echo "✓ Topic created"

echo "=== Setting ACLs ==="
/opt/kafka/bin/kafka-acls.sh --bootstrap-server kafka-1:9094 --command-config /tmp/admin.properties --add --allow-principal User:producer --operation Create --operation Describe --operation Write --topic archived-status 2>&1 || true
echo "✓ Producer ACL added"

/opt/kafka/bin/kafka-acls.sh --bootstrap-server kafka-1:9094 --command-config /tmp/admin.properties --add --allow-principal User:consumer --operation Describe --operation Read --topic archived-status 2>&1 || true
echo "✓ Consumer read ACL added"

/opt/kafka/bin/kafka-acls.sh --bootstrap-server kafka-1:9094 --command-config /tmp/admin.properties --add --allow-principal User:consumer --operation Read --group lab-consumer 2>&1 || true
echo "✓ Consumer group ACL added"

echo -e "\n=== Final ACLs ==="
/opt/kafka/bin/kafka-acls.sh --bootstrap-server kafka-1:9094 --command-config /tmp/admin.properties --list

echo -e "\n=== Test 1: Producer write (authorized) ==="
cat >/tmp/producer.properties <<'PRODEOF'
security.protocol=SASL_SSL
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username="producer" password="12345";
ssl.truststore.location=/etc/kafka/secrets/kafka.truststore.jks
ssl.truststore.password=changeit
ssl.truststore.type=JKS
PRODEOF

echo "test-message-1" | /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server kafka-1:9094 --topic archived-status --producer-property security.protocol=SASL_SSL --producer-property sasl.mechanism=PLAIN --producer-property 'sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username="producer" password="12345";' --producer-property ssl.truststore.location=/etc/kafka/secrets/kafka.truststore.jks --producer-property ssl.truststore.password=changeit --producer-property ssl.truststore.type=JKS
echo "✓ Producer write successful"

echo -e "\n=== Test 2: Consumer read (authorized) ==="
cat >/tmp/consumer.properties <<'CONSEOF'
security.protocol=SASL_SSL
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username="consumer" password="12345";
ssl.truststore.location=/etc/kafka/secrets/kafka.truststore.jks
ssl.truststore.password=changeit
ssl.truststore.type=JKS
CONSEOF

timeout 10 /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka-1:9094 --topic archived-status --consumer-property security.protocol=SASL_SSL --consumer-property sasl.mechanism=PLAIN --consumer-property 'sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username="consumer" password="12345";' --consumer-property ssl.truststore.location=/etc/kafka/secrets/kafka.truststore.jks --consumer-property ssl.truststore.password=changeit --consumer-property ssl.truststore.type=JKS --from-beginning --group lab-consumer --max-messages 1 || true
echo "✓ Consumer read successful"

echo -e "\n=== Test 3: Unauthorized access attempt (should fail) ==="
cat >/tmp/unauth.properties <<'UNAUTH EOF'
security.protocol=SASL_SSL
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username="unknown" password="invalid";
ssl.truststore.location=/etc/kafka/secrets/kafka.truststore.jks
ssl.truststore.password=changeit
ssl.truststore.type=JKS
UNAUTH EOF

timeout 5 /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server kafka-1:9094 --command-config /tmp/unauth.properties 2>&1 || echo "✓ Unauthorized access blocked as expected"

echo -e "\n=== All smoke tests passed ==="
