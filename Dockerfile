FROM node:17 as BUILD

RUN npm install typescript -g

RUN echo "$GITHUB_TOKEN" > /key && chmod 400 /key && cat /key
ENV GIT_SSH_COMMAND="ssh -i /key -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"
RUN git clone git@github.com:VolcanoCookies/ciam.git

WORKDIR /ciam

RUN npm install --include=dev
RUN tsc

FROM node:17-alpine

WORKDIR /ciam
COPY --from=BUILD /ciam/dist /ciam

ENTRYPOINT [ "node" ]