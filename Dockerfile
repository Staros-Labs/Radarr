FROM mcr.microsoft.com/dotnet/runtime-deps:8.0-noble

COPY --chmod=755 radarr /opt/radarr

RUN groupadd -f -g 1000 radarr && \
    useradd -u 1000 -g 1000 -d /config -s /bin/bash radarr 2>/dev/null; \
    mkdir -p /config && chown 1000:1000 /config

ENV RADARR_BRANCH="develop" \
    XDG_CONFIG_HOME="/config/xdg"

VOLUME /config
EXPOSE 7878

USER radarr
ENTRYPOINT ["/opt/radarr/Radarr", "-nobrowser", "-data=/config"]
