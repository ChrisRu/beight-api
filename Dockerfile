FROM node:latest

WORKDIR /usr/app

COPY package.json .

RUN npm install --silent

COPY . .
