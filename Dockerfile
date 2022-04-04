FROM node:17

RUN find . -name "Dockerfile"

COPY ./dist/* /ciam