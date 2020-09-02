FROM partlab/ubuntu-websocketd

RUN apt-get update -y && \
    apt-get install -y netcat jq && \
    rm -rf /var/lib/apt/lists/*

RUN wget https://github.com/shadiakiki1986/nats-cli/releases/download/0.0.4.2/nats-amd64 -O /sbin/nats && \
    chmod +x /sbin/nats
