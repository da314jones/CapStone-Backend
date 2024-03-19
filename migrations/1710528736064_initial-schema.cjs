// /* eslint-disable camelcase */

// exports.shorthands = undefined;

// exports.up = pgm => {
//     pgm.createTable('users', {
//       id: 'id',
//       firstName: { type: 'varchar(255)' },
//       lastName: { type: 'varchar(255)' },
//       email: { type: 'varchar(255)', notNull: true, unique: true },
//       photo_url: { type: 'varchar(255)' },
//       firebase_uid: { type: 'varchar(255)', notNull: true, unique: true },
//       created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
//     });

//     pgm.createTable('videos', {
//         id: 'id',
//         user_id: { type: 'integer', references: '"users"', onDelete: 'cascade' },
//         title: { type: 'varchar(255)', notNull: true },
//         summary: { type: 'text' },
//         ai_summary: { type: 'text' },
//         video_url: { type: 'varchar(255)', notNull: true },
//         is_private: { type: 'boolean' },
//         duration: { type: 'integer', notNull: true },
//         created_at: { type: 'timestamp with time zone', default: pgm.func('current_timestamp') },
//         updated_at: { type: 'timestamp with time zone', default: pgm.func('current_timestamp') }
//       });
// };
// exports.down = pgm => {
//     pgm.dropTable('videos');
//     pgm.dropTable('users');

// };
