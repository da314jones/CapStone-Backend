const db = require('dbConfig');
const bcrypt = require('bcrypt');

const createUser = async ({ email, password }) => {
    try {
    const hashedPassword = await bcrypt.hash(password, 10);
    return db.one('INSERT INTO users (email password) VALUES ($1, $2) RETURNING *', [email, hashedPassword])
} catch (error) {
    console.error('Error in createUser:', error);
    throw error;
}
};

const findUserByEmail = async (email) => {
    try {
        return db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
    } catch (error) {
        console.error(" in finUserByEmail:", error);
        throw error;
    }
};


module.exports = {
    createUser,
    findUserByEmail
}
