import { DialectName, parse } from 'sql-parser-cst';
import { SQLStatement } from '../types';

export class SQLParser {
  constructor(
    public dialect: DialectName,
  ) {}

  parseStatements(content: string): SQLStatement[] {
    const statements: SQLStatement[] = [];
    
    // Split content by semicolons, but be careful with strings and comments
    const rawStatements = this.splitSQLStatements(content);
    
    let lineNumber = 1;
    
    for (const rawStatement of rawStatements) {
      const trimmed = rawStatement.trim();
      
      // Skip empty statements or pure comment blocks
      if (!trimmed) {
        lineNumber += (rawStatement.match(/\n/g) || []).length;
        continue;
      }
      
      // Check if this is a pure comment (starts with -- and has no SQL)
      const lines = trimmed.split('\n');
      const sqlLines = lines.filter(line => {
        const lineTrimmed = line.trim();
        return lineTrimmed && !lineTrimmed.startsWith('--') && !lineTrimmed.startsWith('/*');
      });
      
      if (sqlLines.length === 0) {
        // This is a pure comment block, skip it
        lineNumber += (rawStatement.match(/\n/g) || []).length;
        continue;
      }
      
      // Extract just the SQL part (remove comment lines)
      const sqlContent = sqlLines.join('\n').trim();
      
      if (!sqlContent) {
        lineNumber += (rawStatement.match(/\n/g) || []).length;
        continue;
      }

      try {
        const ast = parse(sqlContent, { dialect: this.dialect });
        const statement: SQLStatement = {
          type: this.getStatementType(sqlContent),
          content: sqlContent,
          startLine: lineNumber,
          endLine: lineNumber + (rawStatement.match(/\n/g) || []).length,
          ast
        };
        statements.push(statement);
      } catch (error) {
        // If parsing fails, still create a statement for linting
        const statement: SQLStatement = {
          type: this.getStatementType(sqlContent),
          content: sqlContent,
          startLine: lineNumber,
          endLine: lineNumber + (rawStatement.match(/\n/g) || []).length,
          ast: null
        };
        statements.push(statement);
      }
      
      lineNumber += (rawStatement.match(/\n/g) || []).length;
    }
    
    return statements;
  }

  private splitSQLStatements(content: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    let inComment = false;
    let commentType = '';
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];
      
      // Handle comments
      if (!inString && !inComment) {
        if (char === '-' && nextChar === '-') {
          inComment = true;
          commentType = 'line';
          current += char;
          continue;
        }
        if (char === '/' && nextChar === '*') {
          inComment = true;
          commentType = 'block';
          current += char;
          continue;
        }
      }
      
      if (inComment) {
        current += char;
        if (commentType === 'line' && char === '\n') {
          inComment = false;
        } else if (commentType === 'block' && char === '*' && nextChar === '/') {
          current += nextChar;
          i++; // Skip the next character
          inComment = false;
        }
        continue;
      }
      
      // Handle strings
      if (!inString && (char === "'" || char === '"')) {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }
      
      if (inString) {
        current += char;
        if (char === stringChar && content[i - 1] !== '\\') {
          inString = false;
        }
        continue;
      }
      
      // Handle statement termination
      if (char === ';') {
        current += char;
        statements.push(current);
        current = '';
        continue;
      }
      
      current += char;
    }
    
    // Add remaining content if any
    if (current.trim()) {
      statements.push(current);
    }
    
    return statements;
  }

  private getStatementType(statement: string): string {
    const trimmed = statement.trim().toUpperCase();
    
    if (trimmed.startsWith('CREATE TABLE')) return 'CREATE_TABLE';
    if (trimmed.startsWith('ALTER TABLE')) return 'ALTER_TABLE';
    if (trimmed.startsWith('DROP TABLE')) return 'DROP_TABLE';
    if (trimmed.startsWith('CREATE INDEX')) return 'CREATE_INDEX';
    if (trimmed.startsWith('DROP INDEX')) return 'DROP_INDEX';
    if (trimmed.startsWith('INSERT')) return 'INSERT';
    if (trimmed.startsWith('UPDATE')) return 'UPDATE';
    if (trimmed.startsWith('DELETE')) return 'DELETE';
    if (trimmed.startsWith('SELECT')) return 'SELECT';
    if (trimmed.startsWith('CREATE')) return 'CREATE';
    if (trimmed.startsWith('DROP')) return 'DROP';
    if (trimmed.startsWith('ALTER')) return 'ALTER';
    
    return 'UNKNOWN';
  }
} 