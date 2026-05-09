FROM node:18-bullseye

# Instalar dependencias del sistema y Oracle Instant Client
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    unzip wget libaio1 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Descargar Oracle Instant Client Basic
RUN mkdir -p /opt/oracle && \
    cd /opt/oracle && \
    wget -q https://download.oracle.com/otn_software/linux/instantclient/2110000/instantclient-basiclite-linux.x64-21.10.0.0.0dbru.zip -O ic-basic.zip && \
    unzip -q ic-basic.zip && \
    rm ic-basic.zip && \
    echo /opt/oracle/instantclient_21_10 > /etc/ld.so.conf.d/oracle.conf && \
    ldconfig

# Variables de entorno Oracle
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_21_10

# App
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 8080

CMD ["node", "server.js"]