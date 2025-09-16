import { Umzug, SequelizeStorage } from 'umzug';

export default async function runMigrations(sequelize) {
  const umzug = new Umzug({
    migrations: { glob: 'migrations/*.ts' },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });

  await umzug.up().then(() => {
    console.log('Migrations completed successfully');
  }).catch((error) => {
    console.error('Error running migrations:', error);
  });
}