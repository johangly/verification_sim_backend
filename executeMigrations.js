import { Umzug, SequelizeStorage } from 'umzug';

import db from './database/index.js';

const {sequelize} = db;

const umzug = new Umzug({
  migrations: { glob: 'migrations/*.ts' },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

(async () => {
  await umzug.up();
})();