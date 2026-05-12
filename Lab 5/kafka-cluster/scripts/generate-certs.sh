#!/usr/bin/env bash
set -euo pipefail

if [ -f /certs/kafka.keystore.jks ] && [ -f /certs/kafka.truststore.jks ] && [ -f /certs/kafka-keystore.creds ] && [ -f /certs/kafka-key.creds ]; then
  echo "SSL materials already exist"
  exit 0
fi

if [ ! -f /certs/kafka.keystore.jks ]; then
  keytool -genkeypair \
    -alias kafka-broker \
    -keyalg RSA \
    -keysize 4096 \
    -validity 3650 \
    -dname "CN=kafka-1, OU=Lab, O=NT533, L=HCM, ST=HCM, C=VN" \
    -ext "SAN=dns:kafka-1,dns:kafka-2,dns:kafka-3,dns:localhost,ip:127.0.0.1" \
    -storetype JKS \
    -keystore /certs/kafka.keystore.jks \
    -storepass changeit \
    -keypass changeit \
    -noprompt
fi

if [ ! -f /certs/kafka.truststore.jks ]; then
  keytool -exportcert \
    -alias kafka-broker \
    -keystore /certs/kafka.keystore.jks \
    -storepass changeit \
    -rfc \
    -file /certs/kafka-broker.crt

  keytool -importcert \
    -alias kafka-broker \
    -file /certs/kafka-broker.crt \
    -keystore /certs/kafka.truststore.jks \
    -storepass changeit \
    -noprompt
fi

printf 'changeit' > /certs/kafka-keystore.creds
printf 'changeit' > /certs/kafka-key.creds