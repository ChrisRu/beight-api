# Beight Core
A collaborative web editor built with Node, PostgreSQL, Typescript, KoaJS, PassportJS and WS.
This is the backend/API for the Beight application. If you want the full experience, go to https://github.com/ChrisRu/beight-client and install the frontend.

# License
This application is MIT licensed

# Setup
1. Install Docker Compose

      If you don't have docker compose installed, follow the instructions on https://docs.docker.com/compose/install/

2. Configure the environment variables

      - Move or copy the `.env.example` file to just `.env`

      - Optionally configure the environment variables to your liking

3. Build the containers

      Start the build by running the following command inside the root folder:

      `docker-compose build`

4. Everything should work now :)

      Next up: running the dev server

# Running

1. Start the containers

      Start the containers by running the following command inside the root folder:

      `docker-compose up`

2. Done :)

      You can now edit the files and the server will automatically restart when a file changes.
      Press CTRL+C to exit.
