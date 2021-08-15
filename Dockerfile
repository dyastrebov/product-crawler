FROM node:12-alpine3.14
RUN mkdir -p /app
WORKDIR /app

COPY . ./

RUN npm install
RUN npm run build

EXPOSE 5677

ENTRYPOINT node server/build