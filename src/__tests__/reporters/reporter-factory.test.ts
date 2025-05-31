import { ReporterFactory, Reporter } from '../../reporters';
import { TextReporter } from '../../reporters/text-reporter';
import { JsonReporter } from '../../reporters/json-reporter';
import { JunitReporter } from '../../reporters/junit-reporter';
import { OutputFormat } from '../../types';

describe('ReporterFactory', () => {
  describe('create', () => {
    it('should create TextReporter for TEXT format', () => {
      const reporter = ReporterFactory.create(OutputFormat.TEXT);
      
      expect(reporter).toBeInstanceOf(TextReporter);
    });

    it('should create JsonReporter for JSON format', () => {
      const reporter = ReporterFactory.create(OutputFormat.JSON);
      
      expect(reporter).toBeInstanceOf(JsonReporter);
    });

    it('should create JunitReporter for JUNIT format', () => {
      const reporter = ReporterFactory.create(OutputFormat.JUNIT);
      
      expect(reporter).toBeInstanceOf(JunitReporter);
    });

    it('should default to TextReporter for unknown format', () => {
      // Force an unknown format by casting
      const unknownFormat = 'unknown' as OutputFormat;
      const reporter = ReporterFactory.create(unknownFormat);
      
      expect(reporter).toBeInstanceOf(TextReporter);
    });

    it('should create reporters that implement Reporter interface', () => {
      const formats = [OutputFormat.TEXT, OutputFormat.JSON, OutputFormat.JUNIT];
      
      formats.forEach(format => {
        const reporter = ReporterFactory.create(format);
        expect(typeof reporter.format).toBe('function');
      });
    });

    it('should create different instances for each call', () => {
      const reporter1 = ReporterFactory.create(OutputFormat.TEXT);
      const reporter2 = ReporterFactory.create(OutputFormat.TEXT);
      
      expect(reporter1).not.toBe(reporter2);
      expect(reporter1).toBeInstanceOf(TextReporter);
      expect(reporter2).toBeInstanceOf(TextReporter);
    });
  });
}); 