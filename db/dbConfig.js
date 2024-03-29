import pgPromise from 'pg-promise';

import dotenv from "dotenv"
const pgp = pgPromise({});
dotenv.config()

const DATABASE_URL = process.env.DATABASE_URL
const cn = {
    databaseURL: process.env.DATABASE_UR,
    host: process.env.PG_HOST, 
    port: process.env.PG_PORT,
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD
}


const db = pgp(cn);

export { db }
