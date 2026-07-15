// ----------------------------------------------------------------------
// TSKK Academy Platform — CI/CD pipeline
//
// This is a Multibranch Pipeline. Jenkins's "Declarative: Checkout SCM"
// stage (added automatically by Jenkins) already clones the repo for us.
// Do NOT add a manual `cleanWs()` + `git ...` checkout — that would wipe
// the workspace and then try to clone from a different URL.
//
// What this pipeline does:
//   1. Ensures the Docker Compose v2 plugin is installed on the agent.
//   2. Generates a .env file that docker-compose.yml consumes (Postgres,
//      Redis, MinIO, JWT, SMTP, frontend/backend URLs, …).
//   3. Builds the backend (NestJS) + frontend (Next.js) images and brings
//      the full stack up: postgres, redis, minio (+ bootstrap), mailhog,
//      backend on :4000, frontend on :3000.
//   4. Waits for the infra tier (postgres/redis/minio) to be healthy via
//      their native Docker healthchecks, then polls the backend /health
//      and the frontend root until each responds 200.
//   5. Runs in-container smoke tests: backend /health, backend
//      /health/ready (which pings Postgres), backend Swagger at /docs,
//      and the frontend landing page + a deep app-router route (must
//      fall back through Next's routing).
//   6. Prints the live URLs on success, or dumps container logs on
//      failure.
//
// The stack is a Next.js 14 (App Router) frontend + NestJS 10 backend
// with Prisma → Postgres 16, Redis 7 for caching, and MinIO for object
// storage. See docker-compose.yml for the exact wiring.
// ----------------------------------------------------------------------
pipeline {
    agent any

    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '5'))
    }

    environment {
        // ---- Deploy target ----
        // Public host that users will hit in the browser.
        // Change this to whichever VM/domain actually serves this stack.
        VM_HOST = '140.245.254.149'

        // ---- Host port mapping (must match docker-compose.yml) ----
        // The frontend container listens on 3000, the backend on 4000.
        // These are the host ports that get published.
        FRONTEND_PORT = '3000'
        BACKEND_PORT  = '4000'

        // ---- Misc ----
        TZ = 'UTC'

        // Stable Compose project name so containers always get the same
        // names (matches `name: tskk-academy` in docker-compose.yml).
        COMPOSE_PROJECT_NAME = 'tskk-academy'

        // Pin the compose file explicitly so Docker Compose does NOT auto-
        // load docker-compose.override.yml. The override adds bind mounts
        // (./backend:/app, ./frontend:/app) that are great for local dev
        // hot-reload but catastrophic in Jenkins-in-Docker: the ./backend
        // path only exists inside the Jenkins container, and the host
        // Docker daemon silently mounts an empty directory over /app,
        // wiping the image and crash-looping the app with
        // `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND`.
        COMPOSE_FILE = 'docker-compose.yml'

        // Container names we poll for health (match container_name in compose).
        FRONTEND_CONTAINER = 'tskk-frontend'
        BACKEND_CONTAINER  = 'tskk-backend'
        POSTGRES_CONTAINER = 'tskk-postgres'
        REDIS_CONTAINER    = 'tskk-redis'
        MINIO_CONTAINER    = 'tskk-minio'
    }

    stages {

        stage('Verify Docker') {
            steps {
                sh '''
                set -e

                docker --version

                if ! docker compose version >/dev/null 2>&1; then
                    echo "Installing Docker Compose plugin..."

                    ARCH=$(uname -m)
                    mkdir -p $HOME/.docker/cli-plugins

                    curl -fsSL \
                      https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-${ARCH} \
                      -o $HOME/.docker/cli-plugins/docker-compose

                    chmod +x $HOME/.docker/cli-plugins/docker-compose
                fi

                docker compose version
                '''
            }
        }

        stage('Generate .env') {
            steps {
                sh '''
                # docker-compose.yml pulls all of these via variable substitution
                # and the backend/frontend containers load them via env_file.
                # See .env.example for the full contract.
                cat > .env <<EOF
# --- App ---
NODE_ENV=production
APP_NAME=TSKK Academy Platform
APP_URL=http://${VM_HOST}:${FRONTEND_PORT}
API_URL=http://${VM_HOST}:${BACKEND_PORT}

# --- Backend ---
BACKEND_PORT=${BACKEND_PORT}
API_PREFIX=api/v1
CORS_ORIGINS=http://${VM_HOST}:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT}

# --- PostgreSQL ---
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=tskk
POSTGRES_PASSWORD=tskk_ci_password
POSTGRES_DB=tskk
DATABASE_URL=postgresql://tskk:tskk_ci_password@postgres:5432/tskk?schema=public

# --- Redis ---
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://redis:6379

# --- MinIO ---
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_PUBLIC_URL=http://${VM_HOST}:9000
MINIO_BUCKET_PHOTOS=tskk-photos
MINIO_BUCKET_CERTIFICATES=tskk-certificates
MINIO_BUCKET_VIDEOS=tskk-videos
MINIO_BUCKET_DOCUMENTS=tskk-documents

# --- JWT (rotate in real prod via Jenkins credentials) ---
JWT_ACCESS_SECRET=ci_change_me_access_secret_min_32_chars___
JWT_REFRESH_SECRET=ci_change_me_refresh_secret_min_32_chars__
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# --- QR signing ---
QR_HMAC_SECRET=ci_change_me_qr_hmac_secret_min_32_chars__

# --- Email (SMTP → mailhog in-stack) ---
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="TSKK Academy <no-reply@tskk.in>"

# --- Rate limiting ---
THROTTLE_TTL=60
THROTTLE_LIMIT=120

# --- Frontend (Next.js public) ---
NEXT_PUBLIC_API_URL=http://${VM_HOST}:${BACKEND_PORT}/api/v1
NEXT_PUBLIC_APP_NAME=TSKK Academy

# --- Misc ---
TZ=${TZ}
EOF

                echo ".env written (values masked):"
                sed 's/=.*/=***/' .env
                '''
            }
        }

        stage('Build & Deploy') {
            steps {
                // Docker Compose's default "auto" progress renderer uses TTY
                // cursor codes and buffers heavily. Under Jenkins that means
                // long stretches (npm/pnpm install, chromium download, Next
                // build) produce zero log output, which trips JENKINS-48300
                // ("wrapper script does not seem to be touching the log file")
                // and Jenkins kills the shell around the 5-min mark.
                //
                // Forcing plain progress + BuildKit gives us one line per
                // step, so the wrapper log is always fresh. We also emit a
                // heartbeat every 30s as a belt-and-braces guarantee against
                // any single very long BuildKit step (e.g. base image pull).
                sh '''
                set -e

                export DOCKER_BUILDKIT=1
                export COMPOSE_DOCKER_CLI_BUILD=1
                export BUILDKIT_PROGRESS=plain

                docker compose down --remove-orphans || true

                # Background heartbeat so Jenkins always sees log activity,
                # even if a single BuildKit step is silent for minutes.
                ( while true; do echo "[heartbeat $(date -u +%H:%M:%S)] build in progress..."; sleep 30; done ) &
                HEARTBEAT_PID=$!
                trap 'kill $HEARTBEAT_PID 2>/dev/null || true' EXIT

                # Use the build cache for speed. Switch to --no-cache only when
                # you really need a clean rebuild (e.g. base-image security patch
                # or a stale pnpm/npm layer).
                docker compose build --progress=plain --pull

                kill $HEARTBEAT_PID 2>/dev/null || true
                trap - EXIT

                docker compose up -d

                docker image prune -f
                '''
            }
        }

        stage('Wait for Infra') {
            steps {
                sh '''
                # Postgres, Redis, and MinIO all ship native Docker healthchecks
                # in docker-compose.yml. Poll `docker inspect` until they flip to
                # "healthy" (or fail). Backend/frontend don't have compose-level
                # healthchecks — we poll those with wget in the next stage.

                wait_healthy() {
                    NAME=$1
                    echo "Waiting for ${NAME} to report healthy..."
                    for i in $(seq 1 60); do
                        STATUS=$(docker inspect -f '{{.State.Health.Status}}' "${NAME}" 2>/dev/null || echo "starting")

                        if [ "$STATUS" = "healthy" ]; then
                            echo "${NAME} is healthy."
                            return 0
                        fi

                        if [ "$STATUS" = "unhealthy" ]; then
                            echo "${NAME} reported unhealthy."
                            docker compose logs "${NAME#tskk-}" || true
                            return 1
                        fi

                        sleep 5
                    done

                    echo "${NAME} failed to become healthy within timeout."
                    docker compose logs "${NAME#tskk-}" || true
                    return 1
                }

                wait_healthy ${POSTGRES_CONTAINER}
                wait_healthy ${REDIS_CONTAINER}
                wait_healthy ${MINIO_CONTAINER}
                '''
            }
        }

        stage('Wait for App') {
            steps {
                sh '''
                # The backend serves an unauthenticated /health endpoint that's
                # intentionally excluded from the /api/v1 prefix (see main.ts).
                # The frontend just needs to return 200 on /.

                wait_http() {
                    NAME=$1
                    URL=$2
                    echo "Polling ${NAME} at ${URL} ..."
                    for i in $(seq 1 60); do
                        STATUS=$(docker exec "${NAME}" \
                            wget -q -S -O /dev/null "${URL}" 2>&1 \
                            | awk '/HTTP\\// {print $2; exit}')

                        if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
                            echo "${NAME} responded ${STATUS} — OK."
                            return 0
                        fi

                        sleep 5
                    done

                    echo "${NAME} did not respond 200 at ${URL} within timeout."
                    docker compose logs --tail=200 "${NAME#tskk-}" || true
                    return 1
                }

                wait_http ${BACKEND_CONTAINER}  http://127.0.0.1:${BACKEND_PORT}/health
                wait_http ${FRONTEND_CONTAINER} http://127.0.0.1:${FRONTEND_PORT}/
                '''
            }
        }

        stage('Smoke Test') {
            steps {
                sh '''
                set -e

                # We run smoke tests INSIDE the containers via `docker exec`
                # rather than from the Jenkins agent. Reason: when Jenkins
                # itself runs in a container, its 127.0.0.1 is its own
                # loopback — not the host where the app publishes 3000/4000.
                # Running inside the container side-steps all network
                # topology assumptions and uses each service's own listener.

                check_status() {
                    LABEL=$1
                    NAME=$2
                    URL=$3
                    EXPECTED=$4

                    STATUS=$(docker exec "${NAME}" \
                        wget -q -S -O /dev/null "${URL}" 2>&1 \
                        | awk '/HTTP\\// {print $2; exit}')

                    if [ "$STATUS" != "$EXPECTED" ]; then
                        echo "${LABEL} at ${URL} returned ${STATUS:-no-response} — expected ${EXPECTED}."
                        docker compose logs --tail=100 "${NAME#tskk-}" || true
                        exit 1
                    fi
                    echo "${LABEL} at ${URL} returned ${STATUS} — OK."
                }

                # ---- Backend ----
                # Liveness: process is up and answering.
                check_status "Backend /health"        ${BACKEND_CONTAINER} http://127.0.0.1:${BACKEND_PORT}/health       200
                # Readiness: also validates Postgres connectivity end-to-end.
                check_status "Backend /health/ready"  ${BACKEND_CONTAINER} http://127.0.0.1:${BACKEND_PORT}/health/ready 200
                # Swagger docs are always mounted at /docs — good regression check.
                check_status "Backend /docs"          ${BACKEND_CONTAINER} http://127.0.0.1:${BACKEND_PORT}/docs         200

                # ---- Frontend ----
                # Landing page.
                check_status "Frontend /"             ${FRONTEND_CONTAINER} http://127.0.0.1:${FRONTEND_PORT}/          200
                # Deep App Router route — verifies Next's routing (dashboard is
                # a real route under src/app/dashboard). A 200 here means the
                # Next server rendered the page (auth may render a login shell
                # for unauth users, but should still return 200).
                check_status "Frontend /dashboard"    ${FRONTEND_CONTAINER} http://127.0.0.1:${FRONTEND_PORT}/dashboard 200
                '''
            }
        }

        stage('Verify Containers') {
            steps {
                sh 'docker compose ps'
            }
        }
    }

    post {

        success {
            echo "Deployment Successful"
            echo "Frontend       : http://${VM_HOST}:${FRONTEND_PORT}"
            echo "Backend API    : http://${VM_HOST}:${BACKEND_PORT}/api/v1"
            echo "Backend Health : http://${VM_HOST}:${BACKEND_PORT}/health"
            echo "Swagger Docs   : http://${VM_HOST}:${BACKEND_PORT}/docs"
            echo "MinIO Console  : http://${VM_HOST}:9001"
            echo "Mailhog UI     : http://${VM_HOST}:8025"
        }

        failure {
            echo "Deployment Failed"
            sh '''
            docker compose logs --tail=200 || true
            docker compose ps              || true
            '''
        }

        always {
            sh 'docker ps -a'
        }
    }
}
