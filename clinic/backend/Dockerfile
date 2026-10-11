FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /workspace

COPY pom.xml .
COPY src ./src
RUN mvn -B clean package -DskipTests

FROM eclipse-temurin:21-jre-jammy AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 1001 --shell /usr/sbin/nologin clinic

COPY --from=builder /workspace/target/clinicl-*.jar /app/app.jar

RUN chown -R clinic:clinic /app

USER clinic

ENV PORT=8080
EXPOSE ${PORT}

# Container-level liveness. Uses the DB-free /api/v1/health endpoint so a slow or
# unreachable database never causes the container to be killed and restarted.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD curl -fsS "http://localhost:${PORT}/api/v1/health" > /dev/null || exit 1

# -XX:+UseSerialGC and TieredStopAtLevel=1 cut JVM start-up time and footprint,
# which matters most on the free Render plan where instances sleep and wake.
ENTRYPOINT ["java", \
  "-XX:+UseSerialGC", \
  "-XX:TieredStopAtLevel=1", \
  "-Xshare:auto", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "/app/app.jar"]
