FROM node:17 as BUILD

RUN npm install typescript -g

WORKDIR /ciam
COPY ./src src
COPY package-lock.json package-lock.json
COPY package.json package.json
COPY tsconfig.json tsconfig.json

RUN ls -la

RUN npm ci --include=dev
RUN tsc

FROM node:17-alpine

WORKDIR /ciam
COPY --from=BUILD /ciam/dist /ciam

ENTRYPOINT [ "node", "index.js" ]