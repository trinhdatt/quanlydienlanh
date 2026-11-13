import 'reflect-metadata';
import 'dotenv/config';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';

class Initial1780000000000 implements MigrationInterface {
  async up(db: QueryRunner) {
    await db.query('CREATE TABLE accounts (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL)');
    await db.query("CREATE TABLE records (id INT AUTO_INCREMENT PRIMARY KEY, owner INT NOT NULL, kind VARCHAR(20) NOT NULL, title VARCHAR(200) NOT NULL, details VARCHAR(1000) NOT NULL, status VARCHAR(30) NOT NULL, appointment DATE NULL, customer INT NULL, equipment INT NULL, technician INT NULL, INDEX (owner, kind), FOREIGN KEY (owner) REFERENCES accounts(id), FOREIGN KEY (customer) REFERENCES records(id), FOREIGN KEY (equipment) REFERENCES records(id), FOREIGN KEY (technician) REFERENCES records(id))");
  }
  async down(db: QueryRunner) {
    await db.query('DROP TABLE records');
    await db.query('DROP TABLE accounts');
  }
}

class Management1780000000001 implements MigrationInterface {
  async up(db: QueryRunner) { await db.query('ALTER TABLE records ADD COLUMN metadata JSON NULL'); }
  async down(db: QueryRunner) { await db.query('ALTER TABLE records DROP COLUMN metadata'); }
}
export default new DataSource({
  type: 'mysql',
  url: process.env.DATABASE_URL,
  charset: 'utf8mb4',
  dateStrings: true,
  ssl: process.env.DB_CA ? { ca: process.env.DB_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true } : undefined,
  migrations: [Initial1780000000000, Management1780000000001],
});
