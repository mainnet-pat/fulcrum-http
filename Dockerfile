FROM node:18-slim

ADD . .
RUN yarn

CMD node index.mjs