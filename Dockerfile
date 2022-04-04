FROM node:17 as BUILD

RUN npm install typescript -g
RUN git clone https://github.com/VolcanoCookies/ciam

WORKDIR /ciam

RUN npm install --include=dev
RUN tsc 

FROM node:17-alpine

WORKDIR /ciam
COPY --from=BUILD /ciam/dist /ciam

ENTRYPOINT [ "node" ]