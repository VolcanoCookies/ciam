FROM node:17 as BUILD

RUN echo "$GITHUB_TOKEN" > /key
ENV GIT_SSH_COMMAND="ssh -i /key -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"

RUN npm install typescript -g
RUN git clone git@github.com:VolcanoCookies/ciam.git

WORKDIR /ciam

RUN npm install --include=dev
RUN tsc 

FROM node:17-alpine

WORKDIR /ciam
COPY --from=BUILD /ciam/dist /ciam

ENTRYPOINT [ "node" ]