FROM node:22-alpine
WORKDIR /app
COPY agent.js operations.js ./
RUN mkdir /data && chown node:node /data
USER node
CMD ["node", "agent.js"]
