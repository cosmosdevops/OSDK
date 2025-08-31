# Build stage
FROM golang:1.24-bullseye AS builder

RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/* \
    && curl -Lo /usr/local/bin/operator-sdk https://github.com/operator-framework/operator-sdk/releases/latest/download/operator-sdk_linux_amd64 \
    && chmod +x /usr/local/bin/operator-sdk

WORKDIR /app

COPY *.go ./
COPY go.mod ./

RUN go get -u github.com/gin-gonic/gin \
    && go get -u github.com/dave/dst/dstutil \
    && go get -u github.com/dave/dst/decorator


RUN go build -o server .

# Runtime
FROM golang:1.24-bullseye

WORKDIR /app

COPY --from=builder /app/server /app/server
COPY --from=builder /usr/local/bin/operator-sdk /usr/local/bin/operator-sdk

RUN mkdir /.cache 
RUN chmod -R 777 /.cache

EXPOSE 8080

CMD ["/app/server"]
