FROM node:20-slim

ADD . .
RUN yarn

CMD node index.mjs