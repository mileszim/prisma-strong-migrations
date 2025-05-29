import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { Migration } from '../types';
import { SQLParser } from './sql-parser';
import type { DialectName } from 'sql-parser-cst';

export class MigrationScanner {
  private sqlParser: SQLParser;

  constructor(
    public dialect: DialectName,
  ) {
    this.sqlParser = new SQLParser(dialect);
  }

  async scanMigrations(migrationsPath: string, include?: string[], exclude?: string[]): Promise<Migration[]> {
    const migrationFiles = await this.findMigrationFiles(migrationsPath, include, exclude);
    const migrations: Migration[] = [];

    for (const filePath of migrationFiles) {
      try {
        const migration = await this.parseMigrationFile(filePath);
        migrations.push(migration);
      } catch (error) {
        console.warn(`Failed to parse migration file ${filePath}:`, error);
      }
    }

    return migrations;
  }

  async scanSingleMigration(filePath: string): Promise<Migration> {
    return this.parseMigrationFile(filePath);
  }

  private async findMigrationFiles(migrationsPath: string, include?: string[], exclude?: string[]): Promise<string[]> {
    // Default Prisma migration pattern
    const defaultPattern = path.join(migrationsPath, '**', 'migration.sql');
    
    const patterns = include?.length ? include.map(pattern => path.join(migrationsPath, pattern)) : [defaultPattern];
    
    const files: string[] = [];
    for (const pattern of patterns) {
      try {
        const matchedFiles = await new Promise<string[]>((resolve, reject) => {
          glob(pattern, { absolute: true }, (err, matches) => {
            if (err) reject(err);
            else resolve(matches);
          });
        });
        
        // Filter out excluded files manually
        const filteredFiles = exclude?.length 
          ? matchedFiles.filter(file => !exclude.some(ex => file.includes(ex)))
          : matchedFiles;
          
        files.push(...filteredFiles);
      } catch (_error) {
        // Skip patterns that don't match anything
        continue;
      }
    }

    // Remove duplicates and sort
    return [...new Set(files)].sort();
  }

  private async parseMigrationFile(filePath: string): Promise<Migration> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const filename = path.basename(path.dirname(filePath));
    
    // Extract migration ID from the directory name (Prisma format: YYYYMMDDHHMMSS_migration_name)
    const migrationId = filename.split('_')[0] || filename;

    const statements = this.sqlParser.parseStatements(content);

    return {
      id: migrationId,
      filename: path.relative(process.cwd(), filePath),
      content,
      statements
    };
  }

  async getRecentMigrations(migrationsPath: string, count: number = 1): Promise<Migration[]> {
    const migrations = await this.scanMigrations(migrationsPath);
    
    // Sort by migration ID (timestamp) in descending order
    migrations.sort((a, b) => b.id.localeCompare(a.id));
    
    return migrations.slice(0, count);
  }

  async getMigrationsSince(migrationsPath: string, sinceId: string): Promise<Migration[]> {
    const migrations = await this.scanMigrations(migrationsPath);
    
    // Sort by migration ID (timestamp) 
    migrations.sort((a, b) => a.id.localeCompare(b.id));
    
    const sinceIndex = migrations.findIndex(m => m.id === sinceId);
    if (sinceIndex === -1) {
      throw new Error(`Migration with ID ${sinceId} not found`);
    }
    
    return migrations.slice(sinceIndex + 1);
  }
} 