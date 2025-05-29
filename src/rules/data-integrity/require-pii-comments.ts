import { Rule, Severity, RuleCategory, SQLStatement, Migration, Violation } from '../../types';

export const requirePiiCommentsRule: Rule = {
  id: 'require-pii-comments',
  name: 'Require PII Comments',
  description: 'Columns containing PII should have comments for compliance tracking',
  severity: Severity.INFO,
  category: RuleCategory.DATA_INTEGRITY,
  enabled: true,
  recommendation: 'Add COMMENT containing "PII" to columns that store personal information',
  check: (statement: SQLStatement, migration: Migration): Violation[] => {
    const violations: Violation[] = [];

    if (statement.type === 'CREATE_TABLE' || 
        (statement.type === 'ALTER_TABLE' && statement.content.toUpperCase().includes('ADD COLUMN'))) {
      
      const content = statement.content;
      const lines = content.split('\n');
      
      // Common PII column names
      const piiPatterns = [
        /\b(email|e_mail|email_address)\b/i,
        /\b(phone|telephone|mobile|cell)\b/i,
        /\b(address|street|city|zip|postal)\b/i,
        /\b(ssn|social_security|tax_id)\b/i,
        /\b(name|first_name|last_name|full_name)\b/i,
        /\b(dob|date_of_birth|birthday)\b/i,
        /\b(ip_address|mac_address)\b/i,
        /\b(passport|driver_license|license_number)\b/i,
        /\b(biometric|fingerprint)\b/i
      ];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check if line contains PII column name
        const containsPii = piiPatterns.some(pattern => pattern.test(line));
        
        if (containsPii && !line.toUpperCase().includes('COMMENT') && 
            !line.toUpperCase().includes('PII')) {
          violations.push({
            ruleId: 'require-pii-comments',
            ruleName: 'Require PII Comments',
            severity: Severity.INFO,
            message: 'Column appears to contain PII but lacks proper comment',
            line: statement.startLine + i,
            suggestion: 'Add COMMENT containing "PII" for compliance tracking',
            category: RuleCategory.DATA_INTEGRITY
          });
        }
      }
    }

    return violations;
  }
}; 