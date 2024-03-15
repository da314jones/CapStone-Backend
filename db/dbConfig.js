import pgPromise from 'pg-promise';

const pgp = pgPromise({});


const cn = {
    host: process.env.PG_HOST, 
    port: process.env.PG_PORT, 
    database: process.env.PG_DATABASE, 
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD
};

const db = pgp(cn);

export { db }
