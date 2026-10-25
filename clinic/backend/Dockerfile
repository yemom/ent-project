FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /workspace

# Dependencies are resolved in their own layer, before the source is copied.
# Editing a .java file then reuses the cached artifacts instead of re-downloading
# the world, which is where the previous build kept failing.
COPY pom.xml .
RUN mvn -B -q dependency:resolve -DincludeScope=runtime

COPY src ./src

# Build flags, and why each is here. The failure this fixes was
# "Could not transfer artifact ... from/to central" on Testcontainers and its
# transitive JNA, JLine, JDBC and database-commons jars.
#
# The cause is throughput, not the artifact list. Against Maven Central these
# artifacts were transferring at 1-30 kB/s -- some as slow as 183 bytes per second --
# so connections were being reset mid-transfer and Maven gave up. Three settings
# address that:
#
#   artifact.threads=1   Maven resolves five artifacts in parallel by default. On a
#                        saturated link that guarantees they all crawl and time out
#                        together; one at a time keeps each transfer healthy.
#   retryHandler.count    A dropped connection is retried rather than failing the
#                        build on the first hiccup.
#   wagon.rto             A generous read timeout, so a slow-but-progressing
#                        download is not mistaken for a dead one.
#
# -P no-test-execution additionally unbinds surefire, failsafe and jacoco. The
# runtime image does not run tests, so this trims the dependency set without
# affecting `mvn test` on a developer machine.
RUN mvn -B -P no-test-execution "-Dmaven.test.skip=true" \
      -Dmaven.artifact.threads=1 \
      -Dmaven.wagon.http.retryHandler.count=10 \
      -Dmaven.wagon.httpconnectionManager.ttlSeconds=300 \
      -Dmaven.wagon.rto=900000 \
      clean package

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

# Container-level readiness. Compose and orchestrators should keep traffic away
# until Flyway, JPA validation, and application startup have completed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD curl -fsS "http://localhost:${PORT}/actuator/health/readiness" > /dev/null || exit 1

# -XX:+UseSerialGC and TieredStopAtLevel=1 cut JVM start-up time and footprint,
# which matters most on the free Render plan where instances sleep and wake.
# Keep the Java heap bounded so the process does not get OOM-killed when Docker
# is also building or running the frontend.
ENTRYPOINT ["java", \
  "-XX:+UseSerialGC", \
  "-XX:TieredStopAtLevel=1", \
  "-Xms128m", \
  "-Xmx384m", \
  "-Xshare:auto", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "/app/app.jar"]
