# Use the official Node.js image as the base image
FROM node:24-bullseye AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the source code
COPY . .

ARG REACT_APP_API_URL=http://osdk-backend-osdk.apps-crc.testing
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Build the React application
RUN npm run build

# Use a minimal base image for the runtime
FROM nginxinc/nginx-unprivileged:alpine-perl

# Copy the built React app from the builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Update Nginx to listen on port 8080
RUN sed -i 's/listen       80;/listen       8080;/; s/listen  \[::\]:80;/listen  [::]:8080;/' /etc/nginx/conf.d/default.conf

# Expose the default Nginx port
EXPOSE 8080

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
