FROM docker.io/cloudflare/sandbox:0.7.0

WORKDIR /workspace

RUN bun add @wingman-ai/gateway@latest
RUN mkdir -p /workspace/.wingman

COPY wingman.config.json /workspace/.wingman/wingman.config.json

ENTRYPOINT ["/sandbox"]
CMD ["bun", "./node_modules/@wingman-ai/gateway/bin/wingman", "gateway", "run", "--host", "0.0.0.0", "--port", "8080", "--workspace", "/workspace", "--config-dir", ".wingman"]
