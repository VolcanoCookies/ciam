FROM node:17

RUN find . -maxdepth 2 -type d -ls

COPY ./dist/* /ciam