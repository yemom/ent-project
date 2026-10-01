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

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD curl -fsS http://localhost:${PORT}/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
