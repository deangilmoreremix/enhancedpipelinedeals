// ts-jest wrapper: Jest runs CommonJS, so rewrite Vite's `import.meta.env` to `process.env`.
const { TsJestTransformer } = require('ts-jest');

class ImportMetaTransformer extends TsJestTransformer {
  process(sourceText, sourcePath, options) {
    const patched = sourceText
      .replace(/typeof import\.meta/g, '"undefined"')
      .replace(/import\.meta\.env/g, 'process.env')
      .replace(/import\.meta/g, '({ env: process.env })');
    return super.process(patched, sourcePath, options);
  }
  async processAsync(sourceText, sourcePath, options) {
    const patched = sourceText
      .replace(/typeof import\.meta/g, '"undefined"')
      .replace(/import\.meta\.env/g, 'process.env')
      .replace(/import\.meta/g, '({ env: process.env })');
    return super.processAsync(patched, sourcePath, options);
  }
}

module.exports = {
  createTransformer: (tsJestConfig) => new ImportMetaTransformer(tsJestConfig),
};
