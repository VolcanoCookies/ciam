FROM node:17

RUN find . -name "permission*"

COPY ./dist/* /ciam