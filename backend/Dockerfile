FROM golang:1.24-bullseye AS builder

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download

COPY . .

RUN go build -o backend .

FROM golang:1.24-bullseye

WORKDIR /app

COPY --from=builder /app/backend /app/backend

# Set default environment variables
ENV OPERATOR_SDK_RUNNER_NAME operator-sdk-runner
ENV OPERATOR_SDK_RUNNER_NAMESPACE osdk
ENV OPERATOR_SDK_RUNNER_IMAGE operator-sdk:latest

EXPOSE 8080

CMD ["/app/backend"]
