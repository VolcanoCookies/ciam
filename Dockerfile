FROM node:17

RUN find . -maxdepth 4 -type d -ls

COPY ./dist/* /ciam